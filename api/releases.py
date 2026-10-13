"""Notes travel with the deployed artifact: no build/webhook publishes ahead of Render.

Rolling back the artifact also rolls back this history. The frontend only announces
notes when the responding API version matches the version it actually loaded.
"""
import json
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from .auth import Viewer, get_viewer
from .config import settings
from .db import get_session
from .models import ReleaseSeen

router = APIRouter(prefix="/api")
log = logging.getLogger(__name__)


def manifest() -> dict:
    artifact = settings.web_dist / "release-manifest.json"
    if artifact.exists():
        return json.loads(artifact.read_text())
    if not settings.is_dev:
        return {"current": None, "releases": []}
    directory = Path(__file__).resolve().parent.parent / "release-notes"
    notes = [json.loads(path.read_text()) for path in directory.glob("*.json")]
    notes.sort(key=lambda note: (note["published_at"], note["id"]), reverse=True)
    return {"current": notes[0]["id"] if notes and notes[0]["visibility"] == "public" else None,
            "releases": [note for note in notes if note["visibility"] == "public"]}


@router.get("/releases")
def releases(response: Response):
    response.headers["Cache-Control"] = "no-store"
    try:
        return {"version": settings.app_version, **manifest()}
    except (OSError, ValueError, KeyError, TypeError):
        log.warning("Release notes unavailable")
        raise HTTPException(503, "Novità temporaneamente non disponibili") from None


def account(viewer: Viewer) -> tuple[str, int] | None:
    if viewer.member and viewer.classroom:
        return None if viewer.classroom.is_demo else ("member", viewer.member.id)
    if viewer.owner:
        return ("owner", viewer.owner.id)
    raise HTTPException(401, "Accedi per salvare la preferenza")


@router.get("/release-preference")
def preference(response: Response, viewer: Viewer = Depends(get_viewer), session: Session = Depends(get_session)):
    response.headers["Cache-Control"] = "no-store"
    who = account(viewer)
    if who is None:
        return {"seen": [], "stored": False}
    rows = session.exec(select(ReleaseSeen).where(ReleaseSeen.account_kind == who[0], ReleaseSeen.account_id == who[1])).all()
    return {"seen": [row.release_id for row in rows], "stored": True}


class SeenIn(BaseModel):
    release_id: str = Field(min_length=1, max_length=80)


@router.post("/release-preference")
def mark_seen(data: SeenIn, viewer: Viewer = Depends(get_viewer), session: Session = Depends(get_session)):
    who = account(viewer)
    # A stale tab cannot acknowledge an upcoming or withdrawn release.
    if data.release_id != manifest()["current"]:
        raise HTTPException(409, "Il rilascio non è più quello corrente")
    if who is None:
        return {"ok": True, "stored": False}
    session.add(ReleaseSeen(account_kind=who[0], account_id=who[1], release_id=data.release_id))
    try:
        session.commit()
    except IntegrityError:
        session.rollback()  # concurrent tabs / repeat clicks are harmless
    return {"ok": True, "stored": True}
