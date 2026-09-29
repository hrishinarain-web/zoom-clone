"use client";

import { useEffect, useState } from "react";
import {
  ChatIcon,
  ChevronIcon,
  MicIcon,
  MicOffIcon,
  RecordIcon,
  ShareIcon,
  ShieldIcon,
  SmileIcon,
  UsersIcon,
  VideoIcon,
  VideoOffIcon,
} from "./Icons";

const REACTIONS = ["👍", "👏", "❤️", "😂", "🎉", "😮"];

type Menu = "security" | "reactions" | "leave" | null;

export default function ControlBar({
  audioOn,
  videoOn,
  hasAudio,
  hasVideo,
  sharing,
  role,
  locked,
  participantCount,
  unreadChat,
  panel,
  recording,
  onToggleAudio,
  onToggleVideo,
  onShare,
  onTogglePanel,
  onReaction,
  onMuteAll,
  onToggleLock,
  onLeave,
  onEnd,
  onToggleRecording,
}: {
  audioOn: boolean;
  videoOn: boolean;
  hasAudio: boolean;
  hasVideo: boolean;
  sharing: boolean;
  role: string;
  locked: boolean;
  participantCount: number;
  unreadChat: number;
  panel: "chat" | "people" | null;
  recording: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onShare: () => void;
  onTogglePanel: (panel: "chat" | "people") => void;
  onReaction: (emoji: string) => void;
  onMuteAll: () => void;
  onToggleLock: () => void;
  onLeave: () => void;
  onEnd: () => void;
  onToggleRecording: () => void;
}) {
  const [menu, setMenu] = useState<Menu>(null);
  const host = role === "host";

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  function toggle(next: Menu) {
    setMenu((current) => (current === next ? null : next));
  }

  return (
    <div className="bottom-bar">
      <div className="controls">
        <button type="button" className={`ctrl ${audioOn ? "" : "danger-text"}`} disabled={!hasAudio} onClick={onToggleAudio}>
          {audioOn ? <MicIcon /> : <MicOffIcon />}
          <span>{audioOn ? "Mute" : "Unmute"}</span>
        </button>
        <button type="button" className={`ctrl ${videoOn ? "" : "danger-text"}`} disabled={!hasVideo || sharing} onClick={onToggleVideo}>
          {videoOn ? <VideoIcon /> : <VideoOffIcon />}
          <span>{videoOn ? "Stop Video" : "Start Video"}</span>
        </button>
        <div className="ctrl-wrap">
          <button type="button" className={`ctrl ${locked ? "active" : ""}`} onClick={(event) => { event.stopPropagation(); toggle("security"); }}>
            <ShieldIcon />
            <span>Security <ChevronIcon size={12} /></span>
          </button>
          {menu === "security" && (
            <div className="popover" onClick={(event) => event.stopPropagation()}>
              {host ? (
                <>
                  <button type="button" onClick={() => { onToggleLock(); setMenu(null); }}>{locked ? "Unlock meeting" : "Lock meeting"}</button>
                  <button type="button" onClick={() => { onMuteAll(); setMenu(null); }}>Mute all</button>
                </>
              ) : (
                <p>{locked ? "This meeting is locked." : "Security controls are available to the host."}</p>
              )}
            </div>
          )}
        </div>
        <button type="button" className={`ctrl ${panel === "people" ? "active" : ""}`} onClick={() => onTogglePanel("people")}>
          <UsersIcon />
          <span>Participants ({participantCount})</span>
        </button>
        <button type="button" className={`ctrl ${panel === "chat" ? "active" : ""}`} onClick={() => onTogglePanel("chat")}>
          <span className="ctrl-icon">
            <ChatIcon />
            {unreadChat > 0 && panel !== "chat" && <i className="badge">{unreadChat}</i>}
          </span>
          <span>Chat</span>
        </button>
        <button type="button" className={`ctrl ${sharing ? "active" : ""}`} onClick={onShare}>
          <ShareIcon />
          <span>{sharing ? "Stop Share" : "Share Screen"}</span>
        </button>
        <button type="button" className={`ctrl ${recording ? "danger-text" : ""}`} onClick={onToggleRecording}>
          <RecordIcon on={recording} />
          <span>{recording ? "Stop Recording" : "Record"}</span>
        </button>
        <div className="ctrl-wrap">
          <button type="button" className="ctrl" onClick={(event) => { event.stopPropagation(); toggle("reactions"); }}>
            <SmileIcon />
            <span>Reactions</span>
          </button>
          {menu === "reactions" && (
            <div className="popover reaction-popover" onClick={(event) => event.stopPropagation()}>
              {REACTIONS.map((emoji) => (
                <button key={emoji} type="button" onClick={() => { onReaction(emoji); setMenu(null); }}>{emoji}</button>
              ))}
            </div>
          )}
        </div>
        <div className="ctrl-wrap leave-wrap">
          <button type="button" className="leave" onClick={(event) => { event.stopPropagation(); toggle("leave"); }}>
            Leave
          </button>
          {menu === "leave" && (
            <div className="popover" onClick={(event) => event.stopPropagation()}>
              <button type="button" onClick={onLeave}>Leave meeting</button>
              {host && <button type="button" className="danger-text" onClick={onEnd}>End meeting for all</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
