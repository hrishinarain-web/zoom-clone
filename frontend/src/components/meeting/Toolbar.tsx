"use client";

import {
  Hand, Link2, MessageSquare, Mic, MicOff, MonitorUp, MoreHorizontal, Smile, Users, Video, VideoOff,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";

export const REACTIONS = ["👏", "👍", "❤️", "😂", "😮", "🎉"];

interface Props {
  audioOn: boolean;
  videoOn: boolean;
  sharing: boolean;
  handRaised: boolean;
  participantCount: number;
  unread: number;
  panel: "participants" | "chat" | null;
  isHost: boolean;
  onAudio: () => void;
  onVideo: () => void;
  onShare: () => void;
  onHand: () => void;
  onReact: (e: string) => void;
  onPanel: (p: "participants" | "chat") => void;
  onCopyInvite: () => void;
  onLeave: () => void;
  onEndForAll: () => void;
}

export default function Toolbar(p: Props) {
  const [pop, setPop] = useState<"react" | "more" | "end" | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setPop(null);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} className="relative flex h-[68px] shrink-0 items-center justify-between gap-1 bg-room-bar px-2 text-white sm:px-4">
      <div className="flex items-center">
        <Btn
          icon={p.audioOn ? Mic : MicOff}
          label={p.audioOn ? "Mute" : "Unmute"}
          danger={!p.audioOn}
          onClick={p.onAudio}
          shortcut="Alt+A"
        />
        <Btn
          icon={p.videoOn ? Video : VideoOff}
          label={p.videoOn ? "Stop Video" : "Start Video"}
          danger={!p.videoOn}
          onClick={p.onVideo}
          shortcut="Alt+V"
        />
      </div>

      <div className="flex items-center overflow-x-auto">
        <Btn icon={Users} label="Participants" badge={p.participantCount} active={p.panel === "participants"} onClick={() => p.onPanel("participants")} />
        <Btn icon={MessageSquare} label="Chat" dot={p.unread} active={p.panel === "chat"} onClick={() => p.onPanel("chat")} />
        <Btn icon={MonitorUp} label={p.sharing ? "Stop Share" : "Share"} green={!p.sharing} danger={p.sharing} onClick={p.onShare} className="hidden sm:flex" />
        <Btn icon={Smile} label="Reactions" active={pop === "react"} onClick={() => setPop(pop === "react" ? null : "react")} />
        <Btn icon={MoreHorizontal} label="More" active={pop === "more"} onClick={() => setPop(pop === "more" ? null : "more")} />
      </div>

      <button
        onClick={() => setPop(pop === "end" ? null : "end")}
        className="h-9 rounded-lg bg-zoom-red px-4 text-sm font-semibold hover:bg-red-700"
      >
        {p.isHost ? "End" : "Leave"}
      </button>

      {pop === "react" && (
        <div className="absolute bottom-[72px] left-1/2 z-30 -translate-x-1/2 animate-fadeIn rounded-xl bg-[#2B2B2B] p-2 shadow-pop">
          <div className="flex gap-1">
            {REACTIONS.map((e) => (
              <button key={e} onClick={() => { p.onReact(e); setPop(null); }} className="rounded-lg p-2 text-2xl hover:bg-white/10" aria-label={`React ${e}`}>
                {e}
              </button>
            ))}
          </div>
          <button
            onClick={() => { p.onHand(); setPop(null); }}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 py-2 text-sm hover:bg-white/15"
          >
            <Hand size={16} /> {p.handRaised ? "Lower Hand" : "Raise Hand"}
          </button>
        </div>
      )}

      {pop === "more" && (
        <div className="absolute bottom-[72px] left-1/2 z-30 w-56 animate-fadeIn rounded-xl bg-[#2B2B2B] p-1.5 text-sm shadow-pop sm:left-auto sm:right-24 sm:translate-x-0 max-sm:-translate-x-1/2">
          <MenuBtn icon={Link2} label="Copy invite link" onClick={() => { p.onCopyInvite(); setPop(null); }} />
          <MenuBtn icon={MonitorUp} label={p.sharing ? "Stop sharing" : "Share screen"} onClick={() => { p.onShare(); setPop(null); }} />
          <MenuBtn icon={Hand} label={p.handRaised ? "Lower hand" : "Raise hand"} onClick={() => { p.onHand(); setPop(null); }} />
        </div>
      )}

      {pop === "end" && (
        <div className="absolute bottom-[72px] right-2 z-30 w-64 animate-fadeIn rounded-xl bg-[#2B2B2B] p-3 shadow-pop">
          {p.isHost ? (
            <>
              <button onClick={p.onEndForAll} className="mb-2 w-full rounded-lg bg-zoom-red py-2 text-sm font-semibold hover:bg-red-700">
                End meeting for all
              </button>
              <button onClick={p.onLeave} className="w-full rounded-lg bg-white/10 py-2 text-sm font-semibold hover:bg-white/15">
                Leave meeting
              </button>
            </>
          ) : (
            <button onClick={p.onLeave} className="w-full rounded-lg bg-zoom-red py-2 text-sm font-semibold hover:bg-red-700">
              Leave meeting
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Btn({
  icon: Icon, label, onClick, danger, green, active, badge, dot, shortcut, className = "",
}: {
  icon: LucideIcon; label: string; onClick: () => void; danger?: boolean; green?: boolean; active?: boolean;
  badge?: number; dot?: number; shortcut?: string; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={`relative flex min-w-[56px] flex-col items-center gap-1 rounded-lg px-1.5 py-1.5 text-[11px] hover:bg-room-hover sm:min-w-[72px] ${active ? "bg-room-hover" : ""} ${className}`}
    >
      <span className="relative">
        <Icon size={22} className={danger ? "text-red-500" : green ? "text-zoom-green" : "text-white"} />
        {!!badge && (
          <span className="absolute -right-3 -top-1.5 rounded bg-[#3A3A3A] px-1 text-[10px] font-semibold">{badge}</span>
        )}
        {!!dot && (
          <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-zoom-red px-1 text-[10px] font-bold">
            {dot > 9 ? "9+" : dot}
          </span>
        )}
      </span>
      <span className="whitespace-nowrap text-white/85">{label}</span>
    </button>
  );
}

function MenuBtn({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/10">
      <Icon size={16} /> {label}
    </button>
  );
}
