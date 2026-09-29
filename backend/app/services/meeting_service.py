"""Business logic for meetings. Routers stay thin and call into here."""
import secrets
import string
from datetime import timedelta

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from ..config import settings
from ..models import Meeting, Participant, User, utcnow
from .. import schemas


class MeetingError(Exception):
    def __init__(self, status: int, detail: str):
        self.status, self.detail = status, detail


# ---------- identifiers ----------

def generate_meeting_code(db: Session) -> str:
    """Random 10-digit numeric Meeting ID (never starting with 0), unique in DB."""
    while True:
        code = str(secrets.randbelow(9 * 10**9) + 10**9)
        if not db.scalar(select(Meeting.id).where(Meeting.meeting_code == code)):
            return code


def generate_passcode(length: int = 6) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def normalize_code(raw: str) -> str:
    """Accept '812 3456 7890', '812-3456-7890' or a full invite link; return digits."""
    raw = raw.strip()
    if "/j/" in raw:
        raw = raw.split("/j/", 1)[1].split("?", 1)[0].split("/", 1)[0]
    return "".join(ch for ch in raw if ch.isdigit())


def join_url(m: Meeting) -> str:
    return f"{settings.FRONTEND_URL}/j/{m.meeting_code}?pwd={m.passcode}"


# ---------- serialization ----------

def to_out(db: Session, m: Meeting) -> schemas.MeetingOut:
    total = db.scalar(select(func.count(Participant.id)).where(Participant.meeting_id == m.id)) or 0
    active = db.scalar(
        select(func.count(Participant.id)).where(Participant.meeting_id == m.id, Participant.left_at.is_(None))
    ) or 0
    data = schemas.MeetingOut.model_validate(
        {**{c.name: getattr(m, c.name) for c in Meeting.__table__.columns},
         "host": m.host, "join_url": join_url(m),
         "participant_count": total, "active_participant_count": active}
    )
    return data


# ---------- queries ----------

def get_user(db: Session, user_id: int = settings.DEFAULT_USER_ID) -> User:
    user = db.get(User, user_id)
    if not user:
        raise MeetingError(500, "Default user missing - run the seed script")
    return user


def get_by_code(db: Session, code: str) -> Meeting:
    code = normalize_code(code)
    m = db.scalar(select(Meeting).options(selectinload(Meeting.host)).where(Meeting.meeting_code == code))
    if not m:
        raise MeetingError(404, "This meeting ID is not valid. Please check and try again.")
    return m


def list_upcoming(db: Session, user_id: int) -> list[Meeting]:
    """Scheduled meetings that haven't finished yet (end time in the future), soonest first."""
    now = utcnow()
    rows = db.scalars(
        select(Meeting)
        .options(selectinload(Meeting.host))
        .where(
            Meeting.host_id == user_id,
            Meeting.meeting_type == "scheduled",
            Meeting.status != "ended",
            Meeting.scheduled_start.is_not(None),
        )
        .order_by(Meeting.scheduled_start)
    ).all()
    return [m for m in rows if m.scheduled_start + timedelta(minutes=m.duration_minutes) > now]


def list_recent(db: Session, user_id: int, limit: int = 20) -> list[Meeting]:
    """Meetings that actually took place (were started) that the user hosted or attended."""
    attended = select(Participant.meeting_id).where(Participant.user_id == user_id)
    return list(db.scalars(
        select(Meeting)
        .options(selectinload(Meeting.host))
        .where(Meeting.started_at.is_not(None), or_(Meeting.host_id == user_id, Meeting.id.in_(attended)))
        .order_by(Meeting.started_at.desc())
        .limit(limit)
    ).all())


# ---------- commands ----------

def create_instant(db: Session, host: User, payload: schemas.InstantMeetingCreate) -> Meeting:
    m = Meeting(
        meeting_code=generate_meeting_code(db),
        passcode=generate_passcode(),
        title=(payload.title or f"{host.name}'s Zoom Meeting").strip(),
        host_id=host.id,
        meeting_type="instant",
        status="scheduled",
        scheduled_start=utcnow(),
        duration_minutes=40,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


def create_scheduled(db: Session, host: User, p: schemas.ScheduleMeetingCreate) -> Meeting:
    if p.scheduled_start < utcnow() - timedelta(minutes=5):
        raise MeetingError(422, "Start time must be in the future")
    m = Meeting(
        meeting_code=generate_meeting_code(db),
        passcode=p.passcode or generate_passcode(),
        title=p.title,
        description=(p.description or "").strip() or None,
        host_id=host.id,
        meeting_type="scheduled",
        status="scheduled",
        scheduled_start=p.scheduled_start,
        duration_minutes=p.duration_minutes,
        waiting_room=p.waiting_room,
        mute_on_entry=p.mute_on_entry,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


def update_meeting(db: Session, m: Meeting, p: schemas.MeetingUpdate) -> Meeting:
    for field, value in p.model_dump(exclude_unset=True).items():
        setattr(m, field, value)
    db.commit()
    db.refresh(m)
    return m


def join(db: Session, m: Meeting, p: schemas.JoinRequest) -> Participant:
    if p.passcode is not None and p.passcode != m.passcode:
        raise MeetingError(403, "Incorrect meeting passcode")
    if p.passcode is None and not p.as_host:
        raise MeetingError(403, "Meeting passcode required")

    is_host = p.as_host and m.host_id == settings.DEFAULT_USER_ID
    part = Participant(
        meeting_id=m.id,
        user_id=settings.DEFAULT_USER_ID if is_host else None,
        display_name=p.display_name,
        role="host" if is_host else "participant",
        session_token=secrets.token_urlsafe(32),
    )
    # Joining (re)opens the meeting.
    if m.status != "live":
        m.status = "live"
        m.started_at = m.started_at or utcnow()
        m.ended_at = None
    db.add(part)
    db.commit()
    db.refresh(part)
    return part


def mark_left(db: Session, participant_id: int, removed: bool = False) -> None:
    part = db.get(Participant, participant_id)
    if part and part.left_at is None:
        part.left_at = utcnow()
        part.was_removed = removed
        db.commit()


def end_meeting(db: Session, m: Meeting) -> None:
    now = utcnow()
    m.status = "ended"
    m.ended_at = now
    for part in m.participants:
        if part.left_at is None:
            part.left_at = now
    db.commit()


def close_if_empty(db: Session, meeting_id: int) -> None:
    """When the last person leaves, the meeting ends (Zoom behaviour for a non-persistent room)."""
    m = db.get(Meeting, meeting_id)
    if not m or m.status != "live":
        return
    active = db.scalar(
        select(func.count(Participant.id)).where(Participant.meeting_id == m.id, Participant.left_at.is_(None))
    )
    if not active:
        m.status = "ended"
        m.ended_at = utcnow()
        db.commit()
