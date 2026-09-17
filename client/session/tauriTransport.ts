/**
 * LAN / Hamachi carrier (CAMPAIGN_RESOURCES.md §6): the Tauri shell's Rust TCP transport, one JSON object per
 * newline-delimited frame. The host binds every interface; a player connects to `host:port` from the invite code.
 * Peer ids on the host side are what Rust reports (socket addresses); on the player side everything is "host".
 */
import type { PeerState, Transport } from "./transport";

interface TauriStatus { role: "host" | "client" | null; state: string; address: string; peerCount: number }
interface TauriMessage { peer: string; message: string }
interface TauriPeerLifecycle { peer: string; state: "connected" | "disconnected" }

type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
type Listen = <T>(event: string, handler: (event: { payload: T }) => void) => Promise<() => void>;

export const DEFAULT_SESSION_PORT = 41230;

export function tauriAvailable() { return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window; }

async function api(): Promise<{ invoke: Invoke; listen: Listen }> {
  const core = await import("@tauri-apps/api/core");
  const event = await import("@tauri-apps/api/event");
  return { invoke: core.invoke as Invoke, listen: event.listen as unknown as Listen };
}

/** IPv4 addresses players can use to reach this PC (LAN adapter, Hamachi 25.x.x.x). */
export async function listSessionAddresses(): Promise<string[]> {
  if (!tauriAvailable()) return [];
  const { invoke } = await api();
  try { return await invoke<string[]>("list_session_addresses"); } catch { return []; }
}

export class TauriTcpTransport implements Transport {
  readonly peerId: string;
  private readonly messageHandlers = new Set<(from: string, message: unknown) => void>();
  private readonly peerHandlers = new Set<(peerId: string, state: PeerState) => void>();
  private readonly unlisten: Array<() => void> = [];
  private closed = false;
  /**
   * R71 (D206): the socket is open. `connect()` used to announce "connected" in a microtask queued before it returned,
   * and that microtask ran before the caller's `await` resumed and built the TableClient — so nobody was listening,
   * hello was never sent, and a player sat on "호스트에 연결하는 중…" forever. The state is kept instead, and whoever
   * subscribes afterwards is told.
   */
  private connected = false;

  private constructor(private readonly role: "host" | "peer", private readonly invoke: Invoke) {
    this.peerId = role === "host" ? "host" : `tcp_${Math.random().toString(36).slice(2, 10)}`;
  }

  /** Bind and listen; throws with the Rust error text when the port is taken or blocked. */
  static async host(port = DEFAULT_SESSION_PORT): Promise<TauriTcpTransport> {
    const { invoke, listen } = await api();
    const transport = new TauriTcpTransport("host", invoke);
    await transport.subscribe(listen);
    await invoke<TauriStatus>("start_session_host", { bindAddress: `0.0.0.0:${port}` });
    return transport;
  }

  /** Connect to `host:port`; resolves once the socket is open, then reports the host as connected so hello goes out. */
  static async connect(address: string): Promise<TauriTcpTransport> {
    const { invoke, listen } = await api();
    const transport = new TauriTcpTransport("peer", invoke);
    await transport.subscribe(listen);
    await invoke<TauriStatus>("connect_session_client", { address });
    transport.connected = true;
    return transport;
  }

  private async subscribe(listen: Listen) {
    this.unlisten.push(await listen<TauriMessage>("session-transport-message", ({ payload }) => {
      let parsed: unknown;
      try { parsed = JSON.parse(payload.message); } catch { return; }
      if (parsed && typeof parsed === "object" && (parsed as { type?: string }).type === "transport-error") return;
      const from = this.role === "host" ? payload.peer : "host";
      for (const handler of [...this.messageHandlers]) handler(from, parsed);
    }));
    this.unlisten.push(await listen<TauriPeerLifecycle>("session-transport-peer-lifecycle", ({ payload }) => {
      const peer = this.role === "host" ? payload.peer : "host";
      for (const handler of [...this.peerHandlers]) handler(peer, payload.state === "connected" ? "connected" : "disconnected");
    }));
    this.unlisten.push(await listen<TauriStatus>("session-transport-state", ({ payload }) => {
      if (this.role === "peer" && (payload.state === "disconnected" || payload.role === null) && !this.closed) { this.connected = false; for (const handler of [...this.peerHandlers]) handler("host", "disconnected"); }
    }));
  }

  send(to: string, message: unknown) {
    const text = JSON.stringify(message);
    if (this.role === "peer" || to === "*") void this.invoke("send_session_message", { message: text }).catch(() => undefined);
    else void this.invoke("send_session_message_to", { peer: to, message: text }).catch(() => undefined);
  }
  onMessage(handler: (from: string, message: unknown) => void) { this.messageHandlers.add(handler); return () => { this.messageHandlers.delete(handler); }; }
  onPeer(handler: (peerId: string, state: PeerState) => void) {
    this.peerHandlers.add(handler);
    // R71 (D206): a player's socket that is already open says so to a listener that arrives after the connect.
    if (this.role === "peer" && this.connected) queueMicrotask(() => { if (this.connected && this.peerHandlers.has(handler)) handler("host", "connected"); });
    return () => { this.peerHandlers.delete(handler); };
  }
  close() {
    this.closed = true;
    for (const off of this.unlisten) off();
    void this.invoke("stop_session_transport").catch(() => undefined);
  }
}
