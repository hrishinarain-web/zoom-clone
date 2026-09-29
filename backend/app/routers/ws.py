"""
WebSocket endpoint: WebRTC signaling + meeting presence, chat and host controls.

Client -> server messages
  {type: "media", audio: bool, video: bool}
  {type: "hand", raised: bool}
  {type: "screen", sharing: bool}
  {type: "signal", to: <pid>, data: {...sdp|candidate}}
  {type: "chat", content: str}
  {type: "reaction", emoji: str}
  host only: {type: "mute-all"} | {type: "mute", target} | {type: "remove", target} | {type: "end"}

Server -> client messages
  welcome, peer-joined, peer-left, peer-updated, signal, chat, reaction,
  force-mute, removed, meeting-ended, error
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from ..database import SessionLocal
from ..models import ChatMessage, Meeting, Participant
from ..schemas import ChatMessageOut
from ..services import meeting_service as svc
from ..services.room_manager import Peer, rooms

router = APIRouter()

ALLOWED_REACTIONS = {"👏", "👍", "❤️", "😂", "😮", "🎉"}


@router.websocket("/ws/meetings/{code}")
async def meeting_socket(ws: WebSocket, code: str, token: str):
    await ws.accept()

    with SessionLocal() as db:
        part = db.scalar(select(Participant).where(Participant.session_token == token))
        meeting = db.get(Meeting, part.meeting_id) if part else None
        if not part or not meeting or meeting.meeting_code != code:
            await ws.send_json({"type": "error", "detail": "Invalid session"})
            await ws.close(code=4401)
            return
        if part.left_at is not None:
            await ws.send_json({"type": "error", "detail": "This session has ended. Please rejoin."})
            await ws.close(code=4410)
            return
        mute_on_entry = meeting.mute_on_entry
        meeting_id = meeting.id

    me = Peer(participant_id=part.id, display_name=part.display_name, role=part.role, ws=ws)
    await rooms.add(code, me)
    await ws.send_json({
        "type": "welcome",
        "self": me.public(),
        "peers": [p.public() for p in rooms.peers(code) if p.participant_id != me.participant_id],
        "mute_on_entry": mute_on_entry,
    })
    await rooms.broadcast(code, {"type": "peer-joined", "peer": me.public()}, exclude=me.participant_id)

    removed = False
    try:
        while True:
            msg = await ws.receive_json()
            kind = msg.get("type")

            if kind == "media":
                me.audio, me.video = bool(msg.get("audio")), bool(msg.get("video"))
                await rooms.broadcast(code, {"type": "peer-updated", "peer": me.public()}, exclude=me.participant_id)

            elif kind == "hand":
                me.hand_raised = bool(msg.get("raised"))
                await rooms.broadcast(code, {"type": "peer-updated", "peer": me.public()}, exclude=me.participant_id)

            elif kind == "screen":
                me.screen_sharing = bool(msg.get("sharing"))
                await rooms.broadcast(code, {"type": "peer-updated", "peer": me.public()}, exclude=me.participant_id)

            elif kind == "signal":
                target = msg.get("to")
                if isinstance(target, int) and rooms.get(code, target):
                    await rooms.send(code, target, {"type": "signal", "from": me.participant_id, "data": msg.get("data")})

            elif kind == "chat":
                content = str(msg.get("content", "")).strip()[:2000]
                if not content:
                    continue
                with SessionLocal() as db:
                    row = ChatMessage(meeting_id=meeting_id, participant_id=me.participant_id, content=content)
                    db.add(row)
                    db.commit()
                    db.refresh(row)
                    out = ChatMessageOut(id=row.id, participant_id=me.participant_id, sender_name=me.display_name,
                                         content=row.content, sent_at=row.sent_at).model_dump(mode="json")
                await rooms.broadcast(code, {"type": "chat", "message": out})

            elif kind == "reaction":
                emoji = msg.get("emoji")
                if emoji in ALLOWED_REACTIONS:
                    await rooms.broadcast(code, {"type": "reaction", "from": me.participant_id, "emoji": emoji})

            elif kind in {"mute-all", "mute", "remove", "end"}:
                if me.role != "host":
                    await ws.send_json({"type": "error", "detail": "Only the host can do that"})
                    continue
                await _host_action(code, me, kind, msg.get("target"))
                if kind == "end":
                    break

    except WebSocketDisconnect:
        pass
    except Exception:
        # Malformed JSON etc. - drop the connection but clean up below.
        pass
    finally:
        still_mine = await rooms.remove(code, me.participant_id, ws)
        if still_mine:
            with SessionLocal() as db:
                p = db.get(Participant, me.participant_id)
                removed = bool(p and p.was_removed)
                svc.mark_left(db, me.participant_id, removed=removed)
                svc.close_if_empty(db, meeting_id)
            await rooms.broadcast(code, {"type": "peer-left", "participant_id": me.participant_id})


async def _host_action(code: str, host: Peer, kind: str, target) -> None:
    if kind == "mute-all":
        for p in rooms.peers(code):
            if p.participant_id != host.participant_id:
                await rooms.send(code, p.participant_id, {"type": "force-mute", "by": host.display_name})

    elif kind == "mute" and isinstance(target, int):
        await rooms.send(code, target, {"type": "force-mute", "by": host.display_name})

    elif kind == "remove" and isinstance(target, int) and target != host.participant_id:
        peer = rooms.get(code, target)
        if not peer:
            return
        with SessionLocal() as db:
            p = db.get(Participant, target)
            if p:
                p.was_removed = True
                db.commit()
        await rooms.send(code, target, {"type": "removed", "by": host.display_name})
        await rooms._safe_close(peer.ws, code=4403)

    elif kind == "end":
        others = [p for p in rooms.peers(code) if p.participant_id != host.participant_id]
        for p in others:
            await rooms.send(code, p.participant_id, {"type": "meeting-ended"})
        with SessionLocal() as db:
            m = svc.get_by_code(db, code)
            svc.end_meeting(db, m)
        for p in others:
            await rooms._safe_close(p.ws)
