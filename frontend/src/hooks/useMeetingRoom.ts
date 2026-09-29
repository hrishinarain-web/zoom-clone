"use client";

/**
 * Meeting room engine: WebSocket signaling + WebRTC full-mesh media.
 *
 * - The *newcomer* sends offers to everyone already in the room (from the `welcome`
 *   snapshot); existing members answer. Only one side ever offers, so no glare.
 * - Every connection is created with exactly one audio + one video transceiver.
 *   Turning the camera on/off or screen sharing just swaps the track with
 *   `replaceTrack`, so no SDP renegotiation is needed after the initial handshake.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { WS_URL, api } from "@/lib/api";
import type { ChatMessage, PeerState } from "@/lib/types";

export type ExitReason = "left" | "ended" | "removed" | "error";

export interface RemotePeer extends PeerState {
  stream: MediaStream;
  connection: RTCPeerConnectionState | "new";
}

export interface Reaction {
  id: number;
  participantId: number;
  emoji: string;
}

interface Options {
  code: string;
  token: string;
  self: PeerState;
  initialStream: MediaStream | null;
  initialAudio: boolean;
  initialVideo: boolean;
  onExit: (reason: ExitReason, detail?: string) => void;
  notify: (text: string) => void;
}

function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
  const turn = process.env.NEXT_PUBLIC_TURN_URL;
  if (turn) {
    servers.push({
      urls: turn.split(","),
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
    });
  }
  return servers;
}

interface PeerConn {
  pc: RTCPeerConnection;
  stream: MediaStream;
  pending: RTCIceCandidateInit[];
}

export function useMeetingRoom(opts: Options) {
  const { code, token, self } = opts;
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // ---- local media ----
  const audioTrack = useRef<MediaStreamTrack | null>(opts.initialStream?.getAudioTracks()[0] ?? null);
  const cameraTrack = useRef<MediaStreamTrack | null>(opts.initialStream?.getVideoTracks()[0] ?? null);
  const screenTrack = useRef<MediaStreamTrack | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream>(() => new MediaStream());
  const [audioOn, setAudioOn] = useState(opts.initialAudio && !!audioTrack.current);
  const [videoOn, setVideoOn] = useState(opts.initialVideo && !!cameraTrack.current);
  const [sharing, setSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);

  // ---- remote state ----
  const [peers, setPeers] = useState<Record<number, RemotePeer>>({});
  const conns = useRef(new Map<number, PeerConn>());
  const ws = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [muteOnEntry, setMuteOnEntry] = useState(false);
  const exited = useRef(false);

  const audioOnRef = useRef(audioOn);
  const videoOnRef = useRef(videoOn);
  audioOnRef.current = audioOn;
  videoOnRef.current = videoOn;

  const send = useCallback((msg: object) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(msg));
  }, []);

  const refreshLocalStream = useCallback(() => {
    const tracks = [audioTrack.current, cameraTrack.current].filter(Boolean) as MediaStreamTrack[];
    setLocalStream(new MediaStream(tracks));
  }, []);

  /** Video we send to peers: the screen while sharing, otherwise the camera if on. */
  const outgoingVideo = () => screenTrack.current ?? (videoOnRef.current ? cameraTrack.current : null);

  const replaceOutgoing = useCallback(async (kind: "audio" | "video", track: MediaStreamTrack | null) => {
    for (const { pc } of conns.current.values()) {
      const tx = pc.getTransceivers().find((t) => t.receiver.track?.kind === kind);
      if (tx) await tx.sender.replaceTrack(track).catch(() => {});
    }
  }, []);

  const upsertPeer = useCallback((p: PeerState) => {
    setPeers((prev) => {
      const existing = prev[p.participant_id];
      const stream = existing?.stream ?? conns.current.get(p.participant_id)?.stream ?? new MediaStream();
      return { ...prev, [p.participant_id]: { ...p, stream, connection: existing?.connection ?? "new" } };
    });
  }, []);

  const dropPeer = useCallback((pid: number) => {
    conns.current.get(pid)?.pc.close();
    conns.current.delete(pid);
    setPeers((prev) => {
      const next = { ...prev };
      delete next[pid];
      return next;
    });
  }, []);

  // ---- WebRTC ----
  const createConn = useCallback(
    (pid: number, initiator: boolean): PeerConn => {
      const pc = new RTCPeerConnection({ iceServers: iceServers() });
      const entry: PeerConn = { pc, stream: new MediaStream(), pending: [] };
      conns.current.set(pid, entry);

      pc.ontrack = (e) => {
        // New MediaStream object each time so <video> elements re-bind srcObject.
        if (entry.stream.getTracks().includes(e.track)) return;
        entry.stream = new MediaStream([...entry.stream.getTracks(), e.track]);
        const s = entry.stream;
        setPeers((prev) => (prev[pid] ? { ...prev, [pid]: { ...prev[pid], stream: s } } : prev));
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) send({ type: "signal", to: pid, data: { candidate: e.candidate.toJSON() } });
      };
      pc.onconnectionstatechange = () => {
        setPeers((prev) => (prev[pid] ? { ...prev, [pid]: { ...prev[pid], connection: pc.connectionState } } : prev));
        if (pc.connectionState === "failed" && initiator) {
          pc.restartIce();
          pc.createOffer({ iceRestart: true })
            .then((o) => pc.setLocalDescription(o))
            .then(() => send({ type: "signal", to: pid, data: { sdp: pc.localDescription } }))
            .catch(() => {});
        }
      };
      setPeers((prev) => (prev[pid] ? { ...prev, [pid]: { ...prev[pid], stream: entry.stream } } : prev));

      if (initiator) {
        pc.addTransceiver(audioTrack.current ?? "audio", { direction: "sendrecv" });
        pc.addTransceiver(outgoingVideo() ?? "video", { direction: "sendrecv" });
        (async () => {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          send({ type: "signal", to: pid, data: { sdp: pc.localDescription } });
        })().catch((err) => console.error("offer failed", err));
      }
      return entry;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [send],
  );

  const handleSignal = useCallback(
    async (from: number, data: { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }) => {
      const entry = conns.current.get(from) ?? createConn(from, false);
      const { pc } = entry;
      try {
        if (data.sdp) {
          await pc.setRemoteDescription(data.sdp);
          if (data.sdp.type === "offer") {
            for (const tx of pc.getTransceivers()) {
              const kind = tx.receiver.track?.kind;
              tx.direction = "sendrecv";
              await tx.sender.replaceTrack(kind === "audio" ? audioTrack.current : outgoingVideo());
            }
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            send({ type: "signal", to: from, data: { sdp: pc.localDescription } });
          }
          for (const c of entry.pending.splice(0)) await pc.addIceCandidate(c).catch(() => {});
        } else if (data.candidate) {
          if (pc.remoteDescription) await pc.addIceCandidate(data.candidate).catch(() => {});
          else entry.pending.push(data.candidate);
        }
      } catch (err) {
        console.error("signal handling failed", err);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [createConn, send],
  );

  // ---- cleanup ----
  const teardown = useCallback(() => {
    for (const { pc } of conns.current.values()) pc.close();
    conns.current.clear();
    [audioTrack.current, cameraTrack.current, screenTrack.current].forEach((t) => t?.stop());
    const sock = ws.current;
    ws.current = null;
    if (sock && sock.readyState <= WebSocket.OPEN) sock.close();
  }, []);

  const exit = useCallback(
    (reason: ExitReason, detail?: string) => {
      if (exited.current) return;
      exited.current = true;
      teardown();
      optsRef.current.onExit(reason, detail);
    },
    [teardown],
  );

  // ---- socket lifecycle ----
  useEffect(() => {
    if (audioTrack.current) audioTrack.current.enabled = audioOnRef.current;
    if (cameraTrack.current && !videoOnRef.current) {
      cameraTrack.current.stop();
      cameraTrack.current = null;
    }
    refreshLocalStream();

    const sock = new WebSocket(`${WS_URL}/ws/meetings/${code}?token=${encodeURIComponent(token)}`);
    ws.current = sock;

    sock.onopen = () => {
      setConnected(true);
      send({ type: "media", audio: audioOnRef.current, video: videoOnRef.current });
    };

    sock.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      switch (msg.type) {
        case "welcome": {
          setMuteOnEntry(!!msg.mute_on_entry);
          if (msg.mute_on_entry && self.role !== "host" && audioTrack.current) {
            audioTrack.current.enabled = false;
            setAudioOn(false);
            send({ type: "media", audio: false, video: videoOnRef.current });
            optsRef.current.notify("You are muted. The host has enabled mute on entry.");
          }
          for (const p of msg.peers as PeerState[]) {
            upsertPeer(p);
            createConn(p.participant_id, true);
          }
          api.messages(code, token).then(setMessages).catch(() => {});
          break;
        }
        case "peer-joined":
          upsertPeer(msg.peer);
          optsRef.current.notify(`${msg.peer.display_name} joined the meeting`);
          break;
        case "peer-updated":
          upsertPeer(msg.peer);
          break;
        case "peer-left":
          setPeers((prev) => {
            const name = prev[msg.participant_id]?.display_name;
            if (name) optsRef.current.notify(`${name} left the meeting`);
            return prev;
          });
          dropPeer(msg.participant_id);
          break;
        case "signal":
          handleSignal(msg.from, msg.data);
          break;
        case "chat":
          setMessages((m) => (m.some((x) => x.id === msg.message.id) ? m : [...m, msg.message]));
          break;
        case "reaction": {
          const id = Date.now() + Math.random();
          setReactions((r) => [...r, { id, participantId: msg.from, emoji: msg.emoji }]);
          setTimeout(() => setReactions((r) => r.filter((x) => x.id !== id)), 3000);
          break;
        }
        case "force-mute":
          if (audioTrack.current) audioTrack.current.enabled = false;
          setAudioOn(false);
          send({ type: "media", audio: false, video: videoOnRef.current });
          optsRef.current.notify(`${msg.by} (host) muted you`);
          break;
        case "removed":
          exit("removed", `You have been removed from this meeting by the host.`);
          break;
        case "meeting-ended":
          exit("ended", "This meeting has been ended by host.");
          break;
        case "error":
          optsRef.current.notify(msg.detail);
          break;
      }
    };

    sock.onclose = (ev) => {
      setConnected(false);
      if (exited.current || ws.current !== sock) return;
      if (ev.code === 4403) exit("removed", "You have been removed from this meeting by the host.");
      else if (ev.code === 4401 || ev.code === 4410) exit("error", "Your meeting session is no longer valid. Please rejoin.");
      else exit("error", "You were disconnected from the meeting.");
    };

    const beforeUnload = () => sock.close();
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      exited.current = true;
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, token]);

  // ---- user actions ----
  const toggleAudio = useCallback(async () => {
    if (!audioTrack.current) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioTrack.current = s.getAudioTracks()[0];
        await replaceOutgoing("audio", audioTrack.current);
        refreshLocalStream();
      } catch {
        optsRef.current.notify("Microphone access was denied");
        return;
      }
      setAudioOn(true);
      send({ type: "media", audio: true, video: videoOnRef.current });
      return;
    }
    const next = !audioOnRef.current;
    audioTrack.current.enabled = next;
    setAudioOn(next);
    send({ type: "media", audio: next, video: videoOnRef.current });
  }, [refreshLocalStream, replaceOutgoing, send]);

  const toggleVideo = useCallback(async () => {
    if (videoOnRef.current) {
      cameraTrack.current?.stop();
      cameraTrack.current = null;
      videoOnRef.current = false;
      setVideoOn(false);
      if (!screenTrack.current) await replaceOutgoing("video", null);
      refreshLocalStream();
      send({ type: "media", audio: audioOnRef.current, video: false });
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
      cameraTrack.current = s.getVideoTracks()[0];
    } catch {
      optsRef.current.notify("Camera access was denied or no camera found");
      return;
    }
    videoOnRef.current = true;
    setVideoOn(true);
    if (!screenTrack.current) await replaceOutgoing("video", cameraTrack.current);
    refreshLocalStream();
    send({ type: "media", audio: audioOnRef.current, video: true });
  }, [refreshLocalStream, replaceOutgoing, send]);

  const stopShare = useCallback(async () => {
    screenTrack.current?.stop();
    screenTrack.current = null;
    setSharing(false);
    await replaceOutgoing("video", videoOnRef.current ? cameraTrack.current : null);
    send({ type: "screen", sharing: false });
  }, [replaceOutgoing, send]);

  const toggleShare = useCallback(async () => {
    if (screenTrack.current) return stopShare();
    if (!navigator.mediaDevices?.getDisplayMedia) {
      optsRef.current.notify("Screen sharing isn't supported on this device");
      return;
    }
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const track = s.getVideoTracks()[0];
      track.onended = () => stopShare();
      screenTrack.current = track;
      setSharing(true);
      await replaceOutgoing("video", track);
      send({ type: "screen", sharing: true });
    } catch {
      /* user cancelled the picker */
    }
  }, [replaceOutgoing, send, stopShare]);

  const toggleHand = useCallback(() => {
    setHandRaised((v) => {
      send({ type: "hand", raised: !v });
      return !v;
    });
  }, [send]);

  const react = useCallback(
    (emoji: string) => send({ type: "reaction", emoji }),
    [send],
  );
  const sendChat = useCallback((content: string) => send({ type: "chat", content }), [send]);
  const muteAll = useCallback(() => send({ type: "mute-all" }), [send]);
  const muteOne = useCallback((pid: number) => send({ type: "mute", target: pid }), [send]);
  const removeOne = useCallback((pid: number) => send({ type: "remove", target: pid }), [send]);
  const endForAll = useCallback(() => {
    // WebSocket.close() flushes queued frames first, so the server still receives "end".
    send({ type: "end" });
    exit("left");
  }, [exit, send]);
  const leave = useCallback(() => exit("left"), [exit]);

  return {
    connected,
    localStream,
    audioOn,
    videoOn,
    sharing,
    handRaised,
    peers: Object.values(peers),
    messages,
    reactions,
    muteOnEntry,
    actions: { toggleAudio, toggleVideo, toggleShare, toggleHand, react, sendChat, muteAll, muteOne, removeOne, endForAll, leave },
  };
}
