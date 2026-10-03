import base64
import logging
from datetime import date

from sqlmodel import Session, select

from . import db
from .config import settings
from .models import Attachment, OcrJob, Subject
from .schedule import ClassCalendar
from .tasks import extract_items

log = logging.getLogger("ieri.jobs")


def ocr_context(cal: ClassCalendar, today: date) -> dict:
    subjects = cal.session.exec(select(Subject).where(Subject.class_id == cal.classroom.id)).all()
    return {
        "today": today.isoformat(),
        "subjects": [{"code": s.code, "name_it": s.name_it, "name_en": s.name_en} for s in subjects],
        "next_lessons": cal.next_lessons(today),
        "school_days": [d.isoformat() for d in cal.school_days(today, 21)],
    }


def build_payload(session: Session, job: OcrJob, context: dict, provider: str | None = None, notice: str = "") -> dict:
    payload: dict = {
        "kind": job.input_kind,
        "context": context,
        "provider": provider or settings.ocr_provider,
        "notice": notice,
    }
    if job.input_kind == "image":
        att = session.get(Attachment, job.attachment_id)
        payload["image_b64"] = base64.b64encode(att.data).decode() if att else ""
        payload["mime"] = att.mime if att else "image/webp"
    else:
        payload["text"] = job.text
    return payload


def _store_result(job: OcrJob, result: dict) -> None:
    job.status = "done"
    job.provider = result.get("provider", "")
    job.result = result.get("drafts", [])
    job.error = result.get("warning", "")


def run_inline(job_id: str, payload: dict) -> None:
    with Session(db.engine) as session:
        job = session.get(OcrJob, job_id)
        if job is None:
            return
        job.status = "running"
        session.add(job)
        session.commit()
        try:
            _store_result(job, extract_items(payload))
        except Exception as exc:  # noqa: BLE001
            log.exception("OCR job %s failed", job_id)
            job.status = "error"
            job.error = f"Lettura non riuscita: {type(exc).__name__}"
        session.add(job)
        session.commit()


def start_job(session: Session, job: OcrJob, payload: dict, background) -> None:
    uses_ai = payload.get("provider") != "mock"
    if uses_ai and settings.task_runner == "render" and settings.render_api_key and settings.render_workflow_task:
        try:
            from render import Render  # Render Workflows SDK, `pip install render`

            client = Render(token=settings.render_api_key)
            run = client.workflows.start_task(settings.render_workflow_task, [payload])
            job.render_run_id = run.id
            job.status = "running"
            session.add(job)
            session.commit()
            return
        except Exception:  # noqa: BLE001
            log.exception("Render Workflows start failed, running inline")
    background.add_task(run_inline, job.id, payload)


def refresh_job(session: Session, job: OcrJob) -> OcrJob:
    if not job.render_run_id or job.status in ("done", "error"):
        return job
    try:
        from render import Render

        client = Render(token=settings.render_api_key)
        details = client.workflows.get_task_run(job.render_run_id)
        status = str(getattr(details, "status", "")).lower()
        if status.endswith(("completed", "succeeded")):
            results = getattr(details, "results", []) or []
            _store_result(job, results[0] if results else {"drafts": []})
        elif any(status.endswith(s) for s in ("failed", "canceled", "cancelled")):
            job.status = "error"
            job.error = "Lettura non riuscita"
        session.add(job)
        session.commit()
    except Exception:  # noqa: BLE001
        log.exception("Render Workflows poll failed")
    return job
