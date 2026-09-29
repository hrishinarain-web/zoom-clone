import type { Settings } from "./types";

const KEY = "zoom-settings";

export const defaultSettings: Settings = {
  mirror: true,
  joinMuted: false,
  joinVideoOff: false,
  displayName: "",
};

export function loadSettings(): Settings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: Settings) {
  localStorage.setItem(KEY, JSON.stringify(settings));
}
