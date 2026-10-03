"""Deploy status for the in-app "update" notice.

The browser only learns which version is running and whether a newer deploy is
being prepared. The Render API key, deploy logs and commit details stay here.
"""

import hashlib
import logging
import threading
import time

import httpx
from fastapi import APIRouter, Response

from .config import settings

router = APIRouter(prefix="/api")
log = logging.getLogger(__name__)

RENDER_API = "https://api.render.com/v1"
IN_PROGRESS = {"created", "queued", "build_in_progress", "update_in_progress", "pre_deploy_in_progress"}
# Every open tab polls; one Render call per window keeps us far from Render's rate limits.
CACHE_SECONDS = 10
ERROR_CACHE_SECONDS = 60

_lock = threading.Lock()
_cache: dict = {"until": 0.0, "update_id": None}


def _opaque(deploy_id: str) -> str:
    return hashlib.sha256(deploy_id.encode()).hexdigest()[:12]


def _fetch_pending() -> str | None:
    res = httpx.get(
        f"{RENDER_API}/services/{settings.render_service_id}/deploys",
        params={"limit": 5},
        headers={"Authorization": f"Bearer {settings.render_api_key}", "Accept": "application/json"},
        timeout=4,
    )
    res.raise_for_status()
    # Newest first. Anything older than the live deploy is history, not an update on the way.
    for row in res.json():
        deploy = row.get("deploy", row)
        status = deploy.get("status")
        if status == "live":
            return None
        commit = (deploy.get("commit") or {}).get("id")
        if status in IN_PROGRESS and commit != settings.app_version:
            return _opaque(str(deploy.get("id", "")))
    return None


def pending_update() -> str | None:
    """Opaque id of the deploy being prepared, or None (also when Render is not configured or unreachable)."""
    if not (settings.render_api_key and settings.render_service_id):
        return None
    with _lock:
        now = time.monotonic()
        if now < _cache["until"]:
            return _cache["update_id"]
        try:
            update_id, ttl = _fetch_pending(), CACHE_SECONDS
        except Exception as exc:  # noqa: BLE001 - the notice is optional, the site is not
            log.warning("Render deploy status unavailable: %s", exc.__class__.__name__)
            update_id, ttl = None, ERROR_CACHE_SECONDS
        _cache.update(until=now + ttl, update_id=update_id)
        return update_id


def reset_cache() -> None:
    _cache.update(until=0.0, update_id=None)


@router.get("/version")
def version(response: Response):
    response.headers["Cache-Control"] = "no-store"
    return {"version": settings.app_version, "update_id": pending_update()}
