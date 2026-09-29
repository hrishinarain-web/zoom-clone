import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Meeting, MeetingHistory, User


def _local_at(days: int, hour: int, minute: int) -> datetime:
    now = datetime.now().astimezone()
    target = (now + timedelta(days=days)).replace(hour=hour, minute=minute, second=0, microsecond=0)
    return target.astimezone(timezone.utc)


def _unique_code(db: Session, reserved: set[str]) -> str:
    while True:
        code = str(random.randint(10**10, 10**11 - 1))
        if code in reserved:
            continue
        if db.scalar(select(Meeting.id).where(Meeting.code == code)):
            continue
        reserved.add(code)
        return code


def seed(db: Session) -> None:
    if db.scalar(select(User.id)):
        return

    reserved: set[str] = set()
    pmi = _unique_code(db, reserved)
    user = User(name="Jordan Lee", email="jordan.lee@example.com", personal_meeting_code=pmi)
    db.add(user)
    db.flush()

    now = datetime.now(timezone.utc)
    db.add(
        Meeting(
            code=pmi,
            title="Jordan Lee's Personal Meeting Room",
            description="Your personal room. The meeting ID never changes.",
            host_user_id=user.id,
            meeting_type="personal",
            status="ready",
            duration_minutes=60,
            locked=False,
            created_at=now,
        )
    )

    upcoming = [
        ("Design Critique", "Review the new onboarding flow and empty states.", 1, 10, 0, 45),
        ("Sprint Planning", "Lock scope for the next two weeks.", 2, 14, 30, 60),
        ("Candidate Interview", "Frontend panel with the hiring manager.", 0 if (datetime.now().hour, datetime.now().minute) < (16, 0) else 1, 16, 0, 30),
    ]
    for title, description, days, hour, minute, duration in upcoming:
        db.add(
            Meeting(
                code=_unique_code(db, reserved),
                title=title,
                description=description,
                host_user_id=user.id,
                meeting_type="scheduled",
                status="scheduled",
                scheduled_at=_local_at(days, hour, minute),
                duration_minutes=duration,
                locked=False,
                created_at=now,
            )
        )

    past = [
        ("Product Sync", 1, 9, 30, 42, 5),
        ("Customer Discovery", 2, 15, 0, 38, 3),
        ("Weekly Standup", 5, 11, 0, 18, 8),
    ]
    for title, days_ago, hour, minute, duration, people in past:
        started = _local_at(-days_ago, hour, minute)
        ended = started + timedelta(minutes=duration)
        code = _unique_code(db, reserved)
        meeting = Meeting(
            code=code,
            title=title,
            description="",
            host_user_id=user.id,
            meeting_type="instant",
            status="ended",
            duration_minutes=duration,
            started_at=started,
            ended_at=ended,
            locked=False,
            created_at=started,
        )
        db.add(meeting)
        db.flush()
        db.add(
            MeetingHistory(
                meeting_id=meeting.id,
                code=code,
                title=title,
                host_user_id=user.id,
                meeting_type="instant",
                started_at=started,
                ended_at=ended,
                participant_count=people,
            )
        )

    db.commit()
