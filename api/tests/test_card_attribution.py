from datetime import date

import pytest
from sqlmodel import Session, select

from api import db
from api.models import Classroom, ScribeOverride

from .conftest import make_client
from .test_api import at, demo_member, reset_demo

DAY = date(2026, 10, 13)
HEADERS = at(15, day=DAY)


@pytest.fixture(params=["demo", "official"])
def writers(client, request):
    admin = make_client()
    author = make_client()
    if request.param == "demo":
        reset_demo(client)
        demo_member(admin, "leo")
        demo_member(author, "gianni")
        code = "DEMO"
    else:
        assert client.post("/api/owner/login", json={"username": "preside", "password": "test-password"}).status_code == 200
        created = client.post("/api/owner/classes", json={"name": "4AT", "label": "Attribution test", "admin_nick": "Leo", "timetable_from": "4BI"}).json()
        code = created["code"]
        assert admin.post(f"/api/classes/{code}/activate", json={**created["admin"], "pin": "111111"}).status_code == 200
        member = admin.post(f"/api/classes/{code}/members", json={"nick": "Ada"}).json()
        assert author.post(f"/api/classes/{code}/activate", json={**member, "pin": "222222"}).status_code == 200
    author_info = author.get("/api/me").json()["member"]
    admin_info = admin.get("/api/me").json()["member"]
    # Pick a known school day and writer, independently of the rotation/date of execution.
    with Session(db.engine) as session:
        classroom = session.exec(select(Classroom).where(Classroom.code == code)).one()
        override = ScribeOverride(class_id=classroom.id, day=DAY, member_id=author_info["id"], reason="takeover")
        session.add(override)
        session.commit()
        override_id = override.id
    yield code, author, admin, author_info, admin_info, override_id
    author.close()
    admin.close()


def assign_scribe(override_id, member_id):
    with Session(db.engine) as session:
        override = session.get(ScribeOverride, override_id)
        override.member_id = member_id
        session.add(override)
        session.commit()


def payload(card=None, *, notes="", extra_item=False):
    items = card["items"] if card else [{"type": "compito", "subject_code": "INI", "title": "Primo compito", "due_date": DAY.isoformat()}]
    if extra_item:
        items = [*items, {"type": "compito", "subject_code": "INI", "title": "Compito dell'admin", "due_date": DAY.isoformat()}]
    return {
        "revision": card["revision"] if card else 0,
        "entries": [{"subject_code": "INI", "bullets": ["API e database"]}],
        "notes": notes,
        "items": items,
    }


def save(client, url, body):
    response = client.put(url, json=body, headers=HEADERS)
    assert response.status_code == 200, response.text
    return response.json()


def publish(client, url):
    response = client.post(f"{url}/publish", headers=HEADERS)
    assert response.status_code == 200, response.text
    return response.json()


def test_published_author_permissions_counts_and_item_authors_survive_admin_edits(writers):
    code, author, admin, author_info, admin_info, override_id = writers
    base = f"/api/classes/{code}"
    url = f"{base}/cards/{DAY}"
    save(author, url, payload())
    first = publish(author, url)
    assert first["author"]["id"] == author_info["id"]
    assert first["updated_by"] is None
    counts_before = {m["id"]: m["days_written"] for m in admin.get(f"{base}/members", headers=HEADERS).json()["members"]}

    # The original publisher must retain author-based rights even after their turn changes.
    assign_scribe(override_id, admin_info["id"])
    edited = save(admin, url, payload(first, notes="Correzione dell'admin", extra_item=True))
    assert edited["author"] == first["author"]
    assert edited["published_at"] == first["published_at"]
    assert edited["updated_by"]["id"] == admin_info["id"]
    assert edited["items"][0]["author"]["id"] == author_info["id"]
    assert edited["items"][1]["author"]["id"] == admin_info["id"]
    assert all(item["status"] == "published" for item in edited["items"])
    page = author.get(url, headers=HEADERS).json()
    assert page["state"]["can_write"] and not page["state"]["is_me_scribe"]
    counts_after = {m["id"]: m["days_written"] for m in admin.get(f"{base}/members", headers=HEADERS).json()["members"]}
    assert counts_after == counts_before
    today = author.get(f"{base}/today", headers=HEADERS).json()["card"]
    summary = next(c for c in author.get(f"{base}/cards").json() if c["day"] == str(DAY))
    subject = next(e for e in author.get(f"{base}/subjects/INI/entries", headers=HEADERS).json() if e["day"] == str(DAY))
    for surface in (page["card"], today, summary, subject):
        assert surface["author"] == first["author"]
        assert surface["updated_by"] == edited["updated_by"]

    # The editor calls publish again after saving an already published day.
    republished = publish(admin, url)
    assert republished["author"] == first["author"]
    assert republished["published_at"] == first["published_at"]
    assert republished["updated_by"] == edited["updated_by"]
    stale = author.put(url, json=payload(first), headers=HEADERS)
    assert stale.status_code == 409
    assert stale.json()["detail"]["card"]["updated_by"] == edited["updated_by"]

    own_edit = save(author, url, payload(republished, notes="Correzione del redattore"))
    assert own_edit["author"] == first["author"]
    assert own_edit["published_at"] == first["published_at"]
    assert own_edit["updated_by"] is None
    assert own_edit["items"][1]["author"]["id"] == admin_info["id"]
    for surface in (
        author.get(f"{base}/today", headers=HEADERS).json()["card"],
        next(c for c in author.get(f"{base}/cards").json() if c["day"] == str(DAY)),
        next(e for e in author.get(f"{base}/subjects/INI/entries", headers=HEADERS).json() if e["day"] == str(DAY)),
    ):
        assert surface["updated_by"] is None


def test_drafts_follow_writer_but_first_publication_records_actual_publisher(writers):
    code, author, admin, author_info, admin_info, _ = writers
    url = f"/api/classes/{code}/cards/{DAY}"
    draft = save(author, url, payload())
    assert draft["author"]["id"] == author_info["id"] and draft["updated_by"] is None
    admin_draft = save(admin, url, payload(draft))
    assert admin_draft["author"]["id"] == admin_info["id"] and admin_draft["updated_by"] is None
    own_draft = save(author, url, payload(admin_draft))
    assert own_draft["author"]["id"] == author_info["id"]
    # Publishing someone else's draft without an intervening save still credits the publisher.
    published = publish(admin, url)
    assert published["author"]["id"] == admin_info["id"]
    assert published["scribe"]["id"] == author_info["id"]
    assert published["updated_by"] is None


def test_admin_can_publish_without_scribe_then_distinguish_another_editor(writers):
    code, author, admin, author_info, admin_info, override_id = writers
    assign_scribe(override_id, None)
    url = f"/api/classes/{code}/cards/{DAY}"
    save(admin, url, payload())
    published = publish(admin, url)
    assert published["author"]["id"] == admin_info["id"]
    assert published["updated_by"] is None
    assign_scribe(override_id, author_info["id"])
    edited = save(author, url, payload(published, notes="Aggiornamento del compagno"))
    assert edited["author"] == published["author"]
    assert edited["published_at"] == published["published_at"]
    assert edited["updated_by"]["id"] == author_info["id"]
