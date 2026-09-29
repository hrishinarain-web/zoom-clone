"use client";

import { LayoutGrid, MonitorUp, UserSquare2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMeetingRoom, type ExitReason, type RemotePeer } from "@/hooks/useMeetingRoom";
import { formatElapsed } from "@/lib/format";
import type { Meeting, PeerState } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import ChatPanel from "./ChatPanel";
import MeetingInfo from "./MeetingInfo";
import ParticipantsPanel from "./ParticipantsPanel";
import Toolbar from "./Toolbar";
import VideoTile from "./VideoTile";

interface Props {
  meeting: Meeting;
  token: string;
  participantId: number;
  displayName: string;
  role: "host" | "participant";
  initialStream: MediaStream | null;
  initialAudio: boolean;
  initialVideo: boolean;
  onExit: (reason: ExitReason, detail?: string) => void;
}

function gridDims(n: number): { cols: number; rows: number } {
  if (n <= 1) return { cols: 1, rows: 1 };
  if (n === 2) return { cols: 2, rows: 1 };
  if (n <= 4) return { cols: 2, rows: 2 };
  if (n <= 6) return { cols: 3, rows: 2 };
  if (n <= 9) return { cols: 3, rows: 3 };
  if (n <= 12) return { cols: 4, rows: 3 };
  return { cols: 5, rows: Math.ceil(n / 5) };
}

export default function MeetingRoom(props: Props) {
  const { meeting, token, participantId, displayName, role } = props;
  const toast = useToast();
  const isHost = role === "host";

  const selfBase: PeerState = useMemo(
    () => ({ participant_id: participantId, display_name: displayName, role, audio: false, video: false, hand_raised: false, screen_sharing: false }),
    [participantId, displayName, role],
  );

  const room = useMeetingRoom({
    code: meeting.meeting_code,
    token,
    self: selfBase,
    initialStream: props.initialStream,
    initialAudio: props.initialAudio,
    initialVideo: props.initialVideo,
    onExit: props.onExit,
    notify: (t) => toast(t),
  });
  const { actions } = room;

  const self: PeerState = { ...selfBase, audio: room.audioOn, video: room.videoOn, hand_raised: room.handRaised, screen_sharing: room.sharing };

  const [panel, setPanel] = useState<"participants" | "chat" | null>(null);
  const [view, setView] = useState<"gallery" | "speaker">("gallery");
  const [unread, setUnread] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const seen = useRef(0);

  // Elapsed timer
  useEffect(() => {
    const t0 = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  // Unread chat badge
  useEffect(() => {
    const fresh = room.messages.slice(seen.current).filter((m) => m.participant_id !== participantId).length;
    seen.current = room.messages.length;
    if (panel === "chat") setUnread(0);
    else if (fresh) setUnread((u) => u + fresh);
  }, [room.messages, panel, participantId]);

  // Keyboard shortcuts (Zoom: Alt+A mute, Alt+V video, Alt+H chat, Alt+U participants)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "a" || e.code === "KeyA") { e.preventDefault(); actions.toggleAudio(); }
      if (k === "v" || e.code === "KeyV") { e.preventDefault(); actions.toggleVideo(); }
      if (e.code === "KeyH") { e.preventDefault(); setPanel((p) => (p === "chat" ? null : "chat")); }
      if (e.code === "KeyU") { e.preventDefault(); setPanel((p) => (p === "participants" ? null : "participants")); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions]);

  const copyInvite = () =>
    navigator.clipboard.writeText(meeting.join_url).then(
      () => toast("Invite link copied to clipboard", "success"),
      () => toast("Couldn't access clipboard", "error"),
    );

  const reactionsFor = (pid: number) => room.reactions.filter((r) => r.participantId === pid).map((r) => r.emoji);
  const sharer: RemotePeer | undefined = room.peers.find((p) => p.screen_sharing);

  const selfTile = (compact = false) => (
    <VideoTile
      stream={room.localStream}
      name={displayName}
      isSelf
      audio={room.audioOn}
      video={room.videoOn}
      handRaised={room.handRaised}
      isHost={isHost}
      reactions={reactionsFor(participantId)}
      compact={compact}
    />
  );
  const peerTile = (p: RemotePeer, compact = false) => (
    <VideoTile
      stream={p.stream}
      name={p.display_name}
      audio={p.audio}
      video={p.video}
      handRaised={p.hand_raised}
      isHost={p.role === "host"}
      reactions={reactionsFor(p.participant_id)}
      compact={compact}
      connecting={p.connection === "new" || p.connection === "connecting"}
    />
  );

  const total = room.peers.length + 1;
  const { cols, rows } = gridDims(total);

  function stage() {
    // Someone else is sharing: big screen + filmstrip
    if (sharer || room.sharing || view === "speaker") {
      const main = sharer ?? (room.sharing ? null : room.peers[0]);
      const strip = room.peers.filter((p) => p !== main);
      return (
        <div className="flex h-full flex-col gap-2 p-2 md:flex-row">
          <div className="relative min-h-0 flex-1">
            {room.sharing && !sharer ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 rounded-lg bg-room-tile text-white">
                <MonitorUp size={48} className="text-zoom-green" />
                <p className="text-lg font-semibold">You are sharing your screen</p>
                <button onClick={actions.toggleShare} className="btn-danger">Stop Share</button>
              </div>
            ) : main ? (
              <VideoTile
                stream={main.stream}
                name={main.display_name}
                audio={main.audio}
                video={main.video || main.screen_sharing}
                isScreen={main.screen_sharing}
                isHost={main.role === "host"}
                handRaised={main.hand_raised}
                reactions={reactionsFor(main.participant_id)}
              />
            ) : (
              selfTile()
            )}
          </div>
          <div className="scroll-thin flex h-24 shrink-0 gap-2 overflow-x-auto md:h-auto md:w-52 md:flex-col md:overflow-y-auto">
            {(main || room.sharing) && <div className="aspect-video h-full shrink-0 md:h-auto md:w-full">{selfTile(true)}</div>}
            {strip.map((p) => (
              <div key={p.participant_id} className="aspect-video h-full shrink-0 md:h-auto md:w-full">{peerTile(p, true)}</div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div
        className="grid h-full gap-2 p-2"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0,1fr))` }}
      >
        <div className="min-h-0">{selfTile(total > 9)}</div>
        {room.peers.map((p) => (
          <div key={p.participant_id} className="min-h-0">{peerTile(p, total > 9)}</div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-room-bg text-white">
      {/* Top bar */}
      <div className="flex h-10 shrink-0 items-center justify-between px-2">
        <MeetingInfo meeting={meeting} onCopy={copyInvite} />
        <div className="flex items-center gap-2 text-xs">
          {!room.connected && <span className="rounded bg-amber-500/20 px-2 py-0.5 text-amber-300">Connecting...</span>}
          <span className="tabular-nums text-white/70">{formatElapsed(elapsed)}</span>
          <button
            onClick={() => setView((v) => (v === "gallery" ? "speaker" : "gallery"))}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-white/10"
          >
            {view === "gallery" ? <UserSquare2 size={15} /> : <LayoutGrid size={15} />}
            <span className="hidden sm:inline">{view === "gallery" ? "Speaker View" : "Gallery View"}</span>
          </button>
        </div>
      </div>

      {room.sharing && (
        <div className="mx-auto -mt-1 mb-1 flex items-center gap-3 rounded-b-lg bg-zoom-green/90 px-3 py-1 text-xs font-semibold text-black">
          You are screen sharing
          <button onClick={actions.toggleShare} className="rounded bg-zoom-red px-2 py-0.5 text-white">Stop Share</button>
        </div>
      )}

      {/* Stage + side panel */}
      <div className="relative flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">{stage()}</div>
        {panel && (
          <div className="absolute inset-0 z-30 md:static md:z-auto md:w-80 md:shrink-0 md:border-l md:border-black">
            {panel === "participants" ? (
              <ParticipantsPanel
                self={self}
                peers={room.peers}
                isHost={isHost}
                onClose={() => setPanel(null)}
                onInvite={copyInvite}
                onMuteAll={() => { actions.muteAll(); toast("All participants have been muted"); }}
                onMute={actions.muteOne}
                onRemove={actions.removeOne}
              />
            ) : (
              <ChatPanel messages={room.messages} selfId={participantId} onSend={actions.sendChat} onClose={() => setPanel(null)} />
            )}
          </div>
        )}
      </div>

      <Toolbar
        audioOn={room.audioOn}
        videoOn={room.videoOn}
        sharing={room.sharing}
        handRaised={room.handRaised}
        participantCount={total}
        unread={unread}
        panel={panel}
        isHost={isHost}
        onAudio={actions.toggleAudio}
        onVideo={actions.toggleVideo}
        onShare={() => {
          if (sharer && !room.sharing) toast(`${sharer.display_name} is already sharing`);
          else actions.toggleShare();
        }}
        onHand={actions.toggleHand}
        onReact={actions.react}
        onPanel={(p) => setPanel((cur) => (cur === p ? null : p))}
        onCopyInvite={copyInvite}
        onLeave={actions.leave}
        onEndForAll={actions.endForAll}
      />
    </div>
  );
}
