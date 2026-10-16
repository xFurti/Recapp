from datetime import timedelta
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from api import db
from api.auth import COOKIE_NAME, _serializer
from api.models import Attachment, Classroom, DayCard, ItemCorrection, Member, Subject, UpcomingItem

from .conftest import make_client
from .test_api import TODAY, at


@pytest.fixture(params=[False, True], ids=["official", "demo"])
def scenario(client, request):
    with Session(db.engine) as s:
        classroom = Classroom(code=f"COR-{uuid4().hex[:8].upper()}", name="4BI", is_demo=request.param, rotation_anchor=TODAY)
        s.add(classroom)
        s.flush()
        people = {}
        for nick, role in [("author", "member"), ("student", "member"), ("other", "member"), ("admin", "admin")]:
            member = Member(class_id=classroom.id, nick=nick, role=role)
            s.add(member)
            s.flush()
            people[nick] = member.id
        s.add(Subject(class_id=classroom.id, code="MAT", name_it="Matematica", name_en="Math", color="#1898C8"))
        card = DayCard(class_id=classroom.id, day=TODAY, author_member_id=people["author"], status="published", notes="Original recap")
        s.add(card)
        s.flush()
        attachment = Attachment(class_id=classroom.id, data=b"image", created_by=people["author"])
        s.add(attachment)
        s.flush()
        item = UpcomingItem(class_id=classroom.id, card_id=card.id, author_member_id=people["author"],
                            type="compito", subject_code="MAT", title="Esercizi 1–5", due_date=TODAY,
                            due_time="09:30", source="Classroom", link="https://example.org/work", attachment_id=attachment.id)
        s.add(item)
        s.commit()
        code, item_id, card_id, attachment_id = classroom.code, item.id, card.id, attachment.id
    clients = {}
    for nick, member_id in people.items():
        c = make_client()
        c.cookies.set(COOKIE_NAME, _serializer.dumps({"t": "m", "id": member_id, "v": 1}))
        clients[nick] = c
    return {"clients": clients, "people": people, "code": code, "base": f"/api/classes/{code}/upcoming",
            "url": f"/api/classes/{code}/upcoming/{item_id}", "item_id": item_id, "card_id": card_id, "attachment_id": attachment_id}


def propose(scenario, nick="student", proposed=None, reason="La docente ha indicato un altro giorno"):
    r = scenario["clients"][nick].post(scenario["url"] + "/corrections", headers=at(15), json={
        "proposed": proposed or {"title": "Esercizi 1–10", "due_date": (TODAY + timedelta(days=1)).isoformat()}, "reason": reason,
    })
    assert r.status_code == 200, r.text
    return r.json()


def details(scenario, nick="student"):
    r = scenario["clients"][nick].get(scenario["url"] + "/corrections")
    assert r.status_code == 200, r.text
    return r.json()


def decision(scenario, correction, action="accept", nick="author", note=""):
    return scenario["clients"][nick].post(scenario["url"] + f"/corrections/{correction['id']}/decide", json={"action": action, "note": note})


def test_acceptance_preserves_attribution_and_non_proposed_fields(scenario):
    r = propose(scenario)
    # Manual edits made after the proposal must survive acceptance.
    assert scenario["clients"]["author"].patch(scenario["url"], json={"source": "Campus", "link": "example.org/new"}).status_code == 200
    accepted = decision(scenario, r)
    assert accepted.status_code == 200, accepted.text
    audit = accepted.json()
    assert audit["status"] == "accepted" and audit["decided_by"]["id"] == scenario["people"]["author"]
    assert audit["decided_at"] and not audit["already_fixed"]
    item = details(scenario)["item"]
    assert item["title"] == "Esercizi 1–10" and item["due_date"] == (TODAY + timedelta(days=1)).isoformat()
    assert item["author"]["id"] == scenario["people"]["author"]
    assert item["source"] == "Campus" and item["link"] == "https://example.org/new"
    assert item["due_time"] == "09:30" and item["attachment_id"] == scenario["attachment_id"]
    assert item["card_day"] == TODAY.isoformat()
    assert decision(scenario, r, "reject").status_code == 409
    assert details(scenario)["requests"][0]["status"] == "accepted"
    with Session(db.engine) as s:
        card = s.get(DayCard, scenario["card_id"])
        assert card.author_member_id == scenario["people"]["author"] and card.notes == "Original recap"
        assert card.revision == 2  # manual patch + accepted proposal invalidate stale editors


def test_privacy_upsert_and_multiple_pending_requests(scenario):
    first = propose(scenario)
    replacement = propose(scenario, proposed={"title": "Esercizi 1–12"}, reason="Intervallo corretto")
    assert first["id"] == replacement["id"]
    assert replacement["proposed"] == {"title": "Esercizi 1–12"}
    assert len(details(scenario)["requests"]) == 1
    assert details(scenario, "other")["requests"] == []
    second = propose(scenario, "other", {"title": "Esercizi 1–20", "source": "Campus"}, "Seconda proposta")
    assert len(details(scenario, "other")["requests"]) == 1
    assert details(scenario, "other")["requests"][0]["id"] == second["id"]
    assert len(details(scenario, "author")["requests"]) == 2
    assert len(details(scenario, "admin")["requests"]) == 2
    for nick in ("author", "admin"):
        inbox = scenario["clients"][nick].get(scenario["base"] + "/corrections").json()
        assert inbox["pending_count"] == 2 and inbox["items"][0]["pending_count"] == 2
        # Inbox rows carry the same viewer flags as list rows, so the panel opened from them is complete.
        assert inbox["items"][0]["item"]["can_review_corrections"]
        assert inbox["items"][0]["item"]["can_request_correction"] == (nick == "admin")
    assert details(scenario, "admin")["item"]["can_request_correction"]
    assert not details(scenario, "author")["item"]["can_request_correction"]
    assert scenario["clients"]["student"].get(scenario["base"] + "/corrections").json()["pending_count"] == 0
    assert decision(scenario, replacement).status_code == 200
    remaining = details(scenario, "other")
    assert remaining["item"]["title"] == "Esercizi 1–12"
    assert remaining["requests"][0]["status"] == "pending"
    assert decision(scenario, second).status_code == 200
    assert details(scenario)["item"]["title"] == "Esercizi 1–20"
    with Session(db.engine) as s:
        assert len(s.exec(select(ItemCorrection).where(ItemCorrection.item_id == scenario["item_id"])).all()) == 2


def test_rejection_and_already_fixed_do_not_write_item(scenario):
    first = propose(scenario)
    with Session(db.engine) as s:
        previous = s.get(UpcomingItem, scenario["item_id"]).updated_at
    rejected = decision(scenario, first, "reject", note="La scadenza sul registro è corretta")
    assert rejected.status_code == 200
    assert rejected.json()["decision_note"] == "La scadenza sul registro è corretta"
    assert details(scenario)["requests"][0]["status"] == "rejected"
    with Session(db.engine) as s:
        assert s.get(UpcomingItem, scenario["item_id"]).updated_at == previous
    second = propose(scenario, proposed={"title": "Titolo corretto"})
    assert second["id"] != first["id"]
    assert decision(scenario, second, "already_fixed").status_code == 409
    assert scenario["clients"]["author"].patch(scenario["url"], json={"title": "Titolo corretto"}).status_code == 200
    with Session(db.engine) as s:
        previous = s.get(UpcomingItem, scenario["item_id"]).updated_at
    fixed = decision(scenario, second, "already_fixed")
    assert fixed.status_code == 200 and fixed.json()["already_fixed"]
    assert fixed.json()["status"] == "accepted"
    with Session(db.engine) as s:
        assert s.get(UpcomingItem, scenario["item_id"]).updated_at == previous


def test_author_admin_and_removed_author(scenario):
    r = propose(scenario)
    assert decision(scenario, r, nick="student").status_code == 403
    assert decision(scenario, r, nick="other").status_code == 403
    own = scenario["clients"]["author"].post(scenario["url"] + "/corrections", json={"proposed": {"title": "x"}, "reason": "y"})
    assert own.status_code == 403
    with Session(db.engine) as s:
        author = s.get(Member, scenario["people"]["author"])
        author.active = False
        s.add(author)
        s.commit()
    assert scenario["clients"]["admin"].patch(scenario["url"], json={"source": "Campus"}).status_code == 200
    assert decision(scenario, r, nick="admin").status_code == 200
    assert details(scenario)["item"]["author"]["id"] == scenario["people"]["author"]


@pytest.mark.parametrize("payload", [
    {"proposed": {"title": "x"}, "reason": " "},
    {"proposed": {"due_time": "11:00"}, "reason": "x"},
    {"proposed": {"author_member_id": 999}, "reason": "x"},
    {"proposed": {"attachment_id": 999}, "reason": "x"},
    {"proposed": {"class_id": 999}, "reason": "x"},
    {"proposed": {"type": "invalid"}, "reason": "x"},
    {"proposed": {"title": " "}, "reason": "x"},
    {"proposed": {"due_date": None}, "reason": "x"},
    {"proposed": {"source": None}, "reason": "x"},
    {"proposed": {}, "reason": "x"},
    {"proposed": {"title": "Esercizi 1–5"}, "reason": "x"},
    {"proposed": {"subject_code": "ALIEN"}, "reason": "x"},
])
def test_invalid_proposals_leave_no_request(scenario, payload):
    r = scenario["clients"]["student"].post(scenario["url"] + "/corrections", json=payload)
    assert r.status_code in (400, 422), r.text
    assert details(scenario)["requests"] == []


def test_validation_matches_normal_patch_and_applies_all_six_fields(scenario):
    proposed = {"type": "lab", "subject_code": None, "title": "  Portare il computer  ",
                "due_date": (TODAY + timedelta(days=2)).isoformat(), "source": "Campus", "link": "example.org/lab"}
    r = propose(scenario, proposed=proposed)
    assert r["proposed"]["title"] == "Portare il computer" and r["proposed"]["link"] == "https://example.org/lab"
    assert decision(scenario, r).status_code == 200
    item = details(scenario)["item"]
    assert all(item[k] == v for k, v in r["proposed"].items())
    assert scenario["clients"]["author"].patch(scenario["url"], json={"title": " "}).status_code == 422
    assert scenario["clients"]["author"].patch(scenario["url"], json={"subject_code": "ALIEN"}).status_code == 400


def test_revalidation_past_drafts_scope_and_owner_privacy(scenario):
    r = propose(scenario, proposed={"subject_code": "MAT", "title": "Altro titolo"})
    # This proposal changes title only, so changing subjects manually is preserved.
    assert r["proposed"] == {"title": "Altro titolo"}
    with Session(db.engine) as s:
        item = s.get(UpcomingItem, scenario["item_id"])
        item.due_date = TODAY - timedelta(days=1)
        s.add(item)
        s.commit()
    past = scenario["clients"]["student"].get(scenario["base"] + "?range=past", headers=at(15)).json()
    row = next(i for i in past if i["id"] == scenario["item_id"])
    assert not row["can_request_correction"] and row["my_correction"]["status"] == "pending"
    late = scenario["clients"]["other"].post(scenario["url"] + "/corrections", json={"proposed": {"title": "late"}, "reason": "late"}, headers=at(15))
    assert late.status_code == 409
    assert decision(scenario, r, "reject").status_code == 200, "existing requests remain decidable when overdue"
    with Session(db.engine) as s:
        other_class = Classroom(code=f"FOREIGN-{uuid4().hex[:6].upper()}", name="other", rotation_anchor=TODAY)
        s.add(other_class)
        s.flush()
        stranger = Member(class_id=other_class.id, nick="stranger")
        s.add(stranger)
        s.commit()
        stranger_id, other_code = stranger.id, other_class.code
    stranger_client = make_client()
    stranger_client.cookies.set(COOKIE_NAME, _serializer.dumps({"t": "m", "id": stranger_id, "v": 1}))
    assert stranger_client.get(scenario["url"] + "/corrections").status_code == 403
    assert stranger_client.get(f"/api/classes/{other_code}/upcoming/{scenario['item_id']}/corrections").status_code == 404
    assert make_client().get(scenario["url"] + "/corrections").status_code == 401
    owner = make_client()
    assert owner.post("/api/owner/login", json={"username": "preside", "password": "test-password"}).status_code == 200
    assert owner.get(scenario["url"] + "/corrections").status_code == 403
    assert owner.get(scenario["base"] + "/corrections").json()["pending_count"] == 0
    with Session(db.engine) as s:
        item = s.get(UpcomingItem, scenario["item_id"])
        item.status = "draft"
        s.add(item)
        s.commit()
    assert scenario["clients"]["student"].get(scenario["url"] + "/corrections").status_code == 404


def test_pending_unique_index_cleanup_and_today_metadata(scenario):
    r = propose(scenario)
    student_today = scenario["clients"]["student"].get(f"/api/classes/{scenario['code']}/today", headers=at(15)).json()
    row = next(i for i in student_today["upcoming_soon"] if i["id"] == scenario["item_id"])
    assert row["my_correction"]["id"] == r["id"] and row["pending_corrections"] == 0
    author_today = scenario["clients"]["author"].get(f"/api/classes/{scenario['code']}/today", headers=at(15)).json()
    row = next(i for i in author_today["upcoming_soon"] if i["id"] == scenario["item_id"])
    assert row["pending_corrections"] == 1 and not row["can_request_correction"]
    with Session(db.engine) as s:
        s.add(ItemCorrection(class_id=s.get(UpcomingItem, scenario["item_id"]).class_id,
                             item_id=scenario["item_id"], member_id=scenario["people"]["student"], proposed={"title": "duplicate"}, reason="duplicate"))
        with pytest.raises(IntegrityError):
            s.commit()
    assert scenario["clients"]["author"].delete(scenario["url"]).status_code == 200
    with Session(db.engine) as s:
        assert s.get(ItemCorrection, r["id"]) is None


@pytest.mark.parametrize("item_type", ["compito", "verifica", "evento", "lab"])
def test_every_item_type_and_day_feedback_are_independent(scenario, item_type):
    assert scenario["clients"]["author"].patch(scenario["url"], json={"type": item_type}).status_code == 200
    feedback_url = f"/api/classes/{scenario['code']}/cards/{TODAY.isoformat()}"
    assert scenario["clients"]["student"].post(feedback_url + "/comments", json={"kind": "correction", "body": "Il compito ha un errore"}).status_code == 200
    assert details(scenario)["requests"] == []
    assert details(scenario)["item"]["title"] == "Esercizi 1–5"
    proposal = propose(scenario)
    assert decision(scenario, proposal).status_code == 200
    feedback = scenario["clients"]["student"].get(feedback_url + "/feedback").json()
    assert feedback["open_corrections"] == 1 and not feedback["comments"][0]["resolved"]
    assert details(scenario)["item"]["type"] == item_type


def test_decision_revalidates_subject_and_rolls_back_audit(scenario):
    with Session(db.engine) as s:
        class_id = s.get(UpcomingItem, scenario["item_id"]).class_id
        subject = Subject(class_id=class_id, code="INI", name_it="Informatica", name_en="CS", color="#80B830")
        s.add(subject)
        s.commit()
        subject_id = subject.id
    proposal = propose(scenario, proposed={"subject_code": "INI"})
    with Session(db.engine) as s:
        s.delete(s.get(Subject, subject_id))
        s.commit()
    failed = decision(scenario, proposal)
    assert failed.status_code == 400
    unchanged = details(scenario)
    assert unchanged["requests"][0]["status"] == "pending" and unchanged["requests"][0]["decided_by"] is None
    assert unchanged["item"]["subject_code"] == "MAT"
    assert decision(scenario, proposal, "reject").status_code == 200


def test_concurrent_decisions_preserve_audit_and_independent_fields(scenario):
    first = propose(scenario, proposed={"title": "Titolo corretto"})
    second = propose(scenario, "other", proposed={"source": "Campus"})
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda args: decision(scenario, *args), [(first, "accept", "author"), (second, "accept", "admin")]))
    assert [r.status_code for r in responses] == [200, 200]
    item = details(scenario)["item"]
    assert item["title"] == "Titolo corretto" and item["source"] == "Campus"
    assert item["author"]["id"] == scenario["people"]["author"]
    third = propose(scenario, proposed={"title": "Ancora corretto"})
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda nick: decision(scenario, third, nick=nick), ["author", "admin"]))
    assert sorted(r.status_code for r in responses) == [200, 409]
    audit = next(r for r in details(scenario)["requests"] if r["id"] == third["id"])
    assert audit["status"] == "accepted" and audit["decided_by"]["id"] in (scenario["people"]["author"], scenario["people"]["admin"])
