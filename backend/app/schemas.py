"""Pydantic request/response models (API contract)."""
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    @field_serializer("*", when_used="json", check_fields=False)
    def _utc(self, v):
        # DB stores naive UTC; emit explicit "Z" so browsers convert to local time correctly.
        if isinstance(v, datetime):
            if v.tzinfo is None:
                v = v.replace(tzinfo=timezone.utc)
            return v.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
        return v


class UserOut(APIModel):
    id: int
    name: str
    email: str
    avatar_color: str
    personal_meeting_id: str
    timezone: str


class MeetingOut(APIModel):
    id: int
    meeting_code: str
    passcode: str
    title: str
    description: str | None
    meeting_type: Literal["instant", "scheduled"]
    status: Literal["scheduled", "live", "ended"]
    scheduled_start: datetime | None
    duration_minutes: int
    waiting_room: bool
    mute_on_entry: bool
    started_at: datetime | None
    ended_at: datetime | None
    created_at: datetime
    host: UserOut
    join_url: str
    participant_count: int = 0
    active_participant_count: int = 0


class MeetingPublic(APIModel):
    """What an unauthenticated joiner may see before entering the passcode."""
    meeting_code: str
    title: str
    host_name: str
    status: str
    requires_passcode: bool
    scheduled_start: datetime | None


class InstantMeetingCreate(BaseModel):
    title: str | None = Field(default=None, max_length=200)


class ScheduleMeetingCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    scheduled_start: datetime
    duration_minutes: int = Field(ge=15, le=24 * 60)
    passcode: str | None = Field(default=None, min_length=1, max_length=10)
    waiting_room: bool = False
    mute_on_entry: bool = False

    @field_validator("scheduled_start")
    @classmethod
    def _to_naive_utc(cls, v: datetime) -> datetime:
        if v.tzinfo is not None:
            v = v.astimezone(timezone.utc).replace(tzinfo=None)
        return v

    @field_validator("title")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title cannot be blank")
        return v


class MeetingUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    scheduled_start: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=15, le=24 * 60)

    @field_validator("scheduled_start")
    @classmethod
    def _to_naive_utc(cls, v: datetime | None) -> datetime | None:
        if v is not None and v.tzinfo is not None:
            v = v.astimezone(timezone.utc).replace(tzinfo=None)
        return v


class JoinRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=100)
    passcode: str | None = None
    # True when the default logged-in user starts their own meeting (host flow).
    as_host: bool = False

    @field_validator("display_name")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Display name cannot be blank")
        return v


class ParticipantOut(APIModel):
    id: int
    display_name: str
    role: str
    joined_at: datetime
    left_at: datetime | None
    user_id: int | None


class JoinResponse(BaseModel):
    participant: ParticipantOut
    session_token: str
    meeting: MeetingOut


class ChatMessageOut(APIModel):
    id: int
    participant_id: int
    sender_name: str
    content: str
    sent_at: datetime
