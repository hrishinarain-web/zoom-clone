import type { ChatMessage, HistoryItem, JoinResult, Meeting, Role, User } from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

type ApiMeeting = {
  id: number;
  code: string;
  code_display: string;
  title: string;
  description: string;
  meeting_type: string;
  status: string;
  scheduled_at: string | null;
  duration_minutes: number;
  started_at: string | null;
  ended_at: string | null;
  locked: boolean;
  host_name: string;
};

function mapMeeting(meeting: ApiMeeting): Meeting {
  return {
    id: meeting.id,
    code: meeting.code,
    codeDisplay: meeting.code_display,
    title: meeting.title,
    description: meeting.description,
    meetingType: meeting.meeting_type,
    status: meeting.status,
    scheduledAt: meeting.scheduled_at,
    durationMinutes: meeting.duration_minutes,
    startedAt: meeting.started_at,
    endedAt: meeting.ended_at,
    locked: meeting.locked,
    hostName: meeting.host_name,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers || {}),
      },
    });
  } catch {
    throw new Error("Can't reach the server. Start the backend on port 8000.");
  }
  if (!response.ok) {
    let detail = "Something went wrong.";
    try {
      const body = await response.json();
      if (typeof body.detail === "string") detail = body.detail;
      else if (Array.isArray(body.detail)) {
        detail = body.detail.map((item: { msg?: string }) => item.msg || "").filter(Boolean).join(" ");
      }
    } catch {
      /* response had no JSON body */
    }
    throw new Error(detail || "Something went wrong.");
  }
  return response.json();
}

function mapJoin(body: {
  meeting: ApiMeeting;
  participant_id: number;
  display_name: string;
  role: Role;
  token: string;
}): JoinResult {
  return {
    meeting: mapMeeting(body.meeting),
    participantId: body.participant_id,
    displayName: body.display_name,
    role: body.role,
    token: body.token,
  };
}

export function getMe() {
  return request<{
    id: number;
    name: string;
    email: string;
    personal_meeting_code: string;
    personal_meeting_code_display: string;
    personal_meeting_status: string;
    personal_meeting_title: string;
  }>("/api/me").then(
    (user): User => ({
      id: user.id,
      name: user.name,
      email: user.email,
      personalMeetingCode: user.personal_meeting_code,
      personalMeetingCodeDisplay: user.personal_meeting_code_display,
      personalMeetingStatus: user.personal_meeting_status,
      personalMeetingTitle: user.personal_meeting_title,
    }),
  );
}

export function getUpcoming() {
  return request<ApiMeeting[]>("/api/meetings/upcoming").then((rows) => rows.map(mapMeeting));
}

export function getRecent() {
  return request<
    {
      id: number;
      code: string;
      code_display: string;
      title: string;
      host_name: string;
      meeting_type: string;
      started_at: string | null;
      ended_at: string | null;
      participant_count: number;
    }[]
  >("/api/meetings/recent").then(
    (rows): HistoryItem[] =>
      rows.map((row) => ({
        id: row.id,
        code: row.code,
        codeDisplay: row.code_display,
        title: row.title,
        hostName: row.host_name,
        meetingType: row.meeting_type,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        participantCount: row.participant_count,
      })),
  );
}

export function getMeeting(code: string) {
  return request<ApiMeeting>(`/api/meetings/${code}`).then(mapMeeting);
}

export function createInstant(title?: string) {
  return request<Parameters<typeof mapJoin>[0]>("/api/meetings/instant", {
    method: "POST",
    body: JSON.stringify(title ? { title } : {}),
  }).then(mapJoin);
}

export function scheduleMeeting(input: {
  title: string;
  description: string;
  scheduledAt: string;
  durationMinutes: number;
}) {
  return request<ApiMeeting>("/api/meetings/schedule", {
    method: "POST",
    body: JSON.stringify({
      title: input.title,
      description: input.description,
      scheduled_at: input.scheduledAt,
      duration_minutes: input.durationMinutes,
    }),
  }).then(mapMeeting);
}

export function startMeeting(code: string) {
  return request<Parameters<typeof mapJoin>[0]>(`/api/meetings/${code}/start`, { method: "POST" }).then(mapJoin);
}

export function joinMeeting(code: string, displayName: string) {
  return request<Parameters<typeof mapJoin>[0]>(`/api/meetings/${code}/join`, {
    method: "POST",
    body: JSON.stringify({ display_name: displayName }),
  }).then(mapJoin);
}

function auth(token: string): HeadersInit {
  return { "X-Participant-Token": token };
}

export function leaveMeeting(code: string, token: string) {
  return request<{ ok: boolean }>(`/api/meetings/${code}/leave`, { method: "POST", headers: auth(token) });
}

export function endMeeting(code: string, token: string) {
  return request<ApiMeeting>(`/api/meetings/${code}/end`, { method: "POST", headers: auth(token) }).then(mapMeeting);
}

export function cancelMeeting(code: string) {
  return request<ApiMeeting>(`/api/meetings/${code}/cancel`, { method: "POST" }).then(mapMeeting);
}

export function setLocked(code: string, token: string, locked: boolean) {
  return request<ApiMeeting>(`/api/meetings/${code}/lock`, {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({ locked }),
  }).then(mapMeeting);
}

export function muteAll(code: string, token: string) {
  return request<{ ok: boolean }>(`/api/meetings/${code}/mute-all`, { method: "POST", headers: auth(token) });
}

export function removeParticipant(code: string, token: string, participantId: number) {
  return request<{ ok: boolean }>(`/api/meetings/${code}/participants/${participantId}/remove`, {
    method: "POST",
    headers: auth(token),
  });
}

export function getMessages(code: string) {
  return request<{ id: number; sender_name: string; body: string; sent_at: string }[]>(
    `/api/meetings/${code}/messages`,
  ).then(
    (rows): ChatMessage[] =>
      rows.map((row) => ({
        id: row.id,
        senderName: row.sender_name,
        body: row.body,
        sentAt: row.sent_at,
      })),
  );
}
