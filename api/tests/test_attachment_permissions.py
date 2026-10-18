from datetime import date
from uuid import uuid4

import pytest
from sqlmodel import Session, select

from api import db
from api.auth import COOKIE_NAME, _serializer
from api.models import Attachment, Classroom, DayCard, LabBlock, Member, ScribeOverride, SubjectEntry, UpcomingItem

from .conftest import make_client
from .test_api import at
from .test_security import _upload

SOURCE_DAY = date(2026, 10, 5)
TARGET_DAY = date(2026, 10, 6)
HEADERS = at(15, day=TARGET_DAY)


@pytest.fixture
def world(client):
    with Session(db.engine) as session:
        classroom = Classroom(code=f"ATT-{uuid4().hex[:8].upper()}", name="Attachment permissions", rotation_anchor=SOURCE_DAY)
        session.add(classroom)
        session.flush()
        people = {}
        for nick, role in (("uploader", "member"), ("writer", "member"), ("reader", "member"), ("admin", "admin")):
            member = Member(class_id=classroom.id, nick=nick, role=role)
            session.add(member)
            session.flush()
            people[nick] = member.id
        for day, nick in ((SOURCE_DAY, "uploader"), (TARGET_DAY, "writer")):
            session.add(ScribeOverride(class_id=classroom.id, day=day, member_id=people[nick], reason="swap"))
        session.commit()
        class_id, code = classroom.id, classroom.code
    clients = {}
    for nick, member_id in people.items():
        c = make_client()
        c.cookies.set(COOKIE_NAME, _serializer.dumps({"t": "m", "id": member_id, "v": 1}))
        clients[nick] = c
    yield {"class_id": class_id, "code": code, "base": f"/api/classes/{code}", "people": people, "clients": clients}
    for c in clients.values():
        c.close()


def item_payload(attachment_id=None):
    return {"type": "compito", "title": "Appunti", "due_date": str(TARGET_DAY), "attachment_id": attachment_id}


def card_payload(attachment_id=None, surface="entry", card=None):
    body = {"revision": card["revision"] if card else 0, "notes": "Appunti",
            "entries": [{"subject_code": "INI", "bullets": ["Lezione"]}], "items": []}
    if surface == "day":
        body["attachment_ids"] = [attachment_id] if attachment_id else []
    elif surface == "entry":
        body["entries"] = [{"subject_code": "INI", "bullets": ["Lezione"], "attachment_ids": [attachment_id] if attachment_id else []}]
    else:
        body["items"] = [item_payload(attachment_id)]
        if card and card["items"]:
            body["items"][0]["id"] = card["items"][0]["id"]
    return body


def save(world, nick, day, body):
    r = world["clients"][nick].put(f"{world['base']}/cards/{day}", json=body, headers=HEADERS)
    assert r.status_code == 200, r.text
    return r.json()


def publish(world, nick, day):
    r = world["clients"][nick].post(f"{world['base']}/cards/{day}/publish", headers=HEADERS)
    assert r.status_code == 200, r.text
    return r.json()


def get_card(world, day):
    r = world["clients"]["admin"].get(f"{world['base']}/cards/{day}", headers=HEADERS)
    assert r.status_code == 200, r.text
    return r.json()["card"]


def source_attachment(world, source):
    attachment_id = _upload(world["clients"]["uploader"], world["code"])
    if source != "orphan":
        save(world, "uploader", SOURCE_DAY, card_payload(attachment_id, "item" if source == "draft_item" else "entry"))
    return attachment_id


def snapshot():
    with Session(db.engine) as session:
        return {model.__name__: [row.model_dump() for row in session.exec(select(model).order_by(model.id)).all()]
                for model in (Attachment, DayCard, SubjectEntry, LabBlock, UpcomingItem)}


@pytest.mark.parametrize("source", ["orphan", "draft_card", "draft_item"])
def test_member_cannot_publish_another_members_private_attachment(world, source):
    attachment_id = source_attachment(world, source)
    writer = world["clients"]["writer"]
    image = f"/api/attachments/{attachment_id}"
    assert writer.get(image, headers=HEADERS).status_code == 403
    before = snapshot()
    r = writer.post(f"{world['base']}/upcoming", json=item_payload(attachment_id), headers=HEADERS)
    assert r.status_code == 403, r.text
    assert snapshot() == before
    assert writer.get(image, headers=HEADERS).status_code == 403


@pytest.mark.parametrize("source", ["orphan", "draft_card", "draft_item"])
@pytest.mark.parametrize("surface", ["day", "entry", "item"])
@pytest.mark.parametrize("target_status", ["new", "draft", "published"])
def test_private_attachment_is_rejected_before_any_day_changes(world, source, surface, target_status):
    attachment_id = source_attachment(world, source)
    card = None
    if target_status != "new":
        card = save(world, "writer", TARGET_DAY, card_payload(surface=surface))
        if target_status == "published":
            r = world["clients"]["writer"].post(f"{world['base']}/cards/{TARGET_DAY}/publish", headers=HEADERS)
            assert r.status_code == 200, r.text
            card = r.json()
    before = snapshot()
    r = world["clients"]["writer"].put(f"{world['base']}/cards/{TARGET_DAY}",
        json=card_payload(attachment_id, surface, card), headers=HEADERS)
    assert r.status_code == 403, r.text
    assert snapshot() == before
    assert world["clients"]["reader"].get(f"/api/attachments/{attachment_id}", headers=HEADERS).status_code == 403


@pytest.mark.parametrize("nick", ["uploader", "admin"])
def test_uploader_and_class_admin_can_publish_an_unlinked_upload(world, nick):
    attachment_id = source_attachment(world, "orphan")
    r = world["clients"][nick].post(f"{world['base']}/upcoming", json=item_payload(attachment_id), headers=HEADERS)
    assert r.status_code == 200, r.text
    assert world["clients"]["reader"].get(f"/api/attachments/{attachment_id}", headers=HEADERS).status_code == 200


@pytest.mark.parametrize("surface", ["day", "entry", "item"])
def test_writer_can_save_and_publish_their_own_upload(world, surface):
    attachment_id = _upload(world["clients"]["writer"], world["code"])
    card = save(world, "writer", TARGET_DAY, card_payload(attachment_id, surface))
    save(world, "writer", TARGET_DAY, card_payload(attachment_id, surface, card))
    r = world["clients"]["writer"].post(f"{world['base']}/cards/{TARGET_DAY}/publish", headers=HEADERS)
    assert r.status_code == 200, r.text
    assert world["clients"]["reader"].get(f"/api/attachments/{attachment_id}", headers=HEADERS).status_code == 200


@pytest.mark.parametrize("nick", ["writer", "admin"])
@pytest.mark.parametrize("surface", ["upcoming", "day", "entry", "item"])
def test_even_admin_cannot_link_attachments_from_another_class(world, nick, surface):
    with Session(db.engine) as session:
        other = Classroom(code=f"OTHER-{uuid4().hex[:8].upper()}", name="Other class", rotation_anchor=SOURCE_DAY)
        session.add(other)
        session.flush()
        card = DayCard(class_id=other.id, day=SOURCE_DAY, status="published")
        session.add(card)
        session.flush()
        attachment = Attachment(class_id=other.id, card_id=card.id, data=b"other class")
        session.add(attachment)
        session.commit()
        attachment_id = attachment.id
    before = snapshot()
    actor = world["clients"][nick]
    if surface == "upcoming":
        r = actor.post(f"{world['base']}/upcoming", json=item_payload(attachment_id), headers=HEADERS)
    else:
        r = actor.put(f"{world['base']}/cards/{TARGET_DAY}", json=card_payload(attachment_id, surface), headers=HEADERS)
    assert r.status_code == 400, r.text
    assert snapshot() == before
    assert actor.get(f"/api/attachments/{attachment_id}", headers=HEADERS).status_code == 403


def test_owner_keeps_read_access_without_acquiring_member_write_access(world):
    attachment_id = source_attachment(world, "orphan")
    with make_client() as owner:
        assert owner.post("/api/owner/login", json={"username": "preside", "password": "test-password"}).status_code == 200
        assert owner.get(f"/api/attachments/{attachment_id}", headers=HEADERS).status_code == 200
        before = snapshot()
        assert owner.post(f"{world['base']}/upcoming", json=item_payload(attachment_id), headers=HEADERS).status_code == 403
        assert owner.put(f"{world['base']}/cards/{TARGET_DAY}", json=card_payload(attachment_id), headers=HEADERS).status_code == 403
        assert snapshot() == before


@pytest.mark.parametrize("source", ["draft_card", "draft_item"])
@pytest.mark.parametrize("surface", ["day", "entry", "item"])
def test_takeover_can_use_private_photos_only_within_the_original_day(world, source, surface):
    attachment_id = source_attachment(world, source)
    orphan = _upload(world["clients"]["uploader"], world["code"])
    writer = world["clients"]["writer"]
    r = writer.post(f"{world['base']}/today/takeover", json={"day": str(SOURCE_DAY)}, headers=HEADERS)
    assert r.status_code == 200, r.text
    assert writer.get(f"/api/attachments/{attachment_id}", headers=HEADERS).status_code == 200
    assert writer.get(f"/api/attachments/{orphan}", headers=HEADERS).status_code == 403
    before = snapshot()
    assert writer.post(f"{world['base']}/upcoming", json=item_payload(attachment_id), headers=HEADERS).status_code == 403
    assert writer.put(f"{world['base']}/cards/{TARGET_DAY}", json=card_payload(attachment_id, surface), headers=HEADERS).status_code == 403
    assert snapshot() == before

    card = get_card(world, SOURCE_DAY)
    body = card_payload(attachment_id, surface, card)
    # The previous writer retains their own upload, but loses the right to save the draft.
    r = world["clients"]["uploader"].put(f"{world['base']}/cards/{SOURCE_DAY}", json=body, headers=HEADERS)
    assert r.status_code == 403, r.text
    saved = save(world, "writer", SOURCE_DAY, body)
    assert saved["status"] == "draft"
    assert world["clients"]["reader"].get(f"/api/attachments/{attachment_id}", headers=HEADERS).status_code == 403
    publish(world, "writer", SOURCE_DAY)
    assert world["clients"]["reader"].get(f"/api/attachments/{attachment_id}", headers=HEADERS).status_code == 200


@pytest.mark.parametrize("source", ["day", "entry", "item", "upcoming"])
@pytest.mark.parametrize("surface", ["day", "entry", "item", "upcoming"])
def test_published_material_can_be_reused_without_changing_the_source(world, source, surface):
    attachment_id = _upload(world["clients"]["uploader"], world["code"])
    if source == "upcoming":
        r = world["clients"]["uploader"].post(f"{world['base']}/upcoming", json=item_payload(attachment_id), headers=HEADERS)
        assert r.status_code == 200, r.text
        original_item = r.json()
    else:
        save(world, "uploader", SOURCE_DAY, card_payload(attachment_id, source))
        publish(world, "uploader", SOURCE_DAY)
    source_before = get_card(world, SOURCE_DAY)
    with Session(db.engine) as session:
        attachment_before = session.get(Attachment, attachment_id).model_dump()
    image = f"/api/attachments/{attachment_id}"
    original_bytes = world["clients"]["reader"].get(image, headers=HEADERS).content

    if surface == "upcoming":
        r = world["clients"]["writer"].post(f"{world['base']}/upcoming", json=item_payload(attachment_id), headers=HEADERS)
        assert r.status_code == 200, r.text
        reused_id = r.json()["attachment_id"]
    else:
        saved = save(world, "writer", TARGET_DAY, card_payload(attachment_id, surface))
        reused_id = (saved["attachments"][0]["id"] if surface == "day" else
                     saved["entries"][0]["attachment_ids"][0] if surface == "entry" else
                     saved["items"][0]["attachment_id"])
        # A second save uses the returned ids and must not create more copies.
        count = len(snapshot()["Attachment"])
        saved_again = save(world, "writer", TARGET_DAY, card_payload(reused_id, surface, saved))
        assert len(snapshot()["Attachment"]) == count
        assert saved_again["status"] == "draft"
        publish(world, "writer", TARGET_DAY)
    assert get_card(world, SOURCE_DAY) == source_before
    with Session(db.engine) as session:
        assert session.get(Attachment, attachment_id).model_dump() == attachment_before
    if source == "upcoming":
        items = world["clients"]["reader"].get(f"{world['base']}/upcoming", params={"from": str(TARGET_DAY)}, headers=HEADERS).json()
        assert next(item for item in items if item["id"] == original_item["id"])["attachment_id"] == attachment_id
    response = world["clients"]["reader"].get(f"/api/attachments/{reused_id}", headers=HEADERS)
    assert response.status_code == 200 and response.content == original_bytes
    assert world["clients"]["reader"].get(image, headers=HEADERS).status_code == 200


@pytest.mark.parametrize("nick", ["uploader", "admin"])
@pytest.mark.parametrize("source", ["draft_card", "draft_item"])
def test_author_and_admin_can_reuse_private_material_without_moving_it(world, nick, source):
    attachment_id = source_attachment(world, source)
    before = get_card(world, SOURCE_DAY)
    saved = save(world, nick, TARGET_DAY, card_payload(attachment_id)) if nick == "admin" else None
    if saved is None:
        # The uploader may publish their own photo as an independent item even when off duty.
        r = world["clients"][nick].post(f"{world['base']}/upcoming", json=item_payload(attachment_id), headers=HEADERS)
        assert r.status_code == 200, r.text
    else:
        assert saved["entries"][0]["attachment_ids"][0] != attachment_id
    assert get_card(world, SOURCE_DAY) == before


def test_rejected_mixed_save_does_not_attach_valid_photos_or_create_copies(world):
    private_id = source_attachment(world, "orphan")
    published_id = source_attachment(world, "draft_card")
    publish(world, "uploader", SOURCE_DAY)
    own_id = _upload(world["clients"]["writer"], world["code"])
    body = card_payload(private_id, "item")
    body["attachment_ids"] = [own_id, published_id]
    before = snapshot()
    r = world["clients"]["writer"].put(f"{world['base']}/cards/{TARGET_DAY}", json=body, headers=HEADERS)
    assert r.status_code == 403, r.text
    assert snapshot() == before


def test_standalone_item_patch_cannot_replace_attachments(world):
    private_id = source_attachment(world, "orphan")
    writer = world["clients"]["writer"]
    r = writer.post(f"{world['base']}/upcoming", json=item_payload(), headers=HEADERS)
    assert r.status_code == 200, r.text
    before = snapshot()
    r = writer.patch(f"{world['base']}/upcoming/{r.json()['id']}", json={"attachment_id": private_id}, headers=HEADERS)
    assert r.status_code == 422, r.text
    assert snapshot() == before


def test_one_copy_serves_all_target_references_and_survives_source_removal(world):
    attachment_id = source_attachment(world, "draft_card")
    source = publish(world, "uploader", SOURCE_DAY)
    body = card_payload(attachment_id)
    body["attachment_ids"] = [attachment_id, attachment_id]
    body["entries"][0]["attachment_ids"] = [attachment_id, attachment_id]
    body["items"] = [item_payload(attachment_id)]
    count = len(snapshot()["Attachment"])
    saved = save(world, "writer", TARGET_DAY, body)
    copied_id = saved["entries"][0]["attachment_ids"][0]
    assert copied_id != attachment_id
    assert len(snapshot()["Attachment"]) == count + 1
    assert saved["entries"][0]["attachment_ids"] == [copied_id]
    assert saved["items"][0]["attachment_id"] == copied_id
    with Session(db.engine) as session:
        original = session.get(Attachment, attachment_id)
        copied = session.get(Attachment, copied_id)
        assert (copied.data, copied.mime, copied.width, copied.height, copied.created_by) == (
            original.data, original.mime, original.width, original.height, original.created_by)
        assert copied.card_id == saved["id"] and original.card_id == source["id"]
    publish(world, "writer", TARGET_DAY)
    save(world, "uploader", SOURCE_DAY, card_payload(card=source))
    reader = world["clients"]["reader"]
    assert reader.get(f"/api/attachments/{attachment_id}", headers=HEADERS).status_code == 403
    assert reader.get(f"/api/attachments/{copied_id}", headers=HEADERS).status_code == 200


def test_stale_revision_does_not_create_copies_or_change_either_day(world):
    attachment_id = source_attachment(world, "draft_card")
    publish(world, "uploader", SOURCE_DAY)
    old = save(world, "writer", TARGET_DAY, card_payload())
    save(world, "writer", TARGET_DAY, card_payload(card=old))
    before = snapshot()
    r = world["clients"]["writer"].put(f"{world['base']}/cards/{TARGET_DAY}",
        json=card_payload(attachment_id, card=old), headers=HEADERS)
    assert r.status_code == 409, r.text
    assert snapshot() == before


@pytest.mark.parametrize("attachment_id", [0, -1, 999999999])
@pytest.mark.parametrize("surface", ["upcoming", "day", "entry", "item"])
def test_invalid_attachment_ids_are_rejected_without_changes(world, attachment_id, surface):
    before = snapshot()
    writer = world["clients"]["writer"]
    if surface == "upcoming":
        r = writer.post(f"{world['base']}/upcoming", json=item_payload(attachment_id), headers=HEADERS)
    else:
        body = card_payload(surface=surface)
        if surface == "day":
            body["attachment_ids"] = [attachment_id]
        elif surface == "entry":
            body["entries"][0]["attachment_ids"] = [attachment_id]
        else:
            body["items"][0]["attachment_id"] = attachment_id
        r = writer.put(f"{world['base']}/cards/{TARGET_DAY}", json=body, headers=HEADERS)
    assert r.status_code == 400, r.text
    assert snapshot() == before
