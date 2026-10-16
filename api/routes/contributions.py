from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from ..auth import ClassAccess, class_access, request_now
from ..contributions import contributions
from ..db import get_session
from ..models import ItemThanks, UpcomingItem
from ..schedule import ClassCalendar
from ..thanks import can_thank, item_thanks_count

router = APIRouter(prefix="/api/classes/{code}")


def _published_item(session: Session, access: ClassAccess, item_id: int) -> UpcomingItem:
    item = session.exec(select(UpcomingItem).where(
        UpcomingItem.id == item_id, UpcomingItem.class_id == access.classroom.id, UpcomingItem.status == "published",
    )).first()
    if item is None:
        raise HTTPException(404, "Elemento non trovato")
    return item


@router.get("/contributions")
def class_contributions(request: Request, access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    """Streak and Grazie leaderboard: only for people who can already read this class."""
    now = request_now(request, access.classroom)
    return contributions(ClassCalendar(session, access.classroom), access.member, now)


@router.post("/upcoming/{item_id}/thanks")
def toggle_item_thanks(item_id: int, access: ClassAccess = Depends(class_access), session: Session = Depends(get_session)):
    me = access.require_member()
    item = _published_item(session, access, item_id)
    if not can_thank(me, item.author_member_id, True):
        raise HTTPException(403, "Non puoi ringraziare un elemento che hai aggiunto tu")
    existing = session.exec(select(ItemThanks).where(ItemThanks.item_id == item.id, ItemThanks.member_id == me.id)).first()
    if existing:
        session.delete(existing)
    else:
        session.add(ItemThanks(item_id=item.id, member_id=me.id))
    try:
        session.commit()
    except IntegrityError:
        # A double tap raced another request that already saved the same Grazie,
        # or the item was removed meanwhile (then this is a 404).
        session.rollback()
        item = _published_item(session, access, item_id)
    thanked = session.exec(select(ItemThanks.id).where(ItemThanks.item_id == item.id, ItemThanks.member_id == me.id)).first() is not None
    return {"ok": True, "thanks": item_thanks_count(session, item), "thanked": thanked}
