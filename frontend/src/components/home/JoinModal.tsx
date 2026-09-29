"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { parseJoinInput } from "@/lib/format";
import { session } from "@/lib/session";
import Modal from "@/components/ui/Modal";

export default function JoinModal({ open, onClose, defaultName }: { open: boolean; onClose: () => void; defaultName: string }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [name, setName] = useState("");
  const [remember, setRemember] = useState(true);
  const [noAudio, setNoAudio] = useState(false);
  const [noVideo, setNoVideo] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(session.displayName || defaultName);
      setError("");
    }
  }, [open, defaultName]);

  const { code, pwd } = parseJoinInput(input);
  const valid = code.length >= 9 && code.length <= 11 && name.trim().length > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError("");
    try {
      await api.publicInfo(code); // validates that the meeting exists
      if (remember) session.displayName = name.trim();
      session.setJoinPrefs({ name: name.trim(), audio: !noAudio, video: !noVideo });
      router.push(`/j/${code}${pwd ? `?pwd=${encodeURIComponent(pwd)}` : ""}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Join meeting">
      <form onSubmit={submit} className="space-y-4" id="join-form">
        <div>
          <input
            autoFocus
            className="input"
            placeholder="Meeting ID or personal link name"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label="Meeting ID or invite link"
          />
          <p className="mt-1 text-xs text-zoom-muted">Paste a Meeting ID or the full invite link.</p>
        </div>
        <input
          className="input"
          placeholder="Your name"
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
          aria-label="Your name"
        />
        <div className="space-y-2 text-sm">
          <Check label="Remember my name for future meetings" on={remember} set={setRemember} />
          <Check label="Don't connect to audio" on={noAudio} set={setNoAudio} />
          <Check label="Turn off my video" on={noVideo} set={setNoVideo} />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-zoom-red">{error}</p>}
        <p className="text-xs text-zoom-muted">
          By clicking &quot;Join&quot;, you agree to our Terms of Service and Privacy Statement.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary min-w-20" disabled={!valid || busy}>{busy ? "Joining..." : "Join"}</button>
        </div>
      </form>
    </Modal>
  );
}

function Check({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="h-4 w-4 accent-zoom-blue" />
      {label}
    </label>
  );
}
