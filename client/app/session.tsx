/**
 * Session state for the app: open a session as host (this tab becomes the authority) or join one with an invite
 * code; the same view interface serves both. Own characters are written back to the library on every host event
 * (D60). The carrier is BroadcastChannel today (tabs on one PC); the TCP carrier plugs into the same place.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { SheetOp } from "../character/ops";
import type { CharacterRuntime } from "../character/runtime";
import type { CharacterSource } from "../character/types";
import { SessionClient } from "../session/client";
import { SessionHost } from "../session/host";
import type { ClientCommand, Invite, SessionSnapshot } from "../session/protocol";
import { decodeInvite, encodeInvite, newSessionId, newToken } from "../session/protocol";
import { DEFAULT_SESSION_PORT, listSessionAddresses, tauriAvailable, TauriTcpTransport } from "../session/tauriTransport";
import { BroadcastChannelTransport, MemoryHub } from "../session/transport";
import type { CharacterRecord } from "../storage/store";
import { useClient } from "./context";

export type SessionRole = "host" | "player";

export interface SessionState {
  role: SessionRole | null;
  status: "idle" | "connecting" | "joined" | "refused" | "disconnected" | "closed";
  reason: string | null;
  /** The invite to hand out first (LAN/Hamachi `tcp:` in the exe, `tab:` in a browser). */
  invite: string | null;
  /** Every invite that reaches this host: one per address candidate plus the same-PC tab invite. */
  invites: string[];
  /** Why the LAN carrier is not up (port taken, not the exe), if so. */
  transportNote: string | null;
  snapshot: SessionSnapshot | null;
  userId: string;
  displayName: string;
  setDisplayName: (name: string) => void;
  openSession: (name: string) => Promise<void>;
  joinSession: (inviteText: string) => Promise<string | null>;
  leaveSession: () => void;
  bringCharacter: (record: CharacterRecord) => void;
  removeCharacter: (characterId: string) => void;
  dispatchOp: (characterId: string, op: SheetOp) => Promise<string | null>;
  advanceRound: () => void;
  say: (text: string) => void;
  /** Refusals of the last few commands, newest first (shown as toasts). */
  refusals: string[];
}

const SessionContext = createContext<SessionState | null>(null);

/** Browser tabs get their own id (DM and player on one PC for verification); the exe keeps one id per PC (D67 rejoin). */
function tabScoped(key: string, make: () => string) {
  try {
    const store = tauriAvailable() ? localStorage : sessionStorage;
    const existing = store.getItem(key);
    if (existing) return existing;
    const value = make();
    store.setItem(key, value);
    return value;
  } catch { return make(); }
}

const newUserId = () => `user_${Math.random().toString(36).slice(2, 10)}`;

export function SessionProvider({ children }: { children: ReactNode }) {
  const { catalog, saveCharacter } = useClient();
  const [userId] = useState(() => (typeof sessionStorage === "undefined" ? newUserId() : tabScoped("simplevtt-user-id", newUserId)));
  const [displayName, setDisplayNameState] = useState(() => { try { return localStorage.getItem("simplevtt-display-name") ?? ""; } catch { return ""; } });
  const [role, setRole] = useState<SessionRole | null>(null);
  const [invite, setInvite] = useState<string | null>(null);
  const [invites, setInvites] = useState<string[]>([]);
  const [transportNote, setTransportNote] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [refusals, setRefusals] = useState<string[]>([]);
  const hostRef = useRef<SessionHost | null>(null);
  const clientRef = useRef<SessionClient | null>(null);
  const hubRef = useRef<MemoryHub | null>(null);
  const bump = useCallback(() => setTick((value) => value + 1), []);

  const setDisplayName = useCallback((name: string) => { setDisplayNameState(name); try { localStorage.setItem("simplevtt-display-name", name); } catch { /* private window */ } }, []);

  const attachClient = useCallback((client: SessionClient) => {
    clientRef.current = client;
    client.subscribe(bump);
    client.onRefused((reason) => { setRefusals((list) => [reason, ...list].slice(0, 5)); window.setTimeout(() => setRefusals((list) => list.filter((item) => item !== reason)), 6000); });
    // Write-back: every host-confirmed change to one of my characters lands in my library at once (D60).
    client.onCharacter((_characterId, source: CharacterSource, runtime: CharacterRuntime) => { void saveCharacter(source, runtime); });
  }, [bump, saveCharacter]);

  const leaveSession = useCallback(() => {
    clientRef.current?.leave();
    hostRef.current?.close();
    clientRef.current = null;
    hostRef.current = null;
    hubRef.current = null;
    setRole(null);
    setInvite(null);
    setInvites([]);
    setTransportNote(null);
    bump();
  }, [bump]);

  const openSession = useCallback(async (name: string) => {
    leaveSession();
    const sessionId = newSessionId();
    const token = newToken();
    const hostSecret = newToken() + newToken();
    // The host's own seat is a client over an in-process hub; players come through the tab channel and, in the exe, TCP.
    const hub = new MemoryHub();
    hubRef.current = hub;
    const carriers = [hub.hostEndpoint(), ...(BroadcastChannelTransport.available() ? [new BroadcastChannelTransport(sessionId, "host")] : [])];
    const host = new SessionHost(carriers, { sessionId, name: name || "세션", token, hostUserId: userId, hostName: displayName || "DM", catalog, hostSecret });
    hostRef.current = host;
    const mirror = new SessionClient(hub.connect("host-seat"), { userId, name: displayName || "DM", token, hostSecret });
    attachClient(mirror);
    setRole("host");
    const tabInvite = encodeInvite({ carrier: "tab", address: sessionId, token });
    setInvite(tabInvite);
    setInvites([tabInvite]);
    bump();
    if (tauriAvailable()) {
      try {
        const tcp = await TauriTcpTransport.host(DEFAULT_SESSION_PORT);
        if (hostRef.current !== host) { tcp.close(); return; }
        host.attach(tcp);
        const addresses = await listSessionAddresses();
        const lan = addresses.map((ip) => encodeInvite({ carrier: "tcp", address: `${ip}:${DEFAULT_SESSION_PORT}`, token }));
        setInvites([...lan, tabInvite]);
        setInvite(lan[0] ?? tabInvite);
        setTransportNote(addresses.length ? null : "LAN 주소를 찾지 못했습니다. ipconfig의 IPv4 주소로 코드를 직접 만드세요: <IP>:41230-" + token);
      } catch (error) {
        setTransportNote(`LAN 호스트를 열지 못했습니다: ${error instanceof Error ? error.message : String(error)}`);
      }
      bump();
    } else setTransportNote("브라우저에서는 같은 PC의 다른 탭만 참가할 수 있습니다. LAN·하마치는 exe에서 열립니다.");
  }, [attachClient, bump, catalog, displayName, leaveSession, userId]);

  const joinSession = useCallback(async (inviteText: string) => {
    const parsed: Invite | null = decodeInvite(inviteText);
    if (!parsed) return "초대 코드 형식이 아닙니다. 예: tab:sess_x1-K7QX3M 또는 25.12.34.56:41230-K7QX3M";
    if (parsed.carrier === "tcp" && !tauriAvailable()) return "LAN(tcp) 초대는 exe 빌드에서만 받을 수 있습니다. 브라우저에서는 같은 PC의 tab: 초대만 됩니다.";
    if (parsed.carrier === "tab" && !BroadcastChannelTransport.available()) return "이 브라우저는 탭 간 연결을 지원하지 않습니다.";
    leaveSession();
    try {
      const transport = parsed.carrier === "tcp" ? await TauriTcpTransport.connect(parsed.address) : new BroadcastChannelTransport(parsed.address, "peer");
      const client = new SessionClient(transport, { userId, name: displayName || "플레이어", token: parsed.token });
      attachClient(client);
      setRole("player");
      setInvite(encodeInvite(parsed));
      setInvites([encodeInvite(parsed)]);
      bump();
      return null;
    } catch (error) {
      return `호스트 ${parsed.address}에 연결하지 못했습니다: ${error instanceof Error ? error.message : String(error)}. 호스트가 세션을 열었는지, 방화벽이 41230 포트를 허용하는지 확인하세요.`;
    }
  }, [attachClient, bump, displayName, leaveSession, userId]);

  const send = useCallback((command: ClientCommand) => { clientRef.current?.send(command); }, []);
  const bringCharacter = useCallback((record: CharacterRecord) => send({ type: "character.join", source: record.source, runtime: record.runtime }), [send]);
  const removeCharacter = useCallback((characterId: string) => send({ type: "character.leave", characterId }), [send]);
  const dispatchOp = useCallback(async (characterId: string, op: SheetOp) => {
    const client = clientRef.current;
    if (!client) return "세션에 연결되어 있지 않습니다";
    return new Promise<string | null>((resolve) => {
      const off = client.onRefused((reason, commandType) => { if (commandType === "sheet.op") { off(); resolve(reason); } });
      client.send({ type: "sheet.op", characterId, op });
      window.setTimeout(() => { off(); resolve(null); }, 400);
    });
  }, []);
  const advanceRound = useCallback(() => send({ type: "round.advance" }), [send]);
  const say = useCallback((text: string) => { if (text.trim()) send({ type: "chat.say", text: text.trim() }); }, [send]);

  useEffect(() => () => { clientRef.current?.leave(); hostRef.current?.close(); }, []);

  const client = clientRef.current;
  const value = useMemo<SessionState>(() => ({
    role,
    status: !client ? "idle" : client.status,
    reason: client?.reason ?? null,
    invite,
    invites,
    transportNote,
    snapshot: client?.snapshot ?? null,
    userId,
    displayName,
    setDisplayName,
    openSession,
    joinSession,
    leaveSession,
    bringCharacter,
    removeCharacter,
    dispatchOp,
    advanceRound,
    say,
    refusals,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [role, client, invite, invites, transportNote, userId, displayName, setDisplayName, openSession, joinSession, leaveSession, bringCharacter, removeCharacter, dispatchOp, advanceRound, say, refusals, tick]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession outside SessionProvider");
  return value;
}
