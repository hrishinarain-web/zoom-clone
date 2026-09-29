"use client";

import { CalendarPlus, Copy, Radio } from "lucide-react";
import { useEffect, useState } from "react";
import { formatDateLabel, formatMeetingId, formatRange, isStartingSoon } from "@/lib/format";
import type { Meeting } from "@/lib/types";

interface Props {
  meetings: Meeting[];
  loading: boolean;
  onStart: (m: Meeting) => void;
  onCopy: (m: Meeting) => void;
  onSchedule: () => void;
}

/** Right-hand clock card with today's date and the upcoming meeting list (Zoom Workplace home). */
export default function UpcomingCard({ meetings, loading, onStart, onCopy, onSchedule }: Props) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Group by day label ("Today", "Tomorrow", "Fri, Oct 2").
  const groups: [string, Meeting[]][] = [];
  for (const m of meetings) {
    const label = formatDateLabel(m.scheduled_start!);
    const g = groups.find(([l]) => l === label);
    g ? g[1].push(m) : groups.push([label, [m]]);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-zoom-border bg-white shadow-card" aria-label="Upcoming meetings">
      <div className="relative h-36 bg-gradient-to-br from-[#0B5CFF] via-[#3B7BFF] to-[#6FA1FF] px-6 py-5 text-white">
        <svg className="absolute inset-0 h-full w-full opacity-20" viewBox="0 0 400 144" preserveAspectRatio="none" aria-hidden>
          <path d="M0 110 C80 70 160 130 240 90 S360 60 400 80 V144 H0Z" fill="white" />
          <path d="M0 125 C100 100 180 140 280 110 S380 100 400 105 V144 H0Z" fill="white" />
        </svg>
        <div className="relative">
          <div className="text-4xl font-bold tabular-nums tracking-tight sm:text-5xl" suppressHydrationWarning>
            {now ? now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : " "}
          </div>
          <div className="mt-1 text-sm font-medium text-white/90" suppressHydrationWarning>
            {now ? now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : ""}
          </div>
        </div>
      </div>

      <div className="scroll-thin max-h-[420px] overflow-y-auto">
        {loading && <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-zoom-bg" />)}</div>}

        {!loading && meetings.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <CalendarPlus size={36} className="text-zoom-muted" />
            <p className="text-sm text-zoom-muted">No upcoming meetings today</p>
            <button className="btn-secondary" onClick={onSchedule}>Schedule a meeting</button>
          </div>
        )}

        {groups.map(([label, items]) => (
          <div key={label}>
            <div className="sticky top-0 bg-white/95 px-5 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-zoom-muted backdrop-blur">
              {label}
            </div>
            <ul>
              {items.map((m) => {
                const live = m.status === "live";
                const soon = isStartingSoon(m.scheduled_start);
                return (
                  <li key={m.id} className="group flex items-center gap-3 px-5 py-3 hover:bg-zoom-bg">
                    <div className="w-1 self-stretch rounded-full bg-zoom-blue" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">{m.title}</span>
                        {live && (
                          <span className="flex items-center gap-1 rounded bg-emerald-50 px-1.5 text-[11px] font-bold text-emerald-700">
                            <Radio size={11} /> LIVE
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zoom-muted" suppressHydrationWarning>
                        {formatRange(m.scheduled_start!, m.duration_minutes)}
                      </div>
                      <div className="text-xs text-zoom-muted">Meeting ID: {formatMeetingId(m.meeting_code)}</div>
                    </div>
                    <button
                      onClick={() => onCopy(m)}
                      className="rounded-md p-1.5 text-zoom-muted opacity-100 hover:bg-white sm:opacity-0 sm:group-hover:opacity-100"
                      aria-label={`Copy invitation for ${m.title}`}
                      title="Copy invitation"
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      onClick={() => onStart(m)}
                      className={soon || live ? "btn-primary h-8 px-3" : "btn-secondary h-8 px-3"}
                    >
                      {live ? "Join" : "Start"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
