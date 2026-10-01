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
    client.put(f"/api/classes/DEMO/cards/{day}", json=empty, headers=at(15))
    r = client.post(f"/api/classes/DEMO/cards/{day}/publish", headers=at(15))
    assert r.status_code == 422, "anti-empty rule"

    due = (TODAY + timedelta(days=2)).isoformat()
    body = {
        "entries": [
            {"subject_code": "INI", "hours": "5-7", "room": "L143", "is_lab": True, "bullets": ["API GET /stations"],
             "lab": {"goal": "API up", "repo_url": "github.com/x/y", "pitfall": "uvicorn --reload", "bring": ""}},
        ],
        "notes": "portare la calcolatrice",
        "items": [{"type": "verifica", "subject_code": "MAT", "title": "Verifica derivate", "due_date": due}],
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


def test_ocr_text_job(client):
    reset_demo(client)
    client.post("/api/auth/demo")
    r = client.post("/api/classes/DEMO/ocr", json={"text": "Mate: verifica ven"})
    assert r.status_code == 200
    job = client.get(f"/api/classes/DEMO/ocr/{r.json()['job_id']}").json()
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


def test_foreign_origin_rejected(client):
    r = client.post("/api/auth/demo", headers={"Origin": "https://evil.example"})
    assert r.status_code == 403
