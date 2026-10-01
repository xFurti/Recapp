from datetime import date, datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, select

from ..auth import ClassAccess, class_access, request_now
from ..db import get_session
from ..models import DayCard, SubjectEntry, UpcomingItem
from ..schedule import ClassCalendar
from ..schemas import CardIn, ItemIn, UpcomingPatch
from ..services import (
    DayState,
    card_out,
    check_attachment_ids,
    items_out,
    iso_utc,
    member_names,
    member_brief,
    publish_card,
    save_card,
    upcoming_query,
    week_bounds,
)

router = APIRouter(prefix="/api/classes/{code}")


@router.get("/cards")
def list_cards(
    limit: int = 60,
    access: ClassAccess = Depends(class_access),
    session: Session = Depends(get_session),
):
    cards = session.exec(
        select(DayCard)
        .where(DayCard.class_id == access.classroom.id, DayCard.status == "published")
        .order_by(DayCard.day.desc())
        .limit(max(1, min(limit, 200)))
    ).all()
    ids = [c.id for c in cards]
    entries: dict[int, list[SubjectEntry]] = {}
    item_counts: dict[int, int] = {}
    if ids:
        for e in session.exec(select(SubjectEntry).where(SubjectEntry.card_id.in_(ids)).order_by(SubjectEntry.position)).all():
            entries.setdefault(e.card_id, []).append(e)
        for i in session.exec(select(UpcomingItem.card_id).where(UpcomingItem.card_id.in_(ids))).all():
            item_counts[i] = item_counts.get(i, 0) + 1
    authors = member_names(session, {c.author_member_id for c in cards})
    return [
        {
            "day": c.day.isoformat(),
            "author": member_brief(authors.get(c.author_member_id)),
            "subjects": [e.subject_code for e in entries.get(c.id, []) if e.bullets or e.is_lab],
            "has_lab": any(e.is_lab for e in entries.get(c.id, [])),
            "items": item_counts.get(c.id, 0),
            "published_at": iso_utc(c.published_at),
        }
        for c in cards
    ]


@router.get("/cards/{day}")
def get_card(day: date, request: Request, access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    now = request_now(request, access.classroom)
    cal = ClassCalendar(session, access.classroom)
    state = DayState(access, cal, day, now)
    card = state.card
    visible = card is not None and (card.status == "published" or state.can_write)
    prev_pub = session.exec(
        select(DayCard.day)
        .where(DayCard.class_id == access.classroom.id, DayCard.status == "published", DayCard.day < day)
        .order_by(DayCard.day.desc())
    ).first()
    next_pub = session.exec(
        select(DayCard.day)
        .where(DayCard.class_id == access.classroom.id, DayCard.status == "published", DayCard.day > day)
        .order_by(DayCard.day)
    ).first()
    return {
        "state": state.as_dict(),
        "card": card_out(session, card) if visible else None,
        "lessons": [b.as_dict() for b in cal.lessons(day)],
        "next_lessons": cal.next_lessons(day),
        "prev_published": prev_pub.isoformat() if prev_pub else None,
        "next_published": next_pub.isoformat() if next_pub else None,
    }


@router.put("/cards/{day}")
def put_card(day: date, data: CardIn, request: Request, access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    access.require_member()
    now = request_now(request, access.classroom)
    state = DayState(access, ClassCalendar(session, access.classroom), day, now)
    card = save_card(session, state, data)
    return card_out(session, card)


@router.post("/cards/{day}/publish")
def post_publish(day: date, request: Request, access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    access.require_member()
    now = request_now(request, access.classroom)
    state = DayState(access, ClassCalendar(session, access.classroom), day, now)
    card = publish_card(session, state)
    return card_out(session, card)


@router.get("/latest")
def latest_card(request: Request, before: Optional[date] = None, access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    """Most recent published day strictly before `before` (default: today).
    On Monday this is Friday's card."""
    now = request_now(request, access.classroom)
    limit_day = before or now.date()
    card = session.exec(
        select(DayCard)
        .where(DayCard.class_id == access.classroom.id, DayCard.status == "published", DayCard.day < limit_day)
        .order_by(DayCard.day.desc())
    ).first()
    return {"day": card.day.isoformat() if card else None}


# ---- upcoming ------------------------------------------------------------------
@router.get("/upcoming")
def upcoming(
    request: Request,
    type: Optional[str] = None,
    range: Literal["week", "next", "all", "past"] = "all",
    access: ClassAccess = Depends(class_access),
    session: Session = Depends(get_session),
):
    now = request_now(request, access.classroom)
    today = now.date()
    cid = access.classroom.id
    if range == "past":
        q = (
            select(UpcomingItem)
            .where(
                UpcomingItem.class_id == cid,
                UpcomingItem.status == "published",
                UpcomingItem.due_date < today,
                UpcomingItem.due_date >= today - timedelta(days=45),
            )
            .order_by(UpcomingItem.due_date.desc())
        )
    elif range == "week":
        q = upcoming_query(cid, today, week_bounds(today)[1])
    elif range == "next":
        start, end = week_bounds(today + timedelta(days=7))
        q = upcoming_query(cid, start, end)
    else:
        q = upcoming_query(cid, today, None)
    if type:
        q = q.where(UpcomingItem.type == type)
    items = session.exec(q).all()
    me = access.member
    out = items_out(session, list(items))
    for row, item in zip(out, items):
        row["can_edit"] = me is not None and (access.is_admin or item.author_member_id == me.id)
    return out


@router.post("/upcoming")
def add_upcoming(data: ItemIn, access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    me = access.require_member()
    if data.attachment_id:
        check_attachment_ids(session, access.classroom.id, [data.attachment_id])
    item = UpcomingItem(
        class_id=access.classroom.id,
        type=data.type,
        subject_code=data.subject_code or None,
        title=data.title,
        due_date=data.due_date,
        due_time=data.due_time,
        source=data.source,
        link=data.link,
        attachment_id=data.attachment_id,
        author_member_id=me.id,
        status="published",
    )
    session.add(item)
    session.commit()
    session.refresh(item)
    return items_out(session, [item])[0]


def _editable_item(session: Session, access: ClassAccess, item_id: int) -> UpcomingItem:
    me = access.require_member()
    item = session.get(UpcomingItem, item_id)
    if item is None or item.class_id != access.classroom.id:
        raise HTTPException(404, "Elemento non trovato")
    if not (access.is_admin or item.author_member_id == me.id):
        raise HTTPException(403, "Puoi modificare solo quello che hai scritto tu")
    return item


@router.patch("/upcoming/{item_id}")
def patch_upcoming(item_id: int, data: UpcomingPatch, access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    item = _editable_item(session, access, item_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    item.updated_at = datetime.now(timezone.utc)
    session.add(item)
    session.commit()
    session.refresh(item)
    return items_out(session, [item])[0]


@router.delete("/upcoming/{item_id}")
def delete_upcoming(item_id: int, access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    item = _editable_item(session, access, item_id)
    session.delete(item)
    session.commit()
    return {"ok": True}
