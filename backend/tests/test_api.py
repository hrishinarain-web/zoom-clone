import os
import tempfile

os.environ["ZOOM_DB_PATH"] = tempfile.NamedTemporaryFile(suffix=".db", delete=False).name

from fastapi.testclient import TestClient

from app.database import SessionLocal, init_db
from app.main import app
from app.seed import seed

init_db()
_db = SessionLocal()
seed(_db)
_db.close()

client = TestClient(app)


def test_dashboard_seed():
    me = client.get("/api/me")
    assert me.status_code == 200
    body = me.json()
    assert body["name"] == "Jordan Lee"
    assert len(body["personal_meeting_code"]) == 11

    upcoming = client.get("/api/meetings/upcoming").json()
    titles = {item["title"] for item in upcoming}
    assert {"Design Critique", "Sprint Planning", "Candidate Interview"} <= titles

    recent = client.get("/api/meetings/recent").json()
    assert len(recent) >= 3


def test_instant_meeting_join_and_end():
    created = client.post("/api/meetings/instant")
    assert created.status_code == 200
    host = created.json()
    code = host["meeting"]["code"]
    assert host["role"] == "host"
    assert host["meeting"]["status"] == "live"

    detail = client.get(f"/api/meetings/{code}")
    assert detail.status_code == 200

    joined = client.post(f"/api/meetings/{code}/join", json={"display_name": "Sam Rivera"})
    assert joined.status_code == 200
    guest = joined.json()
    assert guest["role"] == "participant"

    denied = client.post(
        f"/api/meetings/{code}/mute-all",
        headers={"X-Participant-Token": guest["token"]},
    )
    assert denied.status_code == 403

    ended = client.post(
        f"/api/meetings/{code}/end",
        headers={"X-Participant-Token": host["token"]},
    )
    assert ended.status_code == 200
    assert ended.json()["status"] == "ended"

    again = client.post(f"/api/meetings/{code}/join", json={"display_name": "Sam Rivera"})
    assert again.status_code == 410


def test_schedule_and_invalid_join():
    missing = client.get("/api/meetings/00000000000")
    assert missing.status_code == 404

    bad = client.post(
        "/api/meetings/schedule",
        json={
            "title": "Past",
            "scheduled_at": "2020-01-01T00:00:00Z",
            "duration_minutes": 30,
        },
    )
    assert bad.status_code == 422

    ok = client.post(
        "/api/meetings/schedule",
        json={
            "title": "Roadmap review",
            "description": "Q4 themes",
            "scheduled_at": "2030-05-01T15:00:00Z",
            "duration_minutes": 45,
        },
    )
    assert ok.status_code == 200
    code = ok.json()["code"]
    early = client.post(f"/api/meetings/{code}/join", json={"display_name": "Sam"})
    assert early.status_code == 409

    cancelled = client.post(f"/api/meetings/{code}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"


def test_signaling_welcome():
    host = client.post("/api/meetings/instant").json()
    code = host["meeting"]["code"]
    with client.websocket_connect(f"/ws/{code}?token={host['token']}") as ws:
        welcome = ws.receive_json()
        assert welcome["type"] == "welcome"
        assert welcome["self"]["role"] == "host"
        assert welcome["peers"] == []
