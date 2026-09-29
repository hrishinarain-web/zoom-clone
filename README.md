# Zoom Clone

A video meeting app with a Zoom-style home page, instant meetings, join-by-ID, scheduling, and a live meeting room. Video and audio use WebRTC. The FastAPI server is the signaling hub.

## Stack

- Frontend: Next.js (App Router, client-rendered pages)
- Backend: Python, FastAPI, WebSockets
- Database: SQLite with SQLAlchemy

## Setup

One command, with Docker:

```bash
docker compose up --build
```

Open [http://localhost:3001](http://localhost:3001). The API is on port 8000. The site is published on 3001 because 3000 is often already in use; set `FRONTEND_PORT=3000` if you want the other port.

Without Docker, from the repo root, two terminals:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`./dev.sh` starts both if the virtualenv and `node_modules` already exist (it creates them on first run).

## What’s included

- Home dashboard with New Meeting, Join, Schedule, and Share Screen
- Upcoming and recent meetings, seeded for the demo user
- Personal meeting ID that stays the same
- Instant meetings with an 11-digit ID and a copyable invite link
- Join by meeting ID or `/j/{id}`, with a display name and a check that the meeting exists
- Scheduled meetings (topic, description, date and time, duration) stored in SQLite
- Meeting room: camera, microphone, screen share, chat, reactions, gallery and speaker view
- Host controls: lock meeting, mute all, remove participant, end meeting for everyone

The signed-in user is **Jordan Lee** (`jordan.lee@example.com`). There is no login screen. Settings (mirror video, join muted, join with video off, display name) are saved in the browser.

To see two people in a meeting, start a meeting in one window, copy the invitation, and open that link in a second window. Enter a different name there. That second person joins as a participant.

## Database

| Table | Purpose |
| --- | --- |
| `users` | Demo host. `personal_meeting_code` is the stable personal meeting ID. |
| `meetings` | A room. `status` is `ready` (idle personal room), `scheduled`, `live`, `ended`, or `cancelled`. |
| `participants` | Someone who entered a room. `token` authorizes the socket and host actions. `left_at` is set on leave, removal, or end. |
| `chat_messages` | Chat for the current session of a meeting. Cleared when the meeting ends. |
| `meeting_history` | Snapshot written when a meeting ends, so the personal room can be reused without losing Recent meetings. |

The SQLite file is created at `backend/zoom.db` on startup. If the database is empty, seed data is inserted: three upcoming meetings and three recent ones.

## Assumptions

- Recording toggles an on-screen indicator only. It does not write a file.
- Calls use a mesh of peer connections plus Google's public STUN server. That works on localhost and most same-network setups. A TURN server would be needed for some strict NATs.
- Refreshing the meeting tab reconnects the same participant. Leaving or ending clears that session.
- Share Screen from the home page starts an instant meeting and opens the screen picker.

## API

Interactive docs: [http://localhost:8000/docs](http://localhost:8000/docs)

## Tests

```bash
cd backend
source .venv/bin/activate
pytest
```
