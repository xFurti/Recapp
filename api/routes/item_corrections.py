from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from ..auth import ClassAccess, class_access, request_now
from ..db import get_session
from ..item_corrections import annotate_items, can_review, correction_out
from ..limits import allow
from ..models import ItemCorrection, UpcomingItem
from ..schemas import ItemCorrectionDecision, ItemCorrectionIn
from ..services import items_out, touch_item_card, validate_item_changes

router = APIRouter(prefix="/api/classes/{code}/upcoming")


def _item(session: Session, access: ClassAccess, item_id: int, *, lock: bool = False) -> UpcomingItem:
    query = select(UpcomingItem).where(
        UpcomingItem.id == item_id, UpcomingItem.class_id == access.classroom.id,
        UpcomingItem.status == "published",
    )
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    item = session.exec(query).first()
    if item is None:
        raise HTTPException(404, "Elemento non trovato")
    return item


@router.get("/corrections")
def inbox(request: Request, access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    me = access.member
    if me is None:
        return {"pending_count": 0, "items": []}
    query = select(ItemCorrection, UpcomingItem).join(UpcomingItem).where(
        ItemCorrection.class_id == access.classroom.id,
        ItemCorrection.status == "pending", UpcomingItem.status == "published",
    )
    if not access.is_admin:
        query = query.where(UpcomingItem.author_member_id == me.id)
    requests = session.exec(query.order_by(UpcomingItem.due_date, UpcomingItem.id)).all()
    items = {}
    counts = {}
    for correction, item in requests:
        items[item.id] = item
        counts[item.id] = counts.get(item.id, 0) + 1
    rows = items_out(session, list(items.values()))
    # The panel opened from the inbox reads the same viewer flags as a list row.
    annotate_items(session, list(items.values()), rows, access, request_now(request, access.classroom).date())
    return {
        "pending_count": len(requests),
        "items": [{"item": row, "pending_count": counts[row["id"]]} for row in rows],
    }


@router.get("/{item_id}/corrections")
def corrections(item_id: int, request: Request, access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    me = access.require_member()
    item = _item(session, access, item_id)
    review = can_review(access, item)
    query = select(ItemCorrection).where(ItemCorrection.item_id == item.id)
    if not review:
        query = query.where(ItemCorrection.member_id == me.id)
    requests = session.exec(query.order_by(ItemCorrection.created_at.desc(), ItemCorrection.id.desc())).all()
    row = items_out(session, [item])[0]
    annotate_items(session, [item], [row], access, request_now(request, access.classroom).date())
    return {
        "item": row,
        "can_review": review,
        "requests": [correction_out(session, r, access) for r in requests],
    }


@router.post("/{item_id}/corrections")
def propose(item_id: int, data: ItemCorrectionIn, request: Request,
            access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    me = access.require_member()
    item = _item(session, access, item_id, lock=True)
    if item.author_member_id == me.id:
        raise HTTPException(403, "Modifica direttamente i tuoi elementi")
    if item.due_date < request_now(request, access.classroom).date():
        raise HTTPException(409, "Non puoi chiedere una correzione per un elemento passato")
    changes = validate_item_changes(session, item, data.proposed.model_dump(exclude_unset=True))
    changes = {field: value for field, value in changes.items() if getattr(item, field) != value}
    if not changes:
        raise HTTPException(422, "Modifica almeno un campo dell'elemento")
    if not allow(f"item-correction:{me.id}", 20, 3600):
        raise HTTPException(429, "Troppe richieste in poco tempo. Riprova tra un po'.")
    pending = session.exec(select(ItemCorrection).where(
        ItemCorrection.item_id == item.id, ItemCorrection.member_id == me.id, ItemCorrection.status == "pending",
    ).with_for_update()).first()
    proposed = data.proposed.model_copy(update=changes).model_dump(mode="json", include=set(changes))
    if pending is None:
        pending = ItemCorrection(class_id=item.class_id, item_id=item.id, member_id=me.id,
                                 proposed=proposed, reason=data.reason)
        session.add(pending)
    else:
        replaced = session.exec(update(ItemCorrection).where(
            ItemCorrection.id == pending.id, ItemCorrection.status == "pending",
            ItemCorrection.updated_at == pending.updated_at,
        ).values(proposed=proposed, reason=data.reason, updated_at=datetime.now(timezone.utc)))
        if replaced.rowcount != 1:
            session.rollback()
            raise HTTPException(409, "La richiesta è appena cambiata. Riaprila e riprova.")
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        # The partial unique index also protects simultaneous submissions in SQLite.
        raise HTTPException(409, "La richiesta è appena cambiata. Riaprila e riprova.") from exc
    session.refresh(pending)
    return correction_out(session, pending, access)


@router.post("/{item_id}/corrections/{correction_id}/decide")
def decide(item_id: int, correction_id: int, data: ItemCorrectionDecision,
           access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    me = access.require_member()
    item = _item(session, access, item_id, lock=True)
    if not can_review(access, item):
        raise HTTPException(403, "Solo l'autore o un admin può decidere")
    correction = session.exec(select(ItemCorrection).where(
        ItemCorrection.id == correction_id, ItemCorrection.item_id == item.id,
        ItemCorrection.class_id == access.classroom.id,
    ).with_for_update()).first()
    if correction is None:
        raise HTTPException(404, "Richiesta non trovata")
    if correction.status != "pending":
        raise HTTPException(409, "Questa richiesta è già stata chiusa")
    decided_at = datetime.now(timezone.utc)
    status = "rejected" if data.action == "reject" else "accepted"
    # Claim the pending request atomically, including on SQLite where FOR UPDATE
    # is ignored. A second decision never rewrites the item or the audit record.
    claimed = session.exec(update(ItemCorrection).where(
        ItemCorrection.id == correction.id, ItemCorrection.status == "pending",
        ItemCorrection.updated_at == correction.updated_at,
    ).values(status=status, decided_by=me.id, decided_at=decided_at,
             decision_note=data.note, updated_at=decided_at))
    if claimed.rowcount != 1:
        session.rollback()
        raise HTTPException(409, "Questa richiesta è appena cambiata. Riaprila e riprova.")
    # The atomic claim holds SQLite's write lock. Refresh after acquiring it so
    # comparisons also use current data when different requests race.
    session.refresh(item)
    changes = {}
    if data.action != "reject":
        changes = validate_item_changes(session, item, correction.proposed)
        changes = {field: value for field, value in changes.items() if getattr(item, field) != value}
    if data.action == "already_fixed" and changes:
        session.rollback()
        raise HTTPException(409, "La proposta è ancora diversa dai dati attuali")
    correction.already_fixed = data.action != "reject" and not changes
    session.add(correction)
    if changes:
        for field, value in changes.items():
            setattr(item, field, value)
        item.updated_at = decided_at
        session.add(item)
        touch_item_card(session, item)
    session.commit()
    session.refresh(correction)
    return correction_out(session, correction, access)
