"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Loader2, VideoOff } from "lucide-react";
import MeetingRoom from "@/components/meeting/MeetingRoom";
import PreJoin, { type JoinChoice } from "@/components/meeting/PreJoin";
import { Logo } from "@/components/layout/TopNav";
import type { ExitReason } from "@/hooks/useMeetingRoom";
import { api } from "@/lib/api";
import { session } from "@/lib/session";
import type { JoinResponse, MeetingPublic } from "@/lib/types";

type Phase =
  | { kind: "loading" }
  | { kind: "invalid"; message: string }
  | { kind: "prejoin" }
  | { kind: "starting" }
  | { kind: "room"; join: JoinResponse; stream: MediaStream | null; audio: boolean; video: boolean }
  | { kind: "exited"; reason: ExitReason; detail?: string };

async function getMedia(audio: boolean, video: boolean): Promise<MediaStream | null> {
  if (!navigator.mediaDevices?.getUserMedia || (!audio && !video)) return null;
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true, video: video ? { width: 1280, height: 720 } : false });
  } catch {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return null;
    }
  }
}

function JoinFlow() {
  const { code } = useParams<{ code: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const pwd = search.get("pwd") || "";

  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [info, setInfo] = useState<MeetingPublic | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [defaults, setDefaults] = useState({ name: "", audio: true, video: true });
  const isHost = useRef(false);
  const started = useRef(false);

  const enter = useCallback(
    async (c: { name: string; passcode: string; audio: boolean; video: boolean; stream: MediaStream | null }) => {
      setBusy(true);
      setError("");
      try {
        const join = await api.join(code, {
          display_name: c.name,
          passcode: c.passcode || undefined,
          as_host: isHost.current,
        });
        if (!isHost.current) session.displayName = c.name;
        setPhase({ kind: "room", join, stream: c.stream, audio: c.audio, video: c.video });
      } catch (e) {
        setError((e as Error).message);
        setPhase((p) => (p.kind === "starting" ? { kind: "prejoin" } : p));
      } finally {
        setBusy(false);
      }
    },
    [code],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      let meeting: MeetingPublic;
      try {
        meeting = await api.publicInfo(code);
      } catch (e) {
        setPhase({ kind: "invalid", message: (e as Error).message });
        return;
      }
      setInfo(meeting);
      isHost.current = session.isHost(meeting.meeting_code);
      const prefs = session.takeJoinPrefs();
      let name = prefs?.name || session.displayName;
      if (isHost.current) {
        const me = await api.me().catch(() => null);
        name = me?.name || name;
      }
      const d = { name: name || "", audio: prefs?.audio ?? true, video: prefs?.video ?? true };
      setDefaults(d);

      // Host clicked "New meeting"/"Start": go straight in, like Zoom.
      if (isHost.current && prefs && d.name) {
        setPhase({ kind: "starting" });
        const stream = await getMedia(d.audio, d.video);
        await enter({
          name: d.name,
          passcode: pwd,
          audio: d.audio && !!stream?.getAudioTracks().length,
          video: d.video && !!stream?.getVideoTracks().length,
          stream,
        });
        return;
      }
      setPhase({ kind: "prejoin" });
    })();
  }, [code, enter, pwd]);

  const onExit = useCallback((reason: ExitReason, detail?: string) => {
    setPhase({ kind: "exited", reason, detail });
  }, []);

  if (phase.kind === "loading" || phase.kind === "starting") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-room-bg text-white">
        <Loader2 className="animate-spin" size={32} />
        <p className="text-sm text-white/70">{phase.kind === "starting" ? "Starting meeting..." : "Loading meeting..."}</p>
      </div>
    );
  }

  if (phase.kind === "invalid") {
    return (
      <CenterCard title="Unable to join meeting" body={phase.message}>
        <Link href="/" className="btn-primary">Back to home</Link>
      </CenterCard>
    );
  }

  if (phase.kind === "exited") {
    const titles: Record<ExitReason, string> = {
      left: "You have left the meeting",
      ended: "The meeting has ended",
      removed: "You have been removed",
      error: "Connection lost",
    };
    return (
      <CenterCard title={titles[phase.reason]} body={phase.detail || info?.title || ""}>
        {phase.reason !== "removed" && (
          <button
            className="btn-secondary"
            onClick={() => {
              setError("");
              setPhase({ kind: "prejoin" });
            }}
          >
            Rejoin
          </button>
        )}
        <button className="btn-primary" onClick={() => router.push("/")}>Back to home</button>
      </CenterCard>
    );
  }

  if (phase.kind === "prejoin" && info) {
    return (
      <PreJoin
        meeting={info}
        defaultName={defaults.name}
        defaultPasscode={pwd}
        defaultAudio={defaults.audio}
        defaultVideo={defaults.video}
        isHost={isHost.current}
        error={error}
        busy={busy}
        onJoin={(c: JoinChoice) => enter({ ...c, passcode: isHost.current ? pwd : c.passcode })}
      />
    );
  }

  if (phase.kind === "room") {
    const { join } = phase;
    return (
      <MeetingRoom
        meeting={join.meeting}
        token={join.session_token}
        participantId={join.participant.id}
        displayName={join.participant.display_name}
        role={join.participant.role}
        initialStream={phase.stream}
        initialAudio={phase.audio}
        initialVideo={phase.video}
        onExit={onExit}
      />
    );
  }
  return null;
}

function CenterCard({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-zoom-bg">
      <header className="flex h-14 items-center border-b border-zoom-border bg-white px-4 lg:px-6">
        <Logo />
      </header>
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-zoom-border bg-white p-8 text-center shadow-card">
          <VideoOff className="mx-auto mb-4 text-zoom-muted" size={40} />
          <h1 className="text-xl font-bold">{title}</h1>
          {body && <p className="mt-2 text-sm text-zoom-muted">{body}</p>}
          <div className="mt-6 flex justify-center gap-2">{children}</div>
        </div>
      </main>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinFlow />
    </Suspense>
  );
}
