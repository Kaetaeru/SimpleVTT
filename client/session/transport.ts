/**
 * How session messages travel. One interface, several carriers: an in-process hub (tests and the host's own
 * mirror), BroadcastChannel (two tabs on one PC — the verification transport), and later the Tauri TCP host for
 * LAN/Hamachi (CAMPAIGN_RESOURCES.md §6). The host sees peers by transport id; `hello` maps them to users.
 */
export type PeerState = "connected" | "disconnected";

export interface Transport {
  /** This side's peer id as the other side sees it. */
  readonly peerId: string;
  /** Send to one peer, or to every connected peer with "*" (host side). */
  send(to: string, message: unknown): void;
  onMessage(handler: (from: string, message: unknown) => void): () => void;
  onPeer(handler: (peerId: string, state: PeerState) => void): () => void;
  close(): void;
}

const newPeerId = () => `peer_${Math.random().toString(36).slice(2, 10)}`;

class Emitter<T extends unknown[]> {
  private readonly handlers = new Set<(...args: T) => void>();
  on(handler: (...args: T) => void) { this.handlers.add(handler); return () => { this.handlers.delete(handler); }; }
  emit(...args: T) { for (const handler of [...this.handlers]) handler(...args); }
}

/** In-process hub: one host endpoint, any number of peers; delivery is asynchronous like a real socket. */
export class MemoryHub {
  private host: MemoryEndpoint | null = null;
  private readonly peers = new Map<string, MemoryEndpoint>();

  hostEndpoint(): Transport { const endpoint = new MemoryEndpoint(this, "host"); this.host = endpoint; return endpoint; }
  connect(peerId = newPeerId()): Transport {
    const endpoint = new MemoryEndpoint(this, peerId);
    this.peers.set(peerId, endpoint);
    queueMicrotask(() => { this.host?.peerEvents.emit(peerId, "connected"); if (this.host) endpoint.peerEvents.emit("host", "connected"); });
    return endpoint;
  }
  /** @internal */
  deliver(from: string, to: string, message: unknown) {
    const targets = from === "host" ? (to === "*" ? [...this.peers.values()] : [this.peers.get(to)].filter((endpoint): endpoint is MemoryEndpoint => Boolean(endpoint))) : [this.host].filter((endpoint): endpoint is MemoryEndpoint => Boolean(endpoint));
    for (const target of targets) queueMicrotask(() => target.messages.emit(from, structuredClone(message)));
  }
  /** @internal */
  drop(peerId: string) {
    if (peerId === "host") { this.host = null; for (const id of this.peers.keys()) this.peers.get(id)?.peerEvents.emit("host", "disconnected"); return; }
    this.peers.delete(peerId);
    queueMicrotask(() => this.host?.peerEvents.emit(peerId, "disconnected"));
  }
}

class MemoryEndpoint implements Transport {
  readonly messages = new Emitter<[string, unknown]>();
  readonly peerEvents = new Emitter<[string, PeerState]>();
  constructor(private readonly hub: MemoryHub, readonly peerId: string) {}
  send(to: string, message: unknown) { this.hub.deliver(this.peerId, to, message); }
  onMessage(handler: (from: string, message: unknown) => void) { return this.messages.on(handler); }
  onPeer(handler: (peerId: string, state: PeerState) => void) { return this.peerEvents.on(handler); }
  close() { this.hub.drop(this.peerId); }
}

interface ChannelFrame { from: string; to: string; kind: "msg" | "join" | "leave" | "ping" | "pong"; message?: unknown }

/**
 * BroadcastChannel carrier: every tab on the same origin that opens the same session id hears the channel; frames
 * are addressed by peer id and everyone else ignores them. The host answers `join` with `pong` so a peer knows the
 * host is alive; peers send `leave` when the tab closes.
 */
export class BroadcastChannelTransport implements Transport {
  readonly peerId: string;
  private readonly channel: BroadcastChannel;
  private readonly messages = new Emitter<[string, unknown]>();
  private readonly peerEvents = new Emitter<[string, PeerState]>();
  private readonly known = new Set<string>();
  private readonly onUnload = () => this.close();

  constructor(sessionId: string, private readonly role: "host" | "peer", peerId?: string) {
    this.peerId = role === "host" ? "host" : peerId ?? newPeerId();
    this.channel = new BroadcastChannel(`simplevtt-session-${sessionId}`);
    this.channel.onmessage = (event: MessageEvent<ChannelFrame>) => this.receive(event.data);
    if (role === "peer") this.post({ from: this.peerId, to: "host", kind: "join" });
    if (typeof window !== "undefined") window.addEventListener("beforeunload", this.onUnload);
  }

  static available() { return typeof BroadcastChannel !== "undefined"; }

  private post(frame: ChannelFrame) { this.channel.postMessage(frame); }

  private receive(frame: ChannelFrame) {
    if (!frame || frame.from === this.peerId) return;
    const forMe = frame.to === this.peerId || (this.role === "peer" && frame.to === "*") || (this.role === "host" && frame.to === "host");
    if (!forMe) return;
    if (this.role === "host") {
      if (frame.kind === "join" || frame.kind === "ping") { if (!this.known.has(frame.from)) { this.known.add(frame.from); this.peerEvents.emit(frame.from, "connected"); } this.post({ from: "host", to: frame.from, kind: "pong" }); return; }
      if (frame.kind === "leave") { if (this.known.delete(frame.from)) this.peerEvents.emit(frame.from, "disconnected"); return; }
    } else {
      if (frame.kind === "pong") { if (!this.known.has("host")) { this.known.add("host"); this.peerEvents.emit("host", "connected"); } return; }
      if (frame.kind === "leave") { if (this.known.delete("host")) this.peerEvents.emit("host", "disconnected"); return; }
    }
    if (frame.kind === "msg") this.messages.emit(frame.from, frame.message);
  }

  send(to: string, message: unknown) { this.post({ from: this.peerId, to: this.role === "peer" ? "host" : to, kind: "msg", message }); }
  onMessage(handler: (from: string, message: unknown) => void) { return this.messages.on(handler); }
  onPeer(handler: (peerId: string, state: PeerState) => void) { return this.peerEvents.on(handler); }
  close() {
    this.post({ from: this.peerId, to: this.role === "peer" ? "host" : "*", kind: "leave" });
    if (typeof window !== "undefined") window.removeEventListener("beforeunload", this.onUnload);
    this.channel.close();
  }
}
