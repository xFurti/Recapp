from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Optional

from sqlmodel import Session, select

from .config import TZ
from .models import Classroom, Holiday, Member, ScribeOverride, Subject, TimetableSlot
from .school_data import HOURS, SCHOOL_YEAR_END, SCHOOL_YEAR_START, bell_hours

TAKEOVER_AT = time(18, 0)
HOUR_TIMES = {h["hour"]: (h["start"], h["end"]) for h in HOURS}


@dataclass
class LessonBlock:
    subject_code: str
    hours: list[int]
    room: str
    is_lab: bool

    @property
    def hours_label(self) -> str:
        if len(self.hours) == 1:
            return str(self.hours[0])
        return f"{self.hours[0]}-{self.hours[-1]}"

    def as_dict(self, times: Optional[dict] = None) -> dict:
        table = times if times is not None else HOUR_TIMES
        return {
            "subject_code": self.subject_code,
            "hours": self.hours,
            "hours_label": self.hours_label,
            "start": table.get(self.hours[0], ("", ""))[0],
            "end": table.get(self.hours[-1], ("", ""))[1],
            "room": self.room,
            "is_lab": self.is_lab,
        }


def local_now(override: Optional[datetime] = None) -> datetime:
    if override is not None:
        return override if override.tzinfo else override.replace(tzinfo=TZ)
    return datetime.now(TZ)


class ClassCalendar:
    """Per-request view of a class schedule: school days, lessons and scribes."""

    def __init__(self, session: Session, classroom: Classroom):
        self.session = session
        self.classroom = classroom
        self._holidays: Optional[dict[date, Holiday]] = None
        self._slots: Optional[dict[int, list[TimetableSlot]]] = None
        self._members: Optional[list[Member]] = None
        self._overrides: Optional[dict[date, ScribeOverride]] = None

    # ---- calendar -------------------------------------------------------------
    @property
    def holidays(self) -> dict[date, Holiday]:
        if self._holidays is None:
            self._holidays = {h.day: h for h in self.session.exec(select(Holiday)).all()}
        return self._holidays

    def holiday(self, d: date) -> Optional[Holiday]:
        if self.classroom.is_demo:
            return None
        return self.holidays.get(d)

    def is_school_day(self, d: date) -> bool:
        if self.classroom.is_demo:
            return True
        if d.weekday() >= 5:
            return False
        if d < SCHOOL_YEAR_START or d > SCHOOL_YEAR_END:
            return False
        return d not in self.holidays

    def no_school_reason(self, d: date) -> str:
        h = self.holiday(d)
        if h:
            return h.label
        if d.weekday() >= 5:
            return "weekend"
        if d < SCHOOL_YEAR_START or d > SCHOOL_YEAR_END:
            return "fuori anno scolastico"
        return ""

    def next_school_day(self, after: date, max_days: int = 60) -> Optional[date]:
        d = after + timedelta(days=1)
        for _ in range(max_days):
            if self.is_school_day(d):
                return d
            d += timedelta(days=1)
        return None

    def prev_school_day(self, before: date, max_days: int = 60) -> Optional[date]:
        d = before - timedelta(days=1)
        for _ in range(max_days):
            if self.is_school_day(d):
                return d
            d -= timedelta(days=1)
        return None

    def school_days(self, start: date, count: int) -> list[date]:
        out: list[date] = []
        d = start
        guard = 0
        while len(out) < count and guard < 400:
            if self.is_school_day(d):
                out.append(d)
            d += timedelta(days=1)
            guard += 1
        return out

    # ---- timetable ------------------------------------------------------------
    @property
    def slots(self) -> dict[int, list[TimetableSlot]]:
        if self._slots is None:
            rows = self.session.exec(
                select(TimetableSlot)
                .where(TimetableSlot.class_id == self.classroom.id)
                .order_by(TimetableSlot.weekday, TimetableSlot.hour)
            ).all()
            by_day: dict[int, list[TimetableSlot]] = {}
            for r in rows:
                by_day.setdefault(r.weekday, []).append(r)
            self._slots = by_day
        return self._slots

    def hour_times(self) -> dict[int, tuple[str, str]]:
        return {int(h["hour"]): (h["start"], h["end"]) for h in bell_hours(self.classroom.hours)}

    def timetable_weekday(self, d: date) -> int:
        wd = d.weekday()
        if wd >= 5 and self.classroom.is_demo:
            return wd - 5
        return wd

    def lessons(self, d: date) -> list[LessonBlock]:
        if not self.is_school_day(d):
            return []
        blocks: list[LessonBlock] = []
        for slot in self.slots.get(self.timetable_weekday(d), []):
            last = blocks[-1] if blocks else None
            if last and last.subject_code == slot.subject_code and last.hours[-1] == slot.hour - 1:
                last.hours.append(slot.hour)
                last.is_lab = last.is_lab or slot.is_lab
                if slot.is_lab and not last.room.upper().startswith("L"):
                    last.room = slot.room
            else:
                blocks.append(LessonBlock(slot.subject_code, [slot.hour], slot.room, slot.is_lab))
        return blocks

    def next_lesson(self, subject_code: str, after: date) -> Optional[date]:
        d = after
        for _ in range(40):
            nd = self.next_school_day(d)
            if nd is None:
                return None
            if any(s.subject_code == subject_code for s in self.slots.get(self.timetable_weekday(nd), [])):
                return nd
            d = nd
        return None

    def next_lessons(self, after: date) -> dict[str, str]:
        subjects = self.session.exec(select(Subject).where(Subject.class_id == self.classroom.id)).all()
        out = {}
        for s in subjects:
            nd = self.next_lesson(s.code, after)
            if nd:
                out[s.code] = nd.isoformat()
        return out

    # ---- rotation ---------------------------------------------------------------
    @property
    def members(self) -> list[Member]:
        if self._members is None:
            self._members = list(
                self.session.exec(
                    select(Member)
                    .where(Member.class_id == self.classroom.id, Member.active == True)  # noqa: E712
                    .order_by(Member.rotation_order, Member.id)
                ).all()
            )
        return self._members

    @property
    def rotation(self) -> list[Member]:
        return [m for m in self.members if m.activated_at is not None]

    @property
    def overrides(self) -> dict[date, ScribeOverride]:
        if self._overrides is None:
            rows = self.session.exec(
                select(ScribeOverride).where(ScribeOverride.class_id == self.classroom.id)
            ).all()
            self._overrides = {r.day: r for r in rows}
        return self._overrides

    def invalidate(self) -> None:
        self._members = None
        self._overrides = None
        self._slots = None

    def rotation_index(self, d: date) -> int:
        anchor = self.classroom.rotation_anchor
        if d == anchor:
            return 0
        step = 1 if d > anchor else -1
        count = 0
        cur = anchor
        while cur != d:
            cur += timedelta(days=step)
            if self.is_school_day(cur):
                count += step
        return count

    def scheduled_scribe(self, d: date) -> Optional[Member]:
        rot = self.rotation
        if not rot or not self.is_school_day(d):
            return None
        return rot[self.rotation_index(d) % len(rot)]

    def scribe(self, d: date) -> tuple[Optional[Member], Optional[ScribeOverride]]:
        """Returns the responsible scribe and the override that applies, if any.

        A `pass` override means the scheduled scribe gave up the turn: nobody is
        responsible and anyone can take over.
        """
        ov = self.overrides.get(d)
        if ov is not None:
            if ov.reason == "pass" or ov.member_id is None:
                return None, ov
            member = next((m for m in self.members if m.id == ov.member_id), None)
            if member is not None:
                return member, ov
        return self.scheduled_scribe(d), None


def takeover_open(d: date, now: datetime) -> bool:
    today = now.date()
    if d < today:
        return True
    if d > today:
        return False
    return now.time() >= TAKEOVER_AT
