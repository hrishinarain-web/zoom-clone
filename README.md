# Zoom Clone: Video Conferencing Platform

A working clone of the Zoom web app. You can create instant meetings, join by Meeting ID or invite link, schedule meetings, and hold real multi-party video calls. Calls include chat, reactions, raise hand, screen share and host controls.

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router, TypeScript), Tailwind CSS, lucide-react icons |
| Backend | Python 3.11, FastAPI, SQLAlchemy 2, WebSockets |
| Database | SQLite (auto-created and seeded on first start) |
| Real-time media | WebRTC (peer-to-peer mesh), with the FastAPI WebSocket as the signaling server |

---

## Quick start

You need Python 3.10+ and Node 18+. Run the backend and frontend in two terminals.

```bash
# 1) Backend  ->  http://localhost:8000  (API docs at /docs)
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 2) Frontend ->  http://localhost:3000
cd frontend
npm install
npm run dev
```

On first start the backend creates `zoom_clone.db` and seeds it with a default user, 5 upcoming meetings and 5 past meetings (with participants and chat). To reset the data:

```bash
cd backend && python -m app.seed --reset
```

### Trying a multi-person call on one machine
1. Click **New meeting**. You join as host.
2. Copy the invite link (Participants, then **Invite**, or **More**, then **Copy invite link**).
3. Open the link in an incognito window or another browser, enter a name and click **Join**.

Browsers only allow camera and mic access on `localhost` or over HTTPS. To test from a phone on your LAN, use HTTPS (for example, the deployed version or an `ngrok` tunnel).

---

## Features

### Core (required)
- **Landing dashboard**: Zoom Workplace-style home page. It has a top nav (search, notifications, settings, and a profile menu showing the Personal Meeting ID) and the four big action tiles (**New meeting**, **Join**, **Schedule**, **Share screen**). A live clock card lists **upcoming meetings** grouped by day, and a **recent meetings** list shows each meeting's duration and participant count.
- **Instant meeting**: generates a unique 10-digit Meeting ID, a passcode and a shareable invite link (`/j/<id>?pwd=<passcode>`), then takes you straight into the room as host.
- **Join meeting**: accepts a Meeting ID (any format, e.g. `812 345 6789`) or a full invite link. The app checks that the meeting exists before joining. The pre-join screen asks for a display name, the passcode if it wasn't in the link, and your mic/camera choice, and shows a camera preview.
- **Schedule meeting**: topic, description, date and time pickers, duration (hr/min), passcode, and options for waiting room and mute on entry. The meeting link is generated for you and saved to the DB. The meeting appears under Upcoming, and a success dialog shows a copyable invitation.

### In-meeting
- Real audio/video between participants (WebRTC), in gallery view (auto grid) or speaker view
- Mute/unmute and start/stop video, with the Zoom shortcuts **Alt+A** and **Alt+V** (**Alt+H** opens chat, **Alt+U** opens participants)
- Active-speaker green border, driven by voice-activity detection
- Screen share (one presenter at a time). Viewers see a large stage with a filmstrip of the other participants
- Meeting chat, stored in the DB. Unread badge. You only see messages sent after you joined, as in Zoom
- Reactions and raise hand
- Meeting info popover showing ID, host, passcode and invite link, plus an elapsed-time timer
- Join and leave notifications

### Bonus
- **Host controls**: mute all, mute a participant, remove a participant, end the meeting for all. The server enforces these, not just the UI.
- **Responsive**: works on mobile, tablet and desktop. Side panels become full-screen overlays on small screens.
- **Meetings page** (`/meetings`): Upcoming and Previous tabs with a detail pane. From there you can start, copy the invitation, **edit** or **delete** a meeting.

---

## Architecture

```
frontend/src
  app/                    routes: / (home), /meetings, /join, /j/[code] (pre-join -> room)
  components/
    layout/               TopNav, SettingsModal
    home/                 ActionTile, UpcomingCard, RecentMeetings, JoinModal, ScheduleModal
    meeting/              MeetingRoom, VideoTile, Toolbar, ParticipantsPanel, ChatPanel, PreJoin, MeetingInfo
    ui/                   Modal, Toast, Avatar
  hooks/
    useMeetingRoom.ts     WebSocket signaling + WebRTC mesh engine (the core of the call)
    useSpeaking.ts        audio-level voice activity detection
    useDashboardData.ts   dashboard fetching
    useMeetingActions.ts  start / new / copy-invite helpers
  lib/                    api client, types, formatting, storage helpers

backend/app
  main.py                 app factory, CORS, startup (create tables, seed, close stale sessions)
  config.py, database.py  settings and SQLAlchemy engine (SQLite FKs enabled)
  models.py               ORM schema
  schemas.py              Pydantic request/response contracts
  services/
    meeting_service.py    business logic (ID generation, join rules, upcoming/recent queries)
    room_manager.py       in-memory live-room registry for WebSocket peers
  routers/
    meetings.py, users.py REST endpoints
    ws.py                 /ws/meetings/{code}: signaling, presence, chat, host actions
  seed.py                 sample data
```

### How a call works
1. `POST /api/meetings/{code}/join` checks the passcode and creates a `participants` row. It returns a one-time **session token**.
2. The browser opens `WS /ws/meetings/{code}?token=...`. The server authenticates the token and replies with `welcome`, a snapshot of everyone already in the room.
3. **The newcomer sends offers to every existing peer** and the existing peers answer. Because only one side ever offers, the two sides can never send offers at the same time (no "glare"). SDP and ICE messages are relayed through the WebSocket.
4. Each peer connection is created with exactly **one audio and one video transceiver**. Camera on/off and screen share only swap tracks with `replaceTrack()`, so the connection never needs renegotiating after the first handshake.
5. The server keeps the authoritative media state (mic, camera, hand, sharing) for every peer in memory, so late joiners see the correct state. It also applies host commands: `force-mute`, `removed` (closes the socket with code 4403), and `meeting-ended`.

---

## Database schema

```
users 1 ─── * meetings 1 ─── * participants * ─── 0..1 users
                  │                  │
                  └──── * chat_messages * ────┘
```

| Table | Key columns | Notes |
|---|---|---|
| `users` | `id`, `name`, `email` (unique), `personal_meeting_id` (unique), `avatar_color`, `timezone` | One seeded default user (no auth, per the brief) |
| `meetings` | `id`, `meeting_code` (unique, indexed), `passcode`, `title`, `description`, `host_id → users`, `meeting_type` (`instant`/`scheduled`), `status` (`scheduled`/`live`/`ended`), `scheduled_start`, `duration_minutes`, `waiting_room`, `mute_on_entry`, `started_at`, `ended_at` | CHECK constraints on the type, status and duration fields. Composite index `(host_id, scheduled_start)` for the upcoming query |
| `participants` | `id`, `meeting_id → meetings`, `user_id → users` (nullable: guests), `display_name`, `role` (`host`/`participant`), `session_token` (unique), `joined_at`, `left_at`, `was_removed` | **One row per join session.** This gives attendance history and durations. `left_at IS NULL` means the person is currently in the meeting (index `(meeting_id, left_at)`) |
| `chat_messages` | `id`, `meeting_id → meetings`, `participant_id → participants`, `content`, `sent_at` | Linked to the participant session rather than the user, so guests can chat |

Design choices:
- The **public Meeting ID** (`meeting_code`) is kept separate from the internal primary key, so IDs can't be guessed by counting and the format can change later.
- Deleting a meeting cascades to its participants and messages (`ON DELETE CASCADE`). Deleting a user sets `participants.user_id` to NULL, so attendance history is kept.
- All timestamps are stored in **UTC**. The API sends them with a `Z` suffix and the browser converts them to local time.
- "Upcoming" = scheduled meetings that haven't ended and whose end time (`scheduled_start + duration`) is still in the future. "Recent" = meetings that actually started and that the user hosted or attended.

---

## REST API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/users/me` | Default logged-in user |
| GET | `/api/meetings/upcoming` | Upcoming scheduled meetings |
| GET | `/api/meetings/recent` | Meetings that have taken place |
| POST | `/api/meetings/instant` | Create an instant meeting |
| POST | `/api/meetings/schedule` | Schedule a meeting |
| GET | `/api/meetings/{code}/public` | Check that a meeting exists (passcode not included) |
| GET / PATCH / DELETE | `/api/meetings/{code}` | Host: view, edit or delete a meeting |
| POST | `/api/meetings/{code}/join` | Join (checks the passcode) and returns a session token |
| GET | `/api/meetings/{code}/participants` | Attendance list |
| GET | `/api/meetings/{code}/messages?token=` | Chat history visible to this session |
| WS | `/ws/meetings/{code}?token=` | Signaling, presence, chat, reactions, host controls |

Interactive docs: `http://localhost:8000/docs`.

---

## Deployment

**Backend (Render or Railway):** `render.yaml` and `backend/Procfile` are included. Set these environment variables:
- `FRONTEND_URL=https://<your-frontend>.vercel.app` (used to build invite links)
- `CORS_ORIGINS=https://<your-frontend>.vercel.app` (`*.vercel.app` preview URLs are already allowed)

**Frontend (Vercel):** import the repo and set the root directory to `frontend`. Set `NEXT_PUBLIC_API_URL=https://<your-backend>.onrender.com`.

On free hosting tiers, SQLite lives on temporary disk. The app re-seeds itself when the disk is wiped, which is fine for a demo. For production data, attach a persistent disk or point `DATABASE_URL` at Postgres (no code changes needed).

---

## Assumptions and limitations
- **No authentication** (as the brief allows). A single default user is always "logged in" and hosts every meeting. Whoever starts a meeting from the dashboard joins as **host**. Anyone arriving through Join or an invite link is a **guest**.
- **Passcodes**: invite links carry the passcode (`?pwd=`), as Zoom's do. Joining by Meeting ID asks for it.
- **Media topology**: WebRTC full mesh with Google STUN. Mesh works well for about 6–8 people. A larger scale would need an SFU (e.g. LiveKit or mediasoup). On very strict corporate or cellular networks, set a TURN server with `NEXT_PUBLIC_TURN_URL`, `NEXT_PUBLIC_TURN_USERNAME` and `NEXT_PUBLIC_TURN_CREDENTIAL`.
- **Live room state** (who's connected, mic and camera state) is held in memory in a single backend process. Running more than one instance would need Redis pub/sub. On restart, open sessions are closed out in the DB.
- **Host control**: a host can mute others but not unmute them, which matches Zoom's privacy behaviour.
- **Not enforced yet**: the Waiting Room setting is saved on the meeting but not applied. Team Chat, Calendar, Contacts and parts of Settings are UI placeholders.
- **Branding**: the look and layout follow Zoom's design language, but the Zoom logo and wordmark are not used.
