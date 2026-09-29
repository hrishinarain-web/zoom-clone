"""
Database schema.

    users 1───* meetings            (a user hosts many meetings)
    meetings 1───* participants     (one row per join session)
    users 1───* participants        (nullable: guests have no user account)
    meetings 1───* chat_messages
    participants 1───* chat_messages

All timestamps are stored as naive UTC.
"""
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    avatar_color: Mapped[str] = mapped_column(String(7), default="#0B5CFF")
    # Personal Meeting ID, like Zoom's PMI.
    personal_meeting_id: Mapped[str] = mapped_column(String(11), unique=True, nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Kolkata")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    meetings: Mapped[list["Meeting"]] = relationship(back_populates="host", cascade="all, delete-orphan")


class Meeting(Base):
    __tablename__ = "meetings"
    __table_args__ = (
        CheckConstraint("meeting_type IN ('instant', 'scheduled')", name="ck_meeting_type"),
        CheckConstraint("status IN ('scheduled', 'live', 'ended')", name="ck_meeting_status"),
        CheckConstraint("duration_minutes > 0", name="ck_duration_positive"),
        Index("ix_meetings_host_start", "host_id", "scheduled_start"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Public 10/11-digit Meeting ID that users type in to join.
    meeting_code: Mapped[str] = mapped_column(String(11), unique=True, index=True, nullable=False)
    passcode: Mapped[str] = mapped_column(String(10), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    host_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    meeting_type: Mapped[str] = mapped_column(String(16), nullable=False, default="instant")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="scheduled")
    scheduled_start: Mapped[datetime | None] = mapped_column(DateTime)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=40)
    waiting_room: Mapped[bool] = mapped_column(Boolean, default=False)
    mute_on_entry: Mapped[bool] = mapped_column(Boolean, default=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    host: Mapped[User] = relationship(back_populates="meetings")
    participants: Mapped[list["Participant"]] = relationship(
        back_populates="meeting", cascade="all, delete-orphan", order_by="Participant.joined_at"
    )
    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="meeting", cascade="all, delete-orphan", order_by="ChatMessage.sent_at"
    )


class Participant(Base):
    """One row per join session. A person who leaves and rejoins gets a new row."""
    __tablename__ = "participants"
    __table_args__ = (
        CheckConstraint("role IN ('host', 'participant')", name="ck_participant_role"),
        Index("ix_participants_meeting_active", "meeting_id", "left_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(16), default="participant")
    # Secret handed to the client on join; authenticates the WebSocket connection.
    session_token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    left_at: Mapped[datetime | None] = mapped_column(DateTime)
    was_removed: Mapped[bool] = mapped_column(Boolean, default=False)

    meeting: Mapped[Meeting] = relationship(back_populates="participants")
    user: Mapped[User | None] = relationship()


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), index=True)
    participant_id: Mapped[int] = mapped_column(ForeignKey("participants.id", ondelete="CASCADE"))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    meeting: Mapped[Meeting] = relationship(back_populates="messages")
    participant: Mapped[Participant] = relationship()
