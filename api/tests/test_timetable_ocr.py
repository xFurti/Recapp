"""Timetable screenshot: a draft is proposed, and the saved grid changes only on confirm."""

import io
from pathlib import Path

from PIL import Image, ImageDraw
from sqlmodel import Session, select

from api import db
from api.models import Subject, TimetableSlot
from api.timetable_ocr import FIXTURE_LESSONS, validate_timetable

from .conftest import make_client
from .test_api import demo_member

FIXTURE = Path(__file__).parent / "fixtures" / "orario-finto.png"

CONTEXT = {
    "subjects": [
        {"code": "MAT", "name_it": "Matematica", "name_en": "Math"},
        {"code": "INI", "name_it": "Informatica", "name_en": "Computer Science"},
        {"code": "STO", "name_it": "Storia", "name_en": "History"},
        {"code": "ING", "name_it": "Inglese", "name_en": "English"},
        {"code": "LIT", "name_it": "Italiano", "name_en": "Italian"},
        {"code": "SMS", "name_it": "Scienze motorie", "name_en": "PE"},
        {"code": "IRC", "name_it": "Religione", "name_en": "Religion"},
    ],
    "hours": [1, 2, 3, 4, 5, 6, 7],
}


def render_fake_timetable(path: Path = FIXTURE) -> None:
    """A made-up grid. It is not a photo of a real class."""
    path.parent.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGB", (920, 460), "#f6f4f1")
    draw = ImageDraw.Draw(img)
    draw.rectangle((16, 16, 904, 444), outline="#1d1b1e", width=3)
    draw.text((32, 28), "Orario finto — classe di prova", fill="#1d1b1e")
    draw.text((32, 56), "Nessuna classe reale. I nomi non fanno parte dell'orario.", fill="#6b6570")
    headers = ["", "Lun", "Mar", "Mer", "Gio", "Ven"]
    rows = [
        ["1ª", "MAT A215", "STO A210", "ING A118", "", "SMS Palestra"],
        ["2ª", "INI L145", "", "LIT Laboratorio", "", "Filosofia A12"],
        ["", "prof. Rossi accanto a MAT", "", "", "Religione senza ora", ""],
    ]
    for col, label in enumerate(headers):
        draw.text((40 + col * 140, 100), label, fill="#a02848")
    for row, cells in enumerate(rows):
        for col, label in enumerate(cells):
            draw.text((40 + col * 140, 150 + row * 70), label, fill="#1d1b1e")
    img.save(path, "PNG")


def _cell(parsed: dict, weekday: int, hour: int) -> dict:
    return next(cell for cell in parsed["slots"] if cell["weekday"] == weekday and cell["hour"] == hour)


def test_reading_drops_names_and_flags_what_it_cannot_place():
    parsed = validate_timetable(FIXTURE_LESSONS, CONTEXT)
    monday = _cell(parsed, 0, 1)
    assert monday["subject_code"] == "MAT"
    assert monday["room"] == "A215"
    assert monday["check_reason"] == "duplicate"
    assert "Rossi" not in monday["room"] and "Bianchi" not in str(parsed)
    lab = _cell(parsed, 0, 2)
    assert lab["subject_code"] == "INI" and lab["room"] == "L145" and lab["is_lab"] is True
    italian = _cell(parsed, 2, 2)
    assert italian["subject_code"] == "LIT" and italian["is_lab"] is True
    unknown = _cell(parsed, 4, 2)
    assert unknown["subject_code"] is None and unknown["check_reason"] == "unknown_subject"
    assert unknown["raw_subject"] == "Filosofia"
    assert parsed["unplaced"] == [{"raw_subject": "Religione", "reason": "unclear_hour", "detail": "giovedì"}]
    assert not any(cell["hour"] is None for cell in parsed["slots"])


def test_empty_reading_is_not_a_timetable():
    assert validate_timetable({"lezioni": []}, CONTEXT) == {"slots": [], "unplaced": []}
    assert validate_timetable("non è un orario", CONTEXT) == {"slots": [], "unplaced": []}


def _png() -> bytes:
    if not FIXTURE.exists():
        render_fake_timetable()
    return FIXTURE.read_bytes()


def _official(name: str, nick: str):
    owner = make_client()
    assert owner.post("/api/owner/login", json={"username": "preside", "password": "test-password"}).status_code == 200
    created = owner.post("/api/owner/classes", json={"name": name, "label": "Prova", "admin_nick": nick, "timetable_from": "4BI"}).json()
    admin = make_client()
    activated = admin.post(
        f"/api/classes/{created['code']}/activate",
        json={"member_id": created["admin"]["member_id"], "invite": created["admin"]["invite"], "pin": "111111"},
    )
    assert activated.status_code == 200, activated.text
    return admin, created["code"]


def test_screenshot_proposes_a_draft_and_saves_only_after_confirm(client):
    admin, code = _official("4TT", "capo")
    before = admin.get(f"/api/classes/{code}/timetable").json()["slots"]
    assert before, "the class already has a timetable"
    upload = admin.post(
        f"/api/classes/{code}/attachments",
        files={"file": ("orario-finto.png", _png(), "image/png")},
        data={"privacy_ok": "true"},
    )
    assert upload.status_code == 200, upload.text
    started = admin.post(f"/api/classes/{code}/ocr", json={"purpose": "timetable", "attachment_id": upload.json()["id"]})
    assert started.status_code == 200, started.text
    job = admin.get(f"/api/classes/{code}/ocr/{started.json()['job_id']}").json()
    assert job["status"] == "done"
    assert job["drafts"] == []
    draft = job["timetable"]
    assert _cell(draft, 0, 2)["is_lab"] is True
    assert any(cell["check_reason"] == "unknown_subject" for cell in draft["slots"])
    assert admin.get(f"/api/classes/{code}/timetable").json()["slots"] == before

    confirmed = [
        {"weekday": cell["weekday"], "hour": cell["hour"], "subject_code": cell["subject_code"], "room": cell["room"]}
        for cell in draft["slots"]
        if cell["subject_code"]
    ]
    saved = admin.put(f"/api/classes/{code}/timetable", json={"slots": confirmed})
    assert saved.status_code == 200, saved.text
    after = admin.get(f"/api/classes/{code}/timetable").json()["slots"]
    assert {(s["weekday"], s["hour"], s["subject_code"], s["room"]) for s in after} == {
        (s["weekday"], s["hour"], s["subject_code"], s["room"]) for s in confirmed
    }
    assert any(s["is_lab"] and s["room"] == "L145" for s in after)
    with Session(db.engine) as session:
        from api.models import Classroom

        classroom = session.exec(select(Classroom).where(Classroom.code == code)).one()
        codes = set(session.exec(select(Subject.code).where(Subject.class_id == classroom.id)).all())
    assert "Filosofia" not in codes


def test_demo_and_members_cannot_read_a_timetable_and_a_second_read_waits(client, monkeypatch):
    demo_member(client, "leo")
    denied = client.post("/api/classes/DEMO/ocr", json={"purpose": "timetable", "attachment_id": 1})
    assert denied.status_code == 403

    admin, code = _official("4TS", "ada")
    member_id = admin.post(f"/api/classes/{code}/members", json={"nick": "nina"}).json()["member_id"]
    invite = admin.post(f"/api/classes/{code}/members/{member_id}/reset-invite").json()["invite"]
    member = make_client()
    member.post(f"/api/classes/{code}/activate", json={"member_id": member_id, "invite": invite, "pin": "222222"})
    upload = member.post(
        f"/api/classes/{code}/attachments",
        files={"file": ("x.png", _png(), "image/png")},
        data={"privacy_ok": "true"},
    )
    assert member.post(f"/api/classes/{code}/ocr", json={"purpose": "timetable", "attachment_id": upload.json()["id"]}).status_code == 403

    held = {}

    def hold(session, job, payload, background):
        held["id"] = job.id

    monkeypatch.setattr("api.routes.media.start_job", hold)
    photo = admin.post(
        f"/api/classes/{code}/attachments",
        files={"file": ("orario-finto.png", _png(), "image/png")},
        data={"privacy_ok": "true"},
    ).json()["id"]
    first = admin.post(f"/api/classes/{code}/ocr", json={"purpose": "timetable", "attachment_id": photo})
    assert first.status_code == 200, first.text
    second = admin.post(f"/api/classes/{code}/ocr", json={"purpose": "timetable", "attachment_id": photo})
    assert second.status_code == 409
    assert "lettura" in second.json()["detail"].lower()


def test_a_file_that_is_not_an_image_is_refused(client):
    admin, code = _official("4TV", "bea")
    refused = admin.post(
        f"/api/classes/{code}/attachments",
        files={"file": ("note.txt", io.BytesIO(b"non e un orario"), "text/plain")},
        data={"privacy_ok": "true"},
    )
    assert refused.status_code == 415
