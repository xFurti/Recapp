"""Idempotent seed.

    python -m api.seed               # reference data + real classes + demo
    python -m api.seed --reset-demo  # force-regenerate the demo class content

Real classes (4AI, 4BI) get a random class code and one admin invite, printed
once to the console. Nothing secret is stored in the repository.
"""

import argparse
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlmodel import Session, col, delete, select

from . import db
from .auth import check_secret, hash_secret, new_class_code, new_invite_code, random_code
from .config import TZ, settings
from .models import (
    Attachment,
    CardComment,
    CardThanks,
    Classroom,
    DayCard,
    Holiday,
    LabBlock,
    Member,
    OcrJob,
    Owner,
    ScribeOverride,
    Subject,
    SubjectEntry,
    TimetableSlot,
    UpcomingItem,
)
from .schedule import ClassCalendar
from .school_data import (
    CLASS_LABELS,
    SCHOOL_YEAR_START,
    SUBJECTS,
    TIMETABLES,
    holidays_dedup,
    is_lab_room,
)

DEMO_CODE = "DEMO"
DEMO_PIN = "123456"
DEMO_NICKS = ["leo", "gianni", "sara", "marta", "luca", "anna"]


# ---- reference data ----------------------------------------------------------------
def ensure_holidays(session: Session) -> None:
    if session.exec(select(Holiday)).first() is not None:
        return
    for d, label, kind in holidays_dedup():
        session.add(Holiday(day=d, label=label, kind=kind))
    session.commit()


def ensure_owner(session: Session) -> None:
    if not settings.owner_username or not settings.owner_password:
        return
    owner = session.exec(select(Owner).where(Owner.username == settings.owner_username)).first()
    if owner is None:
        owner = Owner(
            username=settings.owner_username,
            password_hash=hash_secret(settings.owner_password),
            display_name=settings.owner_display_name,
        )
    elif not check_secret(settings.owner_password, owner.password_hash):
        owner.password_hash = hash_secret(settings.owner_password)
        owner.session_version += 1
    owner.display_name = settings.owner_display_name
    session.add(owner)
    session.commit()


def add_subjects(session: Session, class_id: int) -> None:
    for code, name_it, name_en, color in SUBJECTS:
        session.add(Subject(class_id=class_id, code=code, name_it=name_it, name_en=name_en, color=color))


def add_timetable(session: Session, class_id: int, source: Optional[str]) -> None:
    if source in TIMETABLES:
        for weekday, hours in TIMETABLES[source].items():
            for idx, (subject, room) in enumerate(hours, start=1):
                session.add(
                    TimetableSlot(
                        class_id=class_id, weekday=weekday, hour=idx, subject_code=subject,
                        room=room, is_lab=is_lab_room(room),
                    )
                )
        return
    if source:
        other = session.exec(select(Classroom).where(Classroom.code == source)).first()
        if other:
            for s in session.exec(select(TimetableSlot).where(TimetableSlot.class_id == other.id)).all():
                session.add(
                    TimetableSlot(
                        class_id=class_id, weekday=s.weekday, hour=s.hour,
                        subject_code=s.subject_code, room=s.room, is_lab=s.is_lab,
                    )
                )


def create_class(
    session: Session, name: str, label: str, admin_nick: str, timetable_from: Optional[str]
) -> tuple[Classroom, Member, str]:
    code = new_class_code(name)
    while session.exec(select(Classroom).where(Classroom.code == code)).first():
        code = new_class_code(name)
    today = datetime.now(TZ).date()
    classroom = Classroom(
        code=code, name=name.upper(), label=label or CLASS_LABELS.get(name.upper(), name.upper()),
        rotation_anchor=max(SCHOOL_YEAR_START, today),
    )
    session.add(classroom)
    session.flush()
    add_subjects(session, classroom.id)
    add_timetable(session, classroom.id, timetable_from or (name.upper() if name.upper() in TIMETABLES else None))
    invite = new_invite_code()
    admin = Member(class_id=classroom.id, nick=admin_nick, role="admin", invite_hash=hash_secret(invite))
    session.add(admin)
    session.commit()
    session.refresh(classroom)
    session.refresh(admin)
    return classroom, admin, invite


def ensure_real_classes(session: Session) -> None:
    for name in ("4AI", "4BI"):
        exists = session.exec(
            select(Classroom).where(Classroom.name == name, Classroom.is_demo == False)  # noqa: E712
        ).first()
        if exists:
            continue
        classroom, admin, invite = create_class(session, name, CLASS_LABELS[name], "rappresentante", name)
        banner = (
            f"\n  Classe {classroom.name}: codice {classroom.code}\n"
            f"  Primo accesso admin: nick '{admin.nick}', invito {invite}\n"
            f"  (mostrato una sola volta: se lo perdi, rigeneralo dall'Area scuola)\n"
        )
        print(banner, flush=True)


# ---- demo --------------------------------------------------------------------------
DEMO_BULLETS = {
    "INI": ["REST APIs with FastAPI: path and query parameters", "Built GET /stations returning JSON from SQLite", "Intro to HTTP status codes 200/404/422"],
    "SRI": ["Subnetting practice: /26 and /27 masks", "Configured VLANs on Packet Tracer"],
    "TPI": ["Threads vs processes in Python", "Race condition demo with a shared counter"],
    "TCI": ["Signals: amplitude, frequency, period", "Fourier series intuition with a square wave"],
    "MAT": ["Derivatives: product and quotient rule", "Exercises 3-7 page 112 done together"],
    "LIT": ["Ariosto, Orlando Furioso: canto I", "How to write the text analysis for the essay"],
    "STO": ["The Thirty Years' War: causes", "Map of Europe after the Peace of Westphalia"],
    "ING": ["Unit 3: job interviews vocabulary", "Listening: tech startup podcast"],
    "SMS": ["Volleyball: serve and reception drills"],
    "IRC": ["Debate: ethics of artificial intelligence"],
}
DEMO_LABS = {
    "INI": {"goal": "API GET /stations working locally", "repo_url": "https://github.com/example/4inf-lab-set", "pitfall": "Server does not reload: run uvicorn with --reload", "bring": "GitHub account and laptop charger"},
    "SRI": {"goal": "Two VLANs that can ping through the router", "repo_url": "", "pitfall": "Trunk port left in access mode", "bring": "The .pkt file from last week"},
    "TPI": {"goal": "Fix the race condition with a Lock", "repo_url": "https://github.com/example/tpsit-threads", "pitfall": "Forgot to join() the threads", "bring": ""},
    "TCI": {"goal": "Measure a square wave on the oscilloscope", "repo_url": "", "pitfall": "Probe set to x10 instead of x1", "bring": "Lab notebook"},
}


def _wipe_demo(session: Session, classroom: Classroom) -> None:
    cid = classroom.id
    card_ids = session.exec(select(DayCard.id).where(DayCard.class_id == cid)).all()
    if card_ids:
        session.exec(delete(CardComment).where(col(CardComment.card_id).in_(card_ids)))
        session.exec(delete(CardThanks).where(col(CardThanks.card_id).in_(card_ids)))
        entry_ids = session.exec(select(SubjectEntry.id).where(col(SubjectEntry.card_id).in_(card_ids))).all()
        if entry_ids:
            session.exec(delete(LabBlock).where(col(LabBlock.entry_id).in_(entry_ids)))
        session.exec(delete(SubjectEntry).where(col(SubjectEntry.card_id).in_(card_ids)))
    session.exec(delete(UpcomingItem).where(UpcomingItem.class_id == cid))
    session.exec(delete(OcrJob).where(OcrJob.class_id == cid))
    session.exec(delete(Attachment).where(Attachment.class_id == cid))
    session.exec(delete(DayCard).where(DayCard.class_id == cid))
    session.exec(delete(ScribeOverride).where(ScribeOverride.class_id == cid))
    session.exec(delete(TimetableSlot).where(TimetableSlot.class_id == cid))
    session.exec(delete(Subject).where(Subject.class_id == cid))
    session.exec(delete(Member).where(Member.class_id == cid, col(Member.nick).not_in(DEMO_NICKS)))
    session.flush()


def _restore_demo_members(session: Session, classroom: Classroom) -> list[Member]:
    pin_hash = hash_secret(DEMO_PIN)
    existing = {m.nick: m for m in session.exec(select(Member).where(Member.class_id == classroom.id)).all()}
    members = []
    for i, nick in enumerate(DEMO_NICKS):
        m = existing.get(nick) or Member(class_id=classroom.id, nick=nick)
        m.role = "admin" if nick == "leo" else "member"
        m.pin_hash = pin_hash
        m.invite_hash = None
        m.activated_at = m.activated_at or datetime.now(timezone.utc)
        m.rotation_order = i
        m.active = True
        m.failed_attempts = 0
        m.locked_until = None
        session.add(m)
        members.append(m)
    return members


def _rebuild_demo(session: Session, classroom: Classroom, today: date) -> Classroom:
    _wipe_demo(session, classroom)
    add_subjects(session, classroom.id)
    add_timetable(session, classroom.id, "4BI")
    members = _restore_demo_members(session, classroom)
    classroom.label = "Demo class · 4ª BI"
    classroom.rotation_anchor = today
    classroom.demo_seeded_on = today
    classroom.demo_seen_on = today
    session.add(classroom)
    session.commit()
    for m in members:
        session.refresh(m)

    cal = ClassCalendar(session, classroom)
    by_nick = {m.nick: m for m in members}
    now = datetime.now(timezone.utc)
    cards: dict[int, DayCard] = {}
    for back in range(1, 6):
        day = today - timedelta(days=back)
        scribe = cal.scheduled_scribe(day)
        card = DayCard(
            class_id=classroom.id, day=day, status="published",
            scribe_member_id=scribe.id if scribe else None,
            author_member_id=scribe.id if scribe else None,
            notes="Bring the calculator tomorrow." if back == 1 else "",
            published_at=now - timedelta(days=back, hours=-2), updated_at=now - timedelta(days=back),
        )
        session.add(card)
        session.flush()
        cards[back] = card
        for pos, block in enumerate(cal.lessons(day)):
            if back == 1 and block.subject_code == "INI" and not block.is_lab:
                block.is_lab, block.room = True, "L143"
            bullets = DEMO_BULLETS.get(block.subject_code, ["Lesson notes"])
            entry = SubjectEntry(
                card_id=card.id, position=pos, subject_code=block.subject_code, hours=block.hours_label,
                room=block.room, is_lab=block.is_lab, bullets=bullets[: 1 + (back + pos) % len(bullets)],
                lesson_status="non_svolta" if (back == 4 and pos == 2) else "svolta",
            )
            if entry.lesson_status == "non_svolta":
                entry.bullets = []
            session.add(entry)
            session.flush()
            if block.is_lab and block.subject_code in DEMO_LABS:
                session.add(LabBlock(entry_id=entry.id, **DEMO_LABS[block.subject_code]))

    def next_lesson(code: str, fallback: int) -> date:
        return cal.next_lesson(code, today) or today + timedelta(days=fallback)

    items = [
        ("verifica", "MAT", "Test: derivatives (rules + exercises)", today + timedelta(days=3), None, "detto in classe", 1, "anna"),
        ("compito", "MAT", "Exercises 12-15 page 112", next_lesson("MAT", 1), None, "ClasseViva", 1, "anna"),
        ("compito", "INI", "Add GET /stations/{id} with 404 handling", next_lesson("INI", 2), None, "Classroom", 2, "luca"),
        ("lab", "SRI", "Lab report: VLAN configuration (PDF on Classroom)", today + timedelta(days=5), None, "Classroom", 3, "marta"),
        ("evento", None, "Student assembly in the gym", today + timedelta(days=6), "10:50", "Campus", None, "leo"),
        ("compito", "ING", "Write a 150-word cover letter", next_lesson("ING", 2), None, "Classroom", None, "sara"),
        ("verifica", "STO", "Oral test: Thirty Years' War", today + timedelta(days=8), None, "ClasseViva", 4, "sara"),
        ("compito", "TPI", "Read chapter 4: synchronization", next_lesson("TPI", 3), None, "detto in classe", 5, "gianni"),
    ]
    for tipo, subject, title, due, due_time, source, card_back, nick in items:
        author = cards[card_back].author_member_id if card_back else by_nick[nick].id
        session.add(
            UpcomingItem(
                class_id=classroom.id, card_id=cards[card_back].id if card_back else None, type=tipo,
                subject_code=subject, title=title, due_date=due, due_time=due_time, source=source,
                author_member_id=author, status="published",
            )
        )
    session.commit()
    return classroom


def ensure_demo(session: Session, today: Optional[date] = None, force: bool = False) -> Classroom:
    """Rebuilds the shared demo class from scratch once a day (or when forced)."""
    today = today or datetime.now(TZ).date()
    classroom = session.exec(select(Classroom).where(Classroom.code == DEMO_CODE)).first()
    if classroom is None:
        classroom = Classroom(
            code=DEMO_CODE, name="DEMO", label="Demo class · 4ª BI", is_demo=True, rotation_anchor=today,
        )
        session.add(classroom)
        session.flush()
        force = True
    if not force and classroom.demo_seeded_on == today:
        return classroom
    return _rebuild_demo(session, classroom, today)


def open_private_demo(session: Session, token: str) -> Classroom:
    """One demo classroom per browser. A second device gets its own copy."""
    today = datetime.now(TZ).date()
    classroom = session.exec(select(Classroom).where(Classroom.demo_token == token)).first()
    if classroom is None:
        code = f"D-{random_code(4)}"
        while session.exec(select(Classroom).where(Classroom.code == code)).first():
            code = f"D-{random_code(4)}"
        classroom = Classroom(
            code=code, name="DEMO", label="Demo class · 4ª BI", is_demo=True,
            rotation_anchor=today, demo_token=token,
        )
        session.add(classroom)
        session.flush()
        return _rebuild_demo(session, classroom, today)
    if classroom.demo_seeded_on != today:
        return _rebuild_demo(session, classroom, today)
    classroom.demo_seen_on = today
    session.add(classroom)
    session.commit()
    return classroom


def purge_private_demos(session: Session) -> None:
    """Removes the per-browser demo copies. The shared DEMO class stays.
    They are not real classes and must not pile up in the school area."""
    rows = session.exec(
        select(Classroom).where(Classroom.is_demo == True, Classroom.code != DEMO_CODE)  # noqa: E712
    ).all()
    for classroom in rows:
        _wipe_demo(session, classroom)
        session.exec(delete(Member).where(Member.class_id == classroom.id))
        session.delete(classroom)
    session.commit()


def run_startup_seed() -> None:
    from .routes.media import cleanup_orphans

    db.init_db()
    with Session(db.engine) as session:
        ensure_holidays(session)
        ensure_owner(session)
        ensure_real_classes(session)
        ensure_demo(session)
        purge_private_demos(session)
        cleanup_orphans(session)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset-demo", action="store_true")
    args = parser.parse_args()
    db.init_db()
    with Session(db.engine) as session:
        ensure_holidays(session)
        ensure_owner(session)
        ensure_real_classes(session)
        ensure_demo(session, force=args.reset_demo)
    print("Seed completato.")


if __name__ == "__main__":
    main()
