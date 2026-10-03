import re
from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

ItemType = Literal["compito", "verifica", "evento", "lab"]
ItemSource = Literal["detto in classe", "ClasseViva", "Classroom", "Campus", "altro"]
LessonStatus = Literal["svolta", "non_svolta", "supplenza", "verifica"]

NICK_RE = re.compile(r"^[\w.\-]{2,16}$", re.UNICODE)
TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def _clean_link(v: str) -> str:
    v = (v or "").strip()
    if v and not re.match(r"^https?://", v, re.I):
        v = "https://" + v
    return v[:500]


class ActivateIn(BaseModel):
    member_id: int
    invite: str = Field(max_length=20)
    pin: str


class LoginIn(BaseModel):
    member_id: int
    pin: str


class ChangePinIn(BaseModel):
    old_pin: str
    new_pin: str


class OwnerLoginIn(BaseModel):
    username: str = Field(max_length=64)
    password: str = Field(max_length=200)


class LabIn(BaseModel):
    goal: str = Field("", max_length=300)
    repo_url: str = Field("", max_length=500)
    pitfall: str = Field("", max_length=300)
    bring: str = Field("", max_length=300)

    @field_validator("goal", "pitfall", "bring")
    @classmethod
    def _trim(cls, v: str) -> str:
        return v.strip()

    @field_validator("repo_url")
    @classmethod
    def _repo(cls, v: str) -> str:
        return _clean_link(v)

    def is_empty(self) -> bool:
        return not any(v.strip() for v in (self.goal, self.repo_url, self.pitfall, self.bring))


class EntryIn(BaseModel):
    subject_code: str = Field(max_length=8)
    hours: str = Field("", max_length=12)
    room: str = Field("", max_length=20)
    is_lab: bool = False
    lesson_status: LessonStatus = "svolta"
    bullets: list[str] = Field(default_factory=list, max_length=5)
    lab: Optional[LabIn] = None
    attachment_ids: list[int] = Field(default_factory=list, max_length=3)

    @field_validator("bullets")
    @classmethod
    def _bullets(cls, v: list[str]) -> list[str]:
        return [b.strip()[:300] for b in v]


class ItemIn(BaseModel):
    id: Optional[int] = None
    type: ItemType
    subject_code: Optional[str] = Field(None, max_length=8)
    title: str = Field(min_length=1, max_length=200)
    due_date: date
    due_time: Optional[str] = None
    source: ItemSource = "detto in classe"
    link: str = ""
    attachment_id: Optional[int] = None

    @field_validator("link")
    @classmethod
    def _link(cls, v: str) -> str:
        return _clean_link(v)

    @field_validator("due_time")
    @classmethod
    def _time(cls, v: Optional[str]) -> Optional[str]:
        if v in (None, ""):
            return None
        if not TIME_RE.match(v):
            raise ValueError("Formato ora HH:MM")
        return v

    @field_validator("title")
    @classmethod
    def _title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Titolo obbligatorio")
        return v


class CardIn(BaseModel):
    revision: Optional[int] = None
    entries: list[EntryIn] = Field(default_factory=list, max_length=14)
    notes: str = Field("", max_length=1500)
    items: list[ItemIn] = Field(default_factory=list, max_length=30)
    attachment_ids: list[int] = Field(default_factory=list, max_length=6)


class UpcomingPatch(BaseModel):
    type: Optional[ItemType] = None
    subject_code: Optional[str] = Field(None, max_length=8)
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    due_date: Optional[date] = None
    due_time: Optional[str] = None
    source: Optional[ItemSource] = None
    link: Optional[str] = None

    @field_validator("link")
    @classmethod
    def _link(cls, v: Optional[str]) -> Optional[str]:
        return None if v is None else _clean_link(v)


class SlotIn(BaseModel):
    weekday: int = Field(ge=0, le=4)
    hour: int = Field(ge=1, le=7)
    subject_code: str = Field(min_length=2, max_length=8)
    room: str = Field("", max_length=20)
    is_lab: Optional[bool] = None


class SubjectIn(BaseModel):
    code: str = Field(min_length=2, max_length=8)
    name_it: str = Field(min_length=1, max_length=60)
    name_en: str = Field(min_length=1, max_length=60)
    color: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")


class TimetableIn(BaseModel):
    slots: list[SlotIn] = Field(max_length=35)
    subjects: Optional[list[SubjectIn]] = Field(None, max_length=20)


class MemberIn(BaseModel):
    nick: str
    role: Literal["admin", "member"] = "member"

    @field_validator("nick")
    @classmethod
    def _nick(cls, v: str) -> str:
        v = v.strip()
        if not NICK_RE.match(v):
            raise ValueError("Nick: 2-16 caratteri, lettere, numeri, punto, trattino")
        return v


class MemberPatch(BaseModel):
    role: Optional[Literal["admin", "member"]] = None


class RotationOrderIn(BaseModel):
    member_ids: list[int]


class SwapIn(BaseModel):
    day_a: date
    day_b: date


class DayIn(BaseModel):
    day: Optional[date] = None


class OcrIn(BaseModel):
    text: Optional[str] = Field(None, max_length=2000)
    attachment_id: Optional[int] = None
    day: Optional[date] = None


class OwnerClassIn(BaseModel):
    name: str = Field(min_length=2, max_length=10)
    label: str = Field("", max_length=60)
    admin_nick: str
    timetable_from: Optional[str] = None

    @field_validator("admin_nick")
    @classmethod
    def _nick(cls, v: str) -> str:
        return MemberIn(nick=v).nick


class HolidayIn(BaseModel):
    day: date
    label: str = Field(min_length=1, max_length=80)
    kind: Literal["festivita", "sospensione"] = "festivita"
