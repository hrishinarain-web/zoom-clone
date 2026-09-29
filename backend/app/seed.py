"""Sample data. Runs automatically on first start; `python -m app.seed --reset` rebuilds it."""
import secrets
import sys
from datetime import timedelta

from sqlalchemy.orm import Session

from .models import ChatMessage, Meeting, Participant, User, utcnow


def _code(n: int) -> str:
    return str(8_000_000_000 + n * 1_234_567)


def seed_if_empty(db: Session) -> None:
    if db.query(User).first():
        return

    now = utcnow().replace(second=0, microsecond=0)
    me = User(id=1, name="Hrishav Raj", email="hrishav.raj@example.com",
              avatar_color="#0B5CFF", personal_meeting_id="4155550123", timezone="Asia/Kolkata")
    db.add(me)
    db.flush()

    def at(days=0, hours=0, minutes=0):
        return now + timedelta(days=days, hours=hours, minutes=minutes)

    upcoming = [
        ("Daily Standup - Backend Team", "Quick sync on yesterday's progress and blockers.", at(hours=2), 15),
        ("Sprint Planning", "Plan stories for Sprint 42. Bring your estimates.", at(days=1, hours=3), 60),
        ("1:1 with Priya", "Career growth and quarterly goals.", at(days=2, hours=1), 30),
        ("Design Review: Payments v2", "Walk through the new payment retry architecture.", at(days=3, hours=5), 45),
        ("All Hands - October", "Company-wide updates from leadership.", at(days=6, hours=4), 90),
    ]
    for i, (title, desc, start, dur) in enumerate(upcoming):
        db.add(Meeting(meeting_code=_code(i + 1), passcode=secrets.token_hex(3), title=title, description=desc,
                       host_id=me.id, meeting_type="scheduled", status="scheduled",
                       scheduled_start=start, duration_minutes=dur, created_at=at(days=-3)))

    past = [
        ("Hrishav Raj's Zoom Meeting", None, at(hours=-5), 22, "instant", ["Aman Gupta", "Neha Sharma"]),
        ("Incident Retro: Kafka lag", "Postmortem for Tuesday's consumer lag.", at(days=-1, hours=-2), 50,
         "scheduled", ["Rohit Verma", "Sneha Iyer", "Karan Mehta"]),
        ("Interview Loop - SDE2", None, at(days=-2, hours=-4), 45, "scheduled", ["Candidate"]),
        ("Hrishav Raj's Zoom Meeting", None, at(days=-4, hours=-1), 12, "instant", ["Aman Gupta"]),
        ("Product Sync", "Roadmap alignment with product.", at(days=-6), 35, "scheduled",
         ["Ananya Rao", "Vikram Singh"]),
    ]
    for i, (title, desc, start, dur, kind, guests) in enumerate(past):
        m = Meeting(meeting_code=_code(i + 20), passcode=secrets.token_hex(3), title=title, description=desc,
                    host_id=me.id, meeting_type=kind, status="ended", scheduled_start=start,
                    duration_minutes=max(dur, 30), started_at=start, ended_at=start + timedelta(minutes=dur),
                    created_at=start - timedelta(days=1))
        db.add(m)
        db.flush()
        host_p = Participant(meeting_id=m.id, user_id=me.id, display_name=me.name, role="host",
                             session_token=secrets.token_urlsafe(32), joined_at=start,
                             left_at=start + timedelta(minutes=dur))
        db.add(host_p)
        db.flush()
        for j, g in enumerate(guests):
            db.add(Participant(meeting_id=m.id, display_name=g, role="participant",
                               session_token=secrets.token_urlsafe(32), joined_at=start + timedelta(minutes=j + 1),
                               left_at=start + timedelta(minutes=dur)))
        db.add(ChatMessage(meeting_id=m.id, participant_id=host_p.id, content="Thanks everyone for joining!",
                           sent_at=start + timedelta(minutes=2)))
    db.commit()


if __name__ == "__main__":
    from .database import Base, SessionLocal, engine

    if "--reset" in sys.argv:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as s:
        seed_if_empty(s)
    print("Database seeded.")
