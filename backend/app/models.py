"""Schema for meetings, participants, chat, and history.

users
    The signed-in demo account. personal_meeting_code is a stable PMI.

meetings
    A joinable room.
    status: ready (idle personal room), scheduled, live, ended, cancelled.
    The personal meeting row is reused. Instant and scheduled meetings are one-shot.

participants
    Someone who entered a room. token authenticates signaling and host actions.
    left_at is set when they leave, are removed, or the meeting ends.

chat_messages
    Chat persisted for the life of a meeting row.

meeting_history
    Snapshot written when a meeting ends, so reusing the personal room does not
    erase previous sessions from the Recent list.
"""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    personal_meeting_code: Mapped[str] = mapped_column(String(11), unique=True)

    meetings: Mapped[list["Meeting"]] = relationship(back_populates="host")


class Meeting(Base):
    __tablename__ = "meetings"
    __table_args__ = (Index("ix_meetings_status_scheduled", "status", "scheduled_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(11), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    host_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    meeting_type: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="scheduled")
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=30)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    locked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    host: Mapped[User] = relationship(back_populates="meetings")
    participants: Mapped[list["Participant"]] = relationship(back_populates="meeting")
    messages: Mapped[list["ChatMessage"]] = relationship(back_populates="meeting")


class Participant(Base):
    __tablename__ = "participants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id"), index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    display_name: Mapped[str] = mapped_column(String(64))
    role: Mapped[str] = mapped_column(String(20))
    token: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    meeting: Mapped[Meeting] = relationship(back_populates="participants")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id"), index=True)
    sender_name: Mapped[str] = mapped_column(String(64))
    body: Mapped[str] = mapped_column(Text)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

    meeting: Mapped[Meeting] = relationship(back_populates="messages")


class MeetingHistory(Base):
    __tablename__ = "meeting_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    meeting_id: Mapped[int | None] = mapped_column(ForeignKey("meetings.id"), nullable=True)
    code: Mapped[str] = mapped_column(String(11), index=True)
    title: Mapped[str] = mapped_column(String(120))
    host_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    meeting_type: Mapped[str] = mapped_column(String(20))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    participant_count: Mapped[int] = mapped_column(Integer, default=0)

    host: Mapped[User] = relationship()
