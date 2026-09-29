/** Display "8123456789" as "812 345 6789" (10 digits) or "812 3456 7890" (11 digits), like Zoom. */
export function formatMeetingId(code: string): string {
  const d = code.replace(/\D/g, "");
  if (d.length === 10) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  if (d.length === 11) return `${d.slice(0, 3)} ${d.slice(3, 7)} ${d.slice(7)}`;
  return d;
}

/** Extract a meeting ID and optional passcode from user input (ID or invite link). */
export function parseJoinInput(input: string): { code: string; pwd?: string } {
  const raw = input.trim();
  const m = raw.match(/\/j\/(\d{9,11})(?:\?.*?pwd=([^&#\s]+))?/);
  if (m) return { code: m[1], pwd: m[2] ? decodeURIComponent(m[2]) : undefined };
  return { code: raw.replace(/\D/g, "") };
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Today";
  if (same(d, tomorrow)) return "Tomorrow";
  if (same(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export function formatRange(startIso: string, minutes: number): string {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + minutes * 60_000);
  const t = (x: Date) => x.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${t(start)} - ${t(end)}`;
}

export function formatDuration(startIso: string, endIso: string | null): string {
  if (!endIso) return "";
  const mins = Math.max(1, Math.round((+new Date(endIso) - +new Date(startIso)) / 60_000));
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} hr ${mins % 60 ? `${mins % 60} min` : ""}`.trim();
}

export function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

const PALETTE = ["#0B5CFF", "#7B61FF", "#E0457B", "#00A67E", "#F28C28", "#1C8BD6", "#9B51E0", "#D14343"];
export function colorFor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function isStartingSoon(startIso: string | null, minutes = 15): boolean {
  if (!startIso) return false;
  const diff = +new Date(startIso) - Date.now();
  return diff < minutes * 60_000;
}

export function buildInvitation(m: { title: string; meeting_code: string; passcode: string; join_url: string; scheduled_start: string | null; host: { name: string } }, forScheduled = true): string {
  const when = forScheduled && m.scheduled_start
    ? `\nTime: ${new Date(m.scheduled_start).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}\n`
    : "\n";
  return `${m.host.name} is inviting you to a scheduled Zoom meeting.\n\nTopic: ${m.title}${when}\nJoin Zoom Meeting\n${m.join_url}\n\nMeeting ID: ${formatMeetingId(m.meeting_code)}\nPasscode: ${m.passcode}\n`;
}
