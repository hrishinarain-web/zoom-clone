/**
 * Small wrapper over sessionStorage/localStorage for client-only hand-offs between pages
 * (e.g. "this tab is starting the meeting as host", remembered display name).
 * All access is guarded: storage can be unavailable (private mode, SSR).
 */
function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export const session = {
  markHost(code: string) {
    safe(() => sessionStorage.setItem(`zc:host:${code}`, "1"), undefined);
  },
  isHost(code: string): boolean {
    return safe(() => sessionStorage.getItem(`zc:host:${code}`) === "1", false);
  },
  setJoinPrefs(p: { name?: string; audio?: boolean; video?: boolean }) {
    safe(() => sessionStorage.setItem("zc:joinPrefs", JSON.stringify(p)), undefined);
  },
  takeJoinPrefs(): { name?: string; audio?: boolean; video?: boolean } | null {
    return safe(() => {
      const raw = sessionStorage.getItem("zc:joinPrefs");
      sessionStorage.removeItem("zc:joinPrefs");
      return raw ? JSON.parse(raw) : null;
    }, null);
  },
  get displayName(): string {
    return safe(() => localStorage.getItem("zc:name") || "", "");
  },
  set displayName(v: string) {
    safe(() => localStorage.setItem("zc:name", v), undefined);
  },
};
