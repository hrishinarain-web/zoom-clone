from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import update

from .config import settings
from .database import Base, SessionLocal, engine
from .models import Meeting, Participant, utcnow
from .routers import meetings, users, ws
from .seed import seed_if_empty


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_if_empty(db)
        # Connections don't survive a restart: close out any sessions left open.
        now = utcnow()
        db.execute(update(Participant).where(Participant.left_at.is_(None)).values(left_at=now))
        db.execute(update(Meeting).where(Meeting.status == "live").values(status="ended", ended_at=now))
        db.commit()
    yield


app = FastAPI(title="Zoom Clone API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(meetings.router)
app.include_router(ws.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
