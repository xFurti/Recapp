"""Thanks leaderboard and the class publishing streak. Built from saved cards only."""

from datetime import date, timedelta

from sqlmodel import Session, func, select

from .models import CardThanks, Classroom, DayCard, Member
from .schedule import ClassCalendar
from .services import member_brief

RECENT_DAYS = 8


def concluded_school_day(today: date, published: set[date], cal: ClassCalendar) -> date | None:
    """Latest school day that already counts. Today stays out until it is published."""
    if cal.is_school_day(today):
        if today in published:
            return today
        return cal.prev_school_day(today)
    return cal.prev_school_day(today)


def streak_summary(today: date, published: set[date], cal: ClassCalendar) -> dict:
    start = concluded_school_day(today, published, cal)
    current = 0
    day = start
    while day is not None and day in published:
        current += 1
        day = cal.prev_school_day(day)

    record = 0
    run = 0
    if published:
        cursor = min(published)
        last = today
        while cursor <= last:
            if cal.is_school_day(cursor):
                if cursor in published:
                    run += 1
                    record = max(record, run)
                else:
                    run = 0
            cursor += timedelta(days=1)

    days: list[dict] = []
    if published and start is not None:
        day = start
        while day is not None and len(days) < RECENT_DAYS:
            days.append({"day": day.isoformat(), "published": day in published})
            day = cal.prev_school_day(day)

    return {
        "current": current,
        "record": record,
        "empty": not published,
        "days": days,
    }


def thanks_ranking(session: Session, classroom: Classroom) -> list[dict]:
    cid = classroom.id
    members = session.exec(select(Member).where(Member.class_id == cid)).all()
    member_ids = {m.id for m in members}
    counts = {
        author: total
        for author, total in session.exec(
            select(DayCard.author_member_id, func.count(CardThanks.id))
            .join(CardThanks, CardThanks.card_id == DayCard.id)
            .where(
                DayCard.class_id == cid,
                DayCard.status == "published",
                DayCard.author_member_id.is_not(None),
            )
            .group_by(DayCard.author_member_id)
        ).all()
        if author in member_ids
    }
    ordered = sorted(members, key=lambda m: (-counts.get(m.id, 0), m.nick.casefold()))
    ranking: list[dict] = []
    for index, member in enumerate(ordered):
        total = counts.get(member.id, 0)
        same = index > 0 and total == counts.get(ordered[index - 1].id, 0)
        rank = ranking[-1]["rank"] if same else index + 1
        ranking.append({
            "rank": rank,
            "thanks": total,
            "member": member_brief(member),
        })
    return ranking


def class_board(session: Session, classroom: Classroom, today: date) -> dict:
    published = set(
        session.exec(
            select(DayCard.day).where(DayCard.class_id == classroom.id, DayCard.status == "published")
        ).all()
    )
    cal = ClassCalendar(session, classroom)
    return {
        "streak": streak_summary(today, published, cal),
        "ranking": thanks_ranking(session, classroom),
    }
