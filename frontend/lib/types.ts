export type Role = "host" | "participant";

export type Meeting = {
  id: number;
  code: string;
  codeDisplay: string;
  title: string;
  description: string;
  meetingType: "instant" | "scheduled" | "personal" | string;
  status: "ready" | "scheduled" | "live" | "ended" | "cancelled" | string;
  scheduledAt: string | null;
  durationMinutes: number;
  startedAt: string | null;
  endedAt: string | null;
  locked: boolean;
  hostName: string;
};

export type HistoryItem = {
  id: number;
  code: string;
  codeDisplay: string;
  title: string;
  hostName: string;
  meetingType: string;
  startedAt: string | null;
  endedAt: string | null;
  participantCount: number;
};

export type User = {
  id: number;
  name: string;
  email: string;
  personalMeetingCode: string;
  personalMeetingCodeDisplay: string;
  personalMeetingStatus: string;
  personalMeetingTitle: string;
};

export type JoinResult = {
  meeting: Meeting;
  participantId: number;
  displayName: string;
  role: Role;
  token: string;
};

export type ChatMessage = {
  id: number;
  senderName: string;
  body: string;
  sentAt: string;
};

export type Session = {
  token: string;
  participantId: number;
  displayName: string;
  role: Role;
  code: string;
};

export type Settings = {
  mirror: boolean;
  joinMuted: boolean;
  joinVideoOff: boolean;
  displayName: string;
};
