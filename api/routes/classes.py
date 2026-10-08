from datetime import date, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, col, delete, func, select

from ..auth import ClassAccess, class_access, hash_secret, new_invite_code, request_now
from ..config import settings
from ..db import get_session
from ..models import CardComment, DayCard, Member, ScribeOverride, Subject, TimetableSlot, UpcomingItem, utcnow
from ..schedule import ClassCalendar
from ..standings import class_board
from ..school_data import bell_hours, is_lab_room
from ..seed import DEMO_NICKS
from ..schemas import DayIn, MemberIn, MemberPatch, RotationOrderIn, SwapIn, TimetableIn
from ..services import (
    DayState,
    avatar_color,
    card_out,
    classroom_out,
    iso_utc,
    items_out,
    member_brief,
    subject_out,
    upcoming_query,
)

router = APIRouter(prefix="/api/classes/{code}")
DEMO_MAX_MEMBERS = 12


@router.get("")
def class_info(access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    subjects = session.exec(select(Subject).where(Subject.class_id == access.classroom.id)).all()
    me = access.member
    return {
        **classroom_out(access.classroom),
        "subjects": [subject_out(s) for s in subjects],
        "hours": bell_hours(access.classroom.hours),
        "viewer": {
            "kind": "owner" if access.viewer.is_owner else "member",
            "member": {"id": me.id, "nick": me.nick, "role": me.role, "color": avatar_color(me)} if me else None,
            "can_manage": access.can_manage,
            "read_only": me is None,
            "tour_seen": me is not None and me.tour_seen_at is not None,
        },
    }


@router.post("/tour")
def tour_seen(access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    """Remembers that this account finished or skipped the guided tour.
    Demo nicks are shared by every visitor, so the demo keeps this in the browser instead."""
    me = access.member
    if me is None or access.classroom.is_demo:
        return {"ok": True, "stored": False}
    if me.tour_seen_at is None:
        me.tour_seen_at = utcnow()
        session.add(me)
        session.commit()
    return {"ok": True, "stored": True}


# ---- today ---------------------------------------------------------------------
@router.get("/today")
def today(
    request: Request,
    day: Optional[date] = None,
    access: ClassAccess = Depends(class_access),
    session: Session = Depends(get_session),
):
    now = request_now(request, access.classroom)
    cal = ClassCalendar(session, access.classroom)
    target = day or now.date()
    state = DayState(access, cal, target, now)
    out = state.as_dict()
    out["now"] = now.isoformat()
    out["lessons"] = [b.as_dict(cal.hour_times()) for b in cal.lessons(target)]
    out["next_lessons"] = cal.next_lessons(target)
    card = state.card
    if card is not None and (card.status == "published" or state.can_write):
        out["card"] = card_out(session, card)
    else:
        out["card"] = None
    if card is not None and card.status == "draft":
        out["draft_updated_at"] = iso_utc(card.updated_at)
    nxt = cal.next_school_day(target)
    if nxt:
        scribe, _ = cal.scribe(nxt)
        out["next_school_day"] = {"day": nxt.isoformat(), "scribe": member_brief(scribe)}
    else:
        out["next_school_day"] = None
    soon = session.exec(upcoming_query(access.classroom.id, target, target + timedelta(days=3))).all()
    out["upcoming_soon"] = items_out(session, list(soon))
    out["open_corrections"] = 0
    if state.published and state.can_write:
        out["open_corrections"] = session.exec(
            select(func.count()).select_from(CardComment).where(
                CardComment.card_id == state.card.id,
                CardComment.kind == "correction",
                CardComment.resolved == False,  # noqa: E712
                CardComment.deleted == False,  # noqa: E712
            )
        ).one()
    return out


def _load_state(request: Request, access: ClassAccess, session: Session, day: Optional[date]) -> DayState:
    now = request_now(request, access.classroom)
    cal = ClassCalendar(session, access.classroom)
    return DayState(access, cal, day or now.date(), now)


def _reassign_draft(session: Session, class_id: int, day: date, member_id: Optional[int]) -> None:
    """A change of scribe invalidates editors opened by the previous one (revision bump)."""
    card = session.exec(select(DayCard).where(DayCard.class_id == class_id, DayCard.day == day)).first()
    if card is None or card.status == "published":
        return
    if member_id is not None:
        card.scribe_member_id = member_id
    card.revision += 1
    session.add(card)


def _set_override(session: Session, class_id: int, day: date, member_id: Optional[int], reason: str, by: Optional[int]) -> None:
    _reassign_draft(session, class_id, day, member_id)
    ov = session.exec(
        select(ScribeOverride).where(ScribeOverride.class_id == class_id, ScribeOverride.day == day)
    ).first()
    if ov is None:
        ov = ScribeOverride(class_id=class_id, day=day, reason=reason)
    ov.member_id = member_id
    ov.reason = reason
    ov.created_by = by
    session.add(ov)


@router.post("/today/takeover")
def takeover(request: Request, data: DayIn, access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    me = access.require_member()
    state = _load_state(request, access, session, data.day)
    if not state.can_takeover:
        raise HTTPException(409, "Il turno non è ancora libero")
    _set_override(session, access.classroom.id, state.day, me.id, "takeover", me.id)
    session.commit()
    return {"ok": True}


@router.post("/today/pass")
def pass_turn(request: Request, data: DayIn, access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    me = access.require_member()
    state = _load_state(request, access, session, data.day)
    if not state.can_pass:
        raise HTTPException(409, "Non sei il verbalista di oggi")
    _set_override(session, access.classroom.id, state.day, None, "pass", me.id)
    session.commit()
    return {"ok": True}


# ---- rotation ------------------------------------------------------------------
@router.get("/rotation")
def rotation(
    request: Request,
    days: int = 10,
    access: ClassAccess = Depends(class_access),
    session: Session = Depends(get_session),
):
    now = request_now(request, access.classroom)
    cal = ClassCalendar(session, access.classroom)
    days = max(1, min(days, 30))
    out = []
    d = now.date()
    school_count = 0
    guard = 0
    cards = {
        c.day: c.status
        for c in session.exec(
            select(DayCard).where(DayCard.class_id == access.classroom.id, DayCard.day >= d)
        ).all()
    }
    while school_count < days and guard < 90:
        guard += 1
        if cal.is_school_day(d):
            scribe, ov = cal.scribe(d)
            out.append({
                "day": d.isoformat(), "school": True, "scribe": member_brief(scribe),
                "override_reason": ov.reason if ov else None, "card_status": cards.get(d),
            })
            school_count += 1
        elif d.weekday() < 5:
            out.append({"day": d.isoformat(), "school": False, "reason": cal.no_school_reason(d)})
        d += timedelta(days=1)
    return {
        "days": out,
        "order": [member_brief(m) for m in cal.rotation],
        "not_activated": [member_brief(m) for m in cal.members if m.activated_at is None],
    }


@router.patch("/rotation/order")
def rotation_order(data: RotationOrderIn, access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    access.require_manage()
    access.forbid_in_demo()
    members = {
        m.id: m for m in session.exec(select(Member).where(Member.class_id == access.classroom.id)).all()
    }
    if any(mid not in members for mid in data.member_ids):
        raise HTTPException(400, "Partecipante non valido")
    for pos, mid in enumerate(data.member_ids):
        members[mid].rotation_order = pos
        session.add(members[mid])
    session.commit()
    return {"ok": True}


@router.post("/rotation/swap")
def rotation_swap(data: SwapIn, access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    access.require_manage()
    cal = ClassCalendar(session, access.classroom)
    if not (cal.is_school_day(data.day_a) and cal.is_school_day(data.day_b)) or data.day_a == data.day_b:
        raise HTTPException(400, "Scegli due giorni di scuola diversi")
    a, _ = cal.scribe(data.day_a)
    b, _ = cal.scribe(data.day_b)
    by = access.member.id if access.member else None
    _set_override(session, access.classroom.id, data.day_a, b.id if b else None, "swap" if b else "pass", by)
    _set_override(session, access.classroom.id, data.day_b, a.id if a else None, "swap" if a else "pass", by)
    session.commit()
    return {"ok": True}


# ---- timetable -----------------------------------------------------------------
@router.get("/board")
def board(request: Request, access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    """Thanks ranking and publishing streak. Members of this class only."""
    today = request_now(request, access.classroom).date()
    return class_board(session, access.classroom, today)


@router.get("/timetable")
def timetable(access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    slots = session.exec(
        select(TimetableSlot)
        .where(TimetableSlot.class_id == access.classroom.id)
        .order_by(TimetableSlot.weekday, TimetableSlot.hour)
    ).all()
    subjects = session.exec(select(Subject).where(Subject.class_id == access.classroom.id)).all()
    return {
        "hours": bell_hours(access.classroom.hours),
        "timezone": access.classroom.timezone or "Europe/Rome",
        "subjects": [subject_out(s) for s in subjects],
        "slots": [
            {"weekday": s.weekday, "hour": s.hour, "subject_code": s.subject_code, "room": s.room, "is_lab": s.is_lab}
            for s in slots
        ],
        "can_edit": access.can_manage,
    }


@router.put("/timetable")
def put_timetable(data: TimetableIn, access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    access.require_manage()
    access.forbid_in_demo()
    cid = access.classroom.id
    if data.subjects is not None:
        existing = {s.code: s for s in session.exec(select(Subject).where(Subject.class_id == cid)).all()}
        for s in data.subjects:
            row = existing.get(s.code.upper()) or Subject(class_id=cid, code=s.code.upper(), name_it="", name_en="", color="")
            row.name_it, row.name_en, row.color = s.name_it, s.name_en, s.color
            session.add(row)
        session.flush()
    codes = set(session.exec(select(Subject.code).where(Subject.class_id == cid)).all())
    seen = set()
    for s in data.slots:
        if s.subject_code.upper() not in codes:
            raise HTTPException(400, f"Materia sconosciuta: {s.subject_code}")
        if (s.weekday, s.hour) in seen:
            raise HTTPException(400, "Ora duplicata nell'orario")
        seen.add((s.weekday, s.hour))
    session.exec(delete(TimetableSlot).where(TimetableSlot.class_id == cid))
    for s in data.slots:
        session.add(
            TimetableSlot(
                class_id=cid, weekday=s.weekday, hour=s.hour, subject_code=s.subject_code.upper(),
                room=s.room.strip(), is_lab=is_lab_room(s.room) if s.is_lab is None else s.is_lab,
            )
        )
    if data.timezone:
        try:
            ZoneInfo(data.timezone)
        except Exception:
            raise HTTPException(400, "Fuso orario non valido")
        access.classroom.timezone = data.timezone
    if data.hours is not None:
        access.classroom.hours = [h.model_dump() for h in data.hours]
    session.add(access.classroom)
    session.commit()
    return {"ok": True}


# ---- members -------------------------------------------------------------------
def _join_url(code: str, member_id: int) -> str:
    return f"{settings.public_url}/c/{code}/entra?m={member_id}"


@router.get("/members")
def members(request: Request, access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    now = request_now(request, access.classroom)
    cal = ClassCalendar(session, access.classroom)
    today_scribe, _ = cal.scribe(now.date()) if cal.is_school_day(now.date()) else (None, None)
    written = dict(
        session.exec(
            select(DayCard.author_member_id, func.count())
            .where(DayCard.class_id == access.classroom.id, DayCard.status == "published")
            .group_by(DayCard.author_member_id)
        ).all()
    )
    items = dict(
        session.exec(
            select(UpcomingItem.author_member_id, func.count())
            .where(UpcomingItem.class_id == access.classroom.id, UpcomingItem.status == "published")
            .group_by(UpcomingItem.author_member_id)
        ).all()
    )
    rows = sorted(cal.members, key=lambda m: (m.rotation_order, m.id))
    return {
        "members": [
            {
                "id": m.id,
                "nick": m.nick,
                "role": m.role,
                "color": avatar_color(m),
                "activated": m.activated_at is not None,
                "needs_setup": m.pin_hash is None,
                "rotation_order": m.rotation_order,
                "is_today_scribe": today_scribe is not None and today_scribe.id == m.id,
                "days_written": written.get(m.id, 0),
                "items_added": items.get(m.id, 0),
                "is_me": access.member is not None and access.member.id == m.id,
            }
            for m in rows
        ],
        "can_manage": access.can_manage,
    }


@router.post("/members")
def add_member(data: MemberIn, access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    access.require_manage()
    cid = access.classroom.id
    if access.classroom.is_demo:
        active = session.exec(
            select(func.count()).select_from(Member).where(Member.class_id == cid, Member.active == True)  # noqa: E712
        ).one()
        if active >= DEMO_MAX_MEMBERS:
            raise HTTPException(403, "Nella demo si possono avere al massimo 12 partecipanti")
    existing = session.exec(select(Member).where(Member.class_id == cid, Member.nick == data.nick)).first()
    if existing and existing.active:
        raise HTTPException(409, "Nick già presente in classe")
    if data.role == "admin":
        access.require_staff()
    invite = new_invite_code()
    max_order = session.exec(select(func.max(Member.rotation_order)).where(Member.class_id == cid)).one() or 0
    if existing:
        member = existing
        member.active = True
        member.pin_hash = None
        member.session_version += 1
    else:
        member = Member(class_id=cid, nick=data.nick)
    member.role = data.role
    member.invite_hash = hash_secret(invite)
    member.rotation_order = max_order + 1
    session.add(member)
    session.commit()
    session.refresh(member)
    return {"member_id": member.id, "nick": member.nick, "invite": invite, "join_url": _join_url(access.classroom.code, member.id)}


def _get_member(session: Session, access: ClassAccess, member_id: int) -> Member:
    member = session.get(Member, member_id)
    if member is None or member.class_id != access.classroom.id or not member.active:
        raise HTTPException(404, "Partecipante non trovato")
    return member


def _admins_left(session: Session, class_id: int, excluding: int) -> int:
    return session.exec(
        select(func.count()).select_from(Member).where(
            Member.class_id == class_id, Member.role == "admin", Member.active == True,  # noqa: E712
            Member.id != excluding,
        )
    ).one()


@router.post("/members/{member_id}/reset-invite")
def reset_invite(member_id: int, access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    access.require_manage()
    member = _get_member(session, access, member_id)
    if member.nick in DEMO_NICKS:
        access.forbid_in_demo()
    invite = new_invite_code()
    member.invite_hash = hash_secret(invite)
    member.pin_hash = None
    member.failed_attempts = 0
    member.locked_until = None
    member.session_version += 1
    session.add(member)
    session.commit()
    return {"member_id": member.id, "nick": member.nick, "invite": invite, "join_url": _join_url(access.classroom.code, member.id)}


@router.patch("/members/{member_id}")
def patch_member(member_id: int, data: MemberPatch, access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    access.require_manage()
    access.forbid_in_demo()
    member = _get_member(session, access, member_id)
    if data.role and data.role != member.role:
        access.require_staff()
        if member.role == "admin" and _admins_left(session, access.classroom.id, member.id) == 0:
            raise HTTPException(409, "Serve almeno un admin nella classe")
        member.role = data.role
    session.add(member)
    session.commit()
    return {"ok": True}


@router.delete("/members/{member_id}")
def remove_member(member_id: int, access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    access.require_manage()
    access.forbid_in_demo()
    member = _get_member(session, access, member_id)
    if member.role == "admin":
        access.require_staff()
    if member.role == "admin" and _admins_left(session, access.classroom.id, member.id) == 0:
        raise HTTPException(409, "Serve almeno un admin nella classe")
    member.active = False
    member.session_version += 1
    member.invite_hash = None
    session.add(member)
    session.exec(
        delete(ScribeOverride).where(
            ScribeOverride.class_id == access.classroom.id,
            col(ScribeOverride.member_id) == member.id,
            ScribeOverride.day >= date.today(),
        )
    )
    session.commit()
    return {"ok": True}
