import re
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, Request, Response
from itsdangerous import BadSignature, URLSafeTimedSerializer
from sqlmodel import Session, select

from .config import TZ, settings
from .db import get_session
from .models import Classroom, Member, Owner

COOKIE_NAME = "ieri_session"
SESSION_MAX_AGE = 60 * 60 * 24 * 30
MAX_ATTEMPTS = 5
LOCK_MINUTES = 15
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
PIN_RE = re.compile(r"^\d{6}$")

_serializer = URLSafeTimedSerializer(settings.secret_key, salt="ieri-session")


# ---- secrets -------------------------------------------------------------------
def hash_secret(value: str) -> str:
    return bcrypt.hashpw(value.encode(), bcrypt.gensalt(rounds=10)).decode()


def check_secret(value: str, hashed: Optional[str]) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(value.encode(), hashed.encode())
    except ValueError:
        return False


def random_code(n: int) -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(n))


def new_invite_code() -> str:
    return f"{random_code(4)}-{random_code(4)}"


def normalize_invite(value: str) -> str:
    raw = re.sub(r"[^A-Za-z0-9]", "", value).upper()
    return f"{raw[:4]}-{raw[4:]}" if len(raw) == 8 else raw


def new_class_code(name: str) -> str:
    base = re.sub(r"[^A-Za-z0-9]", "", name).upper()[:6] or "CLASSE"
    return f"{base}-{random_code(4)}"


def normalize_class_code(value: str) -> str:
    return value.strip().upper()


def validate_pin(pin: str) -> None:
    if not PIN_RE.match(pin or ""):
        raise HTTPException(422, "Il PIN deve avere 6 cifre")


# ---- lockout ---------------------------------------------------------------------
def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def ensure_not_locked(account: Member | Owner) -> None:
    locked = _aware(account.locked_until)
    if locked and locked > datetime.now(timezone.utc):
        minutes = max(1, int((locked - datetime.now(timezone.utc)).total_seconds() // 60) + 1)
        raise HTTPException(429, f"Troppi tentativi. Riprova tra {minutes} minuti.")


def register_failure(session: Session, account: Member | Owner) -> None:
    account.failed_attempts += 1
    if account.failed_attempts >= MAX_ATTEMPTS:
        account.failed_attempts = 0
        account.locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOCK_MINUTES)
    session.add(account)
    session.commit()


def register_success(session: Session, account: Member | Owner) -> None:
    account.failed_attempts = 0
    account.locked_until = None
    session.add(account)


# ---- sessions --------------------------------------------------------------------
def set_session_cookie(response: Response, kind: str, account_id: int, version: int) -> None:
    token = _serializer.dumps({"t": kind, "id": account_id, "v": version})
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=settings.secure_cookies,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


@dataclass
class Viewer:
    member: Optional[Member] = None
    owner: Optional[Owner] = None
    classroom: Optional[Classroom] = None  # the member's own class

    @property
    def is_owner(self) -> bool:
        return self.owner is not None

    @property
    def is_anonymous(self) -> bool:
        return self.member is None and self.owner is None


def get_viewer(request: Request, session: Session = Depends(get_session)) -> Viewer:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return Viewer()
    try:
        data = _serializer.loads(token, max_age=SESSION_MAX_AGE)
    except BadSignature:
        return Viewer()
    if data.get("t") == "m":
        member = session.get(Member, data.get("id"))
        if member and member.active and member.session_version == data.get("v"):
            return Viewer(member=member, classroom=session.get(Classroom, member.class_id))
    elif data.get("t") == "o":
        owner = session.get(Owner, data.get("id"))
        if owner and owner.session_version == data.get("v"):
            return Viewer(owner=owner)
    return Viewer()


def require_owner(viewer: Viewer = Depends(get_viewer)) -> Viewer:
    if not viewer.is_owner:
        raise HTTPException(401, "Accesso riservato alla scuola")
    return viewer


@dataclass
class ClassAccess:
    classroom: Classroom
    viewer: Viewer

    @property
    def member(self) -> Optional[Member]:
        return self.viewer.member

    @property
    def is_admin(self) -> bool:
        return self.viewer.member is not None and self.viewer.member.role == "admin"

    @property
    def can_manage(self) -> bool:
        return self.is_admin or self.viewer.is_owner

    def require_member(self) -> Member:
        if self.viewer.member is None:
            raise HTTPException(403, "Solo i partecipanti della classe possono farlo")
        return self.viewer.member

    def require_manage(self) -> None:
        if not self.can_manage:
            raise HTTPException(403, "Serve un admin della classe")

    def forbid_in_demo(self) -> None:
        """The public demo is shared by every visitor: no lasting admin changes."""
        if self.classroom.is_demo and not self.viewer.is_owner:
            raise HTTPException(403, "Non disponibile nella demo")


def get_classroom(session: Session, code: str) -> Classroom:
    classroom = session.exec(
        select(Classroom).where(Classroom.code == normalize_class_code(code))
    ).first()
    if classroom is None:
        raise HTTPException(404, "Classe non trovata")
    return classroom


def class_access(
    code: str,
    viewer: Viewer = Depends(get_viewer),
    session: Session = Depends(get_session),
) -> ClassAccess:
    classroom = get_classroom(session, code)
    if viewer.is_owner:
        return ClassAccess(classroom, viewer)
    if viewer.member is None:
        raise HTTPException(401, "Accedi alla classe")
    if viewer.member.class_id != classroom.id:
        raise HTTPException(403, "Non fai parte di questa classe")
    return ClassAccess(classroom, viewer)


def request_now(request: Request, classroom: Optional[Classroom] = None) -> datetime:
    """Current time in Europe/Rome. The X-Ieri-Now header can simulate another
    time in development and in the demo class, to show every state of the day."""
    raw = request.headers.get("x-ieri-now")
    if raw and (settings.is_dev or (classroom is not None and classroom.is_demo)):
        try:
            dt = datetime.fromisoformat(raw)
            return dt if dt.tzinfo else dt.replace(tzinfo=TZ)
        except ValueError:
            pass
    return datetime.now(TZ)
