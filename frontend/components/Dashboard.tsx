"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "./Navbar";
import Modal, { Toast } from "./Modal";
import {
  CalendarIcon,
  ChevronIcon,
  CopyIcon,
  JoinIcon,
  ShareIcon,
  VideoIcon,
} from "./Icons";
import {
  cancelMeeting,
  createInstant,
  getMe,
  getRecent,
  getUpcoming,
  scheduleMeeting,
  startMeeting,
} from "@/lib/api";
import {
  copyText,
  defaultScheduleValue,
  formatHistoryWhen,
  formatRange,
  groupUpcoming,
  inviteLink,
  inviteText,
  parseMeetingInput,
} from "@/lib/format";
import { saveSession } from "@/lib/session";
import type { HistoryItem, Meeting, User } from "@/lib/types";

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [upcoming, setUpcoming] = useState<Meeting[]>([]);
  const [recent, setRecent] = useState<HistoryItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [me, nextMeetings, history] = await Promise.all([getMe(), getUpcoming(), getRecent()]);
      setUser(me);
      setUpcoming(nextMeetings);
      setRecent(history);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load meetings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  }

  async function enter(task: () => Promise<Awaited<ReturnType<typeof startMeeting>>>, share = false) {
    setBusy(true);
    setError("");
    try {
      const result = await task();
      saveSession(result);
      if (share) sessionStorage.setItem("zoom-share", result.meeting.code);
      router.push(`/meeting/${result.meeting.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the meeting.");
      setBusy(false);
    }
  }

  async function copyInvite(meeting: Meeting) {
    try {
      await copyText(inviteText(meeting));
      showToast("Invitation copied");
    } catch {
      showToast("Couldn't copy the invitation");
    }
  }

  const groups = groupUpcoming(upcoming);

  return (
    <div className="shell">
      <Navbar user={user} />
      <main className="content">
        {error && <div className="banner">{error}</div>}
        <div className="columns">
          <section className="main-col">
            <div className="action-row">
              <div className="split">
                <button type="button" className="split-main" disabled={busy} onClick={() => void enter(() => createInstant())}>
                  <VideoIcon size={18} />
                  New Meeting
                </button>
                <button
                  type="button"
                  className="split-chev"
                  aria-label="Meeting options"
                  onClick={(event) => {
                    event.stopPropagation();
                    setMenu((open) => !open);
                  }}
                >
                  <ChevronIcon />
                </button>
                {menu && (
                  <div className="dropdown action-dropdown" onClick={(event) => event.stopPropagation()}>
                    <button type="button" onClick={() => { setMenu(false); void enter(() => createInstant()); }}>Start an instant meeting</button>
                    <button
                      type="button"
                      disabled={!user}
                      onClick={() => {
                        setMenu(false);
                        if (user) void enter(() => startMeeting(user.personalMeetingCode));
                      }}
                    >
                      Start personal meeting
                    </button>
                  </div>
                )}
              </div>
              <button type="button" className="btn btn-outline" onClick={() => setJoinOpen(true)}>
                <JoinIcon size={18} /> Join
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setScheduleOpen(true)}>
                <CalendarIcon size={18} /> Schedule
              </button>
              <button type="button" className="btn btn-outline" disabled={busy} onClick={() => void enter(() => createInstant(), true)}>
                <ShareIcon size={18} /> Share Screen
              </button>
            </div>

            <section id="upcoming" className="section">
              <div className="section-head">
                <h1>Upcoming meetings</h1>
              </div>
              {loading && <div className="skeleton" />}
              {!loading && groups.length === 0 && (
                <div className="empty">
                  <p>No upcoming meetings</p>
                  <button type="button" className="btn btn-outline" onClick={() => setScheduleOpen(true)}>Schedule a meeting</button>
                </div>
              )}
              {groups.map((group) => (
                <div key={group.label}>
                  <h2 className="day-label">{group.label}</h2>
                  {group.items.map((meeting) => (
                    <article key={meeting.id} className="meeting-row">
                      <div className="when">
                        {meeting.status === "live" ? <span className="pill">Now</span> : formatRange(meeting.scheduledAt, meeting.durationMinutes)}
                      </div>
                      <div className="row-main">
                        <h3>{meeting.title}</h3>
                        {meeting.description && <p>{meeting.description}</p>}
                        <p className="row-meta">
                          Meeting ID: {meeting.codeDisplay}
                          {meeting.status === "live" ? "" : ` · ${meeting.durationMinutes} min`}
                        </p>
                      </div>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-primary btn-small"
                          disabled={busy}
                          onClick={() => void enter(() => startMeeting(meeting.code))}
                        >
                          {meeting.status === "live" ? "Join" : "Start"}
                        </button>
                        <button type="button" className="icon-btn" aria-label="Copy invitation" onClick={() => void copyInvite(meeting)}>
                          <CopyIcon />
                        </button>
                        {meeting.status === "scheduled" && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-small"
                            onClick={() => {
                              void cancelMeeting(meeting.code).then(() => load()).catch((err) => setError(err.message));
                            }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ))}
            </section>

            <section className="section">
              <div className="section-head">
                <h1>Recent meetings</h1>
              </div>
              {!loading && recent.length === 0 && <div className="empty"><p>No recent meetings</p></div>}
              {recent.map((meeting) => (
                <article key={meeting.id} className="meeting-row">
                  <div className="when muted-time">{formatHistoryWhen(meeting.startedAt, meeting.endedAt)}</div>
                  <div className="row-main">
                    <h3>{meeting.title}</h3>
                    <p className="row-meta">
                      {meeting.participantCount} participant{meeting.participantCount === 1 ? "" : "s"} · ID {meeting.codeDisplay}
                    </p>
                  </div>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn btn-outline btn-small"
                      disabled={busy}
                      onClick={() => void enter(() => createInstant(meeting.title))}
                    >
                      Meet again
                    </button>
                  </div>
                </article>
              ))}
            </section>
          </section>

          <aside className="side-card">
            <h2>Personal Meeting ID</h2>
            <p className="pmi-code">{user?.personalMeetingCodeDisplay || "··· ···· ····"}</p>
            <p className="help">This ID stays the same every time you start your personal room.</p>
            <div className="pmi-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!user || busy}
                onClick={() => user && void enter(() => startMeeting(user.personalMeetingCode))}
              >
                {user?.personalMeetingStatus === "live" ? "Join" : "Start"}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                disabled={!user}
                onClick={() => {
                  if (!user) return;
                  void copyText(`${user.personalMeetingCodeDisplay}\n${inviteLink(user.personalMeetingCode)}`)
                    .then(() => showToast("Personal meeting ID copied"))
                    .catch(() => showToast("Couldn't copy"));
                }}
              >
                Copy
              </button>
            </div>
          </aside>
        </div>
      </main>
      {joinOpen && <JoinModal onClose={() => setJoinOpen(false)} />}
      {scheduleOpen && (
        <ScheduleModal
          onClose={() => setScheduleOpen(false)}
          onCreated={() => {
            setScheduleOpen(false);
            showToast("Meeting scheduled");
            void load();
          }}
        />
      )}
      <Toast message={toast} />
    </div>
  );
}

function JoinModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const code = parseMeetingInput(value);

  return (
    <Modal title="Join Meeting" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (code.length < 9) {
            setError("Enter a valid meeting ID.");
            return;
          }
          router.push(`/j/${code}`);
        }}
      >
        <label className="field">
          <span>Meeting ID or invite link</span>
          <input
            autoFocus
            value={value}
            placeholder="847 2931 0562"
            onChange={(event) => {
              setValue(event.target.value);
              setError("");
            }}
          />
        </label>
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={code.length < 9}>Join</button>
        </div>
      </form>
    </Modal>
  );
}

function ScheduleModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [when, setWhen] = useState(defaultScheduleValue);
  const [duration, setDuration] = useState(30);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <Modal title="Schedule Meeting" onClose={onClose} wide>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setSaving(true);
          setError("");
          void scheduleMeeting({
            title,
            description,
            scheduledAt: new Date(when).toISOString(),
            durationMinutes: duration,
          })
            .then(() => onCreated())
            .catch((err: Error) => {
              setError(err.message);
              setSaving(false);
            });
        }}
      >
        <label className="field">
          <span>Topic</span>
          <input value={title} maxLength={120} required autoFocus onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea rows={3} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Date and time</span>
            <input type="datetime-local" required value={when} onChange={(event) => setWhen(event.target.value)} />
          </label>
          <label className="field">
            <span>Duration</span>
            <select value={duration} onChange={(event) => setDuration(Number(event.target.value))}>
              {[15, 30, 45, 60, 90, 120].map((minutes) => (
                <option key={minutes} value={minutes}>{minutes} min</option>
              ))}
            </select>
          </label>
        </div>
        <p className="help">A meeting ID and invite link are created when you save. It shows up under Upcoming meetings.</p>
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving || !title.trim()}>Save</button>
        </div>
      </form>
    </Modal>
  );
}
