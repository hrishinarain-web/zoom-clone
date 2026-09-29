"use client";

import { CalendarPlus, ChevronLeft, Copy, Eye, EyeOff, Pencil, Trash2, Video } from "lucide-react";
import { useEffect, useState } from "react";
import ScheduleModal from "@/components/home/ScheduleModal";
import TopNav from "@/components/layout/TopNav";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useMeetingActions } from "@/hooks/useMeetingActions";
import { api } from "@/lib/api";
import { formatDateLabel, formatDuration, formatMeetingId, formatRange, formatTime } from "@/lib/format";
import type { Meeting } from "@/lib/types";

type Tab = "upcoming" | "previous";

export default function MeetingsPage() {
  const { user, upcoming, recent, loading, refresh } = useDashboardData();
  const { start, copyInvite } = useMeetingActions();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Meeting | null>(null);

  const list = tab === "upcoming" ? upcoming : recent;
  const selected = list.find((m) => m.id === selectedId) || null;

  // Auto-select first item on desktop.
  useEffect(() => {
    if (!selectedId && list.length && typeof window !== "undefined" && window.innerWidth >= 1024) setSelectedId(list[0].id);
  }, [list, selectedId]);

  async function doDelete(m: Meeting) {
    try {
      await api.remove(m.meeting_code);
      toast("Meeting deleted", "success");
      setSelectedId(null);
      refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setConfirmDelete(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-zoom-bg">
      <TopNav user={user} />
      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-4 p-4 lg:grid-cols-[380px_1fr] lg:py-6">
        {/* List */}
        <section className={`${selected ? "hidden lg:flex" : "flex"} flex-col rounded-2xl border border-zoom-border bg-white shadow-card`}>
          <div className="flex items-center justify-between border-b border-zoom-border px-4 py-3">
            <div className="flex rounded-lg bg-zoom-bg p-1 text-sm font-semibold">
              {(["upcoming", "previous"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setSelectedId(null); }}
                  className={`rounded-md px-3 py-1.5 capitalize ${tab === t ? "bg-white text-zoom-text shadow-sm" : "text-zoom-muted"}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <button className="btn-primary h-8 px-3" onClick={() => { setEditing(null); setScheduleOpen(true); }}>
              <CalendarPlus size={15} /> Schedule
            </button>
          </div>
          <ul className="scroll-thin flex-1 overflow-y-auto">
            {loading && <li className="p-4 text-sm text-zoom-muted">Loading...</li>}
            {!loading && list.length === 0 && (
              <li className="p-8 text-center text-sm text-zoom-muted">No {tab} meetings</li>
            )}
            {list.map((m) => {
              const when = tab === "upcoming" ? m.scheduled_start! : m.started_at!;
              return (
                <li key={m.id}>
                  <button
                    onClick={() => { setSelectedId(m.id); setShowPwd(false); }}
                    className={`flex w-full flex-col items-start border-l-4 px-4 py-3 text-left hover:bg-zoom-bg ${
                      selectedId === m.id ? "border-zoom-blue bg-zoom-blue-light/60" : "border-transparent"
                    }`}
                  >
                    <span className="text-xs font-semibold text-zoom-muted" suppressHydrationWarning>
                      {formatDateLabel(when)} · {tab === "upcoming" ? formatRange(when, m.duration_minutes) : formatTime(when)}
                    </span>
                    <span className="truncate text-sm font-semibold">{m.title}</span>
                    <span className="text-xs text-zoom-muted">Meeting ID: {formatMeetingId(m.meeting_code)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Detail */}
        <section className={`${selected ? "block" : "hidden lg:block"} rounded-2xl border border-zoom-border bg-white p-6 shadow-card`}>
          {!selected ? (
            <div className="flex h-full items-center justify-center text-sm text-zoom-muted">Select a meeting to see details</div>
          ) : (
            <div className="space-y-6">
              <button className="flex items-center gap-1 text-sm text-zoom-blue lg:hidden" onClick={() => setSelectedId(null)}>
                <ChevronLeft size={16} /> Back
              </button>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold">{selected.title}</h1>
                  <p className="mt-1 text-sm text-zoom-muted" suppressHydrationWarning>
                    {tab === "upcoming"
                      ? `${formatDateLabel(selected.scheduled_start!)}, ${formatRange(selected.scheduled_start!, selected.duration_minutes)}`
                      : `${formatDateLabel(selected.started_at!)}, ${formatTime(selected.started_at!)} · ${formatDuration(selected.started_at!, selected.ended_at)}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-primary" onClick={() => start(selected)}>
                    <Video size={15} /> {tab === "upcoming" ? "Start" : "Rejoin"}
                  </button>
                  <button className="btn-secondary" onClick={() => copyInvite(selected, true)}>
                    <Copy size={15} /> Copy invitation
                  </button>
                  {tab === "upcoming" && (
                    <>
                      <button className="btn-secondary" onClick={() => { setEditing(selected); setScheduleOpen(true); }} aria-label="Edit">
                        <Pencil size={15} /> Edit
                      </button>
                      <button className="btn-secondary text-zoom-red" onClick={() => setConfirmDelete(selected)} aria-label="Delete">
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <dl className="grid gap-4 text-sm sm:grid-cols-[160px_1fr]">
                <dt className="font-semibold text-zoom-muted">Description</dt>
                <dd>{selected.description || <span className="text-zoom-muted">-</span>}</dd>
                <dt className="font-semibold text-zoom-muted">Meeting ID</dt>
                <dd>{formatMeetingId(selected.meeting_code)}</dd>
                <dt className="font-semibold text-zoom-muted">Passcode</dt>
                <dd className="flex items-center gap-2">
                  {showPwd ? selected.passcode : "••••••"}
                  <button onClick={() => setShowPwd((v) => !v)} className="text-zoom-muted" aria-label="Toggle passcode">
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </dd>
                <dt className="font-semibold text-zoom-muted">Invite link</dt>
                <dd className="flex items-center gap-2 break-all">
                  <a href={selected.join_url} className="text-zoom-blue hover:underline">{selected.join_url}</a>
                  <button onClick={() => copyInvite(selected)} className="shrink-0 text-zoom-muted" aria-label="Copy link"><Copy size={15} /></button>
                </dd>
                <dt className="font-semibold text-zoom-muted">Host</dt>
                <dd>{selected.host.name}</dd>
                <dt className="font-semibold text-zoom-muted">Security</dt>
                <dd>
                  Passcode{selected.waiting_room && " · Waiting Room"}{selected.mute_on_entry && " · Mute on entry"}
                </dd>
                {tab === "previous" && (
                  <>
                    <dt className="font-semibold text-zoom-muted">Participants</dt>
                    <dd>{selected.participant_count}</dd>
                  </>
                )}
              </dl>
            </div>
          )}
        </section>
      </main>

      <ScheduleModal
        open={scheduleOpen}
        onClose={() => { setScheduleOpen(false); setEditing(null); }}
        onSaved={(m) => { refresh(); setTab("upcoming"); setSelectedId(m.id); }}
        editing={editing}
        defaultTitle={user ? `${user.name}'s Zoom Meeting` : "My Meeting"}
      />
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete meeting?"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
            <button className="btn-danger" onClick={() => confirmDelete && doDelete(confirmDelete)}>Delete</button>
          </>
        }
      >
        <p className="text-sm">&quot;{confirmDelete?.title}&quot; will be removed and its invite link will stop working.</p>
      </Modal>
    </div>
  );
}
