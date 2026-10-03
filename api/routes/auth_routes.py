from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlmodel import Session, select

from ..auth import (
    Viewer,
    check_secret,
    clear_session_cookie,
    ensure_not_locked,
    get_classroom,
    get_viewer,
    hash_secret,
    normalize_invite,
    register_failure,
    register_success,
    set_session_cookie,
    validate_pin,
)
from ..db import get_session
from ..limits import allow, client_ip
from ..models import Member, Owner
from ..schemas import ActivateIn, ChangePinIn, LoginIn, OwnerLoginIn
from ..seed import DEMO_CODE, ensure_demo
from ..services import avatar_color, classroom_out

router = APIRouter(prefix="/api")

IP_LIMIT = 40
IP_WINDOW = 600


def rate_limit(request: Request) -> None:
    if not allow(f"auth:{client_ip(request)}", IP_LIMIT, IP_WINDOW):
        raise HTTPException(429, "Troppi tentativi da questa rete. Riprova tra qualche minuto.")


def _member_in_class(session: Session, code: str, member_id: int) -> Member:
    classroom = get_classroom(session, code)
    member = session.get(Member, member_id)
    if member is None or member.class_id != classroom.id or not member.active:
        raise HTTPException(404, "Partecipante non trovato")
    return member


@router.get("/classes/{code}/public")
def class_public(code: str, session: Session = Depends(get_session)):
    classroom = get_classroom(session, code)
    members = session.exec(
        select(Member)
        .where(Member.class_id == classroom.id, Member.active == True)  # noqa: E712
        .order_by(Member.nick)
    ).all()
    return {
        **classroom_out(classroom),
        "members": [
            {"id": m.id, "nick": m.nick, "needs_setup": m.pin_hash is None, "color": avatar_color(m)}
            for m in members
        ],
    }


@router.post("/classes/{code}/activate", dependencies=[Depends(rate_limit)])
def activate(code: str, data: ActivateIn, response: Response, session: Session = Depends(get_session)):
    member = _member_in_class(session, code, data.member_id)
    ensure_not_locked(member)
    if member.invite_hash is None:
        raise HTTPException(409, "Questo nick è già attivo: accedi con il tuo PIN")
    validate_pin(data.pin)
    if not check_secret(normalize_invite(data.invite), member.invite_hash):
        register_failure(session, member)
        raise HTTPException(401, "Codice invito non valido")
    register_success(session, member)
    member.pin_hash = hash_secret(data.pin)
    member.invite_hash = None
    member.activated_at = member.activated_at or datetime.now(timezone.utc)
    session.add(member)
    session.commit()
    set_session_cookie(response, "m", member.id, member.session_version)
    return {"ok": True}


@router.post("/classes/{code}/login", dependencies=[Depends(rate_limit)])
def login(code: str, data: LoginIn, response: Response, session: Session = Depends(get_session)):
    member = _member_in_class(session, code, data.member_id)
    ensure_not_locked(member)
    if member.pin_hash is None:
        raise HTTPException(409, "Primo accesso: serve il codice invito")
    if not check_secret(data.pin, member.pin_hash):
        register_failure(session, member)
        raise HTTPException(401, "PIN errato")
    register_success(session, member)
    session.commit()
    set_session_cookie(response, "m", member.id, member.session_version)
    return {"ok": True}


@router.post("/auth/demo")
def demo_login(response: Response, session: Session = Depends(get_session)):
    classroom = ensure_demo(session)
    leo = session.exec(
        select(Member).where(Member.class_id == classroom.id, Member.nick == "leo")
    ).first()
    if leo is None:
        raise HTTPException(500, "Demo non disponibile")
    set_session_cookie(response, "m", leo.id, leo.session_version)
    return {"ok": True, "code": DEMO_CODE}


@router.post("/auth/logout")
def logout(response: Response):
    clear_session_cookie(response)
    return {"ok": True}


@router.post("/auth/change-pin", dependencies=[Depends(rate_limit)])
def change_pin(data: ChangePinIn, response: Response, viewer: Viewer = Depends(get_viewer), session: Session = Depends(get_session)):
    member = viewer.member
    if member is None:
        raise HTTPException(401, "Accedi alla classe")
    ensure_not_locked(member)
    if not check_secret(data.old_pin, member.pin_hash):
        register_failure(session, member)
        raise HTTPException(401, "PIN attuale errato")
    validate_pin(data.new_pin)
    member.pin_hash = hash_secret(data.new_pin)
    member.session_version += 1
    register_success(session, member)
    session.commit()
    set_session_cookie(response, "m", member.id, member.session_version)
    return {"ok": True}


@router.get("/me")
def me(viewer: Viewer = Depends(get_viewer)):
    if viewer.member is not None and viewer.classroom is not None:
        m = viewer.member
        return {
            "kind": "member",
            "member": {"id": m.id, "nick": m.nick, "role": m.role, "color": avatar_color(m)},
            "classroom": classroom_out(viewer.classroom),
        }
    if viewer.owner is not None:
        return {
            "kind": "owner",
            "owner": {"username": viewer.owner.username, "display_name": viewer.owner.display_name},
        }
    return {"kind": "anonymous"}


@router.post("/owner/login", dependencies=[Depends(rate_limit)])
def owner_login(data: OwnerLoginIn, response: Response, session: Session = Depends(get_session)):
    owner = session.exec(select(Owner).where(Owner.username == data.username.strip())).first()
    if owner is None:
        raise HTTPException(401, "Credenziali non valide")
    ensure_not_locked(owner)
    if not check_secret(data.password, owner.password_hash):
        register_failure(session, owner)
        raise HTTPException(401, "Credenziali non valide")
    register_success(session, owner)
    session.commit()
    set_session_cookie(response, "o", owner.id, owner.session_version)
    return {"ok": True}
