from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import schemas
from ..config import settings
from ..database import get_db
from ..models import ChatMessage, Participant
from ..services import meeting_service as svc
from ..services.room_manager import rooms

router = APIRouter(prefix="/api/meetings", tags=["meetings"])


def _handle(fn, *args):
    try:
        return fn(*args)
    except svc.MeetingError as e:
        raise HTTPException(status_code=e.status, detail=e.detail)


@router.get("/upcoming", response_model=list[schemas.MeetingOut])
def upcoming(db: Session = Depends(get_db)):
    return [svc.to_out(db, m) for m in svc.list_upcoming(db, settings.DEFAULT_USER_ID)]


@router.get("/recent", response_model=list[schemas.MeetingOut])
def recent(db: Session = Depends(get_db)):
    return [svc.to_out(db, m) for m in svc.list_recent(db, settings.DEFAULT_USER_ID)]


@router.post("/instant", response_model=schemas.MeetingOut, status_code=status.HTTP_201_CREATED)
def create_instant(payload: schemas.InstantMeetingCreate, db: Session = Depends(get_db)):
    host = _handle(svc.get_user, db)
    return svc.to_out(db, svc.create_instant(db, host, payload))


@router.post("/schedule", response_model=schemas.MeetingOut, status_code=status.HTTP_201_CREATED)
def schedule(payload: schemas.ScheduleMeetingCreate, db: Session = Depends(get_db)):
    host = _handle(svc.get_user, db)
    m = _handle(svc.create_scheduled, db, host, payload)
    return svc.to_out(db, m)


@router.get("/{code}/public", response_model=schemas.MeetingPublic)
def public_info(code: str, db: Session = Depends(get_db)):
    """Validate a Meeting ID / invite link without revealing the passcode."""
    m = _handle(svc.get_by_code, db, code)
    return schemas.MeetingPublic(
        meeting_code=m.meeting_code, title=m.title, host_name=m.host.name,
        status=m.status, requires_passcode=True, scheduled_start=m.scheduled_start,
    )


@router.get("/{code}", response_model=schemas.MeetingOut)
def get_meeting(code: str, db: Session = Depends(get_db)):
    m = _handle(svc.get_by_code, db, code)
    if m.host_id != settings.DEFAULT_USER_ID:
        raise HTTPException(403, "Only the host can view full meeting details")
    return svc.to_out(db, m)


@router.patch("/{code}", response_model=schemas.MeetingOut)
def update(code: str, payload: schemas.MeetingUpdate, db: Session = Depends(get_db)):
    m = _handle(svc.get_by_code, db, code)
    if m.host_id != settings.DEFAULT_USER_ID:
        raise HTTPException(403, "Only the host can edit this meeting")
    return svc.to_out(db, svc.update_meeting(db, m, payload))


@router.delete("/{code}", status_code=status.HTTP_204_NO_CONTENT)
def delete(code: str, db: Session = Depends(get_db)):
    m = _handle(svc.get_by_code, db, code)
    if m.host_id != settings.DEFAULT_USER_ID:
        raise HTTPException(403, "Only the host can delete this meeting")
    if rooms.peers(m.meeting_code):
        raise HTTPException(409, "Meeting is in progress")
    db.delete(m)
    db.commit()


@router.post("/{code}/join", response_model=schemas.JoinResponse)
def join(code: str, payload: schemas.JoinRequest, db: Session = Depends(get_db)):
    m = _handle(svc.get_by_code, db, code)
    part = _handle(svc.join, db, m, payload)
    return schemas.JoinResponse(
        participant=schemas.ParticipantOut.model_validate(part),
        session_token=part.session_token,
        meeting=svc.to_out(db, m),
    )


@router.get("/{code}/participants", response_model=list[schemas.ParticipantOut])
def participants(code: str, active_only: bool = False, db: Session = Depends(get_db)):
    m = _handle(svc.get_by_code, db, code)
    items = m.participants
    if active_only:
        items = [p for p in items if p.left_at is None]
    return items


@router.get("/{code}/messages", response_model=list[schemas.ChatMessageOut])
def messages(code: str, token: str, db: Session = Depends(get_db)):
    m = _handle(svc.get_by_code, db, code)
    me = db.query(Participant).filter_by(session_token=token, meeting_id=m.id).first()
    if not me:
        raise HTTPException(403, "Not a participant of this meeting")
    # Like Zoom, you only see chat sent after you joined.
    rows = db.query(ChatMessage).filter(ChatMessage.meeting_id == m.id, ChatMessage.sent_at >= me.joined_at)
    return [
        schemas.ChatMessageOut(id=c.id, participant_id=c.participant_id, sender_name=c.participant.display_name,
                               content=c.content, sent_at=c.sent_at)
        for c in rows.order_by(ChatMessage.sent_at)
    ]
