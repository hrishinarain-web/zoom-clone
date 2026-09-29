"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ControlBar from "./ControlBar";
import SidePanel, { type Person } from "./SidePanel";
import VideoTile, { type TileModel } from "./VideoTile";
import { CopyIcon, LockIcon } from "./Icons";
import { Toast } from "./Modal";
import { endMeeting, getMeeting, getMessages, leaveMeeting, muteAll, removeParticipant, setLocked } from "@/lib/api";
import { copyText, formatElapsed, inviteText } from "@/lib/format";
import { getLocalMedia, stopStream } from "@/lib/media";
import { clearSession } from "@/lib/session";
import { loadSettings } from "@/lib/settings";
import { WS_URL } from "@/lib/api";
import { MeetingConnection, type RemotePeer } from "@/lib/webrtc";
import type { ChatMessage, Meeting, Session } from "@/lib/types";

type Terminal = { title: string; body: string } | null;

export default function MeetingRoom({ code, session }: { code: string; session: Session }) {
  const router = useRouter();
  const connRef = useRef<MeetingConnection | null>(null);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<RemotePeer[]>([]);
  const [audioOn, setAudioOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [hasAudio, setHasAudio] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [panel, setPanel] = useState<"chat" | "people" | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [reactions, setReactions] = useState<Record<number, string>>({});
  const [locked, setLockedState] = useState(false);
  const [recording, setRecording] = useState(false);
  const [view, setView] = useState<"gallery" | "speaker">("gallery");
  const [elapsed, setElapsed] = useState("00:00");
  const [toast, setToast] = useState<string | null>(null);
  const [terminal, setTerminal] = useState<Terminal>(null);
  const [warning, setWarning] = useState("");
  const [ready, setReady] = useState(false);
  const panelRef = useRef(panel);
  panelRef.current = panel;
  const mirror = useRef(true);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  }

  function finish(next: Terminal) {
    setTerminal(next);
    clearSession(code);
    connRef.current?.close();
  }

  useEffect(() => {
    const settings = loadSettings();
    mirror.current = settings.mirror;
    let cancelled = false;
    let conn: MeetingConnection | null = null;
    let media: MediaStream | null = null;

    void getMeeting(code).then(setMeeting).catch(() => undefined);
    void getMessages(code).then(setMessages).catch(() => undefined);

    void (async () => {
      const local = await getLocalMedia(settings);
      if (cancelled) {
        stopStream(local.stream);
        return;
      }
      media = local.stream;
      setWarning(local.warning);
      setLocalStream(local.stream);
      setHasAudio(local.stream.getAudioTracks().length > 0);
      setHasVideo(local.stream.getVideoTracks().length > 0);
      setAudioOn(local.stream.getAudioTracks().some((track) => track.enabled));
      setVideoOn(local.stream.getVideoTracks().some((track) => track.enabled));

      conn = new MeetingConnection(code, session.token, local.stream, {
        onReady: () => setReady(true),
        onPeers: setPeers,
        onPreview: setLocalStream,
        onChat: (message) => {
          setMessages((current) => (current.some((item) => item.id === message.id) ? current : [...current, message]));
          if (panelRef.current !== "chat" && message.senderName !== session.displayName) {
            setUnread((count) => count + 1);
          }
        },
        onReaction: (id, emoji) => {
          const token = `${emoji}|${Date.now()}`;
          setReactions((current) => ({ ...current, [id]: token }));
          window.setTimeout(() => {
            setReactions((current) => (current[id] === token ? { ...current, [id]: "" } : current));
          }, 2400);
        },
        onLocked: setLockedState,
        onForceMute: () => {
          setAudioOn(false);
          showToast("The host muted everyone");
        },
        onRemoved: () => finish({ title: "You were removed", body: "The host removed you from the meeting." }),
        onEnded: () => finish({ title: "Meeting ended", body: "The host ended the meeting for everyone." }),
        onError: (message) => finish({ title: "Unable to join", body: message }),
        onDisconnected: () => finish({ title: "Connection lost", body: "You left the meeting or the connection dropped." }),
        onSharing: setSharing,
      });
      connRef.current = conn;
      if (cancelled) {
        conn.close();
        return;
      }
      try {
        await conn.connect(WS_URL);
      } catch (err) {
        if (!cancelled) finish({ title: "Unable to join", body: err instanceof Error ? err.message : "Connection failed." });
      }
    })();

    return () => {
      cancelled = true;
      if (conn) conn.close();
      else stopStream(media);
      connRef.current = null;
    };
    // The meeting session is fixed for this mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, session.token]);

  useEffect(() => {
    if (!ready) return;
    if (sessionStorage.getItem("zoom-share") !== code) return;
    sessionStorage.removeItem("zoom-share");
    void connRef.current?.shareScreen().then(() => setSharing(true)).catch(() => showToast("Screen share was cancelled"));
  }, [ready, code]);

  useEffect(() => {
    if (!meeting?.startedAt) return;
    const tick = () => setElapsed(formatElapsed(meeting.startedAt as string));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [meeting?.startedAt]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.key.toLowerCase() === "m") {
        setAudioOn((on) => {
          connRef.current?.setAudioEnabled(!on);
          return !on;
        });
      }
      if (event.key.toLowerCase() === "v" && !connRef.current?.sharing) {
        setVideoOn((on) => {
          connRef.current?.setVideoEnabled(!on);
          return !on;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const selfTile: TileModel = {
    id: session.participantId,
    name: session.displayName,
    stream: localStream,
    audio: audioOn,
    video: videoOn || sharing,
    isSelf: true,
    mirror: mirror.current && !sharing,
    sharing,
    reaction: reactions[session.participantId] || null,
    role: session.role,
  };

  const tiles: TileModel[] = [
    selfTile,
    ...peers.map((peer) => ({
      id: peer.id,
      name: peer.name,
      stream: peer.stream,
      audio: peer.audio,
      video: peer.video,
      isSelf: false,
      mirror: false,
      sharing: peer.sharing,
      reaction: reactions[peer.id] || null,
      role: peer.role,
    })),
  ];

  const people: Person[] = useMemo(
    () =>
      tiles
        .map((tile) => ({
          id: tile.id,
          name: tile.name,
          role: tile.role,
          audio: tile.audio,
          video: tile.video,
          isSelf: tile.isSelf,
        }))
        .sort((a, b) => Number(b.role === "host") - Number(a.role === "host")),
    [tiles],
  );

  async function copyInvite() {
    if (!meeting) return;
    try {
      await copyText(inviteText(meeting));
      showToast("Invitation copied");
    } catch {
      showToast("Couldn't copy");
    }
  }

  async function leave() {
    try {
      await leaveMeeting(code, session.token);
    } catch {
      /* the socket close still exits the room */
    }
    clearSession(code);
    connRef.current?.close();
    router.push("/");
  }

  async function end() {
    try {
      await endMeeting(code, session.token);
      finish({ title: "Meeting ended", body: "You ended the meeting for everyone." });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't end the meeting");
    }
  }

  if (terminal) {
    return (
      <div className="ended-screen">
        <h1>{terminal.title}</h1>
        <p>{terminal.body}</p>
        <button type="button" className="btn btn-primary" onClick={() => router.push("/")}>Back to home</button>
      </div>
    );
  }

  const featured = tiles.find((tile) => !tile.isSelf) || tiles[0];
  const rest = tiles.filter((tile) => tile !== featured);

  return (
    <div className="room">
      <header className="room-top">
        <div>
          <div className="room-title">
            {locked && <LockIcon size={14} />}
            <strong>{meeting?.title || "Zoom Meeting"}</strong>
            {recording && <span className="rec">REC</span>}
          </div>
          <p>
            <span className="encrypted">Encrypted</span>
            {" · "}
            {meeting?.codeDisplay || code}
            {" · "}
            {elapsed}
          </p>
        </div>
        <div className="room-top-actions">
          <button type="button" className="icon-btn light" aria-label="Copy invitation" onClick={() => void copyInvite()}>
            <CopyIcon />
          </button>
          <div className="view-toggle" role="group" aria-label="Layout">
            <button type="button" className={view === "gallery" ? "on" : ""} onClick={() => setView("gallery")}>Gallery</button>
            <button type="button" className={view === "speaker" ? "on" : ""} onClick={() => setView("speaker")}>Speaker</button>
          </div>
        </div>
      </header>

      <div className={`stage ${panel ? "with-panel" : ""}`}>
        {view === "gallery" ? (
          <div className={`grid count-${Math.min(tiles.length, 9)}`}>
            {tiles.map((tile) => <VideoTile key={tile.id} tile={tile} />)}
          </div>
        ) : (
          <div className="speaker">
            {featured && <VideoTile tile={featured} />}
            <div className="filmstrip">
              {rest.map((tile) => <VideoTile key={tile.id} tile={tile} />)}
            </div>
          </div>
        )}
        {peers.length === 0 && meeting && (
          <div className="invite-card">
            <h2>Your meeting is ready</h2>
            <p>Meeting ID: {meeting.codeDisplay}</p>
            <button type="button" className="btn btn-primary btn-small" onClick={() => void copyInvite()}>Copy invitation</button>
          </div>
        )}
        {warning && <p className="room-warning">{warning}</p>}
      </div>

      {panel && (
        <SidePanel
          mode={panel}
          people={people}
          messages={messages}
          host={session.role === "host"}
          meetingId={meeting?.codeDisplay || code}
          onClose={() => setPanel(null)}
          onSend={(text) => connRef.current?.sendChat(text)}
          onMuteAll={() => {
            void muteAll(code, session.token).catch((err: Error) => showToast(err.message));
          }}
          onRemove={(id) => {
            if (!window.confirm("Remove this participant from the meeting?")) return;
            void removeParticipant(code, session.token, id).catch((err: Error) => showToast(err.message));
          }}
          onCopy={() => void copyInvite()}
        />
      )}

      <ControlBar
        audioOn={audioOn}
        videoOn={videoOn}
        hasAudio={hasAudio}
        hasVideo={hasVideo}
        sharing={sharing}
        role={session.role}
        locked={locked}
        participantCount={people.length}
        unreadChat={unread}
        panel={panel}
        recording={recording}
        onToggleAudio={() => {
          const next = !audioOn;
          setAudioOn(next);
          connRef.current?.setAudioEnabled(next);
        }}
        onToggleVideo={() => {
          const next = !videoOn;
          setVideoOn(next);
          connRef.current?.setVideoEnabled(next);
        }}
        onShare={() => {
          if (sharing) {
            void connRef.current?.stopShare().then(() => setSharing(false));
            return;
          }
          void connRef.current?.shareScreen().then(() => setSharing(true)).catch(() => showToast("Screen share was cancelled"));
        }}
        onTogglePanel={(next) => {
          setPanel((current) => (current === next ? null : next));
          if (next === "chat") setUnread(0);
        }}
        onReaction={(emoji) => connRef.current?.sendReaction(emoji)}
        onMuteAll={() => {
          void muteAll(code, session.token).then(() => showToast("Everyone is muted")).catch((err: Error) => showToast(err.message));
        }}
        onToggleLock={() => {
          void setLocked(code, session.token, !locked)
            .then((updated) => setLockedState(updated.locked))
            .catch((err: Error) => showToast(err.message));
        }}
        onLeave={() => void leave()}
        onEnd={() => void end()}
        onToggleRecording={() => {
          setRecording((on) => !on);
          showToast(recording ? "Recording stopped" : "Recording");
        }}
      />
      <Toast message={toast} />
    </div>
  );
}
