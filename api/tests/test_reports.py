import io

from PIL import Image
from sqlmodel import Session

from api import db
from api.models import Report

from .conftest import make_client

UA_IPHONE = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
)


def own_demo(client) -> dict:
    """A private demo, as Try the demo opens it: every client gets its own class and nick."""
    r = client.post("/api/auth/demo/mine")
    assert r.status_code == 200, r.text
    return r.json()


def owner_login(client) -> None:
    r = client.post("/api/owner/login", json={"username": "preside", "password": "test-password"})
    assert r.status_code == 200, r.text


def send(client, **fields):
    files = fields.pop("files", None)
    data = {"kind": "bug", "title": "Il tasto non va", "body": "Tocco e non succede nulla.", **fields}
    return client.post("/api/reports", data=data, files=files)


def jpeg_with_gps() -> bytes:
    img = Image.new("RGB", (40, 30), "red")
    exif = Image.Exif()
    exif[0x010F] = "Phone maker"  # Make
    exif[0x8825] = {2: (45.0, 26.0, 0.0)}  # GPS latitude
    out = io.BytesIO()
    img.save(out, "JPEG", exif=exif)
    return out.getvalue()


def test_member_sends_and_reads_only_own_reports(client):
    me = own_demo(client)
    r = send(client, page="/c/X/in-arrivo?secret=1", language="it", theme="dark")
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "new"
    mine = client.get("/api/reports/mine").json()
    assert [m["title"] for m in mine] == ["Il tasto non va"]

    other = make_client()
    own_demo(other)
    assert other.get("/api/reports/mine").json() == []

    with Session(db.engine) as s:
        report = s.get(Report, mine[0]["id"])
        assert report.is_demo is True
        assert report.context["nick"] == me["nick"]
        assert report.context["class_code"] == me["code"]
        assert report.context["page"] == "/c/X/in-arrivo"
        assert report.context["theme"] == "dark"
        assert "pin" not in str(report.context).lower()


def test_anonymous_report_has_no_author_and_no_list(client):
    r = client.post(
        "/api/reports",
        data={"kind": "feature", "title": "Idea", "body": "Per chi entra la prima volta.", "page": "/faq"},
        headers={"user-agent": UA_IPHONE},
    )
    assert r.status_code == 200, r.text
    assert client.get("/api/reports/mine").json() == []
    with Session(db.engine) as s:
        report = s.get(Report, r.json()["id"])
        assert report.member_id is None and report.class_id is None
        assert report.context["role"] == "none"
        assert report.context["user_agent"] == "Safari 18 · iOS"
    # A member never inherits an anonymous report.
    own_demo(client)
    assert all(m["id"] != r.json()["id"] for m in client.get("/api/reports/mine").json())


def test_required_fields_and_limits(client):
    r = send(client, title="   ")
    assert r.status_code == 422 and r.json()["detail"]["field"] == "title"
    r = send(client, body="")
    assert r.status_code == 422 and r.json()["detail"]["field"] == "body"
    assert send(client, title="x" * 121).status_code == 422
    assert send(client, body="x" * 2001).status_code == 422
    assert send(client, kind="question").status_code == 422


def test_text_is_stored_as_written(client):
    owner = make_client()
    owner_login(owner)
    r = send(client, title="<b>grassetto</b>", body="<script>alert(1)</script>")
    assert r.status_code == 200
    found = next(x for x in owner.get("/api/owner/reports").json() if x["id"] == r.json()["id"])
    assert found["title"] == "<b>grassetto</b>"
    assert found["body"] == "<script>alert(1)</script>"


def test_image_is_cleaned_and_non_images_refused(client):
    own_demo(client)
    r = send(client, files={"image": ("note.txt", b"not an image", "text/plain")})
    assert r.status_code == 415
    r = send(client, files={"image": ("photo.jpg", jpeg_with_gps(), "image/jpeg")})
    assert r.status_code == 200, r.text
    assert r.json()["has_image"] is True
    img = client.get(f"/api/reports/{r.json()['id']}/image")
    assert img.status_code == 200 and img.headers["content-type"] == "image/webp"
    stored = Image.open(io.BytesIO(img.content))
    assert not stored.getexif()
    assert make_client().get(f"/api/reports/{r.json()['id']}/image").status_code == 404
    classmate = make_client()
    own_demo(classmate)
    assert classmate.get(f"/api/reports/{r.json()['id']}/image").status_code == 404


def test_owner_lists_filters_and_updates_status(client):
    own_demo(client)
    demo_id = send(client, title="Dalla demo").json()["id"]
    anon_id = send(make_client(), title="Dalla home").json()["id"]

    owner = make_client()
    assert owner.get("/api/owner/reports").status_code == 401
    owner_login(owner)
    every = {x["id"]: x for x in owner.get("/api/owner/reports").json()}
    assert {demo_id, anon_id} <= set(every)
    assert every[demo_id]["is_demo"] is True and every[demo_id]["context"]["role"] in ("admin", "member")
    hidden = {x["id"] for x in owner.get("/api/owner/reports?demo=hide").json()}
    assert anon_id in hidden and demo_id not in hidden
    only = {x["id"] for x in owner.get("/api/owner/reports?demo=only").json()}
    assert demo_id in only and anon_id not in only

    r = owner.patch(f"/api/owner/reports/{demo_id}", json={"status": "in_progress"})
    assert r.status_code == 200 and r.json()["status"] == "in_progress"
    assert owner.patch(f"/api/owner/reports/{demo_id}", json={"status": "done"}).status_code == 422
    assert client.patch(f"/api/owner/reports/{demo_id}", json={"status": "closed"}).status_code == 401
    assert next(m for m in client.get("/api/reports/mine").json() if m["id"] == demo_id)["status"] == "in_progress"


def test_rate_limit_is_enforced_on_the_server(client):
    for _ in range(5):
        assert send(client).status_code == 200
    r = send(client)
    assert r.status_code == 429
    assert "Riprova più tardi" in r.json()["detail"]


def test_purged_demo_members_lose_their_reports(client):
    own_demo(client)
    rid = send(client).json()["id"]
    from api.seed import purge_private_demos

    with Session(db.engine) as s:
        purge_private_demos(s)
    with Session(db.engine) as s:
        report = s.get(Report, rid)
        assert report is not None and report.member_id is None
