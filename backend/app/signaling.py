from dataclasses import dataclass, field

from fastapi import WebSocket
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.services import add_message, participant_from_token


@dataclass
class Peer:
    participant_id: int
    meeting_id: int
    name: str
    role: str
    ws: WebSocket
    audio: bool = True
    video: bool = True
    sharing: bool = False


@dataclass
class Room:
    peers: dict[int, Peer] = field(default_factory=dict)


class SignalingHub:
    def __init__(self) -> None:
        self.rooms: dict[str, Room] = {}

    def _room(self, code: str) -> Room:
        if code not in self.rooms:
            self.rooms[code] = Room()
        return self.rooms[code]

    async def connect(self, websocket: WebSocket, code: str, token: str) -> None:
        await websocket.accept()
        db: Session = SessionLocal()
        try:
            found = participant_from_token(db, token)
        finally:
            db.close()

        if found is None or found[0].code != code:
            await websocket.send_json({"type": "error", "message": "Your meeting session has expired. Join again."})
            await websocket.close(code=4401)
            return

        meeting, participant = found
        room = self._room(code)
        peer = Peer(
            participant_id=participant.id,
            meeting_id=meeting.id,
            name=participant.display_name,
            role=participant.role,
            ws=websocket,
        )
        previous = room.peers.pop(peer.participant_id, None)
        others = [
            {
                "id": other.participant_id,
                "name": other.name,
                "role": other.role,
                "audio": other.audio,
                "video": other.video,
                "sharing": other.sharing,
            }
            for other in room.peers.values()
        ]
        room.peers[peer.participant_id] = peer
        if previous is not None:
            try:
                await previous.ws.close()
            except Exception:
                pass
        await websocket.send_json(
            {
                "type": "welcome",
                "self": {"id": peer.participant_id, "name": peer.name, "role": peer.role},
                "peers": others,
                "locked": meeting.locked,
            }
        )
        await self.broadcast(
            code,
            {
                "type": "peer-joined",
                "peer": {
                    "id": peer.participant_id,
                    "name": peer.name,
                    "role": peer.role,
                    "audio": peer.audio,
                    "video": peer.video,
                    "sharing": peer.sharing,
                },
            },
            exclude=peer.participant_id,
        )

        try:
            while True:
                payload = await websocket.receive_json()
                await self.handle(code, peer, payload)
        except Exception:
            pass
        finally:
            await self.disconnect(code, peer.participant_id, websocket)

    async def handle(self, code: str, peer: Peer, payload: dict) -> None:
        kind = payload.get("type")
        if kind in ("offer", "answer", "ice"):
            target = payload.get("target")
            if not isinstance(target, int):
                return
            message = {"type": kind, "from": peer.participant_id}
            if kind in ("offer", "answer"):
                message["sdp"] = payload.get("sdp")
            else:
                message["candidate"] = payload.get("candidate")
            await self.send_to(code, target, message)
            return

        if kind == "media":
            peer.audio = bool(payload.get("audio"))
            peer.video = bool(payload.get("video"))
            peer.sharing = bool(payload.get("sharing"))
            await self.broadcast(
                code,
                {
                    "type": "media",
                    "id": peer.participant_id,
                    "audio": peer.audio,
                    "video": peer.video,
                    "sharing": peer.sharing,
                },
                exclude=peer.participant_id,
            )
            return

        if kind == "chat":
            text = str(payload.get("text") or "")
            db = SessionLocal()
            try:
                saved = add_message(db, peer.meeting_id, peer.name, text)
            except Exception:
                return
            finally:
                db.close()
            await self.broadcast(
                code,
                {
                    "type": "chat",
                    "id": saved.id,
                    "senderName": saved.sender_name,
                    "body": saved.body,
                    "sentAt": saved.sent_at.isoformat(),
                },
            )
            return

        if kind == "reaction":
            emoji = str(payload.get("emoji") or "")[:8]
            if not emoji:
                return
            await self.broadcast(code, {"type": "reaction", "id": peer.participant_id, "emoji": emoji})

    async def send_to(self, code: str, participant_id: int, message: dict) -> None:
        room = self.rooms.get(code)
        if room is None:
            return
        peer = room.peers.get(participant_id)
        if peer is None:
            return
        try:
            await peer.ws.send_json(message)
        except Exception:
            await self.disconnect(code, participant_id, peer.ws)

    async def broadcast(self, code: str, message: dict, exclude: int | None = None) -> None:
        room = self.rooms.get(code)
        if room is None:
            return
        stale: list[int] = []
        for participant_id, peer in list(room.peers.items()):
            if participant_id == exclude:
                continue
            try:
                await peer.ws.send_json(message)
            except Exception:
                stale.append(participant_id)
        for participant_id in stale:
            gone = room.peers.get(participant_id)
            if gone is not None:
                await self.disconnect(code, participant_id, gone.ws)

    async def disconnect(self, code: str, participant_id: int, ws: WebSocket | None = None) -> None:
        room = self.rooms.get(code)
        if room is None:
            return
        current = room.peers.get(participant_id)
        if current is None:
            return
        if ws is not None and current.ws is not ws:
            return
        room.peers.pop(participant_id, None)
        if not room.peers:
            self.rooms.pop(code, None)
        await self.broadcast(code, {"type": "peer-left", "id": participant_id})

    async def kick(self, code: str, participant_id: int) -> None:
        room = self.rooms.get(code)
        if room is None:
            return
        peer = room.peers.get(participant_id)
        if peer is None:
            return
        try:
            await peer.ws.send_json({"type": "removed"})
            await peer.ws.close(code=4403)
        except Exception:
            pass
        await self.disconnect(code, participant_id)

    async def close_room(self, code: str) -> None:
        room = self.rooms.pop(code, None)
        if room is None:
            return
        for peer in list(room.peers.values()):
            try:
                await peer.ws.send_json({"type": "ended"})
                await peer.ws.close()
            except Exception:
                pass
        room.peers.clear()


hub = SignalingHub()
