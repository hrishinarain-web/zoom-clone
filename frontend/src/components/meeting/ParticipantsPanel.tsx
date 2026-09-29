"use client";

import { Hand, Mic, MicOff, MonitorUp, MoreHorizontal, Video, VideoOff, X } from "lucide-react";
import { useState } from "react";
import type { PeerState } from "@/lib/types";
import Avatar from "@/components/ui/Avatar";

interface Props {
  self: PeerState;
  peers: PeerState[];
  isHost: boolean;
  onClose: () => void;
  onInvite: () => void;
  onMuteAll: () => void;
  onMute: (pid: number) => void;
  onRemove: (pid: number) => void;
}

export default function ParticipantsPanel({ self, peers, isHost, onClose, onInvite, onMuteAll, onMute, onRemove }: Props) {
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [confirmMuteAll, setConfirmMuteAll] = useState(false);
  // Zoom order: you, then host, then raised hands, then everyone alphabetically.
  const everyone = [self, ...[...peers].sort((a, b) =>
    (b.role === "host" ? 2 : 0) + (b.hand_raised ? 1 : 0) - ((a.role === "host" ? 2 : 0) + (a.hand_raised ? 1 : 0))
    || a.display_name.localeCompare(b.display_name))];

  return (
    <aside className="flex h-full flex-col bg-white text-zoom-text">
      <header className="flex items-center justify-between border-b border-zoom-border px-4 py-3">
        <h2 className="text-sm font-bold">Participants ({everyone.length})</h2>
        <button onClick={onClose} className="rounded p-1 text-zoom-muted hover:bg-zoom-bg" aria-label="Close participants">
          <X size={18} />
        </button>
      </header>

      <ul className="scroll-thin flex-1 overflow-y-auto py-1">
        {everyone.map((p) => {
          const me = p.participant_id === self.participant_id;
          return (
            <li key={p.participant_id} className="group relative flex items-center gap-2.5 px-4 py-2 hover:bg-zoom-bg">
              <Avatar name={p.display_name} size={30} rounded="lg" />
              <div className="min-w-0 flex-1 text-sm">
                <span className="truncate font-medium">{p.display_name}</span>
                <span className="text-zoom-muted">
                  {me && " (me)"}
                  {p.role === "host" && (me ? ", Host" : " (Host)")}
                </span>
              </div>
              {p.hand_raised && <Hand size={16} className="text-amber-500" aria-label="Hand raised" />}
              {p.screen_sharing && <MonitorUp size={16} className="text-zoom-green" aria-label="Sharing screen" />}

              {isHost && !me && (
                <div className="hidden items-center gap-1 group-hover:flex group-focus-within:flex max-sm:flex">
                  {p.audio && (
                    <button onClick={() => onMute(p.participant_id)} className="rounded-md border border-zoom-border bg-white px-2 py-0.5 text-xs font-semibold hover:bg-zoom-bg">
                      Mute
                    </button>
                  )}
                  <button
                    onClick={() => setMenuFor(menuFor === p.participant_id ? null : p.participant_id)}
                    className="rounded-md border border-zoom-border bg-white p-0.5 hover:bg-zoom-bg"
                    aria-label={`More options for ${p.display_name}`}
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </div>
              )}
              {p.audio ? <Mic size={16} className="text-zoom-muted" /> : <MicOff size={16} className="text-zoom-red" />}
              {p.video || p.screen_sharing ? <Video size={16} className="text-zoom-muted" /> : <VideoOff size={16} className="text-zoom-red" />}

              {menuFor === p.participant_id && (
                <div className="absolute right-4 top-10 z-10 w-44 animate-fadeIn rounded-lg border border-zoom-border bg-white p-1 text-sm shadow-pop">
                  {p.audio && (
                    <button className="w-full rounded px-3 py-1.5 text-left hover:bg-zoom-bg" onClick={() => { onMute(p.participant_id); setMenuFor(null); }}>
                      Mute
                    </button>
                  )}
                  <button className="w-full rounded px-3 py-1.5 text-left text-zoom-red hover:bg-zoom-bg" onClick={() => { onRemove(p.participant_id); setMenuFor(null); }}>
                    Remove
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <footer className="flex gap-2 border-t border-zoom-border p-3">
        <button className="btn-secondary h-8 flex-1 px-2" onClick={onInvite}>Invite</button>
        {isHost && (
          confirmMuteAll ? (
            <button className="btn-primary h-8 flex-1 px-2" onClick={() => { onMuteAll(); setConfirmMuteAll(false); }}>
              Confirm mute all
            </button>
          ) : (
            <button className="btn-secondary h-8 flex-1 px-2" onClick={() => setConfirmMuteAll(true)} disabled={!peers.length}>
              Mute All
            </button>
          )
        )}
      </footer>
    </aside>
  );
}
