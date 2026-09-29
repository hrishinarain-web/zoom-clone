"use client";

import { CheckCircle2, Copy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { buildInvitation } from "@/lib/format";
import type { Meeting } from "@/lib/types";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (m: Meeting) => void;
  editing?: Meeting | null;
  defaultTitle: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Next half hour from now, which is Zoom's default start time. */
function nextSlot(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60);
  return d;
}

export default function ScheduleModal({ open, onClose, onSaved, editing, defaultTitle }: Props) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [hours, setHours] = useState(0);
  const [mins, setMins] = useState(30);
  const [usePasscode, setUsePasscode] = useState(true);
  const [passcode, setPasscode] = useState("");
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [muteOnEntry, setMuteOnEntry] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Meeting | null>(null);

  const tz = useMemo(() => (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : ""), []);

  useEffect(() => {
    if (!open) return;
    setError("");
    setCreated(null);
    setBusy(false);
    if (editing) {
      const s = new Date(editing.scheduled_start || Date.now());
      setTitle(editing.title);
      setDescription(editing.description || "");
      setDate(toDateInput(s));
      setTime(toTimeInput(s));
      setHours(Math.floor(editing.duration_minutes / 60));
      setMins(editing.duration_minutes % 60);
    } else {
      const s = nextSlot();
      setTitle(defaultTitle);
      setDescription("");
      setDate(toDateInput(s));
      setTime(toTimeInput(s));
      setHours(0);
      setMins(30);
      setUsePasscode(true);
      setPasscode(Math.random().toString(36).slice(2, 8));
      setWaitingRoom(false);
      setMuteOnEntry(false);
    }
  }, [open, editing, defaultTitle]);

  const duration = hours * 60 + mins;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const start = new Date(`${date}T${time}`);
    if (isNaN(+start)) return setError("Please pick a valid date and time.");
    if (!editing && +start < Date.now() - 5 * 60_000) return setError("Start time must be in the future.");
    if (duration < 15) return setError("Duration must be at least 15 minutes.");
    if (!title.trim()) return setError("Topic is required.");
    if (usePasscode && !editing && !/^[A-Za-z0-9@*_-]{1,10}$/.test(passcode))
      return setError("Passcode: 1-10 characters (letters, numbers, @ * _ -).");

    setBusy(true);
    try {
      const body = {
        title: title.trim(),
        description: description.trim() || undefined,
        scheduled_start: start.toISOString(),
        duration_minutes: duration,
      };
      const m = editing
        ? await api.update(editing.meeting_code, body)
        : await api.schedule({
            ...body,
            passcode: usePasscode ? passcode : undefined,
            waiting_room: waitingRoom,
            mute_on_entry: muteOnEntry,
          });
      onSaved(m);
      if (editing) {
        toast("Meeting updated", "success");
        onClose();
      } else {
        setCreated(m);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    const invite = buildInvitation(created);
    return (
      <Modal open={open} onClose={onClose} title="Meeting scheduled"
        footer={
          <>
            <button className="btn-secondary" onClick={onClose}>Done</button>
            <button
              className="btn-primary"
              onClick={() => navigator.clipboard.writeText(invite).then(() => toast("Invitation copied", "success"))}
            >
              <Copy size={15} /> Copy invitation
            </button>
          </>
        }
      >
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={18} /> {created.title} has been added to your upcoming meetings.
        </div>
        <pre className="whitespace-pre-wrap rounded-lg bg-zoom-bg p-3 font-sans text-sm">{invite}</pre>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit meeting" : "Schedule meeting"} width="max-w-lg">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="s-title">Topic</label>
          <input id="s-title" className="input" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="s-desc">Description <span className="font-normal text-zoom-muted">(optional)</span></label>
          <textarea
            id="s-desc"
            className="input h-20 resize-none py-2"
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="s-date">Date</label>
            <input id="s-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="s-time">Time</label>
            <input id="s-time" type="time" className="input" value={time} step={300} onChange={(e) => setTime(e.target.value)} required />
          </div>
        </div>
        <div>
          <span className="label">Duration</span>
          <div className="flex items-center gap-2">
            <select className="input w-24" value={hours} onChange={(e) => setHours(+e.target.value)} aria-label="Hours">
              {Array.from({ length: 25 }, (_, i) => <option key={i} value={i}>{i}</option>)}
            </select>
            <span className="text-sm">hr</span>
            <select className="input w-24" value={mins} onChange={(e) => setMins(+e.target.value)} aria-label="Minutes">
              {[0, 15, 30, 45].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <span className="text-sm">min</span>
          </div>
        </div>
        <p className="text-xs text-zoom-muted">Time zone: {tz}</p>

        {!editing && (
          <div className="space-y-3 rounded-xl border border-zoom-border p-3">
            <div className="text-sm font-semibold">Security</div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={usePasscode} onChange={(e) => setUsePasscode(e.target.checked)} className="h-4 w-4 accent-zoom-blue" />
                Passcode
              </label>
              {usePasscode && (
                <input className="input h-8 w-32" value={passcode} maxLength={10} onChange={(e) => setPasscode(e.target.value)} aria-label="Passcode" />
              )}
            </div>
            <p className="text-xs text-zoom-muted">Only users who have the invite link or passcode can join the meeting.</p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={waitingRoom} onChange={(e) => setWaitingRoom(e.target.checked)} className="h-4 w-4 accent-zoom-blue" />
              Waiting Room
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={muteOnEntry} onChange={(e) => setMuteOnEntry(e.target.checked)} className="h-4 w-4 accent-zoom-blue" />
              Mute participants upon entry
            </label>
          </div>
        )}

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-zoom-red">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? "Saving..." : editing ? "Save" : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
}
