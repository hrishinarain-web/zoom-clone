from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db, init_db
from app.errors import ApiError
from app.schemas import ChatOut, HistoryOut, JoinIn, JoinOut, LockIn, MeetingOut, ScheduleIn, UserOut
from app.seed import seed
from app.services import (
    cancel_meeting,
    create_instant,
    end_meeting,
    get_me,
    join_meeting,
    leave_meeting,
    list_messages,
    list_recent,
    list_upcoming,
    remove_participant,
    require_meeting,
    schedule_meeting,
    set_locked,
    start_meeting,
    to_meeting,
)
from app.signaling import hub


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()
    yield


app = FastAPI(title="Zoom Clone API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ApiError)
async def api_error(_request, exc: ApiError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


def token_header(x_participant_token: str = Header(...)) -> str:
    return x_participant_token


@app.get("/")
def root():
    return {"service": "zoom-clone-api", "docs": "/docs"}


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/me", response_model=UserOut)
def me(db: Session = Depends(get_db)):
    return get_me(db)


@app.get("/api/meetings/upcoming", response_model=list[MeetingOut])
def upcoming(db: Session = Depends(get_db)):
    return list_upcoming(db)


@app.get("/api/meetings/recent", response_model=list[HistoryOut])
def recent(db: Session = Depends(get_db)):
    return list_recent(db)


@app.post("/api/meetings/instant", response_model=JoinOut)
async def instant(request: Request, db: Session = Depends(get_db)):
    title = None
    if request.headers.get("content-length") not in (None, "0", ""):
        try:
            data = await request.json()
            if isinstance(data, dict) and isinstance(data.get("title"), str):
                title = data["title"]
        except Exception:
            title = None
    return create_instant(db, title)


@app.post("/api/meetings/schedule", response_model=MeetingOut)
def schedule(payload: ScheduleIn, db: Session = Depends(get_db)):
    return schedule_meeting(db, payload)


@app.get("/api/meetings/{code}", response_model=MeetingOut)
def meeting_detail(code: str, db: Session = Depends(get_db)):
    return to_meeting(require_meeting(db, code))


@app.post("/api/meetings/{code}/start", response_model=JoinOut)
def start(code: str, db: Session = Depends(get_db)):
    return start_meeting(db, code)


@app.post("/api/meetings/{code}/join", response_model=JoinOut)
def join(code: str, payload: JoinIn, db: Session = Depends(get_db)):
    return join_meeting(db, code, payload.display_name)


@app.post("/api/meetings/{code}/leave")
def leave(code: str, token: str = Depends(token_header), db: Session = Depends(get_db)):
    leave_meeting(db, code, token)
    return {"ok": True}


@app.post("/api/meetings/{code}/end", response_model=MeetingOut)
async def end(code: str, token: str = Depends(token_header), db: Session = Depends(get_db)):
    meeting = end_meeting(db, code, token)
    await hub.close_room(meeting.code)
    return meeting


@app.post("/api/meetings/{code}/cancel", response_model=MeetingOut)
def cancel(code: str, db: Session = Depends(get_db)):
    return cancel_meeting(db, code)


@app.post("/api/meetings/{code}/lock", response_model=MeetingOut)
async def lock(code: str, payload: LockIn, token: str = Depends(token_header), db: Session = Depends(get_db)):
    meeting = set_locked(db, code, token, payload.locked)
    await hub.broadcast(meeting.code, {"type": "lock", "locked": meeting.locked})
    return meeting


@app.post("/api/meetings/{code}/mute-all")
async def mute_all(code: str, token: str = Depends(token_header), db: Session = Depends(get_db)):
    from app.services import require_host

    meeting, host = require_host(db, code, token)
    await hub.broadcast(meeting.code, {"type": "force-mute"}, exclude=host.id)
    return {"ok": True}


@app.post("/api/meetings/{code}/participants/{participant_id}/remove")
async def remove(
    code: str,
    participant_id: int,
    token: str = Depends(token_header),
    db: Session = Depends(get_db),
):
    target_id = remove_participant(db, code, token, participant_id)
    await hub.kick(code, target_id)
    return {"ok": True}


@app.get("/api/meetings/{code}/messages", response_model=list[ChatOut])
def messages(code: str, db: Session = Depends(get_db)):
    return list_messages(db, code)


@app.websocket("/ws/{code}")
async def signaling(websocket: WebSocket, code: str, token: str):
    await hub.connect(websocket, code, token)
