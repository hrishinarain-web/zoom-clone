from datetime import datetime

from pydantic import BaseModel, Field


class MeetingOut(BaseModel):
    id: int
    code: str
    code_display: str
    title: str
    description: str
    meeting_type: str
    status: str
    scheduled_at: datetime | None
    duration_minutes: int
    started_at: datetime | None
    ended_at: datetime | None
    locked: bool
    host_name: str


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    personal_meeting_code: str
    personal_meeting_code_display: str
    personal_meeting_status: str
    personal_meeting_title: str


class HistoryOut(BaseModel):
    id: int
    code: str
    code_display: str
    title: str
    host_name: str
    meeting_type: str
    started_at: datetime | None
    ended_at: datetime | None
    participant_count: int


class ScheduleIn(BaseModel):
    title: str
    description: str = ""
    scheduled_at: datetime
    duration_minutes: int = 30


class JoinIn(BaseModel):
    display_name: str = Field(min_length=1, max_length=64)


class JoinOut(BaseModel):
    meeting: MeetingOut
    participant_id: int
    display_name: str
    role: str
    token: str


class LockIn(BaseModel):
    locked: bool


class ChatOut(BaseModel):
    id: int
    sender_name: str
    body: str
    sent_at: datetime
