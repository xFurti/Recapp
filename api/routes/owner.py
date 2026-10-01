from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, func, select

from ..auth import Viewer, request_now, require_owner
from ..config import settings
from ..db import get_session
from ..models import Classroom, DayCard, Holiday, Member
from ..schemas import HolidayIn, OwnerClassIn
from ..seed import create_class
from ..services import classroom_out, week_bounds

router = APIRouter(prefix="/api/owner", dependencies=[Depends(require_owner)])


@router.get("/classes")
def owner_classes(request: Request, session: Session = Depends(get_session)):
    today = request_now(request).date()
    start, end = week_bounds(today)
    out = []
    for c in session.exec(select(Classroom).order_by(Classroom.is_demo, Classroom.name)).all():
        last = session.exec(
            select(DayCard.day)
            .where(DayCard.class_id == c.id, DayCard.status == "published")
            .order_by(DayCard.day.desc())
        ).first()
        week = session.exec(
            select(func.count()).select_from(DayCard).where(
                DayCard.class_id == c.id, DayCard.status == "published",
                DayCard.day >= start, DayCard.day <= end,
            )
        ).one()
        members = session.exec(
            select(Member).where(Member.class_id == c.id, Member.active == True)  # noqa: E712
        ).all()
        out.append({
            **classroom_out(c),
            "last_published": last.isoformat() if last else None,
            "published_this_week": week,
            "members_total": len(members),
            "members_active": sum(1 for m in members if m.activated_at is not None),
            "admins": [m.nick for m in members if m.role == "admin"],
        })
    return out


@router.post("/classes")
def owner_create_class(data: OwnerClassIn, session: Session = Depends(get_session)):
    classroom, admin, invite = create_class(session, data.name, data.label, data.admin_nick, data.timetable_from)
    return {
        **classroom_out(classroom),
        "admin": {"member_id": admin.id, "nick": admin.nick, "invite": invite},
        "join_url": f"{settings.public_url}/c/{classroom.code}/entra?m={admin.id}",
    }


@router.get("/holidays")
def holidays(session: Session = Depends(get_session)):
    rows = session.exec(select(Holiday).order_by(Holiday.day)).all()
    return [{"day": h.day.isoformat(), "label": h.label, "kind": h.kind} for h in rows]


@router.post("/holidays")
def add_holiday(data: HolidayIn, session: Session = Depends(get_session)):
    row = session.exec(select(Holiday).where(Holiday.day == data.day)).first() or Holiday(day=data.day, label="")
    row.label, row.kind = data.label, data.kind
    session.add(row)
    session.commit()
    return {"ok": True}


@router.delete("/holidays/{day}")
def delete_holiday(day: str, session: Session = Depends(get_session)):
    row = session.exec(select(Holiday).where(Holiday.day == datetime.fromisoformat(day).date())).first()
    if row is None:
        raise HTTPException(404, "Giorno non trovato")
    session.delete(row)
    session.commit()
    return {"ok": True}


@router.get("/me")
def owner_me(viewer: Viewer = Depends(require_owner)):
    return {"username": viewer.owner.username, "display_name": viewer.owner.display_name}
