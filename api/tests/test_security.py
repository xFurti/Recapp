import io
from datetime import datetime, timedelta, timezone

from PIL import Image
from sqlmodel import Session, select

from api import db
from api.models import Attachment, Classroom, Member, OcrJob, TimetableSlot

from .conftest import make_client
from .test_api import TODAY, at, demo_member, reset_demo


def _png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (40, 30), "white").save(buf, "PNG")
    return buf.getvalue()


def _upload(c, code="DEMO"):
    r = c.post(f"/api/classes/{code}/attachments", files={"file": ("x.png", _png(), "image/png")}, data={"privacy_ok": "true"})
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_demo_ocr_budget_falls_back_to_parser(client, monkeypatch):
    import dataclasses

    from api import jobs
    from api.routes import media

    sent = []
    monkeypatch.setattr(media, "start_job", lambda session, job, payload, background: sent.append(payload["provider"]))
    monkeypatch.setattr(jobs, "settings", dataclasses.replace(jobs.settings, ocr_provider="featherless"))
    reset_demo(client)
    client.post("/api/auth/demo")
    for _ in range(5):
        assert client.post("/api/classes/DEMO/ocr", json={"text": "Matematica esercizi domani"}).status_code == 200
    assert sent == ["featherless"] * 3 + ["mock"] * 2, "over 3/min per IP the demo never reaches the paid provider"

    from api import limits

    limits.reset()
    with Session(db.engine) as s:
        demo = s.exec(select(Classroom).where(Classroom.code == "DEMO")).first()
        for i in range(30):
            s.add(OcrJob(id=f"fill-{i}", class_id=demo.id))
        s.commit()
    sent.clear()
    renewed = make_client()
    renewed.post("/api/auth/demo")
    assert renewed.post("/api/classes/DEMO/ocr", json={"text": "verifica ven"}).status_code == 200
    assert sent == ["mock"], "daily budget holds across new demo sessions"


def test_demo_admin_changes_blocked_and_reset_restores(client):
    reset_demo(client)
    client.post("/api/auth/demo")
    assert client.put("/api/classes/DEMO/timetable", json={"slots": []}).status_code == 403
    members = client.get("/api/classes/DEMO/members").json()["members"]
    gianni = next(m for m in members if m["nick"] == "gianni")
    assert client.delete(f"/api/classes/DEMO/members/{gianni['id']}").status_code == 403
    assert client.patch(f"/api/classes/DEMO/members/{gianni['id']}", json={"role": "admin"}).status_code == 403
    assert client.patch("/api/classes/DEMO/rotation/order", json={"member_ids": [m["id"] for m in members][::-1]}).status_code == 403
    added = client.post("/api/classes/DEMO/members", json={"nick": "visitor1"})
    assert added.status_code == 200

    with Session(db.engine) as s:
        demo = s.exec(select(Classroom).where(Classroom.code == "DEMO")).first()
        for slot in s.exec(select(TimetableSlot).where(TimetableSlot.class_id == demo.id)).all():
            s.delete(slot)
        leo = s.exec(select(Member).where(Member.class_id == demo.id, Member.nick == "leo")).first()
        leo.role = "member"
        s.add(leo)
        s.commit()
    reset_demo(client)
    with Session(db.engine) as s:
        demo = s.exec(select(Classroom).where(Classroom.code == "DEMO")).first()
        slots = s.exec(select(TimetableSlot).where(TimetableSlot.class_id == demo.id)).all()
        nicks = {m.nick: m.role for m in s.exec(select(Member).where(Member.class_id == demo.id)).all()}
    assert len(slots) == 32
    assert nicks == {"leo": "admin", "gianni": "member", "sara": "member", "marta": "member", "luca": "member", "anna": "member"}


def test_attachment_visibility_follows_publication(client):
    reset_demo(client)
    day = TODAY.isoformat()
    leo = make_client()
    leo.post("/api/auth/demo")
    orphan = _upload(leo)
    draft_att = _upload(leo)
    leo.put(f"/api/classes/DEMO/cards/{day}", json={"entries": [{"subject_code": "INI", "bullets": ["x"], "attachment_ids": [draft_att]}], "notes": "", "items": []}, headers=at(15))

    demo_member(client, "gianni")
    for att in (orphan, draft_att):
        assert client.get(f"/api/attachments/{att}", headers=at(15)).status_code == 403
    assert leo.get(f"/api/attachments/{orphan}").status_code == 200

    assert leo.post(f"/api/classes/DEMO/cards/{day}/publish", headers=at(15)).status_code == 200
    assert client.get(f"/api/attachments/{draft_att}", headers=at(15)).status_code == 200
    assert client.get(f"/api/attachments/{orphan}", headers=at(15)).status_code == 403
    assert make_client().get(f"/api/attachments/{draft_att}").status_code == 403

    item_att = _upload(leo)
    r = leo.post("/api/classes/DEMO/upcoming", json={"type": "compito", "title": "con foto", "due_date": day, "attachment_id": item_att})
    assert r.status_code == 200
    assert client.get(f"/api/attachments/{item_att}").status_code == 200


def test_orphan_cleanup(client):
    from api.routes.media import cleanup_orphans

    reset_demo(client)
    client.post("/api/auth/demo")
    att = _upload(client)
    with Session(db.engine) as s:
        a = s.get(Attachment, att)
        a.created_at = datetime.now(timezone.utc) - timedelta(hours=50)
        s.add(a)
        s.commit()
        assert cleanup_orphans(s) >= 1
        assert s.get(Attachment, att) is None
