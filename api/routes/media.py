import uuid
from datetime import datetime, time, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from sqlmodel import Session, func, select

from ..auth import ClassAccess, Viewer, class_access, get_viewer, request_now
from ..config import TZ
from ..db import get_session
from ..images import MAX_INPUT_BYTES, sanitize_image
from ..jobs import build_payload, ocr_context, refresh_job, start_job
from ..limits import allow, client_ip
from ..models import Attachment, Classroom, DayCard, OcrJob, UpcomingItem
from ..school_data import bell_hours
from ..schedule import ClassCalendar
from ..schemas import OcrIn
from ..services import DayState

router = APIRouter(prefix="/api")

DEMO_AI_PER_DAY = 30
DEMO_AI_PER_IP_MINUTE = 3
DEMO_UPLOADS_PER_DAY = 40
DEMO_UPLOADS_PER_IP = (5, 600)
MEMBER_OCR_PER_HOUR = 30
MEMBER_UPLOADS_PER_HOUR = 40


def _start_of_today_utc() -> datetime:
    today = datetime.now(TZ).date()
    return datetime.combine(today, time.min, tzinfo=TZ).astimezone(timezone.utc)


def _count_today(session: Session, model, class_id: int) -> int:
    return session.exec(
        select(func.count()).select_from(model).where(
            model.class_id == class_id, model.created_at >= _start_of_today_utc()
        )
    ).one()


@router.post("/classes/{code}/attachments")
async def upload_attachment(
    request: Request,
    file: UploadFile = File(...),
    privacy_ok: bool = Form(False),
    access: ClassAccess = Depends(class_access),
    session: Session = Depends(get_session),
):
    me = access.require_member()
    if not privacy_ok:
        raise HTTPException(422, "Conferma che il ritaglio non contiene voti, nomi o volti")
    if access.classroom.is_demo:
        limit, window = DEMO_UPLOADS_PER_IP
        if _count_today(session, Attachment, access.classroom.id) >= DEMO_UPLOADS_PER_DAY or not allow(
            f"demo-upload:{client_ip(request)}", limit, window
        ):
            raise HTTPException(429, "Limite di caricamenti della demo raggiunto. Riprova più tardi.")
    elif not allow(f"upload:{me.id}", MEMBER_UPLOADS_PER_HOUR, 3600):
        raise HTTPException(429, "Troppi caricamenti in poco tempo. Riprova tra un po'.")
    raw = await file.read(MAX_INPUT_BYTES + 1)
    data, width, height = sanitize_image(raw)
    att = Attachment(class_id=access.classroom.id, data=data, width=width, height=height, created_by=me.id)
    session.add(att)
    session.commit()
    session.refresh(att)
    return {"id": att.id, "width": width, "height": height}


def can_view_attachment(session: Session, request: Request, viewer: Viewer, att: Attachment) -> bool:
    """Published content is visible to the class; drafts and orphans only to who can edit them."""
    if viewer.is_owner:
        return True
    member = viewer.member
    if member is None or member.class_id != att.class_id:
        return False
    if member.role == "admin" or att.created_by == member.id:
        return True
    card = session.get(DayCard, att.card_id) if att.card_id else None
    if card is not None and card.status == "published":
        return True
    published_item = session.exec(
        select(UpcomingItem.id).where(UpcomingItem.attachment_id == att.id, UpcomingItem.status == "published")
    ).first()
    if published_item is not None:
        return True
    if card is not None:
        classroom = session.get(Classroom, att.class_id)
        state = DayState(ClassAccess(classroom, viewer), ClassCalendar(session, classroom), card.day, request_now(request, classroom))
        return state.can_write
    return False


@router.get("/attachments/{attachment_id}")
def get_attachment(
    attachment_id: int, request: Request, viewer: Viewer = Depends(get_viewer), session: Session = Depends(get_session)
):
    att = session.get(Attachment, attachment_id)
    if att is None:
        raise HTTPException(404, "Allegato non trovato")
    if not can_view_attachment(session, request, viewer, att):
        raise HTTPException(403, "Non puoi vedere questo allegato")
    return Response(att.data, media_type=att.mime, headers={"Cache-Control": "private, max-age=3600"})


def _ocr_provider_for(session: Session, request: Request, access: ClassAccess) -> tuple[str | None, str]:
    """Returns (provider override, message). The DEMO gets a bounded AI budget."""
    me = access.require_member()
    if access.classroom.is_demo:
        over_day = _count_today(session, OcrJob, access.classroom.id) >= DEMO_AI_PER_DAY
        over_ip = not allow(f"demo-ocr:{client_ip(request)}", DEMO_AI_PER_IP_MINUTE, 60)
        if over_day or over_ip:
            return "mock", "Limite della demo raggiunto: uso il parser semplice al posto dell'AI."
        return None, ""
    if not allow(f"ocr:{me.id}", MEMBER_OCR_PER_HOUR, 3600):
        raise HTTPException(429, "Troppe letture in poco tempo. Riprova tra un po'.")
    return None, ""


@router.post("/classes/{code}/ocr")
def start_ocr(
    data: OcrIn,
    request: Request,
    background: BackgroundTasks,
    access: ClassAccess = Depends(class_access),
    session: Session = Depends(get_session),
):
    me = access.require_member()
    timetable = data.purpose == "timetable"
    if timetable:
        access.require_manage()
        access.forbid_in_demo()
        if not data.attachment_id:
            raise HTTPException(422, "Carica uno screenshot dell'orario")
        busy = session.exec(
            select(OcrJob).where(
                OcrJob.class_id == access.classroom.id,
                OcrJob.input_kind == "timetable",
                OcrJob.status.in_(("queued", "running")),
            )
        ).first()
        if busy is not None:
            raise HTTPException(409, "C'è già una lettura in corso")
    if not data.text and not data.attachment_id:
        raise HTTPException(422, "Incolla una riga o carica un ritaglio")
    if data.attachment_id:
        att = session.get(Attachment, data.attachment_id)
        if att is None or att.class_id != access.classroom.id:
            raise HTTPException(404, "Allegato non trovato")
        if not can_view_attachment(session, request, access.viewer, att):
            raise HTTPException(403, "Non puoi usare questo allegato")
    provider, notice = _ocr_provider_for(session, request, access)
    now = request_now(request, access.classroom)
    cal = ClassCalendar(session, access.classroom)
    context = ocr_context(cal, data.day or now.date())
    if timetable:
        context["hours"] = [h["hour"] for h in bell_hours(access.classroom.hours)]
    job = OcrJob(
        id=uuid.uuid4().hex,
        class_id=access.classroom.id,
        input_kind="timetable" if timetable else ("image" if data.attachment_id else "text"),
        text=(data.text or "").strip(),
        attachment_id=data.attachment_id,
        created_by=me.id,
    )
    session.add(job)
    session.commit()
    payload = build_payload(session, job, context, provider=provider, notice=notice)
    start_job(session, job, payload, background)
    return {"job_id": job.id, "status": job.status}


@router.get("/classes/{code}/ocr/{job_id}")
def get_ocr(job_id: str, access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    job = session.get(OcrJob, job_id)
    if job is None or job.class_id != access.classroom.id:
        raise HTTPException(404, "Lettura non trovata")
    if access.member is not None and job.created_by != access.member.id and not access.is_admin:
        raise HTTPException(404, "Lettura non trovata")
    job = refresh_job(session, job)
    timetable = job.input_kind == "timetable" and isinstance(job.result, dict)
    return {
        "job_id": job.id,
        "status": job.status,
        "provider": job.provider,
        "drafts": [] if timetable else (job.result or []),
        "timetable": job.result if timetable else None,
        "message": job.error,
    }


def cleanup_orphans(session: Session, older_than_hours: int = 48) -> int:
    """Removes old OCR jobs and uploads never linked to a day or an item."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=older_than_hours)
    for job in session.exec(select(OcrJob).where(OcrJob.created_at < cutoff)).all():
        session.delete(job)
    session.flush()
    linked_items = set(session.exec(select(UpcomingItem.attachment_id).where(UpcomingItem.attachment_id.is_not(None))).all())
    in_use = set(session.exec(select(OcrJob.attachment_id).where(OcrJob.attachment_id.is_not(None))).all())
    removed = 0
    for att in session.exec(
        select(Attachment).where(Attachment.card_id.is_(None), Attachment.created_at < cutoff)
    ).all():
        if att.id in linked_items or att.id in in_use:
            continue
        session.delete(att)
        removed += 1
    session.commit()
    return removed
