import type { ChatMessage } from "./types";

export type RemotePeer = {
  id: number;
  name: string;
  role: "host" | "participant";
  audio: boolean;
  video: boolean;
  sharing: boolean;
  stream: MediaStream | null;
};

type Handlers = {
  onReady: (self: { id: number; name: string; role: string }) => void;
  onPeers: (peers: RemotePeer[]) => void;
  onPreview: (stream: MediaStream) => void;
  onChat: (message: ChatMessage) => void;
  onReaction: (id: number, emoji: string) => void;
  onLocked: (locked: boolean) => void;
  onForceMute: () => void;
  onRemoved: () => void;
  onEnded: () => void;
  onError: (message: string) => void;
  onDisconnected: () => void;
  onSharing: (sharing: boolean) => void;
};

const ICE: RTCConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

export class MeetingConnection {
  private ws: WebSocket | null = null;
  private peers = new Map<number, RemotePeer>();
  private pcs = new Map<number, RTCPeerConnection>();
  private videoSenders = new Map<number, RTCRtpSender>();
  private audioSenders = new Map<number, RTCRtpSender>();
  private iceQueue = new Map<number, RTCIceCandidateInit[]>();
  private chain: Promise<void> = Promise.resolve();
  private closed = false;
  private ended = false;
  private audioTrack: MediaStreamTrack | null;
  private cameraTrack: MediaStreamTrack | null;
  private screenTrack: MediaStreamTrack | null = null;
  sharing = false;

  constructor(
    private code: string,
    private token: string,
    local: MediaStream,
    private handlers: Handlers,
  ) {
    this.audioTrack = local.getAudioTracks()[0] ?? null;
    this.cameraTrack = local.getVideoTracks()[0] ?? null;
    this.publishPreview();
  }

  get audioEnabled() {
    return Boolean(this.audioTrack?.enabled);
  }

  get videoEnabled() {
    return Boolean(this.cameraTrack?.enabled);
  }

  get hasAudio() {
    return Boolean(this.audioTrack);
  }

  get hasVideo() {
    return Boolean(this.cameraTrack);
  }

  async connect(wsBase: string) {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`${wsBase}/ws/${this.code}?token=${encodeURIComponent(this.token)}`);
      this.ws = ws;
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("Could not connect to the meeting."));
      ws.onmessage = (event) => {
        this.chain = this.chain.then(() => this.onMessage(event)).catch(() => undefined);
      };
      ws.onclose = () => {
        if (!this.closed && !this.ended) this.handlers.onDisconnected();
      };
    });
    if (this.closed) {
      this.ws?.close();
      return;
    }
    this.sendMedia();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    if (this.screenTrack) {
      this.screenTrack.onended = null;
      this.screenTrack.stop();
    }
    this.audioTrack?.stop();
    this.cameraTrack?.stop();
    this.pcs.forEach((pc) => pc.close());
    this.pcs.clear();
    this.ws?.close();
  }

  setAudioEnabled(on: boolean) {
    if (this.audioTrack) this.audioTrack.enabled = on;
    this.sendMedia();
  }

  setVideoEnabled(on: boolean) {
    if (!this.cameraTrack || this.sharing) return;
    this.cameraTrack.enabled = on;
    this.publishPreview();
    this.sendMedia();
  }

  async shareScreen() {
    const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const track = display.getVideoTracks()[0];
    if (!track) return;
    if (this.screenTrack) {
      this.screenTrack.onended = null;
      this.screenTrack.stop();
    }
    this.screenTrack = track;
    this.sharing = true;
    this.handlers.onSharing(true);
    track.onended = () => {
      void this.stopShare();
    };
    this.publishPreview();
    await this.replaceVideo(track);
    this.sendMedia();
  }

  async stopShare() {
    if (!this.screenTrack && !this.sharing) return;
    const track = this.screenTrack;
    this.screenTrack = null;
    this.sharing = false;
    if (track) {
      track.onended = null;
      track.stop();
    }
    this.handlers.onSharing(false);
    if (this.cameraTrack) await this.replaceVideo(this.cameraTrack);
    this.publishPreview();
    this.sendMedia();
  }

  sendChat(text: string) {
    this.send({ type: "chat", text });
  }

  sendReaction(emoji: string) {
    this.send({ type: "reaction", emoji });
  }

  private currentVideo() {
    if (this.sharing && this.screenTrack) return this.screenTrack;
    return this.cameraTrack;
  }

  private publishPreview() {
    const stream = new MediaStream();
    if (this.audioTrack) stream.addTrack(this.audioTrack);
    const video = this.currentVideo();
    if (video) stream.addTrack(video);
    this.handlers.onPreview(stream);
  }

  private sendMedia() {
    const videoOn = this.sharing || Boolean(this.cameraTrack?.enabled);
    this.send({
      type: "media",
      audio: Boolean(this.audioTrack?.enabled),
      video: videoOn,
      sharing: this.sharing,
    });
  }

  private send(data: object) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(data));
  }

  private async replaceVideo(track: MediaStreamTrack) {
    await Promise.all([...this.videoSenders.values()].map((sender) => sender.replaceTrack(track)));
  }

  private emit() {
    this.handlers.onPeers([...this.peers.values()]);
  }

  private async onMessage(event: MessageEvent) {
    const message = JSON.parse(String(event.data)) as Record<string, unknown>;
    const type = message.type;
    if (type === "welcome") {
      const self = message.self as { id: number; name: string; role: string };
      this.handlers.onReady(self);
      this.handlers.onLocked(Boolean(message.locked));
      const peers = (message.peers as Omit<RemotePeer, "stream">[]) || [];
      this.peers = new Map(peers.map((peer) => [peer.id, { ...peer, stream: null }]));
      this.emit();
      return;
    }
    if (type === "peer-joined") {
      const peer = message.peer as Omit<RemotePeer, "stream">;
      const existing = this.peers.get(peer.id);
      this.peers.set(peer.id, { ...peer, stream: existing?.stream ?? null });
      this.emit();
      await this.offerTo(peer.id);
      return;
    }
    if (type === "peer-left") {
      this.removePeer(Number(message.id));
      return;
    }
    if (type === "offer") {
      await this.answer(Number(message.from), String(message.sdp || ""));
      return;
    }
    if (type === "answer") {
      const id = Number(message.from);
      const pc = this.pcs.get(id);
      if (!pc || pc.signalingState !== "have-local-offer") return;
      await pc.setRemoteDescription({ type: "answer", sdp: String(message.sdp || "") });
      await this.flushIce(id);
      return;
    }
    if (type === "ice") {
      await this.addIce(Number(message.from), (message.candidate as RTCIceCandidateInit) || null);
      return;
    }
    if (type === "media") {
      const peer = this.peers.get(Number(message.id));
      if (!peer) return;
      peer.audio = Boolean(message.audio);
      peer.video = Boolean(message.video);
      peer.sharing = Boolean(message.sharing);
      this.emit();
      return;
    }
    if (type === "chat") {
      this.handlers.onChat({
        id: Number(message.id),
        senderName: String(message.senderName || "Someone"),
        body: String(message.body || ""),
        sentAt: String(message.sentAt || new Date().toISOString()),
      });
      return;
    }
    if (type === "reaction") {
      this.handlers.onReaction(Number(message.id), String(message.emoji || ""));
      return;
    }
    if (type === "lock") {
      this.handlers.onLocked(Boolean(message.locked));
      return;
    }
    if (type === "force-mute") {
      if (this.audioTrack) this.audioTrack.enabled = false;
      this.sendMedia();
      this.handlers.onForceMute();
      return;
    }
    if (type === "removed") {
      this.ended = true;
      this.handlers.onRemoved();
      return;
    }
    if (type === "ended") {
      this.ended = true;
      this.handlers.onEnded();
      return;
    }
    if (type === "error") {
      this.handlers.onError(String(message.message || "Unable to join this meeting."));
    }
  }

  private removePeer(id: number) {
    this.pcs.get(id)?.close();
    this.pcs.delete(id);
    this.videoSenders.delete(id);
    this.audioSenders.delete(id);
    this.iceQueue.delete(id);
    this.peers.delete(id);
    this.emit();
  }

  private attach(pc: RTCPeerConnection, id: number) {
    const peer = this.peers.get(id);
    const stream = peer?.stream ?? new MediaStream();
    if (peer) peer.stream = stream;
    pc.ontrack = (event) => {
      const current = this.peers.get(id);
      if (!current) return;
      const target = current.stream ?? stream;
      if (!target.getTracks().includes(event.track)) target.addTrack(event.track);
      current.stream = target;
      this.emit();
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) this.send({ type: "ice", target: id, candidate: event.candidate.toJSON() });
    };
  }

  private async offerTo(id: number) {
    if (this.pcs.has(id) || this.closed) return;
    const pc = new RTCPeerConnection(ICE);
    this.pcs.set(id, pc);
    this.attach(pc, id);
    const audioTx = pc.addTransceiver("audio", { direction: "sendrecv" });
    const videoTx = pc.addTransceiver("video", { direction: "sendrecv" });
    this.audioSenders.set(id, audioTx.sender);
    this.videoSenders.set(id, videoTx.sender);
    if (this.audioTrack) await audioTx.sender.replaceTrack(this.audioTrack);
    const video = this.currentVideo();
    if (video) await videoTx.sender.replaceTrack(video);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.send({ type: "offer", target: id, sdp: offer.sdp });
  }

  private async answer(id: number, sdp: string) {
    if (!sdp) return;
    let pc = this.pcs.get(id);
    if (!pc) {
      pc = new RTCPeerConnection(ICE);
      this.pcs.set(id, pc);
      if (!this.peers.has(id)) {
        this.peers.set(id, {
          id,
          name: "Participant",
          role: "participant",
          audio: true,
          video: true,
          sharing: false,
          stream: null,
        });
      }
      this.attach(pc, id);
    } else if (pc.signalingState === "have-local-offer") {
      await pc.setLocalDescription({ type: "rollback" });
    }
    await pc.setRemoteDescription({ type: "offer", sdp });
    for (const transceiver of pc.getTransceivers()) {
      const kind = transceiver.receiver.track?.kind;
      if (kind === "audio") {
        this.audioSenders.set(id, transceiver.sender);
        if (this.audioTrack) await transceiver.sender.replaceTrack(this.audioTrack);
      }
      if (kind === "video") {
        this.videoSenders.set(id, transceiver.sender);
        const video = this.currentVideo();
        if (video) await transceiver.sender.replaceTrack(video);
      }
    }
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await this.flushIce(id);
    this.send({ type: "answer", target: id, sdp: answer.sdp });
    this.emit();
  }

  private async addIce(id: number, candidate: RTCIceCandidateInit | null) {
    if (!candidate) return;
    const pc = this.pcs.get(id);
    if (!pc || !pc.remoteDescription) {
      const queued = this.iceQueue.get(id) ?? [];
      queued.push(candidate);
      this.iceQueue.set(id, queued);
      return;
    }
    try {
      await pc.addIceCandidate(candidate);
    } catch {
      /* a late candidate can arrive after the peer leaves */
    }
  }

  private async flushIce(id: number) {
    const pc = this.pcs.get(id);
    const queued = this.iceQueue.get(id) ?? [];
    this.iceQueue.set(id, []);
    if (!pc) return;
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        /* ignore candidates that no longer apply */
      }
    }
  }
}
