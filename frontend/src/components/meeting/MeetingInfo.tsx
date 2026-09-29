"use client";

import { Copy, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatMeetingId } from "@/lib/format";
import type { Meeting } from "@/lib/types";

export default function MeetingInfo({ meeting, onCopy }: { meeting: Meeting; onCopy: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-white/85 hover:bg-white/10"
        aria-label="Meeting information"
      >
        <ShieldCheck size={16} className="text-zoom-green" />
        <span className="hidden max-w-[240px] truncate sm:inline">{meeting.title}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-9 z-40 w-[min(340px,calc(100vw-24px))] animate-fadeIn rounded-xl bg-white p-4 text-sm text-zoom-text shadow-pop">
          <h3 className="mb-3 text-base font-bold">{meeting.title}</h3>
          <dl className="grid grid-cols-[92px_1fr] gap-y-2">
            <dt className="text-zoom-muted">Meeting ID</dt>
            <dd className="font-medium">{formatMeetingId(meeting.meeting_code)}</dd>
            <dt className="text-zoom-muted">Host</dt>
            <dd className="font-medium">{meeting.host.name}</dd>
            <dt className="text-zoom-muted">Passcode</dt>
            <dd className="font-medium">{meeting.passcode}</dd>
            <dt className="text-zoom-muted">Invite link</dt>
            <dd className="break-all text-zoom-blue">{meeting.join_url}</dd>
          </dl>
          <button onClick={onCopy} className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-zoom-blue hover:underline">
            <Copy size={14} /> Copy link
          </button>
          <div className="mt-3 flex items-center gap-1.5 border-t border-zoom-border pt-3 text-xs text-zoom-muted">
            <ShieldCheck size={14} className="text-emerald-600" /> Media is peer-to-peer and encrypted (DTLS-SRTP)
          </div>
        </div>
      )}
    </div>
  );
}
