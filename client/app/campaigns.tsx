/**
 * Campaign state for the app (ROLL20_MODEL.md §1–§2, §6): my campaigns (I am the GM), campaigns I joined, the
 * launched table (host or mirror), chat archives. Launching a campaign makes this app the table's authority:
 * players come through the same-PC tab channel and, in the exe, TCP over LAN/Hamachi. The join code is the
 * campaign's fixed code (D71); presence and chat are written into the campaign documents as they happen.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { JournalEntry } from "../campaign/journal";
import type { Campaign, ChatArchive, ChatMessage, JoinedCampaign, PlayerRole } from "../campaign/model";
import { chatArchiveId, emptyChatArchive, newCampaign, newJoinCode } from "../campaign/model";
import { TableClient, type TableStatus } from "../session/client";
import { TableHost } from "../session/host";
import type { ClientCommand, Invite, RollPayload, TableSnapshot } from "../session/protocol";
import { decodeInvite, encodeInvite } from "../session/protocol";
import { DEFAULT_SESSION_PORT, listSessionAddresses, tauriAvailable, TauriTcpTransport } from "../session/tauriTransport";
import { BroadcastChannelTransport, MemoryHub } from "../session/transport";
import { useClient } from "./context";

export interface TableState {
  role: "host" | "player" | null;
  status: TableStatus | "idle";
  reason: string | null;
  campaignId: string | null;
  snapshot: TableSnapshot | null;
  /** Main invite and every alternative (LAN addresses first in the exe, then the same-PC tab invite). */
  invite: string | null;
  invites: string[];
  transportNote: string | null;
  refusals: string[];
  /** Entries the GM asked to open on this viewer ("플레이어에게 보여주기"), oldest first; the table consumes them. */
  shows: string[];
}

export interface CampaignsState {
  userId: string;
  displayName: string;
  setDisplayName: (name: string) => void;
  campaigns: Campaign[];
  joined: JoinedCampaign[];
  archives: Record<string, ChatArchive>;
  /** Journal entries of my campaigns, by campaign id (the host's copy). */
  journals: Record<string, JournalEntry[]>;
  createCampaign: (name: string) => Promise<Campaign>;
  updateCampaign: (campaign: Campaign) => Promise<void>;
  deleteCampaign: (id: string) => Promise<void>;
  regenerateJoinCode: (id: string) => Promise<void>;
  forgetJoined: (campaignId: string) => Promise<void>;
  table: TableState;
  launch: (campaignId: string) => Promise<void>;
  join: (inviteText: string) => Promise<string | null>;
  leave: () => void;
  say: (text: string) => void;
  sendRoll: (roll: RollPayload, mode?: "public" | "gm" | "self") => void;
  setRole: (userId: string, role: PlayerRole) => void;
  kick: (userId: string) => void;
  putJournal: (entry: JournalEntry) => void;
  removeJournal: (id: string) => void;
  showJournal: (id: string) => void;
  /** Drop a consumed "show" request. */
  dismissShow: (id: string) => void;
}

const CampaignsContext = createContext<CampaignsState | null>(null);

const newUserId = () => `user_${Math.random().toString(36).slice(2, 10)}`;
/** Browser tabs get their own id (DM and a player on one PC for verification); the exe keeps one id per PC. */
function scopedId(key: string) {
  try {
    const store = tauriAvailable() ? localStorage : sessionStorage;
    const existing = store.getItem(key);
    if (existing) return existing;
    const value = newUserId();
    store.setItem(key, value);
    return value;
  } catch { return newUserId(); }
}

export function CampaignsProvider({ children }: { children: ReactNode }) {
  const { store, ready } = useClient();
  const [userId] = useState(() => (typeof sessionStorage === "undefined" ? newUserId() : scopedId("simplevtt-user-id")));
  const [displayName, setDisplayNameState] = useState(() => { try { return localStorage.getItem("simplevtt-display-name") ?? ""; } catch { return ""; } });
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [archives, setArchives] = useState<Record<string, ChatArchive>>({});
  const [journals, setJournals] = useState<Record<string, JournalEntry[]>>({});
  const [shows, setShows] = useState<string[]>([]);
  const [joined, setJoined] = useState<JoinedCampaign[]>([]);
  const [role, setRoleState] = useState<"host" | "player" | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [invite, setInvite] = useState<string | null>(null);
  const [invites, setInvites] = useState<string[]>([]);
  const [transportNote, setTransportNote] = useState<string | null>(null);
  const [refusals, setRefusals] = useState<string[]>([]);
  const [tick, setTick] = useState(0);
  const hostRef = useRef<TableHost | null>(null);
  const clientRef = useRef<TableClient | null>(null);
  const campaignsRef = useRef(campaigns);
  campaignsRef.current = campaigns;
  const archivesRef = useRef(archives);
  archivesRef.current = archives;
  const journalsRef = useRef(journals);
  journalsRef.current = journals;
  const bump = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    if (!store || !ready) return;
    let cancelled = false;
    (async () => {
      const [docs, joinedRows] = await Promise.all([store.listDocuments(), store.getSetting<JoinedCampaign[]>("joined-campaigns")]);
      if (cancelled) return;
      setCampaigns(docs.filter((doc): doc is Campaign => doc.kind === "campaign").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      setArchives(Object.fromEntries(docs.filter((doc): doc is ChatArchive => doc.kind === "chat").map((doc) => [doc.campaignId, doc])));
      const byCampaign: Record<string, JournalEntry[]> = {};
      for (const doc of docs) if (doc.kind === "handout" || doc.kind === "character") (byCampaign[doc.campaignId] ??= []).push(doc);
      setJournals(byCampaign);
      setJoined(joinedRows ?? []);
    })();
    return () => { cancelled = true; };
  }, [store, ready]);

  const setDisplayName = useCallback((name: string) => { setDisplayNameState(name); try { localStorage.setItem("simplevtt-display-name", name); } catch { /* private window */ } }, []);

  const saveCampaign = useCallback(async (campaign: Campaign) => {
    setCampaigns((list) => { const index = list.findIndex((item) => item.id === campaign.id); const next = index >= 0 ? list.map((item, at) => (at === index ? campaign : item)) : [campaign, ...list]; return next; });
    await store?.putDocument(campaign);
  }, [store]);

  const createCampaign = useCallback(async (name: string) => { const campaign = newCampaign(name, { userId, displayName: displayName || "DM" }); await saveCampaign(campaign); return campaign; }, [displayName, saveCampaign, userId]);
  const updateCampaign = useCallback(async (campaign: Campaign) => {
    const stamped = { ...campaign, updatedAt: new Date().toISOString() };
    await saveCampaign(stamped);
    if (hostRef.current && hostRef.current.state.id === stamped.id) hostRef.current.updateCampaign(stamped);
  }, [saveCampaign]);
  const deleteCampaign = useCallback(async (id: string) => {
    setCampaigns((list) => list.filter((item) => item.id !== id));
    setArchives((map) => { const { [id]: _gone, ...rest } = map; return rest; });
    const entries = journalsRef.current[id] ?? [];
    setJournals((map) => { const { [id]: _gone, ...rest } = map; return rest; });
    await store?.deleteDocument(id);
    await store?.deleteDocument(chatArchiveId(id));
    for (const entry of entries) await store?.deleteDocument(entry.id);
  }, [store]);
  const regenerateJoinCode = useCallback(async (id: string) => { const campaign = campaignsRef.current.find((item) => item.id === id); if (campaign) await updateCampaign({ ...campaign, joinCode: newJoinCode() }); }, [updateCampaign]);
  const saveJoined = useCallback(async (list: JoinedCampaign[]) => { setJoined(list); await store?.putSetting("joined-campaigns", list); }, [store]);
  const forgetJoined = useCallback((id: string) => saveJoined(joined.filter((item) => item.campaignId !== id)), [joined, saveJoined]);

  const attachClient = useCallback((client: TableClient) => {
    clientRef.current = client;
    client.subscribe(bump);
    client.onRefused((reason, commandType) => { if (commandType === "hello" || commandType === "kicked") return; setRefusals((list) => [reason, ...list].slice(0, 5)); window.setTimeout(() => setRefusals((list) => list.filter((item) => item !== reason)), 6000); });
    client.onShow((id) => setShows((list) => (list.includes(id) ? list : [...list, id])));
  }, [bump]);

  const leave = useCallback(() => {
    clientRef.current?.leave();
    hostRef.current?.close();
    clientRef.current = null;
    hostRef.current = null;
    setRoleState(null);
    setCampaignId(null);
    setInvite(null);
    setInvites([]);
    setTransportNote(null);
    setShows([]);
    bump();
  }, [bump]);

  /** Chat archive writes are coalesced: one document per campaign, appended as messages arrive. */
  const archiveTimer = useRef<number | null>(null);
  const pendingChat = useRef<ChatMessage[]>([]);
  const flushArchive = useCallback((id: string) => {
    if (!pendingChat.current.length) return;
    const current = archivesRef.current[id] ?? emptyChatArchive(id);
    const next: ChatArchive = { ...current, messages: [...current.messages, ...pendingChat.current.splice(0)].slice(-5000), updatedAt: new Date().toISOString() };
    setArchives((map) => ({ ...map, [id]: next }));
    void store?.putDocument(next);
  }, [store]);

  const launch = useCallback(async (id: string) => {
    const campaign = campaignsRef.current.find((item) => item.id === id);
    if (!campaign) return;
    leave();
    const hostSecret = newJoinCode() + newJoinCode();
    const hub = new MemoryHub();
    const carriers = [hub.hostEndpoint(), ...(BroadcastChannelTransport.available() ? [new BroadcastChannelTransport(campaign.id, "host")] : [])];
    const launched = { ...campaign, lastLaunchedAt: new Date().toISOString() };
    const host = new TableHost(carriers, {
      campaign: launched,
      hostUserId: userId,
      hostSecret,
      archive: archivesRef.current[campaign.id]?.messages ?? [],
      journal: journalsRef.current[campaign.id] ?? [],
      onCampaign: (next) => { void saveCampaign(next); },
      onJournal: (change) => {
        if ("entry" in change) { setJournals((map) => { const list = map[campaign.id] ?? []; const index = list.findIndex((item) => item.id === change.entry.id); return { ...map, [campaign.id]: index >= 0 ? list.map((item, at) => (at === index ? change.entry : item)) : [...list, change.entry] }; }); void store?.putDocument(change.entry); }
        else { setJournals((map) => ({ ...map, [campaign.id]: (map[campaign.id] ?? []).filter((item) => item.id !== change.removed) })); void store?.deleteDocument(change.removed); }
      },
      onChat: (message) => { pendingChat.current.push(message); if (archiveTimer.current !== null) window.clearTimeout(archiveTimer.current); archiveTimer.current = window.setTimeout(() => { archiveTimer.current = null; flushArchive(campaign.id); }, 500); },
    });
    hostRef.current = host;
    void saveCampaign(launched);
    const seat = new TableClient(hub.connect("host-seat"), { userId, displayName: displayName || "DM", joinCode: campaign.joinCode, hostSecret });
    attachClient(seat);
    setRoleState("host");
    setCampaignId(campaign.id);
    const tabInvite = encodeInvite({ carrier: "tab", address: campaign.id, joinCode: campaign.joinCode });
    setInvite(tabInvite);
    setInvites([tabInvite]);
    bump();
    if (tauriAvailable()) {
      try {
        const tcp = await TauriTcpTransport.host(DEFAULT_SESSION_PORT);
        if (hostRef.current !== host) { tcp.close(); return; }
        host.attach(tcp);
        const addresses = await listSessionAddresses();
        const lan = addresses.map((ip) => encodeInvite({ carrier: "tcp", address: `${ip}:${DEFAULT_SESSION_PORT}`, joinCode: campaign.joinCode }));
        setInvites([...lan, tabInvite]);
        setInvite(lan[0] ?? tabInvite);
        setTransportNote(addresses.length ? null : `LAN 주소를 찾지 못했습니다. ipconfig의 IPv4 주소로 코드를 만드세요: <IP>:${DEFAULT_SESSION_PORT}-${campaign.joinCode}`);
      } catch (error) { setTransportNote(`LAN 호스트를 열지 못했습니다: ${error instanceof Error ? error.message : String(error)}`); }
      bump();
    } else setTransportNote("브라우저에서는 같은 PC의 다른 탭만 참가할 수 있습니다. LAN·하마치는 exe에서 열립니다.");
  }, [attachClient, bump, displayName, flushArchive, leave, saveCampaign, store, userId]);

  const join = useCallback(async (inviteText: string) => {
    const parsed: Invite | null = decodeInvite(inviteText);
    if (!parsed) return "참가 코드 형식이 아닙니다. 예: tab:camp_x1-K7QX3M 또는 25.12.34.56:41230-K7QX3M";
    if (parsed.carrier === "tcp" && !tauriAvailable()) return "LAN(tcp) 참가는 exe에서만 됩니다. 브라우저에서는 같은 PC의 tab: 코드만 됩니다.";
    if (parsed.carrier === "tab" && !BroadcastChannelTransport.available()) return "이 브라우저는 탭 간 연결을 지원하지 않습니다.";
    leave();
    try {
      const transport = parsed.carrier === "tcp" ? await TauriTcpTransport.connect(parsed.address) : new BroadcastChannelTransport(parsed.address, "peer");
      const client = new TableClient(transport, { userId, displayName: displayName || "플레이어", joinCode: parsed.joinCode });
      attachClient(client);
      client.subscribe(() => {
        const snapshot = client.snapshot;
        if (client.status !== "joined" || !snapshot?.campaignId) return;
        const hostName = snapshot.players.find((player) => player.role === "gm")?.displayName ?? "DM";
        const entry: JoinedCampaign = { campaignId: snapshot.campaignId, name: snapshot.name, hostName, invite: encodeInvite(parsed), lastSeenAt: new Date().toISOString() };
        const current = joined.filter((item) => item.campaignId !== entry.campaignId);
        if (!joined.some((item) => item.campaignId === entry.campaignId && item.name === entry.name && item.invite === entry.invite)) void saveJoined([entry, ...current]);
        setCampaignId(snapshot.campaignId);
      });
      setRoleState("player");
      setInvite(encodeInvite(parsed));
      setInvites([encodeInvite(parsed)]);
      bump();
      return null;
    } catch (error) {
      return `호스트 ${parsed.address}에 연결하지 못했습니다: ${error instanceof Error ? error.message : String(error)}. 호스트가 캠페인을 시작했는지, 방화벽이 ${DEFAULT_SESSION_PORT} 포트를 허용하는지 확인하세요.`;
    }
  }, [attachClient, bump, displayName, joined, leave, saveJoined, userId]);

  const send = useCallback((command: ClientCommand) => { clientRef.current?.send(command); }, []);
  const say = useCallback((text: string) => { if (text.trim()) send({ type: "chat.say", text }); }, [send]);
  const sendRoll = useCallback((roll: RollPayload, mode: "public" | "gm" | "self" = "public") => send({ type: "chat.roll", roll, mode }), [send]);
  const setRole = useCallback((target: string, nextRole: PlayerRole) => send({ type: "player.role", userId: target, role: nextRole }), [send]);
  const kick = useCallback((target: string) => send({ type: "player.kick", userId: target }), [send]);
  const putJournal = useCallback((entry: JournalEntry) => send({ type: "journal.put", entry }), [send]);
  const removeJournal = useCallback((id: string) => send({ type: "journal.remove", id }), [send]);
  const showJournal = useCallback((id: string) => send({ type: "journal.show", id }), [send]);
  const dismissShow = useCallback((id: string) => setShows((list) => list.filter((item) => item !== id)), []);

  useEffect(() => () => { clientRef.current?.leave(); hostRef.current?.close(); }, []);

  const client = clientRef.current;
  const table = useMemo<TableState>(() => ({ role, status: client ? client.status : "idle", reason: client?.reason ?? null, campaignId, snapshot: client?.snapshot ?? null, invite, invites, transportNote, refusals, shows }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [role, client, campaignId, invite, invites, transportNote, refusals, shows, tick]);
  const value = useMemo<CampaignsState>(() => ({ userId, displayName, setDisplayName, campaigns, joined, archives, journals, createCampaign, updateCampaign, deleteCampaign, regenerateJoinCode, forgetJoined, table, launch, join, leave, say, sendRoll, setRole, kick, putJournal, removeJournal, showJournal, dismissShow }),
    [userId, displayName, setDisplayName, campaigns, joined, archives, journals, createCampaign, updateCampaign, deleteCampaign, regenerateJoinCode, forgetJoined, table, launch, join, leave, say, sendRoll, setRole, kick, putJournal, removeJournal, showJournal, dismissShow]);
  return <CampaignsContext.Provider value={value}>{children}</CampaignsContext.Provider>;
}

export function useCampaigns() {
  const value = useContext(CampaignsContext);
  if (!value) throw new Error("useCampaigns outside CampaignsProvider");
  return value;
}
