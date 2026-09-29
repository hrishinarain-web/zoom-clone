"use client";

import { useEffect, useState } from "react";

let sharedCtx: AudioContext | null = null;
function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  sharedCtx ??= new Ctor();
  if (sharedCtx.state === "suspended") sharedCtx.resume().catch(() => {});
  return sharedCtx;
}

/** Voice-activity detection for the active-speaker highlight. */
export function useSpeaking(stream: MediaStream | null, enabled: boolean, threshold = 0.035): boolean {
  const [speaking, setSpeaking] = useState(false);
  const track = stream?.getAudioTracks()[0];

  useEffect(() => {
    if (!enabled || !track) {
      setSpeaking(false);
      return;
    }
    const ac = ctx();
    if (!ac) return;
    let source: MediaStreamAudioSourceNode;
    try {
      source = ac.createMediaStreamSource(new MediaStream([track]));
    } catch {
      return;
    }
    const analyser = ac.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    let hold = 0;
    const timer = setInterval(() => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      const rms = Math.sqrt(sum / buf.length);
      if (rms > threshold) hold = 4; // keep highlight ~600ms after speech
      else hold = Math.max(0, hold - 1);
      setSpeaking(hold > 0);
    }, 150);
    return () => {
      clearInterval(timer);
      source.disconnect();
    };
  }, [track, enabled, threshold]);

  return speaking;
}
