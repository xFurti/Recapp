"""Real archive requests with more than 200 publications and repeated daily blocks."""
from datetime import date, timedelta

import pytest
from sqlmodel import Session, select

from api import db
from api.models import DayCard, SubjectEntry, UpcomingItem
from api.schedule import ClassCalendar

from .conftest import make_client
from .test_contributions import World, utc

NOW = {"X-Ieri-Now": "2027-06-15T10:00:00+02:00"}


@pytest.fixture(scope="module")
def history(app_client):
    world = World(date(2026, 9, 1))
    world.member("ada", role="admin")
    world.member("bea")
    world.days = {}
    world.entries = []
    world.items = []
    with Session(db.engine) as session:
        from api.models import Classroom
        room = session.get(Classroom, world.class_id)
        cal = ClassCalendar(session, room)
        for offset in range(287):
            day = date(2026, 9, 1) + timedelta(days=offset)
            published = offset % 7 != 0
            if published or offset % 3 == 0:
                card = DayCard(class_id=world.class_id, day=day, status="published" if published else "draft",
                               author_member_id=world.ids["ada"], published_at=utc(day, 15) if published else None)
                session.add(card)
                session.flush()
                for position in (0, 0, 2):
                    entry = SubjectEntry(card_id=card.id, subject_code="INI", position=position, bullets=[f"Lezione {day} · {position}"])
                    session.add(entry)
                    session.flush()
                    if published:
                        world.entries.append((day.isoformat(), position, entry.id))
                item = UpcomingItem(class_id=world.class_id, card_id=card.id, subject_code="INI", type="compito",
                                    title=f"Esercizi {day}", due_date=day, status="published" if published else "draft",
                                    author_member_id=world.ids["ada"])
                session.add(item)
                session.flush()
                if published:
                    world.items.append(item.id)
            if published or cal.is_school_day(day):
                world.days[day.isoformat()] = not published
        session.commit()
    world.entries.sort(key=lambda row: (-date.fromisoformat(row[0]).toordinal(), row[1], row[2]))
    return world


def pages(client, path, params=None):
    params = {"paged": "true", "range": "all", "limit": 17, **(params or {})}
    result = []
    seen = set()
    while True:
        response = client.get(path, params=params, headers=NOW)
        assert response.status_code == 200, response.text
        page = response.json()
        assert len(page["results"]) <= int(params["limit"])
        result.extend(page["results"])
        cursor = page["next_cursor"]
        if cursor is None:
            return result
        assert page["results"] and cursor not in seen
        seen.add(cursor)
        params["cursor"] = cursor


def test_entire_year_merges_publications_and_missing_days_in_one_page_budget(history):
    rows = pages(history.clients["ada"], f"{history.base}/cards")
    assert len([row for row in rows if not row["missing"]]) > 200
    assert [row["day"] for row in rows] == sorted(history.days, reverse=True)
    assert {row["day"]: row["missing"] for row in rows} == history.days
    assert all(row["can_write"] for row in rows if row["missing"])
    # Ordinary members see the same history, with their actual recovery permissions.
    member = pages(history.clients["bea"], f"{history.base}/cards", {"limit": 200})
    assert [row["day"] for row in member] == [row["day"] for row in rows]
    for row in member:
        if row["missing"]:
            state = history.clients["bea"].get(f"{history.base}/cards/{row['day']}", headers=NOW).json()["state"]
            assert row["can_write"] == state["can_write"]


def test_subject_reaches_every_block_with_tied_positions_and_no_repeated_items(history):
    rows = pages(history.clients["ada"], f"{history.base}/subjects/ini/entries", {"limit": 7})
    assert [row["id"] for row in rows] == [entry_id for _, _, entry_id in history.entries]
    assert len(rows) > 80 and len({row["id"] for row in rows}) == len(rows)
    item_ids = [item["id"] for row in rows for item in row["items"]]
    assert sorted(item_ids) == sorted(history.items)


@pytest.mark.parametrize("start,end", [("2026-12-01", "2026-12-31"), ("2027-01-07", "2027-02-12"), ("2026-09-01", "2026-09-01")])
def test_inclusive_period_is_shared_by_publications_gaps_and_subjects(history, start, end):
    params = {"from_date": start, "to_date": end, "limit": 3}
    days = pages(history.clients["ada"], f"{history.base}/cards", params)
    assert [row["day"] for row in days] == sorted((d for d in history.days if start <= d <= end), reverse=True)
    blocks = pages(history.clients["ada"], f"{history.base}/subjects/INI/entries", params)
    assert [row["id"] for row in blocks] == [entry_id for day, _, entry_id in history.entries if start <= day <= end]


def test_empty_period_and_terminal_cursor_are_explicit(history):
    for path in ("cards", "subjects/INI/entries"):
        response = history.clients["ada"].get(f"{history.base}/{path}", params={"paged": "true", "range": "all", "to_date": "2020-01-01"}, headers=NOW)
        assert response.json() == {"results": [], "next_cursor": None}
    assert history.clients["ada"].get(f"{history.base}/cards?paged=true&cursor=0001-01-01", headers=NOW).json() == {"results": [], "next_cursor": None}


def test_keyset_does_not_shift_after_a_new_publication_or_recovered_gap(history):
    client = history.clients["ada"]
    first = client.get(f"{history.base}/cards?paged=true&limit=10", headers=NOW).json()
    cursor = first["next_cursor"]
    with Session(db.engine) as session:
        card = DayCard(class_id=history.class_id, day=date(2027, 6, 15), status="published", author_member_id=history.ids["ada"])
        session.add(card)
        gap = next(row["day"] for row in first["results"] if row["missing"])
        old = session.exec(select(DayCard).where(DayCard.class_id == history.class_id, DayCard.day == date.fromisoformat(gap))).first()
        recovered = old or DayCard(class_id=history.class_id, day=date.fromisoformat(gap))
        recovered.status = "published"
        session.add(recovered)
        session.commit()
        try:
            remaining = pages(client, f"{history.base}/cards", {"cursor": cursor})
            assert [row["day"] for row in remaining] == sorted((d for d in history.days if d < cursor), reverse=True)
        finally:
            session.delete(card)
            if old:
                recovered.status = "draft"
                session.add(recovered)
            else:
                session.delete(recovered)
            session.commit()


def test_validation_and_class_isolation(history):
    client = history.clients["ada"]
    for path in ("cards", "subjects/INI/entries"):
        for suffix in ("limit=0", "limit=201", "from_date=2027-02-31", "from_date=2027-02-02&to_date=2027-01-01", "cursor=invalid"):
            assert client.get(f"{history.base}/{path}?paged=true&{suffix}", headers=NOW).status_code == 422
        assert make_client().get(f"{history.base}/{path}?paged=true", headers=NOW).status_code == 401
        other = World(date(2026, 9, 1))
        other.member("outsider")
        assert other.clients["outsider"].get(f"{history.base}/{path}?paged=true", headers=NOW).status_code == 403
    for cursor in ("2026-01-01|0|0", "2026-01-01|NaN|1", "2026-01-01|0|999999999999999999999999", "20260231|0|1"):
        assert client.get(f"{history.base}/subjects/INI/entries", params={"paged": "true", "cursor": cursor}, headers=NOW).status_code == 422
