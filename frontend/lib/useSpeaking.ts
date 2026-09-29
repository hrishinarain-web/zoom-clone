"use client";

import { useEffect, useRef, useState } from "react";

export function useSpeaking(stream: MediaStream | null, enabled: boolean) {
  const [speaking, setSpeaking] = useState(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!stream || !enabled) {
      setSpeaking(false);
      return;
    }
    const track = stream.getAudioTracks()[0];
    if (!track) return;
    const context = new AudioContext();
    const source = context.createMediaStreamSource(new MediaStream([track]));
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let current = false;
    const timer = window.setInterval(() => {
      if (!enabledRef.current || !track.enabled) {
        if (current) {
          current = false;
          setSpeaking(false);
        }
        return;
      }
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (const value of data) sum += value;
      const next = sum / data.length > 14;
      if (next !== current) {
        current = next;
        setSpeaking(next);
      }
    }, 200);
    return () => {
      window.clearInterval(timer);
      source.disconnect();
      void context.close();
    };
  }, [stream, enabled]);

  return speaking;
}
