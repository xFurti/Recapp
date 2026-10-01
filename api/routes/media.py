import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from sqlmodel import Session

from ..auth import ClassAccess, Viewer, class_access, get_viewer, request_now
from ..db import get_session
from ..images import MAX_INPUT_BYTES, sanitize_image
from ..jobs import build_payload, ocr_context, refresh_job, start_job
from ..models import Attachment, OcrJob
from ..schedule import ClassCalendar
from ..schemas import OcrIn

router = APIRouter(prefix="/api")


@router.post("/classes/{code}/attachments")
async def upload_attachment(
    file: UploadFile = File(...),
    privacy_ok: bool = Form(False),
    access: ClassAccess = Depends(class_access),
    session: Session = Depends(get_session),
):
    me = access.require_member()
    if not privacy_ok:
        raise HTTPException(422, "Conferma che il ritaglio non contiene voti, nomi o volti")
    raw = await file.read(MAX_INPUT_BYTES + 1)
    data, width, height = sanitize_image(raw)
    att = Attachment(class_id=access.classroom.id, data=data, width=width, height=height, created_by=me.id)
    session.add(att)
    session.commit()
    session.refresh(att)
    return {"id": att.id, "width": width, "height": height}


@router.get("/attachments/{attachment_id}")
def get_attachment(attachment_id: int, viewer: Viewer = Depends(get_viewer), session: Session = Depends(get_session)):
    att = session.get(Attachment, attachment_id)
    if att is None:
        raise HTTPException(404, "Allegato non trovato")
    allowed = viewer.is_owner or (viewer.member is not None and viewer.member.class_id == att.class_id)
    if not allowed:
        raise HTTPException(403, "Non puoi vedere questo allegato")
    return Response(att.data, media_type=att.mime, headers={"Cache-Control": "private, max-age=86400"})


@router.post("/classes/{code}/ocr")
def start_ocr(
    data: OcrIn,
    request: Request,
    background: BackgroundTasks,
    access: ClassAccess = Depends(class_access),
    session: Session = Depends(get_session),
):
    me = access.require_member()
    if not data.text and not data.attachment_id:
        raise HTTPException(422, "Incolla una riga o carica un ritaglio")
    if data.attachment_id:
        att = session.get(Attachment, data.attachment_id)
        if att is None or att.class_id != access.classroom.id:
            raise HTTPException(404, "Allegato non trovato")
    now = request_now(request, access.classroom)
    cal = ClassCalendar(session, access.classroom)
    job = OcrJob(
        id=uuid.uuid4().hex,
        class_id=access.classroom.id,
        input_kind="image" if data.attachment_id else "text",
        text=(data.text or "").strip(),
        attachment_id=data.attachment_id,
        created_by=me.id,
    )
    session.add(job)
    session.commit()
    payload = build_payload(session, job, ocr_context(cal, data.day or now.date()))
    start_job(session, job, payload, background)
    return {"job_id": job.id, "status": job.status}


@router.get("/classes/{code}/ocr/{job_id}")
def get_ocr(job_id: str, access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    job = session.get(OcrJob, job_id)
    if job is None or job.class_id != access.classroom.id:
        raise HTTPException(404, "Lettura non trovata")
    job = refresh_job(session, job)
    return {
        "job_id": job.id,
        "status": job.status,
        "provider": job.provider,
        "drafts": job.result or [],
        "message": job.error,
    }
