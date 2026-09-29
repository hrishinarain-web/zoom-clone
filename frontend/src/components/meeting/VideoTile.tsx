"use client";

import { Hand, MicOff } from "lucide-react";
import { useEffect, useRef } from "react";
import { useSpeaking } from "@/hooks/useSpeaking";
import Avatar from "@/components/ui/Avatar";

interface Props {
  stream: MediaStream | null;
  name: string;
  isSelf?: boolean;
  audio: boolean;
  video: boolean;
  handRaised?: boolean;
  isHost?: boolean;
  isScreen?: boolean;
  reactions?: string[];
  compact?: boolean;
  connecting?: boolean;
}

export default function VideoTile({
  stream, name, isSelf, audio, video, handRaised, isHost, isScreen, reactions = [], compact, connecting,
}: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const speaking = useSpeaking(stream, audio);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    el.play().catch(() => {});
  }, [stream]);

  const showVideo = video && !!stream?.getVideoTracks().length;
  const label = `${name}${isSelf ? " (You)" : ""}`;

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg bg-room-tile ring-[3px] transition-shadow ${
        speaking && !isScreen ? "ring-zoom-green" : "ring-transparent"
      }`}
    >
      {/* Always mounted so remote audio keeps playing when the camera is off. */}
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={isSelf}
        className={`h-full w-full ${isScreen ? "object-contain" : "object-cover"} ${isSelf && !isScreen ? "mirror" : ""} ${
          showVideo ? "" : "invisible absolute"
        }`}
      />
      {!showVideo && (
        <div className="flex flex-col items-center gap-2">
          <Avatar name={name} size={compact ? 44 : 84} rounded="lg" />
          {!compact && <span className="max-w-[90%] truncate text-lg font-semibold text-white/90">{name}</span>}
        </div>
      )}

      {connecting && !isSelf && (
        <span className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/80">Connecting...</span>
      )}

      {handRaised && (
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-[#FFD24C] px-1.5 py-1 text-black">
          <Hand size={compact ? 12 : 16} />
        </div>
      )}

      <div className="absolute bottom-1.5 left-1.5 flex max-w-[calc(100%-12px)] items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
        {!audio && <MicOff size={12} className="shrink-0 text-red-500" aria-label="muted" />}
        <span className="truncate">{label}</span>
        {isHost && !compact && <span className="text-white/60">· Host</span>}
      </div>

      <div className="pointer-events-none absolute bottom-8 right-4">
        {reactions.map((e, i) => (
          <span key={i} className="absolute bottom-0 right-0 animate-floatUp text-4xl" style={{ right: i * 12 }}>
            {e}
          </span>
        ))}
      </div>
    </div>
  );
}
