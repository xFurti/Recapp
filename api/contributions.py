"""Contributi della classe: the collective streak of punctual days and the Grazie leaderboard.

Everything is computed from saved content with a handful of aggregate queries:
- the period is the school year; a day or an item counts when its *first publication*
  falls inside it, together with all of its Grazie;
- a school day extends the streak only if it was published by the end of that day in the
  class timezone. A late catch-up is shown as such and breaks the streak like a missed day;
- Grazie go to whoever published the day or added the item, never to oneself.
"""
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from typing import Optional

from sqlmodel import Session, func, select

from .auth import class_zone
from .models import CardThanks, Classroom, DayCard, ItemThanks, Member, UpcomingItem
from .schedule import ClassCalendar
from .school_data import SCHOOL_YEAR_END, SCHOOL_YEAR_START
from .services import member_brief, recap_start
from .thanks import counted_card_thanks, counted_item_thanks

RECENT_DAYS = 7


@dataclass(frozen=True)
class Period:
    start: date
    end: date  # inclusive
    zone: object

    @property
    def label(self) -> str:
        return f"{self.start.year}/{self.end.year % 100:02d}"

    def bounds(self) -> tuple[datetime, datetime]:
        """[start, end) in naive UTC, the format timestamps are stored and compared in."""
        begin = datetime.combine(self.start, time.min, tzinfo=self.zone)
        finish = datetime.combine(self.end + timedelta(days=1), time.min, tzinfo=self.zone)
        return _naive_utc(begin), _naive_utc(finish)

    def as_dict(self) -> dict:
        return {"kind": "school_year", "label": self.label, "start": self.start.isoformat(), "end": self.end.isoformat()}


def school_year(classroom: Classroom) -> Period:
    return Period(SCHOOL_YEAR_START, SCHOOL_YEAR_END, class_zone(classroom))


def _naive_utc(dt: datetime) -> datetime:
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def published_on_time(day: date, published_at: Optional[datetime], zone) -> bool:
    """Published before midnight at the end of its own day, class time. 18:00 only opens the takeover."""
    if published_at is None:
        return True  # no evidence of a late publication: never invent one
    deadline = datetime.combine(day + timedelta(days=1), time.min, tzinfo=zone)
    return _aware(published_at) < deadline


# ---- streak ---------------------------------------------------------------------------
def streak_summary(cal: ClassCalendar, now: datetime) -> dict:
    """Days are `published` (on time), `late` (caught up later), `missed`, or `today_open`.

    Weekends, holidays and days before the class joined Recapp are skipped: they neither
    extend nor break the streak. Today, until published, stays open and breaks nothing.
    """
    classroom = cal.classroom
    zone = class_zone(classroom)
    today = now.date()
    start = recap_start(cal)
    published: dict[date, Optional[datetime]] = {}
    if start <= today:
        published = dict(cal.session.exec(
            select(DayCard.day, DayCard.published_at).where(
                DayCard.class_id == classroom.id, DayCard.status == "published",
                DayCard.day >= start, DayCard.day <= today,
            )
        ).all())

    days: list[tuple[date, str]] = []
    d = start
    while d <= today:
        if cal.is_school_day(d):
            if d in published:
                status = "published" if published_on_time(d, published[d], zone) else "late"
            else:
                status = "today_open" if d == today else "missed"
            days.append((d, status))
        d += timedelta(days=1)

    # Today counts from the moment it is published on time; until then it is left out.
    counted = days[:-1] if days and days[-1][0] == today and days[-1][1] != "published" else days
    record = run = 0
    for _, status in counted:
        run = run + 1 if status == "published" else 0
        record = max(record, run)
    current = 0
    for _, status in reversed(counted):
        if status != "published":
            break
        current += 1
    return {
        "current": current,
        "record": record,
        "has_published": any(status in ("published", "late") for _, status in days),
        "today": today.isoformat(),
        "days": [{"day": day.isoformat(), "status": status} for day, status in days[-RECENT_DAYS:]],
    }


# ---- leaderboard ----------------------------------------------------------------------
def _grouped(session: Session, query) -> dict[int, int]:
    return {member_id: count for member_id, count in session.exec(query).all() if member_id is not None}


def leaderboard(session: Session, classroom: Classroom, viewer: Optional[Member], period: Period) -> dict:
    cid = classroom.id
    begin, end = period.bounds()
    card_in_period = (
        DayCard.class_id == cid, DayCard.status == "published",
        DayCard.published_at >= begin, DayCard.published_at < end,
    )
    item_in_period = (
        UpcomingItem.class_id == cid, UpcomingItem.status == "published",
        UpcomingItem.published_at >= begin, UpcomingItem.published_at < end,
    )
    days = _grouped(session, select(DayCard.author_member_id, func.count()).where(*card_in_period).group_by(DayCard.author_member_id))
    items = _grouped(session, select(UpcomingItem.author_member_id, func.count()).where(*item_in_period).group_by(UpcomingItem.author_member_id))
    card_thanks = _grouped(session, (
        select(DayCard.author_member_id, func.count(CardThanks.id))
        .join(CardThanks, CardThanks.card_id == DayCard.id)
        .where(*card_in_period, counted_card_thanks())
        .group_by(DayCard.author_member_id)
    ))
    item_thanks = _grouped(session, (
        select(UpcomingItem.author_member_id, func.count(ItemThanks.id))
        .join(ItemThanks, ItemThanks.item_id == UpcomingItem.id)
        .where(*item_in_period, counted_item_thanks())
        .group_by(UpcomingItem.author_member_id)
    ))
    # Members who left are not ranked; what they wrote and the Grazie they gave stay on the content.
    members = session.exec(select(Member).where(Member.class_id == cid, Member.active == True)).all()  # noqa: E712
    thanks = {m.id: card_thanks.get(m.id, 0) + item_thanks.get(m.id, 0) for m in members}
    # Role and rotation order give no advantage: Grazie first, then nickname, then a stable id.
    ordered = sorted(members, key=lambda m: (-thanks[m.id], m.nick.casefold(), m.id))
    totals = {"thanks": 0, "days_published": 0, "items_added": 0}
    rows = []
    for member in ordered:
        received = thanks[member.id]
        row = {
            "position": 1 + sum(1 for other in ordered if thanks[other.id] > received),
            "tied": sum(1 for other in ordered if thanks[other.id] == received) > 1,
            "member": member_brief(member),
            "thanks": received,
            "days_published": days.get(member.id, 0),
            "items_added": items.get(member.id, 0),
            "is_me": viewer is not None and viewer.id == member.id,
        }
        totals["thanks"] += row["thanks"]
        totals["days_published"] += row["days_published"]
        totals["items_added"] += row["items_added"]
        rows.append(row)
    return {"ranking": rows, "totals": totals}


def contributions(cal: ClassCalendar, viewer: Optional[Member], now: datetime) -> dict:
    period = school_year(cal.classroom)
    return {
        "period": period.as_dict(),
        "streak": streak_summary(cal, now),
        **leaderboard(cal.session, cal.classroom, viewer, period),
    }
