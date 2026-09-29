import type { ChatMessage, JoinResponse, Meeting, MeetingPublic, SchedulePayload, User } from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
export const WS_URL = API_URL.replace(/^http/, "ws");

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Unable to reach the server. Is the backend running?");
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = Array.isArray(body.detail)
      ? body.detail.map((d: { msg: string }) => d.msg.replace(/^Value error, /, "")).join(", ")
      : body.detail;
    throw new ApiError(res.status, detail || `Request failed (${res.status})`);
  }
  return body as T;
}

export const api = {
  me: () => request<User>("/api/users/me"),
  upcoming: () => request<Meeting[]>("/api/meetings/upcoming"),
  recent: () => request<Meeting[]>("/api/meetings/recent"),
  createInstant: (title?: string) =>
    request<Meeting>("/api/meetings/instant", { method: "POST", body: JSON.stringify({ title }) }),
  schedule: (p: SchedulePayload) =>
    request<Meeting>("/api/meetings/schedule", { method: "POST", body: JSON.stringify(p) }),
  get: (code: string) => request<Meeting>(`/api/meetings/${code}`),
  publicInfo: (code: string) => request<MeetingPublic>(`/api/meetings/${encodeURIComponent(code)}/public`),
  update: (code: string, p: Partial<SchedulePayload>) =>
    request<Meeting>(`/api/meetings/${code}`, { method: "PATCH", body: JSON.stringify(p) }),
  remove: (code: string) => request<void>(`/api/meetings/${code}`, { method: "DELETE" }),
  join: (code: string, body: { display_name: string; passcode?: string; as_host?: boolean }) =>
    request<JoinResponse>(`/api/meetings/${code}/join`, { method: "POST", body: JSON.stringify(body) }),
  messages: (code: string, token: string) =>
    request<ChatMessage[]>(`/api/meetings/${code}/messages?token=${encodeURIComponent(token)}`),
};
