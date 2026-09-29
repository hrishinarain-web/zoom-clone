export interface User {
  id: number;
  name: string;
  email: string;
  avatar_color: string;
  personal_meeting_id: string;
  timezone: string;
}

export interface Meeting {
  id: number;
  meeting_code: string;
  passcode: string;
  title: string;
  description: string | null;
  meeting_type: "instant" | "scheduled";
  status: "scheduled" | "live" | "ended";
  scheduled_start: string | null;
  duration_minutes: number;
  waiting_room: boolean;
  mute_on_entry: boolean;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  host: User;
  join_url: string;
  participant_count: number;
  active_participant_count: number;
}

export interface MeetingPublic {
  meeting_code: string;
  title: string;
  host_name: string;
  status: string;
  requires_passcode: boolean;
  scheduled_start: string | null;
}

export interface Participant {
  id: number;
  display_name: string;
  role: "host" | "participant";
  joined_at: string;
  left_at: string | null;
  user_id: number | null;
}

export interface JoinResponse {
  participant: Participant;
  session_token: string;
  meeting: Meeting;
}

export interface ChatMessage {
  id: number;
  participant_id: number;
  sender_name: string;
  content: string;
  sent_at: string;
}

/** Live presence state relayed over the WebSocket. */
export interface PeerState {
  participant_id: number;
  display_name: string;
  role: "host" | "participant";
  audio: boolean;
  video: boolean;
  hand_raised: boolean;
  screen_sharing: boolean;
}

export interface SchedulePayload {
  title: string;
  description?: string;
  scheduled_start: string;
  duration_minutes: number;
  passcode?: string;
  waiting_room?: boolean;
  mute_on_entry?: boolean;
}
