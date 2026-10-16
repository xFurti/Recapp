"""Contributi della classe: Grazie on days and items, the leaderboard and the punctual streak."""
from datetime import date, datetime, time, timedelta, timezone
from uuid import uuid4
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from api import db
from api.auth import COOKIE_NAME, _serializer
from api.contributions import published_on_time
from api.models import CardThanks, Classroom, DayCard, ItemThanks, Member, ScribeOverride, Subject, SubjectEntry, UpcomingItem
from api.school_data import SCHOOL_YEAR_END, SCHOOL_YEAR_START

from .conftest import make_client
from .test_api import TODAY, at, demo_member, reset_demo

ROME = ZoneInfo("Europe/Rome")
# Rows written directly get a first publication inside the 2026/27 school year.
IN_PERIOD = datetime(2026, 10, 1, 12, tzinfo=timezone.utc)
# Publishing through the API stamps the real clock: period totals only make sense during the year.
IN_YEAR = SCHOOL_YEAR_START <= datetime.now(ROME).date() <= SCHOOL_YEAR_END
needs_school_year = pytest.mark.skipif(not IN_YEAR, reason="the calendar data covers school year 2026/27")


def utc(day: date, hour: int, minute: int = 0, zone=ROME) -> datetime:
    """A local class time, stored the way the app stores it (UTC)."""
    return datetime.combine(day, time(hour, minute), tzinfo=zone).astimezone(timezone.utc)


def now_at(day: date, hour: int, minute: int = 0) -> dict:
    return {"X-Ieri-Now": datetime.combine(day, time(hour, minute), tzinfo=ROME).isoformat()}


def member_client(member_id: int):
    c = make_client()
    c.cookies.set(COOKIE_NAME, _serializer.dumps({"t": "m", "id": member_id, "v": 1}))
    return c


def owner_client():
    c = make_client()
    assert c.post("/api/owner/login", json={"username": "preside", "password": "test-password"}).status_code == 200
    return c


class World:
    def __init__(self, created: date, tz: str = "Europe/Rome"):
        with Session(db.engine) as s:
            classroom = Classroom(
                code=f"CON-{uuid4().hex[:8].upper()}", name="4CT", is_demo=False, rotation_anchor=created,
                timezone=tz, created_at=utc(created, 8),
            )
            s.add(classroom)
            s.flush()
            s.add(Subject(class_id=classroom.id, code="INI", name_it="Informatica", name_en="Computer Science", color="#1898C8"))
            self.class_id = classroom.id
            self.code = classroom.code
            s.commit()
        self.ids: dict[str, int] = {}
        self.clients: dict[str, object] = {}

    @property
    def base(self) -> str:
        return f"/api/classes/{self.code}"

    def member(self, nick: str, role: str = "member", order: int = 5, active: bool = True) -> int:
        with Session(db.engine) as s:
            m = Member(class_id=self.class_id, nick=nick, role=role, rotation_order=order, active=active,
                       activated_at=datetime.now(timezone.utc))
            s.add(m)
            s.commit()
            self.ids[nick] = m.id
        if active:
            self.clients[nick] = member_client(m.id)
        return m.id

    def card(self, day: date, author: str, published_at: datetime | None, status: str = "published") -> int:
        with Session(db.engine) as s:
            card = DayCard(class_id=self.class_id, day=day, status=status, author_member_id=self.ids[author],
                           scribe_member_id=self.ids[author], published_at=published_at)
            s.add(card)
            s.flush()
            s.add(SubjectEntry(card_id=card.id, subject_code="INI", bullets=["API e database"]))
            s.commit()
            return card.id

    def item(self, author: str, title: str = "Esercizi", *, card_id: int | None = None, status: str = "published",
             published_at: datetime | None = None, due: date | None = None) -> int:
        with Session(db.engine) as s:
            item = UpcomingItem(class_id=self.class_id, card_id=card_id, type="compito", subject_code="INI", title=title,
                                due_date=due or TODAY + timedelta(days=3), author_member_id=self.ids[author], status=status,
                                published_at=published_at if published_at or status != "published" else IN_PERIOD)
            s.add(item)
            s.commit()
            return item.id

    def thank_item(self, nick: str, item_id: int, expected: int = 200):
        r = self.clients[nick].post(f"{self.base}/upcoming/{item_id}/thanks")
        assert r.status_code == expected, r.text
        return r.json()

    def thank_day(self, nick: str, day: date, expected: int = 200):
        r = self.clients[nick].post(f"{self.base}/cards/{day}/thanks")
        assert r.status_code == expected, r.text
        return r.json()

    def contributions(self, nick: str = "ada", headers: dict | None = None) -> dict:
        r = self.clients[nick].get(f"{self.base}/contributions", headers=headers or {})
        assert r.status_code == 200, r.text
        return r.json()


def by_nick(data: dict) -> dict[str, dict]:
    return {row["member"]["nick"]: row for row in data["ranking"]}


# ---- streak ------------------------------------------------------------------------------
def statuses(data: dict) -> dict[str, str]:
    return {d["day"]: d["status"] for d in data["streak"]["days"]}


def test_streak_counts_only_punctual_school_days_and_skips_holidays(client):
    # Mon 30 Nov 2026 .. Thu 10 Dec 2026; 7 and 8 December are a bridge and a public holiday.
    w = World(date(2026, 11, 30))
    w.member("ada")
    w.card(date(2026, 11, 30), "ada", utc(date(2026, 11, 30), 15))
    w.card(date(2026, 12, 1), "ada", utc(date(2026, 12, 1), 18, 40))  # after the 18:00 takeover: still on time
    w.card(date(2026, 12, 2), "ada", utc(date(2026, 12, 2), 23, 59))
    # 00:30 in Rome is still 3 December in UTC: lateness is judged in the class timezone.
    w.card(date(2026, 12, 3), "ada", utc(date(2026, 12, 4), 0, 30))
    w.card(date(2026, 12, 4), "ada", utc(date(2026, 12, 4), 14))
    w.card(date(2026, 12, 9), "ada", utc(date(2026, 12, 9), 16))

    data = w.contributions(headers=now_at(date(2026, 12, 10), 10))
    streak = data["streak"]
    assert statuses(data) == {
        "2026-11-30": "published", "2026-12-01": "published", "2026-12-02": "published", "2026-12-03": "late", "2026-12-04": "published",
        "2026-12-09": "published", "2026-12-10": "today_open",
    }, "last seven school days; weekend and holidays are skipped, not missed"
    assert streak["current"] == 2, "today still open: count from Wednesday back across the holidays to Friday"
    assert streak["record"] == 3, "Mon-Wed; the late Thursday breaks the run like a missed day"
    assert streak["has_published"] is True

    # Still open late in the evening: 18:00 is the takeover, not the deadline.
    assert w.contributions(headers=now_at(date(2026, 12, 10), 23, 30))["streak"]["current"] == 2

    # Published today on time: the count starts from today.
    w.card(date(2026, 12, 10), "ada", utc(date(2026, 12, 10), 10, 30))
    data = w.contributions(headers=now_at(date(2026, 12, 10), 11))
    assert data["streak"]["current"] == 3 and data["streak"]["record"] == 3
    assert statuses(data)["2026-12-10"] == "published"

    # The next school day: yesterday published, today not yet.
    data = w.contributions(headers=now_at(date(2026, 12, 11), 9))
    assert data["streak"]["current"] == 3 and statuses(data)["2026-12-11"] == "today_open"

    # Saturday: no school today, the streak is read from Friday, which nobody published.
    data = w.contributions(headers=now_at(date(2026, 12, 12), 9))
    assert statuses(data)["2026-12-11"] == "missed" and data["streak"]["current"] == 0
    assert data["streak"]["record"] == 3


def test_late_catch_up_never_recomposes_the_streak(client):
    w = World(date(2026, 10, 12))
    w.member("ada")
    w.card(date(2026, 10, 12), "ada", utc(date(2026, 10, 12), 15))
    w.card(date(2026, 10, 14), "ada", utc(date(2026, 10, 14), 15))
    headers = now_at(date(2026, 10, 15), 9)
    data = w.contributions(headers=headers)
    assert statuses(data)["2026-10-13"] == "missed" and data["streak"]["current"] == 1
    # Recovering Tuesday on Thursday fills the archive but not the streak.
    w.card(date(2026, 10, 13), "ada", utc(date(2026, 10, 15), 8, 45))
    data = w.contributions(headers=headers)
    assert statuses(data)["2026-10-13"] == "late"
    assert data["streak"]["current"] == 1 and data["streak"]["record"] == 1


def test_streak_zero_state_ignores_days_before_recapp_and_restarts_at_one(client):
    w = World(date(2026, 10, 7))
    w.member("ada")
    # Imported before the class joined Recapp: not an expected day, it neither counts nor breaks.
    w.card(date(2026, 10, 5), "ada", utc(date(2026, 10, 5), 15))
    data = w.contributions(headers=now_at(date(2026, 10, 7), 9))
    assert data["streak"] == {"current": 0, "record": 0, "has_published": False, "today": "2026-10-07",
                              "days": [{"day": "2026-10-07", "status": "today_open"}]}
    # Today published while yesterday was missed: the streak is one.
    w.card(date(2026, 10, 8), "ada", utc(date(2026, 10, 8), 15))
    data = w.contributions(headers=now_at(date(2026, 10, 8), 16))
    assert statuses(data) == {"2026-10-07": "missed", "2026-10-08": "published"}
    assert data["streak"]["current"] == 1 and data["streak"]["record"] == 1


def test_lateness_follows_the_class_timezone():
    tokyo = ZoneInfo("Asia/Tokyo")
    day = date(2026, 10, 14)
    # 23:30 in Tokyo on the 14th is still the afternoon of the 14th in Rome, and vice versa.
    assert published_on_time(day, utc(day, 23, 30, tokyo), tokyo)
    assert not published_on_time(day, utc(day + timedelta(days=1), 0, 5, tokyo), tokyo)
    assert not published_on_time(day, utc(day, 23, 30, ROME), tokyo), "the 14th is over in Tokyo"
    assert published_on_time(day, utc(day, 23, 30, ROME).replace(tzinfo=None), ROME), "naive values are UTC"
    assert published_on_time(day, None, ROME), "no timestamp is not evidence of lateness"


# ---- Grazie on items ----------------------------------------------------------------------
@pytest.fixture
def world(client):
    w = World(TODAY - timedelta(days=30))
    for nick, role, order in [("ada", "member", 3), ("bea", "member", 2), ("cid", "member", 1), ("dan", "admin", 0)]:
        w.member(nick, role, order)
    return w


def item_row(w: World, nick: str, item_id: int) -> dict:
    rows = w.clients[nick].get(f"{w.base}/upcoming").json()
    return next(r for r in rows if r["id"] == item_id)


def test_item_thanks_toggle_unique_and_same_counter_everywhere(world):
    w = world
    card_id = w.card(TODAY, "ada", IN_PERIOD)
    item_id = w.item("ada", "Esercizi 1-5", card_id=card_id, due=TODAY + timedelta(days=1))

    first = w.thank_item("bea", item_id)
    assert first == {"ok": True, "thanks": 1, "thanked": True}
    assert w.thank_item("cid", item_id)["thanks"] == 2
    row = item_row(w, "bea", item_id)
    assert (row["thanks"], row["thanked"], row["can_thank"]) == (2, True, True)
    own = item_row(w, "ada", item_id)
    assert (own["thanks"], own["thanked"], own["can_thank"]) == (2, False, False), "authors see the count, read-only"

    # The same item inside the day, on Today, in the day page and by subject: one counter.
    headers = at(10)
    today = w.clients["bea"].get(f"{w.base}/today", headers=headers).json()
    page = w.clients["bea"].get(f"{w.base}/cards/{TODAY}", headers=headers).json()
    subject = w.clients["bea"].get(f"{w.base}/subjects/INI/entries", headers=headers).json()
    surfaces = [
        next(i for i in today["upcoming_soon"] if i["id"] == item_id),
        next(i for i in today["card"]["items"] if i["id"] == item_id),
        next(i for i in page["card"]["items"] if i["id"] == item_id),
    ]
    surfaces.append(next(i for e in subject for i in e["items"] if i["id"] == item_id))
    assert all((s["thanks"], s["thanked"]) == (2, True) for s in surfaces)

    # Toggle back: the Grazie is withdrawn.
    assert w.thank_item("bea", item_id) == {"ok": True, "thanks": 1, "thanked": False}
    assert w.thank_item("bea", item_id)["thanked"] is True
    with Session(db.engine) as s:
        assert len(s.exec(select(ItemThanks).where(ItemThanks.item_id == item_id)).all()) == 2
        s.add(ItemThanks(item_id=item_id, member_id=w.ids["bea"]))
        with pytest.raises(IntegrityError):
            s.commit()


def test_item_thanks_access_rules(world):
    w = world
    published = w.item("ada")
    draft = w.item("ada", "Bozza", status="draft")
    w.thank_item("ada", published, 403)  # never to yourself
    w.thank_item("bea", draft, 404)
    w.thank_item("bea", 999_999, 404)

    other = World(TODAY - timedelta(days=30))
    other.member("eva")
    foreign = other.item("eva", "Altra classe")
    w.thank_item("bea", foreign, 404)  # an id from another class, through this class
    assert w.clients["bea"].post(f"{other.base}/upcoming/{foreign}/thanks").status_code == 403
    assert w.clients["bea"].get(f"{other.base}/contributions").status_code == 403

    anonymous = make_client()
    assert anonymous.post(f"{w.base}/upcoming/{published}/thanks").status_code == 401
    assert anonymous.get(f"{w.base}/contributions").status_code == 401
    school = owner_client()
    assert school.post(f"{w.base}/upcoming/{published}/thanks").status_code == 403
    read_only = school.get(f"{w.base}/contributions")
    assert read_only.status_code == 200 and not any(r["is_me"] for r in read_only.json()["ranking"])
    assert item_row(w, "dan", published)["can_thank"] is True
    rows = school.get(f"{w.base}/upcoming").json()
    assert next(r for r in rows if r["id"] == published)["can_thank"] is False
    # Nothing about Grazie before login or on the public join page.
    public = anonymous.get(f"{w.base}/public").json()
    assert "thanks" not in str(public) and "ranking" not in public


# ---- Grazie on days -------------------------------------------------------------------------
def test_day_thanks_reject_self_and_ignore_legacy_self_thanks(world):
    w = world
    day = TODAY - timedelta(days=1)
    card_id = w.card(day, "ada", IN_PERIOD)
    with Session(db.engine) as s:
        s.add(CardThanks(card_id=card_id, member_id=w.ids["ada"]))  # saved before the rule existed
        s.commit()
    w.thank_day("ada", day, 403)
    feedback = w.clients["ada"].get(f"{w.base}/cards/{day}/feedback").json()
    assert (feedback["thanks"], feedback["thanked"], feedback["can_thank"]) == (0, False, False)
    assert w.thank_day("bea", day) == {"ok": True, "thanks": 1, "thanked": True}
    feedback = w.clients["bea"].get(f"{w.base}/cards/{day}/feedback").json()
    assert (feedback["thanks"], feedback["thanked"], feedback["can_thank"]) == (1, True, True)
    assert by_nick(w.contributions())["ada"]["thanks"] == 1
    with Session(db.engine) as s:
        assert len(s.exec(select(CardThanks).where(CardThanks.card_id == card_id)).all()) == 2, "legacy rows are kept"


# ---- leaderboard -----------------------------------------------------------------------------
def test_leaderboard_ties_order_inactive_members_and_period(world):
    w = world
    w.member("Eli", active=False)  # left the class: content and given Grazie stay, row does not
    now = IN_PERIOD

    empty = w.contributions()
    assert empty["totals"] == {"thanks": 0, "days_published": 0, "items_added": 0}
    assert [r["member"]["nick"] for r in empty["ranking"]] == ["ada", "bea", "cid", "dan"], "zero for everyone: alphabetical"
    assert all(r["position"] == 1 and r["tied"] for r in empty["ranking"])
    assert empty["period"] == {"kind": "school_year", "label": "2026/27", "start": "2026-09-10", "end": "2027-06-08"}

    d1, d2, d3 = (TODAY - timedelta(days=n) for n in (3, 2, 1))
    w.card(d1, "ada", now)
    w.card(d2, "bea", now)
    w.card(d3, "Eli", now)
    a1 = w.item("ada", "A1")
    b1 = w.item("bea", "B1")
    w.item("cid", "C1")
    e1 = w.item("Eli", "E1")
    w.item("dan", "Bozza admin", status="draft")
    # Published before the school year: outside the period, with its Grazie.
    old_card = w.card(date(2026, 9, 1), "cid", datetime(2026, 9, 1, 12, tzinfo=timezone.utc))
    old_item = w.item("cid", "Vecchio", published_at=datetime(2026, 9, 1, 12, tzinfo=timezone.utc))

    w.thank_day("bea", d1)          # ada +1
    w.thank_item("cid", a1)         # ada +1
    w.thank_day("ada", d2)          # bea +1
    w.thank_item("dan", b1)         # bea +1
    w.thank_item("ada", e1)         # Eli +1 (not ranked)
    with Session(db.engine) as s:
        s.add(CardThanks(card_id=old_card, member_id=w.ids["ada"]))
        s.add(ItemThanks(item_id=old_item, member_id=w.ids["ada"]))
        s.add(ItemThanks(item_id=a1, member_id=w.ids["ada"]))  # legacy self-thanks: ignored
        # A Grazie given by someone who has since left still counts.
        s.add(ItemThanks(item_id=b1, member_id=w.ids["Eli"]))
        s.commit()

    data = w.contributions("dan")
    rows = data["ranking"]
    assert [r["member"]["nick"] for r in rows] == ["bea", "ada", "cid", "dan"], "ties by nickname, ignoring role and rotation"
    bea, ada, cid, dan = rows
    assert (bea["position"], bea["tied"], bea["thanks"]) == (1, False, 3)
    assert (ada["position"], ada["tied"], ada["thanks"]) == (2, False, 2)
    assert (cid["position"], cid["tied"], dan["position"], dan["tied"]) == (3, True, 3, True)
    assert (ada["days_published"], ada["items_added"]) == (1, 1)
    assert (cid["days_published"], cid["items_added"], cid["thanks"]) == (0, 1, 0), "only this school year counts"
    assert (dan["items_added"], dan["is_me"]) == (0, True), "drafts are not contributions"
    assert "Eli" not in by_nick(data)
    assert data["totals"] == {"thanks": 5, "days_published": 2, "items_added": 3}
    # Totals match what each item shows.
    assert item_row(w, "dan", a1)["thanks"] == 1 and item_row(w, "dan", b1)["thanks"] == 2

    # Tie on Grazie: shared first place, then nickname order (case-insensitive).
    w.thank_item("bea", a1)
    rows = w.contributions()["ranking"]
    assert [(r["member"]["nick"], r["position"], r["tied"]) for r in rows[:2]] == [("ada", 1, True), ("bea", 1, True)]

    # Deleting an item removes its Grazie from every total.
    assert w.clients["ada"].delete(f"{w.base}/upcoming/{a1}").status_code == 200
    rows = by_nick(w.contributions())
    assert (rows["ada"]["thanks"], rows["ada"]["items_added"]) == (1, 0)
    with Session(db.engine) as s:
        assert s.exec(select(ItemThanks).where(ItemThanks.item_id == a1)).first() is None


# ---- publication timestamps and credit ---------------------------------------------------------
@needs_school_year
def test_item_publication_time_is_set_once_and_admin_edits_keep_credit(world):
    w = world
    day = date(2026, 10, 6)
    headers = at(15, day=day)
    url = f"{w.base}/cards/{day}"
    admin, ada = w.clients["dan"], w.clients["ada"]
    with Session(db.engine) as s:
        s.add(ScribeOverride(class_id=w.class_id, day=day, member_id=w.ids["ada"], reason="takeover"))
        s.commit()

    standalone = ada.post(f"{w.base}/upcoming", json={"type": "compito", "title": "Da solo", "due_date": str(TODAY + timedelta(days=2))}).json()
    with Session(db.engine) as s:
        first_time = s.get(UpcomingItem, standalone["id"]).published_at
    assert first_time is not None
    assert admin.patch(f"{w.base}/upcoming/{standalone['id']}", json={"title": "Da solo (corretto)"}).status_code == 200

    body = {"revision": 0, "entries": [{"subject_code": "INI", "bullets": ["API"]}], "notes": "",
            "items": [{"type": "compito", "subject_code": "INI", "title": "Nel giorno", "due_date": str(TODAY + timedelta(days=2))}]}
    draft = ada.put(url, json=body, headers=headers).json()
    in_day = draft["items"][0]["id"]
    assert draft["items"][0]["can_thank"] is False
    with Session(db.engine) as s:
        assert s.get(UpcomingItem, in_day).published_at is None, "drafts are not published"
    w.thank_item("bea", in_day, 404)  # nobody can thank a draft
    published = ada.post(f"{url}/publish", headers=headers).json()
    assert published["author"]["id"] == w.ids["ada"]
    with Session(db.engine) as s:
        stamped = s.get(UpcomingItem, in_day).published_at
    assert stamped is not None
    w.thank_item("bea", in_day)
    before = by_nick(w.contributions())
    assert (before["ada"]["days_published"], before["ada"]["items_added"], before["ada"]["thanks"]) == (1, 2, 1)

    # The admin edits the published day and adds an item: the day stays ada's,
    # the new item is the admin's own contribution, old timestamps never move.
    page = admin.get(url, headers=headers).json()["card"]
    edit = {"revision": page["revision"], "entries": [{"subject_code": "INI", "bullets": ["API", "DB"]}], "notes": "fix",
            "items": [*page["items"], {"type": "verifica", "subject_code": "INI", "title": "Nuova verifica", "due_date": str(TODAY + timedelta(days=4))}]}
    edited = admin.put(url, json=edit, headers=headers).json()
    assert edited["author"]["id"] == w.ids["ada"] and edited["items"][0]["thanks"] == 1
    assert admin.post(f"{url}/publish", headers=headers).status_code == 200
    with Session(db.engine) as s:
        assert s.get(UpcomingItem, in_day).published_at == stamped
        assert s.get(UpcomingItem, standalone["id"]).published_at == first_time
        assert s.get(UpcomingItem, standalone["id"]).author_member_id == w.ids["ada"]
        added = s.exec(select(UpcomingItem).where(UpcomingItem.title == "Nuova verifica", UpcomingItem.class_id == w.class_id)).one()
        assert added.published_at is not None and added.author_member_id == w.ids["dan"]
    after = by_nick(w.contributions())
    assert (after["ada"]["days_published"], after["ada"]["items_added"], after["ada"]["thanks"]) == (1, 2, 1)
    assert after["dan"]["days_published"] == 0 and after["dan"]["items_added"] == before["dan"]["items_added"] + 1

    # Removing the thanked item from the day removes its Grazie too.
    page = admin.get(url, headers=headers).json()["card"]
    keep = [i for i in page["items"] if i["id"] != in_day]
    assert admin.put(url, json={**edit, "revision": page["revision"], "items": keep}, headers=headers).status_code == 200
    after = by_nick(w.contributions())
    assert (after["ada"]["thanks"], after["ada"]["items_added"]) == (0, 1)
    with Session(db.engine) as s:
        assert s.exec(select(ItemThanks).where(ItemThanks.item_id == in_day)).first() is None


# ---- demo ------------------------------------------------------------------------------------
def test_demo_has_an_ongoing_streak_a_leader_and_a_tie(client):
    reset_demo(client)
    demo_member(client, "leo")
    for hour, minute in ((0, 5), (12, 0), (23, 55)):
        data = client.get("/api/classes/DEMO/contributions", headers=at(hour, minute)).json()
        assert data["streak"]["current"] == 5 and data["streak"]["record"] == 5
        assert data["streak"]["days"][-1] == {"day": TODAY.isoformat(), "status": "today_open"}
        assert [d["status"] for d in data["streak"]["days"][:-1]] == ["published"] * 5
    if not IN_YEAR:
        pytest.skip("the demo ranking counts contributions of school year 2026/27")
    rows = data["ranking"]
    assert [r["member"]["nick"] for r in rows] == ["luca", "marta", "sara", "anna", "gianni", "leo"]
    assert (rows[0]["position"], rows[0]["tied"], rows[0]["thanks"]) == (1, False, 4)
    assert [(r["position"], r["tied"], r["thanks"]) for r in rows[1:3]] == [(2, True, 2), (2, True, 2)]
    assert rows[-1]["is_me"] and rows[-1]["thanks"] == 0
    with Session(db.engine) as s:
        demo = s.exec(select(Classroom).where(Classroom.code == "DEMO")).one()
        cards = {c.id: c for c in s.exec(select(DayCard).where(DayCard.class_id == demo.id)).all()}
        items = {i.id: i for i in s.exec(select(UpcomingItem).where(UpcomingItem.class_id == demo.id)).all()}
        assert all(i.published_at is not None for i in items.values())
        for t in s.exec(select(CardThanks).where(CardThanks.card_id.in_(list(cards)))).all():
            assert t.member_id != cards[t.card_id].author_member_id
        for t in s.exec(select(ItemThanks).where(ItemThanks.item_id.in_(list(items)))).all():
            assert t.member_id != items[t.item_id].author_member_id


# ---- migration ---------------------------------------------------------------------------------
def test_migration_backfills_item_publication_from_existing_facts_only(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'old.db'}")
    with engine.begin() as c:
        c.execute(text("CREATE TABLE classroom (id INTEGER PRIMARY KEY, code VARCHAR, name VARCHAR, label VARCHAR, is_demo BOOLEAN, rotation_anchor DATE, demo_seeded_on DATE, created_at DATETIME)"))
        c.execute(text("CREATE TABLE member (id INTEGER PRIMARY KEY, class_id INTEGER, nick VARCHAR, role VARCHAR, rotation_order INTEGER, active BOOLEAN, failed_attempts INTEGER, session_version INTEGER, created_at DATETIME)"))
        c.execute(text("CREATE TABLE daycard (id INTEGER PRIMARY KEY, class_id INTEGER, day DATE, status VARCHAR, scribe_member_id INTEGER, author_member_id INTEGER, notes VARCHAR, created_at DATETIME, updated_at DATETIME, published_at DATETIME)"))
        c.execute(text("CREATE TABLE upcomingitem (id INTEGER PRIMARY KEY, class_id INTEGER, card_id INTEGER, type VARCHAR, subject_code VARCHAR, title VARCHAR, due_date DATE, due_time VARCHAR, source VARCHAR, link VARCHAR, attachment_id INTEGER, author_member_id INTEGER, status VARCHAR, created_at DATETIME, updated_at DATETIME)"))
        c.execute(text("INSERT INTO daycard (id, class_id, day, status, published_at) VALUES (1, 1, '2026-10-02', 'published', '2026-10-02 14:10:00.000000')"))
        c.execute(text("INSERT INTO daycard (id, class_id, day, status, published_at) VALUES (2, 1, '2026-10-05', 'draft', NULL)"))
        rows = [
            (1, 1, "published", "2026-10-02 13:00:00.000000"),  # written in the draft, public with the day
            (2, 1, "published", "2026-10-03 09:00:00.000000"),  # added after publication
            (3, None, "published", "2026-10-04 08:00:00.000000"),  # standalone
            (4, 2, "draft", "2026-10-05 08:00:00.000000"),  # still a draft
        ]
        for item_id, card_id, status, created in rows:
            c.execute(text("INSERT INTO upcomingitem (id, class_id, card_id, type, title, due_date, status, created_at) VALUES (:id, 1, :card, 'compito', 't', '2026-10-09', :status, :created)"),
                      {"id": item_id, "card": card_id, "status": status, "created": created})

    db.init_db(engine)
    with engine.begin() as c:
        got = dict(c.execute(text("SELECT id, published_at FROM upcomingitem ORDER BY id")).all())
        assert got == {1: "2026-10-02 14:10:00.000000", 2: "2026-10-03 09:00:00.000000", 3: "2026-10-04 08:00:00.000000", 4: None}
        c.execute(text("UPDATE upcomingitem SET published_at = '2026-10-06 10:00:00.000000', status = 'published' WHERE id = 4"))
    db.init_db(engine)  # idempotent: never rewrites timestamps once the column exists
    with engine.connect() as c:
        assert c.execute(text("SELECT published_at FROM upcomingitem WHERE id = 4")).scalar() == "2026-10-06 10:00:00.000000"
        assert c.execute(text("SELECT published_at FROM upcomingitem WHERE id = 1")).scalar() == "2026-10-02 14:10:00.000000"
        assert "itemthanks" in {r[0] for r in c.execute(text("SELECT name FROM sqlite_master WHERE type = 'table'")).all()}
