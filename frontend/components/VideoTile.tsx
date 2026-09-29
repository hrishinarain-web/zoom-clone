"use client";

import { useEffect, useRef } from "react";
import Avatar from "./Avatar";
import { MicOffIcon } from "./Icons";
import { useSpeaking } from "@/lib/useSpeaking";

export type TileModel = {
  id: number;
  name: string;
  stream: MediaStream | null;
  audio: boolean;
  video: boolean;
  isSelf: boolean;
  mirror: boolean;
  sharing: boolean;
  reaction: string | null;
  role: string;
};

export default function VideoTile({ tile }: { tile: TileModel }) {
  const ref = useRef<HTMLVideoElement>(null);
  const speaking = useSpeaking(tile.stream, tile.audio);
  const showVideo = tile.video && Boolean(tile.stream?.getVideoTracks().some((track) => track.readyState === "live"));

  useEffect(() => {
    if (ref.current) ref.current.srcObject = showVideo ? tile.stream : null;
  }, [tile.stream, showVideo]);

  return (
    <article className={`tile ${speaking ? "speaking" : ""}`}>
      {showVideo ? (
        <video ref={ref} autoPlay playsInline muted={tile.isSelf} className={tile.mirror && !tile.sharing ? "mirror" : ""} />
      ) : (
        <div className="tile-fallback">
          <Avatar name={tile.name} size={92} />
        </div>
      )}
      {tile.reaction && <span className="reaction" key={tile.reaction}>{tile.reaction.split("|")[0]}</span>}
      <span className="tile-name">
        {!tile.audio && <MicOffIcon size={14} />}
        {tile.name}
        {tile.isSelf ? " (You)" : ""}
        {tile.role === "host" ? ", Host" : ""}
        {tile.sharing ? " · sharing" : ""}
      </span>
    </article>
  );
}
