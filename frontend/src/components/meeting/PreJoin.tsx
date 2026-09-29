"use client";

import { Mic, MicOff, Video, VideoOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatMeetingId } from "@/lib/format";
import type { MeetingPublic } from "@/lib/types";
import Avatar from "@/components/ui/Avatar";
import { Logo } from "@/components/layout/TopNav";

export interface JoinChoice {
  name: string;
  passcode: string;
  audio: boolean;
  video: boolean;
  stream: MediaStream | null;
}

interface Props {
  meeting: MeetingPublic;
  defaultName: string;
  defaultPasscode: string;
  defaultAudio: boolean;
  defaultVideo: boolean;
  isHost: boolean;
  error: string;
  busy: boolean;
  onJoin: (c: JoinChoice) => void;
}

/** Pre-join screen: camera preview, name, passcode, mic/camera choice. */
export default function PreJoin({ meeting, defaultName, defaultPasscode, defaultAudio, defaultVideo, isHost, error, busy, onJoin }: Props) {
  const [name, setName] = useState(defaultName);
  const [passcode, setPasscode] = useState(defaultPasscode);
  const [audio, setAudio] = useState(defaultAudio);
  const [video, setVideo] = useState(defaultVideo);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mediaError, setMediaError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const handedOff = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMediaError("Your browser doesn't support camera/microphone access (HTTPS is required).");
        return;
      }
      let s: MediaStream | null = null;
      try {
        s = await navigator.mediaDevices.getUserMedia({ audio: true, video: { width: 1280, height: 720 } });
      } catch {
        try {
          s = await navigator.mediaDevices.getUserMedia({ audio: true });
          setMediaError("No camera available. You can still join with audio.");
          setVideo(false);
        } catch {
          setMediaError("Camera and microphone are blocked. You can still join and watch.");
          setAudio(false);
          setVideo(false);
        }
      }
      if (cancelled) s?.getTracks().forEach((t) => t.stop());
      else {
        streamRef.current = s;
        setStream(s);
      }
    })();
    return () => {
      cancelled = true;
      if (!handedOff.current) streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream, video]);

  useEffect(() => {
    stream?.getAudioTracks().forEach((t) => (t.enabled = audio));
  }, [stream, audio]);

  const hasCam = !!stream?.getVideoTracks().length;
  const hasMic = !!stream?.getAudioTracks().length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    handedOff.current = true;
    onJoin({ name: name.trim(), passcode: passcode.trim(), audio: audio && hasMic, video: video && hasCam, stream });
  }

  return (
    <div className="flex min-h-screen flex-col bg-zoom-bg">
      <header className="flex h-14 items-center border-b border-zoom-border bg-white px-4 lg:px-6">
        <Logo />
      </header>
      <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-8 p-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-[#232323] shadow-card">
          <video ref={videoRef} autoPlay playsInline muted className={`mirror h-full w-full object-cover ${video && hasCam ? "" : "hidden"}`} />
          {!(video && hasCam) && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-white/80">
              <Avatar name={name || "?"} size={88} rounded="lg" />
              <span className="text-sm">{hasCam ? "Your video is off" : "Camera unavailable"}</span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => setAudio((v) => !v)}
              disabled={!hasMic}
              className={`flex h-11 w-11 items-center justify-center rounded-full ${audio && hasMic ? "bg-white/20" : "bg-zoom-red"} text-white backdrop-blur disabled:opacity-60`}
              aria-label={audio ? "Mute microphone" : "Unmute microphone"}
            >
              {audio && hasMic ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
            <button
              type="button"
              onClick={() => setVideo((v) => !v)}
              disabled={!hasCam}
              className={`flex h-11 w-11 items-center justify-center rounded-full ${video && hasCam ? "bg-white/20" : "bg-zoom-red"} text-white backdrop-blur disabled:opacity-60`}
              aria-label={video ? "Turn camera off" : "Turn camera on"}
            >
              {video && hasCam ? <Video size={20} /> : <VideoOff size={20} />}
            </button>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-zoom-border bg-white p-6 shadow-card">
          <div>
            <h1 className="text-xl font-bold">{meeting.title}</h1>
            <p className="mt-1 text-sm text-zoom-muted">
              Meeting ID {formatMeetingId(meeting.meeting_code)} · Host: {meeting.host_name}
            </p>
          </div>
          <div>
            <label className="label" htmlFor="pj-name">Your name</label>
            <input id="pj-name" className="input" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} autoFocus={!name} />
          </div>
          {!isHost && (
            <div>
              <label className="label" htmlFor="pj-pwd">Meeting passcode</label>
              <input id="pj-pwd" className="input" value={passcode} maxLength={10} onChange={(e) => setPasscode(e.target.value)} placeholder="Enter meeting passcode" />
            </div>
          )}
          {mediaError && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{mediaError}</p>}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-zoom-red">{error}</p>}
          <button className="btn-primary h-11 w-full text-base" disabled={busy || !name.trim() || (!isHost && !passcode.trim())}>
            {busy ? "Joining..." : isHost ? "Start meeting" : "Join"}
          </button>
        </form>
      </main>
    </div>
  );
}
