from datetime import date, datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, select

from ..auth import ClassAccess, class_access, request_now
from ..db import get_session
from ..limits import allow
from ..models import CardComment, CardThanks, DayCard, LabBlock, SubjectEntry, UpcomingItem
from ..schedule import ClassCalendar
from ..schemas import CardIn, CommentIn, CommentPatch, ItemIn, UpcomingPatch
from ..services import (
    DayState,
    iso_utc,
    member_brief,
    card_out,
    card_attribution,
    get_card,
    check_attachment_ids,
    items_out,
    iso_utc,
    member_names,
    member_brief,
    missed_days,
    publish_card,
    save_card,
    upcoming_query,
    week_bounds,
)

router = APIRouter(prefix="/api/classes/{code}")


COMMENT_LIMIT_PER_HOUR = 20
DEMO_COMMENT_LIMIT_PER_HOUR = 8


@router.get("/cards/{day}/feedback")
def feedback(day: date, access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    card = get_card(session, access.classroom.id, day)
    if card is None or card.status != "published":
        return {"thanks": 0, "thanked": False, "open_corrections": 0, "comments": []}
    comments = session.exec(
        select(CardComment)
        .where(CardComment.card_id == card.id, CardComment.deleted == False)  # noqa: E712
        .order_by(CardComment.created_at)
    ).all()
    authors = member_names(session, {c.member_id for c in comments})
    me = access.member
    thanks = session.exec(select(CardThanks).where(CardThanks.card_id == card.id)).all()
    return {
        "thanks": len(thanks),
        "thanked": me is not None and any(t.member_id == me.id for t in thanks),
        "open_corrections": sum(1 for c in comments if c.kind == "correction" and not c.resolved),
        "comments": [
            {
                "id": c.id,
                "kind": c.kind,
                "body": c.body,
                "resolved": c.resolved,
                "author": member_brief(authors.get(c.member_id)),
                "created_at": iso_utc(c.created_at),
                "mine": me is not None and c.member_id == me.id,
            }
            for c in comments
        ],
    }


@router.post("/cards/{day}/comments")
def add_comment(day: date, data: CommentIn, access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    me = access.require_member()
    card = _published(session, access.classroom.id, day)
    limit = DEMO_COMMENT_LIMIT_PER_HOUR if access.classroom.is_demo else COMMENT_LIMIT_PER_HOUR
    if not allow(f"comment:{me.id}", limit, 3600):
        raise HTTPException(429, "Troppi messaggi in poco tempo. Riprova tra un po'.")
    comment = CardComment(card_id=card.id, class_id=access.classroom.id, member_id=me.id, kind=data.kind, body=data.body)
    session.add(comment)
    session.commit()
    return {"ok": True}


def _published(session: Session, class_id: int, day: date) -> DayCard:
    card = get_card(session, class_id, day)
    if card is None or card.status != "published":
        raise HTTPException(404, "Giornata non pubblicata")
    return card


def _comment_in_class(session: Session, access: ClassAccess, comment_id: int) -> CardComment:
    comment = session.get(CardComment, comment_id)
    if comment is None or comment.class_id != access.classroom.id or comment.deleted:
        raise HTTPException(404, "Messaggio non trovato")
    return comment


@router.patch("/comments/{comment_id}")
def patch_comment(comment_id: int, data: CommentPatch, access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    me = access.require_member()
    comment = _comment_in_class(session, access, comment_id)
    card = session.get(DayCard, comment.card_id)
    if not (access.is_admin or (card and card.author_member_id == me.id)):
        raise HTTPException(403, "Solo chi ha scritto la giornata può segnare una correzione come vista")
    comment.resolved = data.resolved
    session.add(comment)
    session.commit()
    return {"ok": True}


@router.delete("/comments/{comment_id}")
def delete_comment(comment_id: int, access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    me = access.require_member()
    comment = _comment_in_class(session, access, comment_id)
    if not (access.is_admin or comment.member_id == me.id):
        raise HTTPException(403, "Puoi eliminare solo i tuoi messaggi")
    comment.deleted = True
    session.add(comment)
    session.commit()
    return {"ok": True}


@router.post("/cards/{day}/thanks")
def toggle_thanks(day: date, access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    me = access.require_member()
    card = _published(session, access.classroom.id, day)
    existing = session.exec(select(CardThanks).where(CardThanks.card_id == card.id, CardThanks.member_id == me.id)).first()
    if existing:
        session.delete(existing)
    else:
        session.add(CardThanks(card_id=card.id, member_id=me.id))
    session.commit()
    return {"ok": True}


@router.get("/cards")
def list_cards(
    request: Request,
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
    authors = member_names(session, {member_id for c in cards for member_id in (c.author_member_id, c.updated_by_member_id)})
    published = [
        {
            "day": c.day.isoformat(),
            **card_attribution(c, authors),
            "subjects": [e.subject_code for e in entries.get(c.id, []) if e.bullets or e.is_lab],
            "has_lab": any(e.is_lab for e in entries.get(c.id, [])),
            "items": item_counts.get(c.id, 0),
            "published_at": iso_utc(c.published_at),
            "missing": False,
        }
        for c in cards
    ]
    # Missed days stay listed so an admin can still recover them days later.
    cal = ClassCalendar(session, access.classroom)
    me = access.member
    missing = []
    for d, has_draft in missed_days(cal, request_now(request, access.classroom).date()).items():
        scribe = cal.scribe(d)[0] if me is not None and not access.is_admin else None
        missing.append({
            "day": d.isoformat(),
            "author": None,
            "updated_by": None,
            "subjects": [],
            "has_lab": False,
            "items": 0,
            "published_at": None,
            "missing": True,
            "has_draft": has_draft,
            "can_write": me is not None and (access.is_admin or (scribe is not None and scribe.id == me.id)),
        })
    return sorted(published + missing, key=lambda c: c["day"], reverse=True)


@router.get("/cards/{day}")
def get_card_page(day: date, request: Request, access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
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
    # The arrows also stop on missed school days, so a gap is never skipped silently.
    missed = list(missed_days(cal, now.date()))
    prev_missed = next((d for d in missed if d < day), None)
    next_missed = next((d for d in reversed(missed) if d > day), None)
    prev_pub = max(filter(None, (prev_pub, prev_missed)), default=None)
    next_pub = min(filter(None, (next_pub, next_missed)), default=None)
    return {
        "state": state.as_dict(),
        "card": card_out(session, card) if visible else None,
        "lessons": [b.as_dict(cal.hour_times()) for b in cal.lessons(day)],
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


@router.get("/subjects/{subject}/entries")
def subject_entries(
    subject: str,
    request: Request,
    range: Literal["week", "2weeks", "all"] = "2weeks",
    access: ClassAccess = Depends(class_access),
    session: Session = Depends(get_session),
):
    """Published blocks of one subject across days: catch up on a week of absence."""
    today = request_now(request, access.classroom).date()
    q = (
        select(SubjectEntry, DayCard)
        .join(DayCard, SubjectEntry.card_id == DayCard.id)
        .where(
            DayCard.class_id == access.classroom.id,
            DayCard.status == "published",
            SubjectEntry.subject_code == subject.upper(),
        )
        .order_by(DayCard.day.desc(), SubjectEntry.position)
    )
    if range != "all":
        q = q.where(DayCard.day >= today - timedelta(days=7 if range == "week" else 14))
    rows = session.exec(q.limit(80)).all()
    card_ids = {c.id for _, c in rows}
    labs = {}
    if rows:
        labs = {
            l.entry_id: l
            for l in session.exec(select(LabBlock).where(LabBlock.entry_id.in_([e.id for e, _ in rows]))).all()
        }
    items_by_card: dict[int, list] = {}
    if card_ids:
        items = session.exec(
            select(UpcomingItem).where(UpcomingItem.card_id.in_(card_ids), UpcomingItem.subject_code == subject.upper())
        ).all()
        for item, row in zip(items, items_out(session, list(items))):
            items_by_card.setdefault(item.card_id, []).append(row)
    authors = member_names(session, {member_id for _, c in rows for member_id in (c.author_member_id, c.updated_by_member_id)})
    out = []
    for e, c in rows:
        lab = labs.get(e.id)
        out.append({
            "day": c.day.isoformat(),
            **card_attribution(c, authors),
            "hours": e.hours,
            "room": e.room,
            "is_lab": e.is_lab,
            "lesson_status": e.lesson_status,
            "bullets": e.bullets or [],
            "lab": {"goal": lab.goal, "repo_url": lab.repo_url, "pitfall": lab.pitfall, "bring": lab.bring} if lab else None,
            "attachment_ids": e.attachment_ids or [],
            "items": items_by_card.pop(c.id, []),
        })
    return out


@router.get("/latest")
def latest_card(request: Request, before: Optional[date] = None, access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    """The previous school day before `before` (default: today) when nobody published it,
    otherwise the most recent published day. On Monday this is Friday."""
    now = request_now(request, access.classroom)
    limit_day = before or now.date()
    cal = ClassCalendar(session, access.classroom)
    prev = cal.prev_school_day(limit_day)
    missed = missed_days(cal, now.date())
    if prev in missed:
        return {"day": prev.isoformat(), "missing": True, "has_draft": missed[prev]}
    card = session.exec(
        select(DayCard)
        .where(DayCard.class_id == access.classroom.id, DayCard.status == "published", DayCard.day < limit_day)
        .order_by(DayCard.day.desc())
    ).first()
    return {"day": card.day.isoformat() if card else None, "missing": False, "has_draft": False}


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
