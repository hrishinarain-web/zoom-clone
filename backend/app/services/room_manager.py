"""
In-memory registry of live WebSocket connections per meeting.

The server is a *signaling* relay only: audio/video flows peer-to-peer over WebRTC
(full mesh). The server also owns authoritative per-participant media state so host
controls (mute all / remove) can be enforced and late joiners get a correct snapshot.
"""
import asyncio
from dataclasses import dataclass, field

from fastapi import WebSocket


@dataclass
class Peer:
    participant_id: int
    display_name: str
    role: str
    ws: WebSocket
    audio: bool = False
    video: bool = False
    hand_raised: bool = False
    screen_sharing: bool = False

    def public(self) -> dict:
        return {
            "participant_id": self.participant_id,
            "display_name": self.display_name,
            "role": self.role,
            "audio": self.audio,
            "video": self.video,
            "hand_raised": self.hand_raised,
            "screen_sharing": self.screen_sharing,
        }


@dataclass
class Room:
    peers: dict[int, Peer] = field(default_factory=dict)
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


class RoomManager:
    def __init__(self) -> None:
        self._rooms: dict[str, Room] = {}

    def room(self, code: str) -> Room:
        return self._rooms.setdefault(code, Room())

    def peers(self, code: str) -> list[Peer]:
        return list(self._rooms.get(code, Room()).peers.values())

    def get(self, code: str, pid: int) -> Peer | None:
        return self._rooms.get(code, Room()).peers.get(pid)

    async def add(self, code: str, peer: Peer) -> None:
        room = self.room(code)
        async with room.lock:
            old = room.peers.get(peer.participant_id)
            room.peers[peer.participant_id] = peer
        if old and old.ws is not peer.ws:  # same session reconnected from elsewhere
            await self._safe_close(old.ws)

    async def remove(self, code: str, pid: int, ws: WebSocket | None = None) -> bool:
        room = self._rooms.get(code)
        if not room:
            return False
        async with room.lock:
            peer = room.peers.get(pid)
            if not peer or (ws is not None and peer.ws is not ws):
                return False
            del room.peers[pid]
            if not room.peers:
                self._rooms.pop(code, None)
        return True

    async def send(self, code: str, pid: int, message: dict) -> None:
        peer = self.get(code, pid)
        if peer:
            try:
                await peer.ws.send_json(message)
            except Exception:
                pass

    async def broadcast(self, code: str, message: dict, exclude: int | None = None) -> None:
        for peer in self.peers(code):
            if peer.participant_id != exclude:
                try:
                    await peer.ws.send_json(message)
                except Exception:
                    pass

    @staticmethod
    async def _safe_close(ws: WebSocket, code: int = 1000) -> None:
        try:
            await ws.close(code=code)
        except Exception:
            pass


rooms = RoomManager()
