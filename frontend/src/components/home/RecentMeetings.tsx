import { Clock, History, Users } from "lucide-react";
import { formatDateLabel, formatDuration, formatMeetingId, formatTime } from "@/lib/format";
import type { Meeting } from "@/lib/types";

interface Props {
  meetings: Meeting[];
  loading: boolean;
  onRejoin: (m: Meeting) => void;
}

export default function RecentMeetings({ meetings, loading, onRejoin }: Props) {
  return (
    <section aria-label="Recent meetings" className="rounded-2xl border border-zoom-border bg-white shadow-card">
      <div className="flex items-center gap-2 border-b border-zoom-border px-5 py-3.5">
        <History size={16} className="text-zoom-muted" />
        <h2 className="text-sm font-bold">Recent meetings</h2>
      </div>
      {loading && <div className="space-y-3 p-5">{[0, 1].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-zoom-bg" />)}</div>}
      {!loading && meetings.length === 0 && (
        <p className="px-5 py-8 text-center text-sm text-zoom-muted">Meetings you host or join will appear here.</p>
      )}
      <ul className="divide-y divide-zoom-border">
        {meetings.slice(0, 6).map((m) => (
          <li key={m.id} className="flex items-center gap-3 px-5 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zoom-blue-light text-zoom-blue">
              <Clock size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{m.title}</div>
              <div className="flex flex-wrap gap-x-3 text-xs text-zoom-muted" suppressHydrationWarning>
                <span>{formatDateLabel(m.started_at!)}, {formatTime(m.started_at!)}</span>
                {m.ended_at && <span>{formatDuration(m.started_at!, m.ended_at)}</span>}
                <span className="flex items-center gap-1"><Users size={11} /> {m.participant_count}</span>
                <span className="hidden sm:inline">ID: {formatMeetingId(m.meeting_code)}</span>
              </div>
            </div>
            {m.status === "live" ? (
              <button className="btn-primary h-8 px-3" onClick={() => onRejoin(m)}>Join</button>
            ) : (
              <button className="btn-secondary h-8 px-3" onClick={() => onRejoin(m)}>Rejoin</button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
