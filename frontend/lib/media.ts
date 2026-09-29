import type { Settings } from "./types";

export async function getLocalMedia(settings: Settings) {
  const stream = new MediaStream();
  const missing: string[] = [];
  try {
    const audio = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    audio.getTracks().forEach((track) => stream.addTrack(track));
  } catch {
    missing.push("microphone");
  }
  try {
    const video = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    video.getTracks().forEach((track) => stream.addTrack(track));
  } catch {
    missing.push("camera");
  }
  if (settings.joinMuted) stream.getAudioTracks().forEach((track) => (track.enabled = false));
  if (settings.joinVideoOff) stream.getVideoTracks().forEach((track) => (track.enabled = false));
  const warning = missing.length ? `No ${missing.join(" or ")} found. You can still join.` : "";
  return { stream, warning };
}

export function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}
