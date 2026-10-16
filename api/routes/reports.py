"""Bugs and ideas about Recapp itself (#67).

Not the Replies on a day, and not the corrections of an upcoming item: these
reports stay inside Recapp, the school reads them in its area, and nothing is
ever opened on the public GitHub repository.
"""

import re
from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlmodel import Session, select

from ..auth import Viewer, get_viewer, require_owner
from ..config import settings
from ..db import get_session
from ..images import MAX_INPUT_BYTES, sanitize_image
from ..limits import allow, client_ip
from ..models import Report, utcnow

router = APIRouter(prefix="/api")

TITLE_MAX = 120
BODY_MAX = 2000
# Per member, and per address for whoever is not signed in (or is in a demo, where anyone can get a member).
MEMBER_PER_HOUR = 5
IP_PER_HOUR = 5
KINDS = ("bug", "feature")
STATUSES = ("new", "in_progress", "closed")
PAGE_RE = re.compile(r"^/[\w\-./%~]{0,199}$", re.UNICODE)


def _required(value: str, field: str, limit: int) -> str:
    value = (value or "").strip()
    if not value:
        raise HTTPException(422, {"message": "Compila il campo mancante", "field": field})
    if len(value) > limit:
        raise HTTPException(422, {"message": f"Massimo {limit} caratteri", "field": field})
    return value


def _page(value: str) -> str:
    path = (value or "").split("?", 1)[0].split("#", 1)[0].strip()
    return path if PAGE_RE.match(path) else ""


def short_agent(ua: str) -> str:
    """Browser, major version and system: enough to reproduce, no fingerprint."""
    ua = ua or ""
    browser = "?"
    for name, pattern in (
        ("Edge", r"Edg(?:A|iOS)?/(\d+)"),
        ("Opera", r"OPR/(\d+)"),
        ("Samsung Internet", r"SamsungBrowser/(\d+)"),
        ("Firefox", r"(?:Firefox|FxiOS)/(\d+)"),
        ("Chrome", r"(?:Chrome|CriOS)/(\d+)"),
        ("Safari", r"Version/(\d+)[.\d]* (?:Mobile/\S+ )?Safari/"),
    ):
        found = re.search(pattern, ua)
        if found:
            browser = f"{name} {found.group(1)}"
            break
    system = "?"
    for name, pattern in (
        ("iPadOS", r"iPad"),
        ("iOS", r"iPhone|iPod"),
        ("Android", r"Android"),
        ("Windows", r"Windows"),
        ("ChromeOS", r"CrOS"),
        ("macOS", r"Mac OS X|Macintosh"),
        ("Linux", r"Linux"),
    ):
        if re.search(pattern, ua):
            system = name
            break
    if browser == "?" and system == "?":
        return ua[:60]
    return f"{browser} · {system}"


def _context(viewer: Viewer, request: Request, page: str, language: str, theme: str) -> dict:
    ctx = {
        "page": _page(page),
        "language": language if language in ("it", "en") else "",
        "theme": theme if theme in ("light", "dark") else "",
        "version": settings.app_version,
        "user_agent": short_agent(request.headers.get("user-agent", "")),
        "role": "none",
    }
    if viewer.member is not None and viewer.classroom is not None:
        c = viewer.classroom
        ctx.update(
            class_label=c.label or c.name,
            class_code=c.code,
            role=viewer.member.role,
            nick=viewer.member.nick,
            is_demo=c.is_demo,
        )
    elif viewer.owner is not None:
        ctx["role"] = "owner"
    return ctx


def _brief(r: Report) -> dict:
    return {
        "id": r.id,
        "kind": r.kind,
        "title": r.title,
        "status": r.status,
        "created_at": r.created_at.isoformat(),
        "has_image": r.image is not None,
    }


@router.post("/reports")
async def send_report(
    request: Request,
    kind: str = Form(...),
    title: str = Form(""),
    body: str = Form(""),
    page: str = Form(""),
    language: str = Form(""),
    theme: str = Form(""),
    image: Optional[UploadFile] = File(None),
    viewer: Viewer = Depends(get_viewer),
    session: Session = Depends(get_session),
):
    if kind not in KINDS:
        raise HTTPException(422, {"message": "Scegli Bug o Funzionalità", "field": "kind"})
    title = _required(title, "title", TITLE_MAX)
    body = _required(body, "body", BODY_MAX)
    member = viewer.member if viewer.classroom is not None else None
    demo = member is not None and viewer.classroom.is_demo
    over = False
    if member is not None:
        over = not allow(f"report:m:{member.id}", MEMBER_PER_HOUR, 3600)
    if (member is None or demo) and not over:
        over = not allow(f"report:ip:{client_ip(request)}", IP_PER_HOUR, 3600)
    if over:
        raise HTTPException(429, "Hai inviato molte segnalazioni. Riprova più tardi.")
    data, width, height = None, 0, 0
    if image is not None and image.filename:
        raw = await image.read(MAX_INPUT_BYTES + 1)
        if raw:
            data, width, height = sanitize_image(raw)
    report = Report(
        kind=kind,
        title=title,
        body=body,
        member_id=member.id if member else None,
        class_id=viewer.classroom.id if member else None,
        is_demo=demo,
        context=_context(viewer, request, page, language, theme),
        image=data,
        image_width=width,
        image_height=height,
    )
    session.add(report)
    session.commit()
    session.refresh(report)
    return _brief(report)


@router.get("/reports/mine")
def my_reports(viewer: Viewer = Depends(get_viewer), session: Session = Depends(get_session)):
    """Only the sender's own reports. Without a nick there is no list to return to."""
    if viewer.member is None:
        return []
    rows = session.exec(
        select(Report).where(Report.member_id == viewer.member.id).order_by(Report.created_at.desc(), Report.id.desc())
    ).all()
    return [_brief(r) for r in rows]


@router.get("/reports/{report_id}/image")
def report_image(report_id: int, viewer: Viewer = Depends(get_viewer), session: Session = Depends(get_session)):
    report = session.get(Report, report_id)
    mine = report is not None and viewer.member is not None and report.member_id == viewer.member.id
    if report is None or report.image is None or not (viewer.is_owner or mine):
        raise HTTPException(404, "Immagine non trovata")
    return Response(report.image, media_type="image/webp", headers={"Cache-Control": "private, max-age=3600"})


# ---- school area -------------------------------------------------------------------
owner_router = APIRouter(prefix="/api/owner", dependencies=[Depends(require_owner)])


def _detail(r: Report) -> dict:
    return {
        **_brief(r),
        "body": r.body,
        "is_demo": r.is_demo,
        "context": r.context or {},
        "image_width": r.image_width,
        "image_height": r.image_height,
        "updated_at": r.updated_at.isoformat(),
    }


@owner_router.get("/reports")
def owner_reports(demo: Literal["all", "hide", "only"] = "all", session: Session = Depends(get_session)):
    query = select(Report).order_by(Report.created_at.desc(), Report.id.desc())
    if demo == "hide":
        query = query.where(Report.is_demo == False)  # noqa: E712
    elif demo == "only":
        query = query.where(Report.is_demo == True)  # noqa: E712
    return [_detail(r) for r in session.exec(query).all()]


class ReportPatch(BaseModel):
    status: Literal["new", "in_progress", "closed"]


@owner_router.patch("/reports/{report_id}")
def update_report(report_id: int, data: ReportPatch, session: Session = Depends(get_session)):
    report = session.get(Report, report_id)
    if report is None:
        raise HTTPException(404, "Segnalazione non trovata")
    report.status = data.status
    report.updated_at = utcnow()
    session.add(report)
    session.commit()
    session.refresh(report)
    return _detail(report)
