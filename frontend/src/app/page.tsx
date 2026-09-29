"use client";

import { CalendarDays, ChevronDown, MonitorUp, Plus, Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ActionTile from "@/components/home/ActionTile";
import JoinModal from "@/components/home/JoinModal";
import RecentMeetings from "@/components/home/RecentMeetings";
import ScheduleModal from "@/components/home/ScheduleModal";
import UpcomingCard from "@/components/home/UpcomingCard";
import TopNav from "@/components/layout/TopNav";
import { useToast } from "@/components/ui/Toast";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useMeetingActions } from "@/hooks/useMeetingActions";
import { formatMeetingId } from "@/lib/format";

export default function HomePage() {
  const { user, upcoming, recent, loading, error, refresh } = useDashboardData();
  const { start, newMeeting, copyInvite, busy } = useMeetingActions();
  const toast = useToast();
  const [joinOpen, setJoinOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [dropdown, setDropdown] = useState(false);
  const [startWithVideo, setStartWithVideo] = useState(true);
  const ddRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => ddRef.current && !ddRef.current.contains(e.target as Node) && setDropdown(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="min-h-screen bg-zoom-bg">
      <TopNav user={user} />

      {error && (
        <div className="mx-auto mt-4 max-w-6xl px-4">
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-zoom-red">
            {error}{" "}
            <button className="font-semibold underline" onClick={refresh}>Retry</button>
          </div>
        </div>
      )}

      <main className="mx-auto grid max-w-6xl items-start gap-6 px-4 py-6 lg:grid-cols-[1fr_420px] lg:grid-rows-[auto_1fr] lg:py-10">
          <section className="rounded-2xl border border-zoom-border bg-white px-4 py-8 lg:col-start-1 lg:row-start-1 shadow-card sm:px-8" aria-label="Meeting actions">
            <div className="mx-auto grid max-w-md grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-4 sm:gap-x-4 lg:max-w-none">
              <div ref={ddRef} className="relative flex justify-center">
                <ActionTile icon={Video} label="New meeting" color="orange" disabled={busy} onClick={() => newMeeting(startWithVideo)}>
                  <button
                    onClick={() => setDropdown((v) => !v)}
                    aria-label="New meeting options"
                    className="rounded p-0.5 hover:bg-zoom-bg"
                  >
                    <ChevronDown size={14} />
                  </button>
                </ActionTile>
                {dropdown && (
                  <div className="absolute left-0 top-full z-20 mt-1 w-64 animate-fadeIn rounded-xl border border-zoom-border bg-white p-2 text-sm shadow-pop sm:left-1/2 sm:-translate-x-1/2">
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 hover:bg-zoom-bg">
                      <input type="checkbox" className="h-4 w-4 accent-zoom-blue" checked={startWithVideo} onChange={(e) => setStartWithVideo(e.target.checked)} />
                      Start with video
                    </label>
                    {user && (
                      <button
                        className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-zoom-bg"
                        onClick={() => toast(`Personal Meeting ID: ${formatMeetingId(user.personal_meeting_id)}`)}
                      >
                        Use my Personal Meeting ID (PMI)
                        <span className="text-xs text-zoom-muted">{formatMeetingId(user.personal_meeting_id)}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex justify-center">
                <ActionTile icon={Plus} label="Join" color="blue" onClick={() => setJoinOpen(true)} />
              </div>
              <div className="flex justify-center">
                <ActionTile icon={CalendarDays} label="Schedule" color="blue" onClick={() => setScheduleOpen(true)} />
              </div>
              <div className="flex justify-center">
                <ActionTile
                  icon={MonitorUp}
                  label="Share screen"
                  color="blue"
                  onClick={() => toast("Start or join a meeting to share your screen")}
                />
              </div>
            </div>
          </section>

        {/* On mobile: actions, upcoming, recent. On desktop: upcoming spans the right column. */}
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <UpcomingCard
            meetings={upcoming}
            loading={loading}
            onStart={(m) => start(m)}
            onCopy={(m) => copyInvite(m, true)}
            onSchedule={() => setScheduleOpen(true)}
          />
        </div>

        <div className="lg:col-start-1">
          <RecentMeetings meetings={recent} loading={loading} onRejoin={(m) => start(m)} />
        </div>
      </main>

      <JoinModal open={joinOpen} onClose={() => setJoinOpen(false)} defaultName={user?.name || ""} />
      <ScheduleModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        onSaved={() => refresh()}
        defaultTitle={user ? `${user.name}'s Zoom Meeting` : "My Meeting"}
      />
    </div>
  );
}
