from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import JSON, Column, LargeBinary, UniqueConstraint
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Classroom(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(index=True, unique=True)
    name: str
    label: str = ""
    is_demo: bool = False
    rotation_anchor: date
    demo_seeded_on: Optional[date] = None
    created_at: datetime = Field(default_factory=utcnow)


class Member(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("class_id", "nick"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    class_id: int = Field(foreign_key="classroom.id", index=True)
    nick: str
    role: str = "member"  # admin | member
    pin_hash: Optional[str] = None
    invite_hash: Optional[str] = None
    activated_at: Optional[datetime] = None
    rotation_order: int = 0
    active: bool = True
    failed_attempts: int = 0
    locked_until: Optional[datetime] = None
    session_version: int = 1
    created_at: datetime = Field(default_factory=utcnow)


class Owner(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    password_hash: str
    display_name: str = ""
    failed_attempts: int = 0
    locked_until: Optional[datetime] = None
    session_version: int = 1


class Subject(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("class_id", "code"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    class_id: int = Field(foreign_key="classroom.id", index=True)
    code: str
    name_it: str
    name_en: str
    color: str


class TimetableSlot(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("class_id", "weekday", "hour"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    class_id: int = Field(foreign_key="classroom.id", index=True)
    weekday: int  # 0 = Monday ... 4 = Friday
    hour: int  # 1 ... 7
    subject_code: str
    room: str = ""
    is_lab: bool = False


class Holiday(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    day: date = Field(index=True, unique=True)
    label: str
    kind: str = "festivita"  # festivita | sospensione


class ScribeOverride(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("class_id", "day"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    class_id: int = Field(foreign_key="classroom.id", index=True)
    day: date
    member_id: Optional[int] = Field(default=None, foreign_key="member.id")
    reason: str  # swap | takeover | pass
    created_by: Optional[int] = None
    created_at: datetime = Field(default_factory=utcnow)


class DayCard(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("class_id", "day"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    class_id: int = Field(foreign_key="classroom.id", index=True)
    day: date = Field(index=True)
    status: str = "draft"  # draft | published
    scribe_member_id: Optional[int] = Field(default=None, foreign_key="member.id")
    author_member_id: Optional[int] = Field(default=None, foreign_key="member.id")
    notes: str = ""
    revision: int = 0
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    published_at: Optional[datetime] = None


class SubjectEntry(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    card_id: int = Field(foreign_key="daycard.id", index=True)
    position: int = 0
    subject_code: str
    hours: str = ""
    room: str = ""
    is_lab: bool = False
    lesson_status: str = "svolta"  # svolta | non_svolta | supplenza | verifica
    bullets: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    attachment_ids: Optional[list[int]] = Field(default_factory=list, sa_column=Column(JSON))


class LabBlock(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    entry_id: int = Field(foreign_key="subjectentry.id", index=True, unique=True)
    goal: str = ""
    repo_url: str = ""
    pitfall: str = ""
    bring: str = ""


class Attachment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    class_id: int = Field(foreign_key="classroom.id", index=True)
    card_id: Optional[int] = Field(default=None, foreign_key="daycard.id")
    mime: str = "image/webp"
    data: bytes = Field(sa_column=Column(LargeBinary, nullable=False))
    width: int = 0
    height: int = 0
    created_by: Optional[int] = None
    created_at: datetime = Field(default_factory=utcnow)


class UpcomingItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    class_id: int = Field(foreign_key="classroom.id", index=True)
    card_id: Optional[int] = Field(default=None, foreign_key="daycard.id")
    type: str  # compito | verifica | evento | lab
    subject_code: Optional[str] = None
    title: str
    due_date: date = Field(index=True)
    due_time: Optional[str] = None
    source: str = "detto in classe"
    link: str = ""
    attachment_id: Optional[int] = Field(default=None, foreign_key="attachment.id")
    author_member_id: Optional[int] = Field(default=None, foreign_key="member.id")
    status: str = "published"  # draft | published
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class CardComment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    card_id: int = Field(foreign_key="daycard.id", index=True)
    class_id: int = Field(foreign_key="classroom.id", index=True)
    member_id: int = Field(foreign_key="member.id")
    kind: str = "comment"  # comment | correction
    body: str
    resolved: bool = False
    deleted: bool = False
    created_at: datetime = Field(default_factory=utcnow)


class CardThanks(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("card_id", "member_id"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    card_id: int = Field(foreign_key="daycard.id", index=True)
    member_id: int = Field(foreign_key="member.id")
    created_at: datetime = Field(default_factory=utcnow)


class OcrJob(SQLModel, table=True):
    id: str = Field(primary_key=True)
    class_id: int = Field(foreign_key="classroom.id", index=True)
    status: str = "queued"  # queued | running | done | error
    input_kind: str = "text"  # text | image
    text: str = ""
    attachment_id: Optional[int] = Field(default=None, foreign_key="attachment.id")
    result: Optional[list] = Field(default=None, sa_column=Column(JSON))
    error: str = ""
    provider: str = ""
    render_run_id: str = ""
    created_by: Optional[int] = None
    created_at: datetime = Field(default_factory=utcnow)
