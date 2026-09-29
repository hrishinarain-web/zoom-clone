import type { JoinResult, Session } from "./types";

function key(code: string) {
  return `zoom-session:${code}`;
}

export function saveSession(result: JoinResult) {
  const session: Session = {
    token: result.token,
    participantId: result.participantId,
    displayName: result.displayName,
    role: result.role,
    code: result.meeting.code,
  };
  sessionStorage.setItem(key(result.meeting.code), JSON.stringify(session));
}

export function loadSession(code: string): Session | null {
  const raw = sessionStorage.getItem(key(code));
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as Session;
    if (!session.token || session.code !== code) return null;
    return session;
  } catch {
    return null;
  }
}

export function clearSession(code: string) {
  sessionStorage.removeItem(key(code));
}
