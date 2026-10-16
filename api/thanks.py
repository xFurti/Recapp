"""Grazie on days and items. One rule everywhere: a thanks to your own content never counts.

Self-thanks saved before the rule existed stay in the database, but every counter, the
viewer's `thanked` flag and the leaderboard ignore them, so totals never disagree.
"""
from typing import Optional

from sqlalchemy import or_
from sqlmodel import Session, col, func, select

from .models import CardThanks, DayCard, ItemThanks, Member, UpcomingItem


def counted_card_thanks():
    return or_(col(DayCard.author_member_id).is_(None), CardThanks.member_id != DayCard.author_member_id)


def counted_item_thanks():
    return or_(col(UpcomingItem.author_member_id).is_(None), ItemThanks.member_id != UpcomingItem.author_member_id)


def item_thanks(session: Session, items: list[UpcomingItem], viewer: Optional[Member]) -> dict[int, tuple[int, bool]]:
    """item id -> (counted thanks, whether the viewer gave one of them). One query per list."""
    ids = [i.id for i in items if i.id is not None and i.status == "published"]
    if not ids:
        return {}
    rows = session.exec(
        select(ItemThanks.item_id, ItemThanks.member_id)
        .join(UpcomingItem, UpcomingItem.id == ItemThanks.item_id)
        .where(col(ItemThanks.item_id).in_(ids), counted_item_thanks())
    ).all()
    out: dict[int, tuple[int, bool]] = {}
    for item_id, member_id in rows:
        count, mine = out.get(item_id, (0, False))
        out[item_id] = (count + 1, mine or (viewer is not None and member_id == viewer.id))
    return out


def card_thanks(session: Session, card: DayCard, viewer: Optional[Member]) -> tuple[int, bool]:
    rows = session.exec(
        select(CardThanks.member_id)
        .join(DayCard, DayCard.id == CardThanks.card_id)
        .where(CardThanks.card_id == card.id, counted_card_thanks())
    ).all()
    return len(rows), viewer is not None and viewer.id in rows


def item_thanks_count(session: Session, item: UpcomingItem) -> int:
    return session.exec(
        select(func.count()).select_from(ItemThanks)
        .join(UpcomingItem, UpcomingItem.id == ItemThanks.item_id)
        .where(ItemThanks.item_id == item.id, counted_item_thanks())
    ).one()


def can_thank(viewer: Optional[Member], author_member_id: Optional[int], published: bool) -> bool:
    return viewer is not None and published and author_member_id != viewer.id
