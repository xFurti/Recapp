from .conftest import make_client


def _official_member():
    owner = make_client()
    assert owner.post("/api/owner/login", json={"username": "preside", "password": "test-password"}).status_code == 200
    created = owner.post("/api/owner/classes", json={"name": "4TU", "label": "Tour", "admin_nick": "capo", "timetable_from": "4BI"}).json()
    code, admin = created["code"], created["admin"]
    student = make_client()
    r = student.post(f"/api/classes/{code}/activate", json={"member_id": admin["member_id"], "invite": admin["invite"], "pin": "111111"})
    assert r.status_code == 200, r.text
    return owner, student, code


def test_tour_is_remembered_per_official_account(client):
    owner, student, code = _official_member()
    assert student.get(f"/api/classes/{code}").json()["viewer"]["tour_seen"] is False

    r = student.post(f"/api/classes/{code}/tour")
    assert r.json() == {"ok": True, "stored": True}
    assert student.get(f"/api/classes/{code}").json()["viewer"]["tour_seen"] is True
    assert student.post(f"/api/classes/{code}/tour").status_code == 200, "repeating is harmless"

    # A classmate on the same class still gets the tour.
    gianni_id = student.post(f"/api/classes/{code}/members", json={"nick": "gianni"}).json()["member_id"]
    invite = student.post(f"/api/classes/{code}/members/{gianni_id}/reset-invite").json()["invite"]
    other = make_client()
    other.post(f"/api/classes/{code}/activate", json={"member_id": gianni_id, "invite": invite, "pin": "222222"})
    assert other.get(f"/api/classes/{code}").json()["viewer"]["tour_seen"] is False

    # The school view has no member account to store it on.
    assert owner.post(f"/api/classes/{code}/tour").json()["stored"] is False


def test_demo_tour_is_not_stored_on_the_shared_nick(client):
    client.post("/api/auth/demo")
    assert client.post("/api/classes/DEMO/tour").json() == {"ok": True, "stored": False}
    assert client.get("/api/classes/DEMO").json()["viewer"]["tour_seen"] is False


def test_tour_needs_a_class_session():
    assert make_client().post("/api/classes/DEMO/tour").status_code == 401
