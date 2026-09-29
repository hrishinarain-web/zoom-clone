import type { Meeting } from "./types";

export function formatMeetingId(code: string) {
  const digits = code.replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  if (digits.length === 9) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  return code;
}

export function parseMeetingInput(value: string) {
  const fromLink = value.match(/\/j\/(\d{9,11})/);
  if (fromLink) return fromLink[1];
  return value.replace(/\D/g, "").slice(0, 11);
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

const PALETTE = ["#0e72ed", "#1d4ed8", "#ea580c", "#059669", "#7c3aed", "#db2777", "#0f766e"];

export function colorFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, tomorrow)) return "Tomorrow";
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export function formatRange(startIso: string | null, durationMinutes: number) {
  if (!startIso) return "Now";
  const start = new Date(startIso);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const time = (date: Date) => date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${time(start)} – ${time(end)}`;
}

export function formatHistoryWhen(startIso: string | null, endIso: string | null) {
  if (!startIso) return "";
  const start = new Date(startIso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const date = sameDay(start, today) ? "Today" : sameDay(start, yesterday) ? "Yesterday" : start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (!endIso) return `${date}, ${time}`;
  const minutes = Math.max(1, Math.round((new Date(endIso).getTime() - start.getTime()) / 60000));
  return `${date}, ${time} · ${minutes} min`;
}

export function formatElapsed(startIso: string) {
  const total = Math.max(0, Math.floor((Date.now() - new Date(startIso).getTime()) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export function inviteText(meeting: Meeting) {
  const when = meeting.scheduledAt
    ? new Date(meeting.scheduledAt).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Now";
  const link = `${window.location.origin}/j/${meeting.code}`;
  return `${meeting.hostName} is inviting you to a Zoom Meeting.

Topic: ${meeting.title}
Time: ${when}

Join Zoom Meeting
${link}

Meeting ID: ${meeting.codeDisplay}`;
}

export function inviteLink(code: string) {
  return `${window.location.origin}/j/${code}`;
}

export async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

export function groupUpcoming(meetings: Meeting[]) {
  const groups: { label: string; items: Meeting[] }[] = [];
  const live = meetings.filter((meeting) => meeting.status === "live");
  if (live.length) groups.push({ label: "In progress", items: live });
  const buckets = new Map<string, Meeting[]>();
  for (const meeting of meetings) {
    if (meeting.status !== "scheduled") continue;
    const label = meeting.scheduledAt ? dayLabel(meeting.scheduledAt) : "Scheduled";
    const items = buckets.get(label) ?? [];
    items.push(meeting);
    buckets.set(label, items);
  }
  for (const [label, items] of buckets) groups.push({ label, items });
  return groups;
}

export function defaultScheduleValue() {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 1);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
