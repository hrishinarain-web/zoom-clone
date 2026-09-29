"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "./Logo";
import { MicIcon, MicOffIcon, VideoIcon, VideoOffIcon } from "./Icons";
import { getMeeting, joinMeeting } from "@/lib/api";
import { getLocalMedia, stopStream } from "@/lib/media";
import { loadSettings } from "@/lib/settings";
import { saveSession } from "@/lib/session";
import type { Meeting } from "@/lib/types";

export default function Prejoin({ code }: { code: string }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState("");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [audioOn, setAudioOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [warning, setWarning] = useState("");

  useEffect(() => {
    const settings = loadSettings();
    setName(settings.displayName || "");
    setAudioOn(!settings.joinMuted);
    setVideoOn(!settings.joinVideoOff);
    let active = true;
    void getMeeting(code)
      .then((found) => {
        if (!active) return;
        setMeeting(found);
        if (found.status === "ended" || found.status === "cancelled") setBlocked("This meeting has ended.");
        else if (found.status !== "live") setBlocked("The host hasn't started this meeting yet.");
        if (!settings.displayName) setName("");
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    void getLocalMedia(settings).then(({ stream, warning: mediaWarning }) => {
      if (!active) {
        stopStream(stream);
        return;
      }
      streamRef.current = stream;
      setWarning(mediaWarning);
      setAudioOn(stream.getAudioTracks().some((track) => track.enabled));
      setVideoOn(stream.getVideoTracks().some((track) => track.enabled));
      if (videoRef.current) videoRef.current.srcObject = stream;
    });

    return () => {
      active = false;
      stopStream(streamRef.current);
    };
  }, [code]);

  function toggleAudio() {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setAudioOn(track.enabled);
  }

  function toggleVideo() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setVideoOn(track.enabled);
  }

  const canJoin = Boolean(meeting && meeting.status === "live" && name.trim() && !joining);

  return (
    <div className="prejoin-page">
      <header className="prejoin-bar">
        <a href="/" aria-label="Zoom home"><Logo /></a>
      </header>
      <main className="prejoin">
        <section className="preview">
          <video ref={videoRef} autoPlay playsInline muted className={videoOn ? "mirror" : "hidden-video"} />
          {!videoOn && <div className="preview-fallback">{name.trim() ? name.trim()[0]?.toUpperCase() : "?"}</div>}
          <div className="preview-controls">
            <button type="button" className={`round-btn ${audioOn ? "" : "off"}`} onClick={toggleAudio} aria-label={audioOn ? "Mute" : "Unmute"}>
              {audioOn ? <MicIcon /> : <MicOffIcon />}
            </button>
            <button type="button" className={`round-btn ${videoOn ? "" : "off"}`} onClick={toggleVideo} aria-label={videoOn ? "Stop video" : "Start video"}>
              {videoOn ? <VideoIcon /> : <VideoOffIcon />}
            </button>
          </div>
          {warning && <p className="preview-warning">{warning}</p>}
        </section>
        <section className="join-card">
          {loading && <p className="help">Checking meeting ID…</p>}
          {!loading && error && (
            <>
              <h1>Invalid meeting ID</h1>
              <p className="error-text">{error}</p>
              <a className="btn btn-primary" href="/">Back to home</a>
            </>
          )}
          {!loading && meeting && (
            <>
              <h1>{meeting.title}</h1>
              <p className="row-meta">Meeting ID: {meeting.codeDisplay}</p>
              <p className="help">Hosted by {meeting.hostName}</p>
              {meeting.scheduledAt && meeting.status === "scheduled" && (
                <p className="help">
                  Scheduled for {new Date(meeting.scheduledAt).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </p>
              )}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!canJoin) return;
                  setJoining(true);
                  void joinMeeting(code, name.trim())
                    .then((result) => {
                      stopStream(streamRef.current);
                      streamRef.current = null;
                      saveSession(result);
                      router.push(`/meeting/${code}`);
                    })
                    .catch((err: Error) => {
                      setError(err.message);
                      setJoining(false);
                    });
                }}
              >
                <label className="field">
                  <span>Your name</span>
                  <input value={name} maxLength={64} placeholder="Your name" autoFocus onChange={(event) => setName(event.target.value)} />
                </label>
                {blocked && <p className="notice">{blocked}</p>}
                {error && !blocked && <p className="error-text">{error}</p>}
                <button type="submit" className="btn btn-primary btn-block" disabled={!canJoin}>
                  {joining ? "Joining…" : "Join"}
                </button>
              </form>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
