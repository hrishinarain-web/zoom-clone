import random
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import ChatMessage, Meeting, MeetingHistory, Participant, User
from app.schemas import ChatOut, HistoryOut, JoinOut, MeetingOut, ScheduleIn, UserOut


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def format_code(code: str) -> str:
    if len(code) == 11:
        return f"{code[0:3]} {code[3:7]} {code[7:11]}"
    if len(code) == 10:
        return f"{code[0:3]} {code[3:6]} {code[6:10]}"
    if len(code) == 9:
        return f"{code[0:3]} {code[3:6]} {code[6:9]}"
    return code


def normalize_code(raw: str) -> str:
    digits = "".join(ch for ch in raw if ch.isdigit())
    if not digits:
        raise ApiError(404, "Invalid meeting ID. Please check and try again.")
    return digits


def demo_user(db: Session) -> User:
    user = db.scalar(select(User).order_by(User.id))
    if user is None:
        raise ApiError(500, "Demo user is not seeded.")
    return user


def generate_code(db: Session) -> str:
    for _ in range(30):
        code = str(random.randint(10**10, 10**11 - 1))
        taken = db.scalar(select(Meeting.id).where(Meeting.code == code))
        pmi = db.scalar(select(User.id).where(User.personal_meeting_code == code))
        if taken is None and pmi is None:
            return code
    raise ApiError(500, "Could not generate a meeting ID.")


def to_meeting(meeting: Meeting) -> MeetingOut:
    return MeetingOut(
        id=meeting.id,
        code=meeting.code,
        code_display=format_code(meeting.code),
        title=meeting.title,
        description=meeting.description or "",
        meeting_type=meeting.meeting_type,
        status=meeting.status,
        scheduled_at=as_utc(meeting.scheduled_at) if meeting.scheduled_at else None,
        duration_minutes=meeting.duration_minutes,
        started_at=as_utc(meeting.started_at) if meeting.started_at else None,
        ended_at=as_utc(meeting.ended_at) if meeting.ended_at else None,
        locked=meeting.locked,
        host_name=meeting.host.name,
    )


def to_join(meeting: Meeting, participant: Participant) -> JoinOut:
    return JoinOut(
        meeting=to_meeting(meeting),
        participant_id=participant.id,
        display_name=participant.display_name,
        role=participant.role,
        token=participant.token,
    )


def get_meeting(db: Session, raw_code: str) -> Meeting | None:
    code = normalize_code(raw_code)
    return db.scalar(select(Meeting).where(Meeting.code == code))


def require_meeting(db: Session, raw_code: str) -> Meeting:
    meeting = get_meeting(db, raw_code)
    if meeting is None:
        raise ApiError(404, "Invalid meeting ID. Please check and try again.")
    return meeting


def clean_name(display_name: str) -> str:
    name = " ".join(display_name.split())
    if not name:
        raise ApiError(422, "Enter a display name.")
    if len(name) > 64:
        raise ApiError(422, "Display name must be 64 characters or fewer.")
    return name


def add_participant(
    db: Session,
    meeting: Meeting,
    display_name: str,
    role: str,
    user_id: int | None = None,
) -> Participant:
    participant = Participant(
        meeting_id=meeting.id,
        user_id=user_id,
        display_name=display_name,
        role=role,
        token=secrets.token_urlsafe(24),
        joined_at=utcnow(),
    )
    db.add(participant)
    db.commit()
    db.refresh(participant)
    return participant


def activate(meeting: Meeting) -> None:
    if meeting.status != "live":
        meeting.status = "live"
        meeting.started_at = utcnow()
        meeting.ended_at = None
        meeting.locked = False


def get_me(db: Session) -> UserOut:
    user = demo_user(db)
    personal = db.scalar(select(Meeting).where(Meeting.code == user.personal_meeting_code))
    return UserOut(
        id=user.id,
        name=user.name,
        email=user.email,
        personal_meeting_code=user.personal_meeting_code,
        personal_meeting_code_display=format_code(user.personal_meeting_code),
        personal_meeting_status=personal.status if personal else "ready",
        personal_meeting_title=personal.title if personal else f"{user.name}'s Personal Meeting Room",
    )


def list_upcoming(db: Session) -> list[MeetingOut]:
    now = utcnow()
    rows = db.scalars(select(Meeting).where(Meeting.status.in_(("scheduled", "live")))).all()
    live = [meeting for meeting in rows if meeting.status == "live"]
    scheduled = sorted(
        (meeting for meeting in rows if meeting.status == "scheduled"),
        key=lambda meeting: meeting.scheduled_at or now,
    )
    return [to_meeting(meeting) for meeting in live + scheduled]


def list_recent(db: Session) -> list[HistoryOut]:
    rows = db.scalars(select(MeetingHistory).order_by(MeetingHistory.ended_at.desc()).limit(20)).all()
    return [
        HistoryOut(
            id=row.id,
            code=row.code,
            code_display=format_code(row.code),
            title=row.title,
            host_name=row.host.name,
            meeting_type=row.meeting_type,
            started_at=as_utc(row.started_at) if row.started_at else None,
            ended_at=as_utc(row.ended_at) if row.ended_at else None,
            participant_count=row.participant_count,
        )
        for row in rows
    ]


def create_instant(db: Session, title: str | None = None) -> JoinOut:
    user = demo_user(db)
    cleaned = (title or "").strip()
    meeting = Meeting(
        code=generate_code(db),
        title=(cleaned or f"{user.name}'s Zoom Meeting")[:120],
        description="",
        host_user_id=user.id,
        meeting_type="instant",
        status="live",
        duration_minutes=60,
        started_at=utcnow(),
        locked=False,
        created_at=utcnow(),
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    participant = add_participant(db, meeting, user.name, "host", user.id)
    return to_join(meeting, participant)


def schedule_meeting(db: Session, payload: ScheduleIn) -> MeetingOut:
    user = demo_user(db)
    title = " ".join(payload.title.split())
    if not title:
        raise ApiError(422, "Add a meeting title.")
    if len(title) > 120:
        raise ApiError(422, "Title must be 120 characters or fewer.")
    description = payload.description.strip()
    if len(description) > 2000:
        raise ApiError(422, "Description must be 2000 characters or fewer.")
    when = as_utc(payload.scheduled_at)
    if when <= utcnow() - timedelta(minutes=1):
        raise ApiError(422, "Pick a time in the future.")
    if payload.duration_minutes < 15 or payload.duration_minutes > 240:
        raise ApiError(422, "Duration must be between 15 and 240 minutes.")

    meeting = Meeting(
        code=generate_code(db),
        title=title,
        description=description,
        host_user_id=user.id,
        meeting_type="scheduled",
        status="scheduled",
        scheduled_at=when,
        duration_minutes=payload.duration_minutes,
        locked=False,
        created_at=utcnow(),
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return to_meeting(meeting)


def start_meeting(db: Session, raw_code: str) -> JoinOut:
    user = demo_user(db)
    meeting = require_meeting(db, raw_code)
    if meeting.host_user_id != user.id:
        raise ApiError(403, "Only the host can start this meeting.")
    if meeting.status == "cancelled":
        raise ApiError(410, "This meeting was cancelled.")
    if meeting.status == "ended":
        raise ApiError(410, "This meeting has ended.")
    if meeting.status in ("scheduled", "ready"):
        activate(meeting)
        db.commit()
        db.refresh(meeting)
    elif meeting.status != "live":
        raise ApiError(409, "This meeting cannot be started.")
    participant = add_participant(db, meeting, user.name, "host", user.id)
    return to_join(meeting, participant)


def join_meeting(db: Session, raw_code: str, display_name: str) -> JoinOut:
    meeting = require_meeting(db, raw_code)
    if meeting.status == "ended":
        raise ApiError(410, "This meeting has ended.")
    if meeting.status == "cancelled":
        raise ApiError(410, "This meeting was cancelled.")
    if meeting.status == "scheduled":
        raise ApiError(409, "The host hasn't started this meeting yet.")
    if meeting.status == "ready":
        raise ApiError(409, "The host hasn't started this meeting yet.")
    if meeting.status != "live":
        raise ApiError(409, "This meeting is not available.")
    if meeting.locked:
        raise ApiError(403, "This meeting is locked.")
    participant = add_participant(db, meeting, clean_name(display_name), "participant")
    return to_join(meeting, participant)


def _session(db: Session, raw_code: str, token: str) -> tuple[Meeting, Participant]:
    meeting = require_meeting(db, raw_code)
    participant = db.scalar(select(Participant).where(Participant.token == token))
    if participant is None or participant.meeting_id != meeting.id or participant.left_at is not None:
        raise ApiError(401, "Your meeting session has expired. Join again.")
    if meeting.status in ("ended", "cancelled"):
        raise ApiError(410, "This meeting has ended.")
    return meeting, participant


def require_host(db: Session, raw_code: str, token: str) -> tuple[Meeting, Participant]:
    meeting, participant = _session(db, raw_code, token)
    if participant.role != "host":
        raise ApiError(403, "Only the host can do that.")
    return meeting, participant


def leave_meeting(db: Session, raw_code: str, token: str) -> None:
    _meeting, participant = _session(db, raw_code, token)
    participant.left_at = utcnow()
    db.commit()


def end_meeting(db: Session, raw_code: str, token: str) -> MeetingOut:
    meeting, _participant = require_host(db, raw_code, token)
    now = utcnow()
    started = as_utc(meeting.started_at) if meeting.started_at else None
    count = 0
    for person in meeting.participants:
        if started is not None and as_utc(person.joined_at) >= started:
            count += 1
        if person.left_at is None:
            person.left_at = now
    db.add(
        MeetingHistory(
            meeting_id=meeting.id,
            code=meeting.code,
            title=meeting.title,
            host_user_id=meeting.host_user_id,
            meeting_type=meeting.meeting_type,
            started_at=meeting.started_at,
            ended_at=now,
            participant_count=count,
        )
    )
    db.execute(delete(ChatMessage).where(ChatMessage.meeting_id == meeting.id))
    meeting.ended_at = now
    meeting.locked = False
    meeting.status = "ready" if meeting.meeting_type == "personal" else "ended"
    db.commit()
    db.refresh(meeting)
    return to_meeting(meeting)


def cancel_meeting(db: Session, raw_code: str) -> MeetingOut:
    user = demo_user(db)
    meeting = require_meeting(db, raw_code)
    if meeting.host_user_id != user.id:
        raise ApiError(403, "Only the host can cancel this meeting.")
    if meeting.status != "scheduled":
        raise ApiError(409, "Only scheduled meetings can be cancelled.")
    meeting.status = "cancelled"
    db.commit()
    db.refresh(meeting)
    return to_meeting(meeting)


def set_locked(db: Session, raw_code: str, token: str, locked: bool) -> MeetingOut:
    meeting, _participant = require_host(db, raw_code, token)
    meeting.locked = locked
    db.commit()
    db.refresh(meeting)
    return to_meeting(meeting)


def remove_participant(db: Session, raw_code: str, token: str, participant_id: int) -> int:
    meeting, host = require_host(db, raw_code, token)
    target = db.get(Participant, participant_id)
    if target is None or target.meeting_id != meeting.id:
        raise ApiError(404, "That participant is not in the meeting.")
    if target.id == host.id:
        raise ApiError(409, "You can't remove yourself. Leave or end the meeting instead.")
    if target.left_at is None:
        target.left_at = utcnow()
        db.commit()
    return target.id


def list_messages(db: Session, raw_code: str) -> list[ChatOut]:
    meeting = require_meeting(db, raw_code)
    rows = db.scalars(
        select(ChatMessage).where(ChatMessage.meeting_id == meeting.id).order_by(ChatMessage.sent_at.asc()).limit(200)
    ).all()
    return [ChatOut(id=row.id, sender_name=row.sender_name, body=row.body, sent_at=as_utc(row.sent_at)) for row in rows]


def add_message(db: Session, meeting_id: int, sender_name: str, body: str) -> ChatOut:
    text = body.strip()
    if not text:
        raise ApiError(422, "Message is empty.")
    if len(text) > 500:
        raise ApiError(422, "Message must be 500 characters or fewer.")
    row = ChatMessage(meeting_id=meeting_id, sender_name=sender_name, body=text, sent_at=utcnow())
    db.add(row)
    db.commit()
    db.refresh(row)
    return ChatOut(id=row.id, sender_name=row.sender_name, body=row.body, sent_at=as_utc(row.sent_at))


def participant_from_token(db: Session, token: str) -> tuple[Meeting, Participant] | None:
    participant = db.scalar(select(Participant).where(Participant.token == token))
    if participant is None or participant.left_at is not None:
        return None
    meeting = db.get(Meeting, participant.meeting_id)
    if meeting is None or meeting.status != "live":
        return None
    return meeting, participant
