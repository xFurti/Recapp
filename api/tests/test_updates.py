import dataclasses

import httpx
import pytest

from api import updates


@pytest.fixture
def render(monkeypatch):
    """Configures the deploy check and fakes Render's deploy list; returns the call log."""
    monkeypatch.setattr(updates, "settings", dataclasses.replace(updates.settings, render_api_key="k", render_service_id="srv-1", app_version="aaa"))
    updates.reset_cache()
    state = {"deploys": [], "error": None, "calls": 0}

    def fake_get(url, params=None, headers=None, timeout=None):
        state["calls"] += 1
        assert url.endswith("/services/srv-1/deploys") and headers["Authorization"] == "Bearer k"
        if state["error"]:
            raise state["error"]
        return httpx.Response(200, json=[{"deploy": d, "cursor": "c"} for d in state["deploys"]], request=httpx.Request("GET", url))

    monkeypatch.setattr(updates.httpx, "get", fake_get)
    yield state
    updates.reset_cache()


def deploy(id_, status, commit):
    return {"id": id_, "status": status, "commit": {"id": commit, "message": "secret message"}}


def test_version_without_render_config(client):
    updates.reset_cache()
    r = client.get("/api/version")
    assert r.status_code == 200
    assert r.json() == {"version": updates.settings.app_version, "update_id": None}
    assert r.headers["cache-control"] == "no-store"


def test_build_in_progress_is_reported_without_details(client, render):
    render["deploys"] = [deploy("dep-new", "build_in_progress", "bbb"), deploy("dep-old", "live", "aaa")]
    body = client.get("/api/version").json()
    assert body["version"] == "aaa"
    assert body["update_id"] and body["update_id"] != "dep-new"
    assert "secret" not in str(body) and "bbb" not in str(body), "only an opaque id reaches the browser"


def test_live_failed_and_canceled_deploys_mean_no_update(client, render):
    for deploys in (
        [deploy("d2", "live", "aaa"), deploy("d1", "build_in_progress", "zzz")],
        [deploy("d3", "build_failed", "bbb"), deploy("d2", "live", "aaa")],
        [deploy("d4", "canceled", "ccc"), deploy("d2", "live", "aaa")],
        [deploy("d5", "update_in_progress", "aaa"), deploy("d2", "live", "aaa")],
    ):
        updates.reset_cache()
        render["deploys"] = deploys
        assert client.get("/api/version").json()["update_id"] is None, deploys


def test_consecutive_deploys_report_the_newest(client, render):
    render["deploys"] = [deploy("dep-b", "build_in_progress", "ccc"), deploy("dep-a", "canceled", "bbb"), deploy("d0", "live", "aaa")]
    first = client.get("/api/version").json()["update_id"]
    updates.reset_cache()
    render["deploys"] = [deploy("dep-b", "build_in_progress", "ccc"), deploy("dep-a", "build_in_progress", "bbb"), deploy("d0", "live", "aaa")]
    assert client.get("/api/version").json()["update_id"] == first


def test_render_is_called_at_most_once_per_window(client, render):
    render["deploys"] = [deploy("d1", "build_in_progress", "bbb")]
    for _ in range(5):
        client.get("/api/version")
    assert render["calls"] == 1


def test_render_errors_do_not_break_the_endpoint(client, render):
    render["error"] = httpx.ConnectTimeout("boom")
    r = client.get("/api/version")
    assert r.status_code == 200 and r.json()["update_id"] is None
    client.get("/api/version")
    assert render["calls"] == 1, "a failing Render API is not hammered on every poll"
