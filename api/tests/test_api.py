from datetime import date, datetime, timedelta

from api.config import TZ
from api.schedule import ClassCalendar
from api.tasks import parse_text, validate_drafts

from .conftest import make_client

TODAY = datetime.now(TZ).date()


def at(hour: int, minute: int = 0, day: date = TODAY) -> dict:
    return {"X-Ieri-Now": datetime(day.year, day.month, day.day, hour, minute, tzinfo=TZ).isoformat()}


def demo_member(client, nick: str) -> None:
    public = client.get("/api/classes/DEMO/public").json()
    member = next(m for m in public["members"] if m["nick"] == nick)
    r = client.post("/api/classes/DEMO/login", json={"member_id": member["id"], "pin": "123456"})
    assert r.status_code == 200, r.text


def reset_demo(client):
    from sqlmodel import Session

    from api import db
    from api.seed import ensure_demo

    with Session(db.engine) as s:
        ensure_demo(s, force=True)


def test_health(client):
    assert client.get("/api/healthz").json()["ok"] is True


def test_private_demos_stay_apart(client):
    second = make_client()
    a = client.post("/api/auth/demo/mine")
    b = second.post("/api/auth/demo/mine")
    assert a.status_code == 200 and b.status_code == 200
    assert a.json()["code"] != b.json()["code"]
    assert a.json()["code"] != "DEMO"
    again = client.post("/api/auth/demo/mine")
    assert again.json()["code"] == a.json()["code"]
    shared = make_client().post("/api/auth/demo")
    assert shared.json()["code"] == "DEMO"
    client.post("/api/auth/logout")
    assert client.post("/api/owner/login", json={"username": "preside", "password": "test-password"}).status_code == 200
    listed = {c["code"] for c in client.get("/api/owner/classes").json()}
    assert "DEMO" in listed
    assert a.json()["code"] not in listed
    assert b.json()["code"] not in listed


def test_demo_enter_does_not_ask_for_a_pin(client):
    client.post("/api/auth/demo")
    client.cookies.clear()
    public = client.get("/api/classes/DEMO/public").json()
    leo = next(m for m in public["members"] if m["nick"] == "leo")
    assert client.post("/api/classes/DEMO/demo-enter", json={"member_id": leo["id"]}).status_code == 200
    assert client.get("/api/me").json()["member"]["nick"] == "leo"


def test_unknown_page_is_the_app_and_unknown_api_stays_json(client, tmp_path):
    missing = client.get("/api/not-a-real-endpoint")
    assert missing.status_code == 404
    assert "application/json" in missing.headers["content-type"]

    from api.config import settings

    index = tmp_path / "index.html"
    index.write_text('<!doctype html><div id="root">Recapp</div>', encoding="utf-8")
    previous = settings.web_dist
    object.__setattr__(settings, "web_dist", tmp_path)
    try:
        page = client.get("/this-page-is-not-real", follow_redirects=False)
        assert page.status_code == 200
        assert "text/html" in page.headers["content-type"]
        assert page.headers["cache-control"] == "no-cache"
        assert page.headers.get("location") is None
        assert 'id="root"' in page.text
        again = client.get("/api/not-a-real-endpoint")
        assert again.status_code == 404
        assert "application/json" in again.headers["content-type"]
    finally:
        object.__setattr__(settings, "web_dist", previous)


def test_html_is_not_cached(client):
    from api.app import cache_control_for

    assert cache_control_for("/") == "no-cache"
    assert cache_control_for("/c/DEMO") == "no-cache"
    assert cache_control_for("/assets/index-abc.js") == "public, max-age=31536000, immutable"
    assert cache_control_for("/api/healthz") is None
    page = client.get("/")
    if page.status_code == 200 and "text/html" in page.headers.get("content-type", ""):
        assert page.headers["cache-control"] == "no-cache"


def test_demo_login_and_today(client):
    reset_demo(client)
    assert client.post("/api/auth/demo").status_code == 200
    me = client.get("/api/me").json()
    assert me["kind"] == "member" and me["member"]["nick"] == "leo"
    today = client.get("/api/classes/DEMO/today", headers=at(15)).json()
    assert today["scribe"]["nick"] == "leo"
    assert today["status"] == "not_started"
    assert today["can_write"] and today["is_me_scribe"]
    assert today["lessons"], "demo has lessons every day"


def test_card_publish_flow(client):
    reset_demo(client)
    client.post("/api/auth/demo")
    day = TODAY.isoformat()
    r = client.post(f"/api/classes/DEMO/cards/{day}/publish", headers=at(15))
    assert r.status_code == 400
    empty = {"entries": [{"subject_code": "INI", "bullets": [""]}], "notes": "", "items": []}
    rev = client.put(f"/api/classes/DEMO/cards/{day}", json=empty, headers=at(15)).json()["revision"]
    r = client.post(f"/api/classes/DEMO/cards/{day}/publish", headers=at(15))
    assert r.status_code == 422, "anti-empty rule"

    empty_lab = {"revision": rev, "notes": "", "items": [], "entries": [
        {"subject_code": "INI", "is_lab": True, "bullets": [], "lab": {"goal": "  ", "repo_url": "", "pitfall": "", "bring": " "}}]}
    rev = client.put(f"/api/classes/DEMO/cards/{day}", json=empty_lab, headers=at(15)).json()["revision"]
    assert client.post(f"/api/classes/DEMO/cards/{day}/publish", headers=at(15)).status_code == 422, "empty lab is not content"

    due = (TODAY + timedelta(days=2)).isoformat()
    body = {
        "entries": [
            {"subject_code": "INI", "hours": "5-7", "room": "L143", "is_lab": True, "bullets": ["API GET /stations"],
             "lab": {"goal": "API up", "repo_url": "github.com/x/y", "pitfall": "uvicorn --reload", "bring": ""}},
        ],
        "notes": "portare la calcolatrice",
        "items": [{"type": "verifica", "subject_code": "MAT", "title": "Verifica derivate", "due_date": due}],
        "revision": rev,
    }
    r = client.put(f"/api/classes/DEMO/cards/{day}", json=body, headers=at(15))
    assert r.status_code == 200, r.text
    card = r.json()
    assert card["status"] == "draft"
    assert card["entries"][0]["lab"]["repo_url"] == "https://github.com/x/y"

    upcoming = client.get("/api/classes/DEMO/upcoming").json()
    assert not any(i["title"] == "Verifica derivate" for i in upcoming), "drafts stay hidden"
    assert client.get("/api/classes/DEMO/today", headers=at(15)).json()["status"] == "draft"

    r = client.post(f"/api/classes/DEMO/cards/{day}/publish", headers=at(15))
    assert r.status_code == 200 and r.json()["status"] == "published"
    upcoming = client.get("/api/classes/DEMO/upcoming").json()
    assert any(i["title"] == "Verifica derivate" for i in upcoming)
    assert client.get("/api/classes/DEMO/today", headers=at(15)).json()["status"] == "published"


def test_non_scribe_cannot_write_before_takeover(client):
    reset_demo(client)
    demo_member(client, "gianni")
    day = TODAY.isoformat()
    body = {"entries": [{"subject_code": "INI", "bullets": ["x"]}], "notes": "", "items": []}
    assert client.put(f"/api/classes/DEMO/cards/{day}", json=body, headers=at(15)).status_code == 403
    t = client.get("/api/classes/DEMO/today", headers=at(15)).json()
    assert t["status"] == "not_started" and not t["can_takeover"]
    assert client.post("/api/classes/DEMO/today/takeover", json={}, headers=at(15)).status_code == 409

    t = client.get("/api/classes/DEMO/today", headers=at(18, 30)).json()
    assert t["status"] == "open" and t["can_takeover"]
    assert client.post("/api/classes/DEMO/today/takeover", json={}, headers=at(18, 30)).status_code == 200
    t = client.get("/api/classes/DEMO/today", headers=at(18, 31)).json()
    assert t["scribe"]["nick"] == "gianni" and t["status"] == "not_started" and t["can_write"]
    assert client.put(f"/api/classes/DEMO/cards/{day}", json=body, headers=at(18, 32)).status_code == 200


def test_stale_save_gets_conflict(client):
    reset_demo(client)
    client.post("/api/auth/demo")
    day = TODAY.isoformat()
    url = f"/api/classes/DEMO/cards/{day}"
    first = client.put(url, json={"entries": [{"subject_code": "INI", "bullets": ["original"]}], "notes": "", "items": []}, headers=at(15)).json()
    base = first["revision"]
    b = client.put(url, json={"revision": base, "entries": [{"subject_code": "INI", "bullets": ["important newer edit"]}], "notes": "", "items": []}, headers=at(15))
    assert b.status_code == 200
    a = client.put(url, json={"revision": base, "entries": [{"subject_code": "INI", "bullets": ["original"]}], "notes": "only notes", "items": []}, headers=at(15))
    assert a.status_code == 409
    assert a.json()["detail"]["card"]["entries"][0]["bullets"] == ["important newer edit"]
    saved = client.get(url, headers=at(15)).json()["card"]
    assert saved["entries"][0]["bullets"] == ["important newer edit"] and saved["notes"] == ""
    assert client.put(url, json={"entries": [], "notes": "", "items": []}, headers=at(15)).status_code == 409, "revision required"
    ok = client.put(url, json={"revision": saved["revision"], "entries": [{"subject_code": "INI", "bullets": ["merged"]}], "notes": "n", "items": []}, headers=at(15))
    assert ok.status_code == 200 and ok.json()["revision"] == saved["revision"] + 1


def test_takeover_revokes_previous_author(client):
    reset_demo(client)
    leo = make_client()
    leo.post("/api/auth/demo")
    day = TODAY.isoformat()
    url = f"/api/classes/DEMO/cards/{day}"
    from sqlmodel import Session, select

    from api import db
    from api.models import Classroom, Member

    with Session(db.engine) as s:
        demo = s.exec(select(Classroom).where(Classroom.code == "DEMO")).first()
        m = s.exec(select(Member).where(Member.class_id == demo.id, Member.nick == "leo")).first()
        m.role = "member"
        s.add(m)
        s.commit()
    draft = leo.put(url, json={"entries": [{"subject_code": "INI", "bullets": ["leo draft"]}], "notes": "", "items": []}, headers=at(15)).json()
    demo_member(client, "gianni")
    assert client.post("/api/classes/DEMO/today/takeover", json={}, headers=at(18, 30)).status_code == 200
    stale = leo.put(url, json={"revision": draft["revision"], "entries": [], "notes": "", "items": []}, headers=at(18, 31))
    assert stale.status_code == 403
    assert leo.post(f"{url}/publish", headers=at(18, 31)).status_code == 403
    page = client.get(url, headers=at(18, 31)).json()
    assert page["card"]["entries"][0]["bullets"] == ["leo draft"], "work is kept"
    ok = client.put(url, json={"revision": page["card"]["revision"], "entries": [{"subject_code": "INI", "bullets": ["gianni"]}], "notes": "", "items": []}, headers=at(18, 32))
    assert ok.status_code == 200
    assert client.post(f"{url}/publish", headers=at(18, 33)).status_code == 200


def test_feedback_comments_and_thanks(client):
    reset_demo(client)
    day = (TODAY - timedelta(days=1)).isoformat()
    leo = make_client()
    leo.post("/api/auth/demo")
    demo_member(client, "gianni")
    assert client.post(f"/api/classes/DEMO/cards/{TODAY.isoformat()}/comments", json={"body": "bozza"}, headers=at(15)).status_code == 404
    assert client.post(f"/api/classes/DEMO/cards/{day}/comments", json={"kind": "correction", "body": "manca il repo"}).status_code == 200
    assert client.post(f"/api/classes/DEMO/cards/{day}/comments", json={"body": "grazie per i punti"}).status_code == 200
    assert client.post(f"/api/classes/DEMO/cards/{day}/thanks").status_code == 200
    fb = client.get(f"/api/classes/DEMO/cards/{day}/feedback").json()
    assert fb["thanks"] == 1 and fb["thanked"] and fb["open_corrections"] == 1
    assert [c["kind"] for c in fb["comments"]] == ["correction", "comment"]
    assert client.get("/api/classes/DEMO/today", headers=at(15)).json()["open_corrections"] == 0, "gianni is not the scribe"
    assert leo.get("/api/classes/DEMO/today", headers=at(15, day=TODAY - timedelta(days=1))).json()["open_corrections"] == 1
    correction = next(c for c in fb["comments"] if c["kind"] == "correction")
    assert client.patch(f"/api/classes/DEMO/comments/{correction['id']}", json={"resolved": True}).status_code == 403
    assert leo.patch(f"/api/classes/DEMO/comments/{correction['id']}", json={"resolved": True}).status_code == 200
    assert client.get(f"/api/classes/DEMO/cards/{day}/feedback").json()["open_corrections"] == 0
    other = make_client()
    demo_member(other, "sara")
    assert other.delete(f"/api/classes/DEMO/comments/{correction['id']}").status_code == 403
    assert len(client.get(f"/api/classes/DEMO/cards/{day}/feedback").json()["comments"]) == 2
    assert client.delete(f"/api/classes/DEMO/comments/{correction['id']}").status_code == 200
    assert client.post(f"/api/classes/DEMO/cards/{day}/thanks").status_code == 200
    fb = client.get(f"/api/classes/DEMO/cards/{day}/feedback").json()
    assert fb["thanks"] == 0 and len(fb["comments"]) == 1


def test_subject_entries_across_days(client):
    reset_demo(client)
    client.post("/api/auth/demo")
    rows = client.get("/api/classes/DEMO/subjects/INI/entries?range=all").json()
    assert rows, "demo has published Informatica blocks"
    days = [r["day"] for r in rows]
    assert days == sorted(days, reverse=True)
    assert all("bullets" in r and "items" in r for r in rows)
    assert any(r["lab"] for r in rows), "yesterday's demo card has an INI lab"
    assert client.get("/api/classes/DEMO/subjects/XXX/entries").json() == []


def test_pass_turn_opens_takeover(client):
    reset_demo(client)
    client.post("/api/auth/demo")
    assert client.post("/api/classes/DEMO/today/pass", json={}, headers=at(10)).status_code == 200
    t = client.get("/api/classes/DEMO/today", headers=at(10)).json()
    assert t["status"] == "open" and t["scribe"] is None


def test_owner_creates_class_and_invite_flow(client):
    assert client.post("/api/owner/login", json={"username": "preside", "password": "nope"}).status_code == 401
    assert client.post("/api/owner/login", json={"username": "preside", "password": "test-password"}).status_code == 200
    r = client.post("/api/owner/classes", json={"name": "4ZI", "label": "Test", "admin_nick": "capo", "timetable_from": "4BI"})
    assert r.status_code == 200, r.text
    created = r.json()
    code, admin_id, invite = created["code"], created["admin"]["member_id"], created["admin"]["invite"]
    classes = client.get("/api/owner/classes").json()
    assert any(c["code"] == code for c in classes)

    student = make_client()
    public = student.get(f"/api/classes/{code}/public").json()
    assert public["members"][0]["needs_setup"] is True
    assert student.post(f"/api/classes/{code}/activate", json={"member_id": admin_id, "invite": "AAAA-AAAA", "pin": "111111"}).status_code == 401
    r = student.post(f"/api/classes/{code}/activate", json={"member_id": admin_id, "invite": invite.lower().replace("-", ""), "pin": "111111"})
    assert r.status_code == 200, r.text
    assert student.get("/api/me").json()["member"]["role"] == "admin"

    r = student.post(f"/api/classes/{code}/members", json={"nick": "gianni"})
    assert r.status_code == 200
    gianni_id = r.json()["member_id"]

    other = make_client()
    for _ in range(5):
        assert other.post(f"/api/classes/{code}/activate", json={"member_id": gianni_id, "invite": "ZZZZ-ZZZZ", "pin": "222222"}).status_code == 401
    r = other.post(f"/api/classes/{code}/activate", json={"member_id": gianni_id, "invite": "ZZZZ-ZZZZ", "pin": "222222"})
    assert r.status_code == 429, "locked after 5 failures"

    assert other.get(f"/api/classes/{code}/today").status_code == 401
    assert make_client().get("/api/owner/classes").status_code == 401


def test_rotation_skips_holidays_and_weekends(client):
    from sqlmodel import Session, select

    from api import db
    from api.models import Classroom, Member

    with Session(db.engine) as s:
        classroom = s.exec(select(Classroom).where(Classroom.name == "4BI")).first()
        classroom.rotation_anchor = date(2026, 12, 1)
        for i, nick in enumerate(["a1", "b2", "c3"]):
            s.add(Member(class_id=classroom.id, nick=nick, activated_at=datetime.now(TZ), pin_hash="x", rotation_order=10 + i))
        s.commit()
        cal = ClassCalendar(s, classroom)
        assert not cal.is_school_day(date(2026, 12, 7))
        assert not cal.is_school_day(date(2026, 12, 8))
        assert not cal.is_school_day(date(2026, 12, 5))
        assert cal.is_school_day(date(2026, 12, 9))
        days = cal.school_days(date(2026, 12, 1), 6)
        assert days == [date(2026, 12, d) for d in (1, 2, 3, 4, 9, 10)]
        nicks = [cal.scheduled_scribe(d).nick for d in days]
        assert nicks == ["a1", "b2", "c3", "a1", "b2", "c3"]
        assert cal.next_lesson("MAT", date(2026, 12, 1)) == date(2026, 12, 4)
        lessons = cal.lessons(date(2026, 12, 2))
        ini = next(b for b in lessons if b.subject_code == "INI")
        assert ini.hours == [5, 6, 7] and ini.is_lab and ini.room == "L143"


CTX = {
    "today": "2026-09-30",
    "subjects": [
        {"code": "MAT", "name_it": "Matematica", "name_en": "Math"},
        {"code": "INI", "name_it": "Informatica", "name_en": "Computer Science"},
        {"code": "ING", "name_it": "Inglese", "name_en": "English"},
    ],
    "next_lessons": {"MAT": "2026-10-02", "INI": "2026-10-01", "ING": "2026-10-01"},
    "school_days": ["2026-10-01", "2026-10-02", "2026-10-05", "2026-10-06"],
}


def test_mock_parser_line():
    drafts = parse_text("Mate: es. 12–15, verifica ven", CTX)
    assert [d["type"] for d in drafts] == ["compito", "verifica"]
    assert all(d["subject_code"] == "MAT" for d in drafts)
    assert drafts[0]["due_date"] == "2026-10-02" and drafts[0]["needs_check"]
    assert drafts[1]["due_date"] == "2026-10-02"
    assert "12" in drafts[0]["title"]


def test_mock_parser_dates():
    drafts = parse_text("verifica di informatica il 6/10\nassemblea domani", CTX)
    assert drafts[0]["type"] == "verifica" and drafts[0]["subject_code"] == "INI" and drafts[0]["due_date"] == "2026-10-06"
    assert drafts[1]["type"] == "evento" and drafts[1]["due_date"] == "2026-10-01"
    exercise = parse_text("inglese es. 3-7 pag 40", CTX)[0]
    assert exercise["due_date"] == "2026-10-01", "3-7 is an exercise range, not a date"


def test_validate_flags_bad_dates():
    out = validate_drafts({"items": [
        {"tipo": "verifica", "materia": "Matematica", "titolo": "x", "quando": "2027-06-30"},
        {"tipo": "boh", "titolo": "y", "quando": None},
        {"tipo": "compito", "titolo": "z", "quando": "2026-10-03"},
    ]}, CTX, "altro")
    assert out[0]["subject_code"] == "MAT" and out[0]["needs_check"]
    assert out[1]["type"] == "compito" and out[1]["needs_check"]
    assert out[2]["needs_check"], "saturday is not a school day"

    titled = validate_drafts([{"tipo": "verifica", "materia": "MAT", "titolo": "verifica", "quando": "2026-10-02"}], CTX, "altro")
    assert titled[0]["title"] == "Verifica Matematica"


def test_system_prompt_fills_context():
    from api.tasks import build_system_prompt

    prompt = build_system_prompt(CTX)
    assert "2026-09-30 (mercoledì)" in prompt
    assert "MAT = Matematica" in prompt and '"MAT": "2026-10-02"' in prompt
    assert '{"items": [' in prompt and "@" not in prompt


def test_ocr_text_job(client):
    reset_demo(client)
    client.post("/api/auth/demo")
    r = client.post("/api/classes/DEMO/ocr", json={"text": "Mate: verifica ven"})
    assert r.status_code == 200
    job = client.get(f"/api/classes/DEMO/ocr/{r.json()['job_id']}").json()
    assert job["status"] == "done" and job["drafts"][0]["type"] == "verifica"


def test_ocr_via_render_workflows(client, monkeypatch):
    import dataclasses
    from types import SimpleNamespace

    import render

    from api import jobs
    from api.tasks import extract_items

    runs = {}

    class FakeWorkflows:
        def start_task(self, slug, args):
            runs["run-1"] = extract_items(args[0])
            return SimpleNamespace(id="run-1", status="PENDING")

        def get_task_run(self, run_id):
            return SimpleNamespace(status="TaskRunStatus.SUCCEEDED", results=[runs[run_id]])

    monkeypatch.setattr(render, "Render", lambda token=None: SimpleNamespace(workflows=FakeWorkflows()))
    monkeypatch.setattr(jobs, "settings", dataclasses.replace(jobs.settings, ocr_provider="featherless", task_runner="render", render_api_key="k", render_workflow_task="ieri-ocr/extract_items"))

    reset_demo(client)
    client.post("/api/auth/demo")
    started = client.post("/api/classes/DEMO/ocr", json={"text": "Mate: verifica ven"}).json()
    assert started["status"] == "running"
    job = client.get(f"/api/classes/DEMO/ocr/{started['job_id']}").json()
    assert job["status"] == "done" and job["drafts"][0]["type"] == "verifica"


def test_attachment_upload_strips_metadata(client):
    import io

    from PIL import Image

    reset_demo(client)
    client.post("/api/auth/demo")
    img = Image.new("RGB", (3000, 1500), "white")
    exif = Image.Exif()
    exif[0x010F] = "SecretPhone"
    buf = io.BytesIO()
    img.save(buf, "JPEG", exif=exif)
    files = {"file": ("crop.jpg", buf.getvalue(), "image/jpeg")}
    assert client.post("/api/classes/DEMO/attachments", files=files).status_code == 422
    r = client.post("/api/classes/DEMO/attachments", files=files, data={"privacy_ok": "true"})
    assert r.status_code == 200, r.text
    assert r.json()["width"] == 1280
    raw = client.get(f"/api/attachments/{r.json()['id']}").content
    stored = Image.open(io.BytesIO(raw))
    assert stored.format == "WEBP" and not stored.getexif()
    assert make_client().get(f"/api/attachments/{r.json()['id']}").status_code == 403


def test_board_ranks_thanks_and_keeps_the_streak(client):
    reset_demo(client)
    anon = make_client()
    assert anon.get("/api/classes/DEMO/board").status_code == 401
    assert "ranking" not in anon.get("/api/classes/DEMO/public").json()

    demo_member(client, "gianni")
    yesterday = (TODAY - timedelta(days=1)).isoformat()
    author = client.get(f"/api/classes/DEMO/cards/{yesterday}").json()["card"]["author"]["nick"]
    assert client.post(f"/api/classes/DEMO/cards/{yesterday}/thanks").status_code == 200
    demo_member(client, "sara")
    assert client.post(f"/api/classes/DEMO/cards/{yesterday}/thanks").status_code == 200

    board = client.get("/api/classes/DEMO/board").json()
    ranking = board["ranking"]
    assert [row["member"]["nick"] for row in ranking if row["thanks"] == 0] == sorted(
        (row["member"]["nick"] for row in ranking if row["thanks"] == 0), key=str.casefold
    )
    lead = ranking[0]
    assert lead["member"]["nick"] == author
    assert lead["thanks"] == 2 and lead["rank"] == 1
    assert ranking[-1]["thanks"] == 0
    assert all(row["rank"] == 1 or row["thanks"] < 2 for row in ranking)

    streak = board["streak"]
    assert streak["empty"] is False
    assert streak["current"] == 5
    assert streak["record"] == 5
    assert streak["days"][0] == {"day": yesterday, "published": True}
    assert TODAY.isoformat() not in {d["day"] for d in streak["days"]}
    assert any(not d["published"] for d in streak["days"])

    assert client.post(f"/api/classes/DEMO/cards/{yesterday}/thanks").status_code == 200
    again = client.get("/api/classes/DEMO/board").json()
    assert next(row for row in again["ranking"] if row["member"]["nick"] == author)["thanks"] == 1


def test_streak_skips_today_and_keeps_the_record():
    from api.standings import streak_summary

    class Week:
        def is_school_day(self, d):
            return d.weekday() < 5

        def prev_school_day(self, before, max_days=60):
            d = before - timedelta(days=1)
            for _ in range(max_days):
                if self.is_school_day(d):
                    return d
                d -= timedelta(days=1)
            return None

    # Thu 1 Oct and Fri 2 Oct published. Mon 5 Oct not yet. Wed 30 Sep missed.
    published = {date(2026, 10, 1), date(2026, 10, 2)}
    today = date(2026, 10, 5)
    streak = streak_summary(today, published, Week())
    assert streak["current"] == 2
    assert streak["record"] == 2
    assert streak["days"][0]["day"] == "2026-10-02"
    assert today.isoformat() not in {d["day"] for d in streak["days"]}

    # Friday was missed, so the current run is zero and Thursday stays the record.
    broken = streak_summary(today, {date(2026, 10, 1)}, Week())
    assert broken["current"] == 0
    assert broken["record"] == 1
    assert broken["days"][0] == {"day": "2026-10-02", "published": False}

    empty = streak_summary(today, set(), Week())
    assert empty == {"current": 0, "record": 0, "empty": True, "days": []}


def test_foreign_origin_rejected(client):
    r = client.post("/api/auth/demo", headers={"Origin": "https://evil.example"})
    assert r.status_code == 403


def test_render_hostname_allowed(monkeypatch):
    import dataclasses

    from api import app as app_module

    patched = dataclasses.replace(app_module.settings, app_env="prod", public_url="https://bassaleo.xyz", extra_hosts=("ieri.onrender.com",))
    monkeypatch.setattr(app_module, "settings", patched)
    assert app_module._origin_allowed("https://ieri.onrender.com")
    assert app_module._origin_allowed("https://www.bassaleo.xyz")
    assert not app_module._origin_allowed("https://evil.example")
    assert not app_module._origin_allowed("http://localhost:5173")
