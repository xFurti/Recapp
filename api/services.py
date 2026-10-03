from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, col, delete, func, select

from .auth import ClassAccess
from .models import (
    Attachment,
    Classroom,
    DayCard,
    LabBlock,
    Member,
    Subject,
    SubjectEntry,
    UpcomingItem,
)
from .schedule import ClassCalendar, takeover_open
from .schemas import CardIn, ItemIn

AVATAR_COLORS = ["#A02848", "#1898C8", "#80B830", "#E01058", "#8038B8", "#D99A00", "#0E7490", "#8A5A2B"]


def avatar_color(member: Member) -> str:
    return AVATAR_COLORS[(member.id or 0) % len(AVATAR_COLORS)]


def member_brief(member: Optional[Member]) -> Optional[dict]:
    if member is None:
        return None
    return {"id": member.id, "nick": member.nick, "color": avatar_color(member)}


def classroom_out(c: Classroom) -> dict:
    return {"code": c.code, "name": c.name, "label": c.label or c.name, "is_demo": c.is_demo}


def subjects_map(session: Session, class_id: int) -> dict[str, Subject]:
    return {s.code: s for s in session.exec(select(Subject).where(Subject.class_id == class_id)).all()}


def subject_out(s: Subject) -> dict:
    return {"code": s.code, "name_it": s.name_it, "name_en": s.name_en, "color": s.color}


def member_names(session: Session, ids: set[int]) -> dict[int, Member]:
    ids = {i for i in ids if i}
    if not ids:
        return {}
    return {m.id: m for m in session.exec(select(Member).where(col(Member.id).in_(ids))).all()}


# ---- items ---------------------------------------------------------------------
def item_out(item: UpcomingItem, members: dict[int, Member], card_days: dict[int, date] | None = None) -> dict:
    author = members.get(item.author_member_id) if item.author_member_id else None
    return {
        "id": item.id,
        "type": item.type,
        "subject_code": item.subject_code,
        "title": item.title,
        "due_date": item.due_date.isoformat(),
        "due_time": item.due_time,
        "source": item.source,
        "link": item.link,
        "attachment_id": item.attachment_id,
        "author": member_brief(author),
        "status": item.status,
        "card_day": (card_days or {}).get(item.card_id).isoformat() if item.card_id and card_days and item.card_id in card_days else None,
    }


def items_out(session: Session, items: list[UpcomingItem]) -> list[dict]:
    members = member_names(session, {i.author_member_id for i in items if i.author_member_id})
    card_ids = {i.card_id for i in items if i.card_id}
    card_days = {}
    if card_ids:
        card_days = {c.id: c.day for c in session.exec(select(DayCard).where(col(DayCard.id).in_(card_ids))).all()}
    return [item_out(i, members, card_days) for i in items]


# ---- cards ---------------------------------------------------------------------
def card_out(session: Session, card: DayCard) -> dict:
    entries = session.exec(
        select(SubjectEntry).where(SubjectEntry.card_id == card.id).order_by(SubjectEntry.position)
    ).all()
    labs = {}
    if entries:
        labs = {
            l.entry_id: l
            for l in session.exec(
                select(LabBlock).where(col(LabBlock.entry_id).in_([e.id for e in entries]))
            ).all()
        }
    items = session.exec(
        select(UpcomingItem)
        .where(UpcomingItem.card_id == card.id)
        .order_by(UpcomingItem.due_date, UpcomingItem.id)
    ).all()
    entry_attachments = {a for e in entries for a in (e.attachment_ids or [])}
    attachments = [
        a
        for a in session.exec(
            select(Attachment.id, Attachment.width, Attachment.height).where(Attachment.card_id == card.id)
        ).all()
        if a[0] not in entry_attachments
    ]
    members = member_names(session, {card.author_member_id, card.scribe_member_id})
    return {
        "id": card.id,
        "day": card.day.isoformat(),
        "status": card.status,
        "author": member_brief(members.get(card.author_member_id)),
        "scribe": member_brief(members.get(card.scribe_member_id)),
        "notes": card.notes,
        "revision": card.revision,
        "published_at": iso_utc(card.published_at),
        "updated_at": iso_utc(card.updated_at),
        "entries": [
            {
                "subject_code": e.subject_code,
                "hours": e.hours,
                "room": e.room,
                "is_lab": e.is_lab,
                "lesson_status": e.lesson_status,
                "bullets": e.bullets or [],
                "lab": (
                    {
                        "goal": labs[e.id].goal,
                        "repo_url": labs[e.id].repo_url,
                        "pitfall": labs[e.id].pitfall,
                        "bring": labs[e.id].bring,
                    }
                    if e.id in labs
                    else None
                ),
                "attachment_ids": e.attachment_ids or [],
            }
            for e in entries
        ],
        "items": items_out(session, list(items)),
        "attachments": [{"id": a[0], "width": a[1], "height": a[2]} for a in attachments],
    }


def iso_utc(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def get_card(session: Session, class_id: int, day: date) -> Optional[DayCard]:
    return session.exec(select(DayCard).where(DayCard.class_id == class_id, DayCard.day == day)).first()


class DayState:
    """Everything the UI needs to know about who writes a given school day."""

    def __init__(self, access: ClassAccess, cal: ClassCalendar, day: date, now: datetime):
        self.access = access
        self.cal = cal
        self.day = day
        self.now = now
        self.today = now.date()
        self.card = get_card(cal.session, cal.classroom.id, day)
        self.is_school_day = cal.is_school_day(day)
        self.scribe, self.override = cal.scribe(day) if self.is_school_day else (None, None)

    @property
    def me(self) -> Optional[Member]:
        return self.access.member

    @property
    def is_me_scribe(self) -> bool:
        return self.me is not None and self.scribe is not None and self.scribe.id == self.me.id

    @property
    def published(self) -> bool:
        return self.card is not None and self.card.status == "published"

    @property
    def taken_over(self) -> bool:
        return self.override is not None and self.override.reason == "takeover"

    @property
    def status(self) -> str:
        if not self.is_school_day:
            return "no_school"
        if self.published:
            return "published"
        if self.day > self.today:
            return "future"
        if self.scribe is None:
            return "open"
        if takeover_open(self.day, self.now) and not self.taken_over:
            return "open"
        if self.card is not None:
            return "draft"
        return "not_started"

    @property
    def can_write(self) -> bool:
        me = self.me
        if me is None or not self.is_school_day or self.day > self.today:
            return False
        if self.access.is_admin or self.is_me_scribe:
            return True
        # A draft belongs to the current scribe: after a takeover, pass or swap the
        # previous author loses it. Published days stay editable by their author.
        return self.published and self.card.author_member_id == me.id

    @property
    def can_takeover(self) -> bool:
        return (
            self.me is not None
            and self.status == "open"
            and not self.is_me_scribe
        )

    @property
    def can_pass(self) -> bool:
        return self.is_me_scribe and not self.published and self.day == self.today

    def as_dict(self) -> dict:
        return {
            "day": self.day.isoformat(),
            "is_school_day": self.is_school_day,
            "no_school_reason": "" if self.is_school_day else self.cal.no_school_reason(self.day),
            "status": self.status,
            "scribe": member_brief(self.scribe),
            "override_reason": self.override.reason if self.override else None,
            "is_me_scribe": self.is_me_scribe,
            "has_draft": self.card is not None and self.card.status == "draft",
            "can_write": self.can_write,
            "can_takeover": self.can_takeover,
            "can_pass": self.can_pass,
            "takeover_at": "18:00",
        }


def _item_fields(item: UpcomingItem, data: ItemIn) -> None:
    item.type = data.type
    item.subject_code = data.subject_code or None
    item.title = data.title
    item.due_date = data.due_date
    item.due_time = data.due_time
    item.source = data.source
    item.link = data.link
    item.attachment_id = data.attachment_id
    item.updated_at = datetime.now(timezone.utc)


def check_attachment_ids(session: Session, class_id: int, ids: list[int]) -> None:
    if not ids:
        return
    found = session.exec(
        select(func.count()).select_from(Attachment).where(
            col(Attachment.id).in_(ids), Attachment.class_id == class_id
        )
    ).one()
    if found != len(set(ids)):
        raise HTTPException(400, "Allegato non valido")


def conflict(session: Session, card: DayCard) -> HTTPException:
    session.rollback()
    session.refresh(card)
    return HTTPException(
        409,
        {
            "message": "Qualcuno ha modificato questa giornata mentre scrivevi",
            "card": card_out(session, card),
        },
    )


def all_attachment_ids(data: CardIn) -> list[int]:
    ids = list(data.attachment_ids)
    ids += [a for e in data.entries for a in e.attachment_ids]
    ids += [i.attachment_id for i in data.items if i.attachment_id]
    return ids


def save_card(session: Session, state: DayState, data: CardIn) -> DayCard:
    if not state.can_write:
        raise HTTPException(403, "Oggi non sei il verbalista di questa giornata")
    me = state.me
    assert me is not None
    classroom_id = state.cal.classroom.id
    check_attachment_ids(session, classroom_id, all_attachment_ids(data))

    card = state.card
    now = datetime.now(timezone.utc)
    if card is None:
        if data.revision not in (None, 0):
            raise HTTPException(409, {"message": "Questa giornata non esiste più: ricarica la pagina", "card": None})
        card = DayCard(
            class_id=classroom_id,
            day=state.day,
            status="draft",
            scribe_member_id=state.scribe.id if state.scribe else me.id,
            author_member_id=me.id,
            notes=data.notes.strip(),
            revision=1,
            updated_at=now,
        )
        session.add(card)
        try:
            session.flush()
        except IntegrityError:
            session.rollback()
            existing = get_card(session, classroom_id, state.day)
            if existing is None:
                raise
            raise conflict(session, existing)
    else:
        if data.revision is None:
            raise conflict(session, card)
        # Atomic compare-and-set: two saves based on the same revision cannot both win.
        result = session.execute(
            update(DayCard)
            .where(DayCard.id == card.id, DayCard.revision == data.revision)
            .values(
                revision=DayCard.revision + 1,
                author_member_id=me.id,
                notes=data.notes.strip(),
                updated_at=now,
            )
        )
        if result.rowcount != 1:
            raise conflict(session, card)
        session.expire(card)

    old_entries = session.exec(select(SubjectEntry.id).where(SubjectEntry.card_id == card.id)).all()
    if old_entries:
        session.exec(delete(LabBlock).where(col(LabBlock.entry_id).in_(old_entries)))
        session.exec(delete(SubjectEntry).where(SubjectEntry.card_id == card.id))
    for pos, e in enumerate(data.entries):
        entry = SubjectEntry(
            card_id=card.id,
            position=pos,
            subject_code=e.subject_code,
            hours=e.hours,
            room=e.room,
            is_lab=e.is_lab,
            lesson_status=e.lesson_status,
            bullets=[b for b in e.bullets if b],
            attachment_ids=list(dict.fromkeys(e.attachment_ids)),
        )
        session.add(entry)
        session.flush()
        if e.lab is not None and not e.lab.is_empty():
            session.add(LabBlock(entry_id=entry.id, **e.lab.model_dump()))

    existing = {
        i.id: i for i in session.exec(select(UpcomingItem).where(UpcomingItem.card_id == card.id)).all()
    }
    keep: set[int] = set()
    item_status = "published" if card.status == "published" else "draft"
    for it in data.items:
        if it.id and it.id in existing:
            item = existing[it.id]
            keep.add(it.id)
        else:
            item = UpcomingItem(
                class_id=classroom_id,
                card_id=card.id,
                author_member_id=me.id,
                status=item_status,
                type=it.type,
                title=it.title,
                due_date=it.due_date,
            )
        _item_fields(item, it)
        session.add(item)
    for item_id, item in existing.items():
        if item_id not in keep:
            session.delete(item)

    linked = set(data.attachment_ids) | {a for e in data.entries for a in e.attachment_ids}
    for att in session.exec(select(Attachment).where(Attachment.card_id == card.id)).all():
        if att.id not in linked:
            att.card_id = None
            session.add(att)
    for att_id in linked:
        att = session.get(Attachment, att_id)
        if att:
            att.card_id = card.id
            session.add(att)

    session.commit()
    session.refresh(card)
    return card


def has_content(session: Session, card: DayCard) -> bool:
    entries = session.exec(select(SubjectEntry).where(SubjectEntry.card_id == card.id)).all()
    if any(b.strip() for e in entries for b in (e.bullets or [])):
        return True
    if any(e.attachment_ids for e in entries):
        return True
    if entries:
        labs = session.exec(select(LabBlock).where(col(LabBlock.entry_id).in_([e.id for e in entries]))).all()
        if any(any(v.strip() for v in (l.goal, l.repo_url, l.pitfall, l.bring)) for l in labs):
            return True
    item = session.exec(select(UpcomingItem.id).where(UpcomingItem.card_id == card.id)).first()
    return item is not None


def publish_card(session: Session, state: DayState) -> DayCard:
    if not state.can_write:
        raise HTTPException(403, "Oggi non sei il verbalista di questa giornata")
    card = state.card
    if card is None:
        raise HTTPException(400, "Salva prima la giornata")
    if not has_content(session, card):
        raise HTTPException(422, "Scrivi almeno un punto, un blocco lab o un compito prima di pubblicare")
    now = datetime.now(timezone.utc)
    card.status = "published"
    card.published_at = card.published_at or now
    card.updated_at = now
    card.revision += 1
    session.add(card)
    for item in session.exec(select(UpcomingItem).where(UpcomingItem.card_id == card.id)).all():
        item.status = "published"
        session.add(item)
    session.commit()
    session.refresh(card)
    return card


def upcoming_query(class_id: int, start: date, end: Optional[date]):
    q = select(UpcomingItem).where(
        UpcomingItem.class_id == class_id,
        UpcomingItem.status == "published",
        UpcomingItem.due_date >= start,
    )
    if end is not None:
        q = q.where(UpcomingItem.due_date <= end)
    return q.order_by(UpcomingItem.due_date, UpcomingItem.due_time, UpcomingItem.id)


def week_bounds(today: date) -> tuple[date, date]:
    start = today - timedelta(days=today.weekday())
    return start, start + timedelta(days=6)
