"""Viewer-scoped metadata for upcoming-item correction requests."""
from datetime import date

from sqlmodel import Session, col, select

from .auth import ClassAccess
from .models import ItemCorrection, UpcomingItem
from .services import iso_utc, member_brief, member_names


def can_review(access: ClassAccess, item: UpcomingItem) -> bool:
    me = access.member
    return me is not None and (access.is_admin or item.author_member_id == me.id)


def correction_out(session: Session, correction: ItemCorrection, access: ClassAccess) -> dict:
    members = member_names(session, {correction.member_id, correction.decided_by})
    return {
        "id": correction.id,
        "item_id": correction.item_id,
        "author": member_brief(members.get(correction.member_id)),
        "proposed": correction.proposed,
        "reason": correction.reason,
        "status": correction.status,
        "decided_by": member_brief(members.get(correction.decided_by)),
        "decided_at": iso_utc(correction.decided_at),
        "decision_note": correction.decision_note,
        "already_fixed": correction.already_fixed,
        "created_at": iso_utc(correction.created_at),
        "updated_at": iso_utc(correction.updated_at),
        "mine": access.member is not None and access.member.id == correction.member_id,
    }


def annotate_items(session: Session, items: list[UpcomingItem], rows: list[dict], access: ClassAccess, today: date) -> None:
    me = access.member
    visible: dict[int, list[ItemCorrection]] = {}
    if me is not None and items:
        manageable = [item.id for item in items if can_review(access, item)]
        query = select(ItemCorrection).where(
            ItemCorrection.class_id == access.classroom.id,
            col(ItemCorrection.item_id).in_([item.id for item in items]),
            (ItemCorrection.member_id == me.id) | col(ItemCorrection.item_id).in_(manageable),
        ).order_by(ItemCorrection.updated_at.desc(), ItemCorrection.id.desc())
        for correction in session.exec(query).all():
            visible.setdefault(correction.item_id, []).append(correction)
    for item, row in zip(items, rows):
        requests = visible.get(item.id, [])
        mine = next((r for r in requests if r.member_id == me.id), None) if me else None
        row["can_request_correction"] = (
            me is not None and item.author_member_id != me.id
            and item.status == "published" and item.due_date >= today
        )
        row["can_review_corrections"] = can_review(access, item)
        row["pending_corrections"] = sum(r.status == "pending" for r in requests) if can_review(access, item) else 0
        row["correction_count"] = len(requests) if can_review(access, item) else 0
        row["my_correction"] = {"id": mine.id, "status": mine.status} if mine else None
