/**
 * Campaign state for the app (ROLL20_MODEL.md §1–§2, §6): my campaigns (I am the GM), campaigns I joined, the
 * launched table (host or mirror), chat archives. Launching a campaign makes this app the table's authority:
 * players come through the same-PC tab channel and, in the exe, TCP over LAN/Hamachi. The join code is the
 * campaign's fixed code (D71); presence and chat are written into the campaign documents as they happen.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ArtAsset } from "../campaign/art";
import { ART_LIMIT, ART_MIMES, chunkText, hashText, newArtAsset } from "../campaign/art";
import type { JournalCharacter, JournalEntry } from "../campaign/journal";
import type { Page, Token } from "../campaign/page";
import type { Tracker, TrackerTurn } from "../campaign/tracker";
import { deriveCharacter } from "../character/derive";
import type { Campaign, ChatArchive, ChatMessage, JoinedCampaign, Macro, PlayerRole, RollTable } from "../campaign/model";
import { chatArchiveId, emptyChatArchive, isStoredDocument, newCampaign, newJoinCode, repairCampaign } from "../campaign/model";
import { TableClient, type TableStatus } from "../session/client";
import { TableHost } from "../session/host";
import type { ActorRef, AttackRef, AttackRiders, ClientCommand, Invite, RollPayload, TableSnapshot } from "../session/protocol";
import { derivedOf, pcAttackSpec, pcCombatant, pcConcentrationKey } from "../rules/attackSpec";
import { pcStats, type ActionKind } from "../rules/actions";
import { castableSpells, cheapestCast, pcSpell } from "../rules/spellcast";
import { itemUse } from "../rules/items";
import { longRest, setItemQuantity, shortRest } from "../character/play";
import type { CastMethod } from "../character/play";
import type { AttackOverrides } from "../rules/resolve";
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
  /** Art bytes by asset id as this viewer has them: a data URL, "loading", or "error". */
  artUrls: Record<string, string>;
  /** Fetches in flight (for "자료 받는 중 n"). */
  artPending: number;
  /** Pings seen in the last moments (the canvas animates them). */
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
  /** Art metadata of my campaigns, by campaign id (the host's copy; bytes are in the store by hash). */
  arts: Record<string, ArtAsset[]>;
  /** Pages of my campaigns, by campaign id (the host's copy). */
  pages: Record<string, Page[]>;
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
  /** Upload an image to the campaign's art library; resolves with the asset id once the host has it. */
  uploadArt: (file: File) => Promise<string>;
  updateArt: (id: string, patch: { name?: string; folder?: string; tags?: string[] }) => void;
  removeArt: (id: string) => void;
  /** Make sure the bytes of an asset are on this viewer (cache, else the host); the URL lands in table.artUrls. */
  requestArt: (id: string) => void;
  putPage: (page: Page) => void;
  removePage: (id: string) => void;
  setRibbon: (pageId: string) => void;
  setBookmark: (userId: string, pageId: string | null) => void;
  putToken: (pageId: string, token: Token) => void;
  removeToken: (pageId: string, id: string) => void;
  setTracker: (tracker: Tracker) => void;
  addTurn: (turn: Omit<TrackerTurn, "id" | "initiative"> & { initiative?: number }, rollBonus?: number) => void;
  nextTurn: () => void;
  /** R11: swap the current turn with a later party member in the same linked group (BG3). */
  swapTurn: (turnId: string) => void;
  attack: (attacker: ActorRef, targets: ActorRef[], attack: AttackRef, riders?: AttackRiders, options?: { overrides?: AttackOverrides; reaction?: string; readied?: boolean }) => void;
  /** R9: an NPC's save action (breath, gaze) at targets; a legendary action from the pool. */
  npcSave: (actor: ActorRef, actionName: string, targets: ActorRef[]) => void;
  legendary: (actor: ActorRef, name: string, targets?: ActorRef[]) => void;
  /** R10: use a bag item (a potion) on a creature; the host rolls, applies and takes it out of the bag. */
  useItem: (actor: ActorRef, target: ActorRef | undefined, instanceId: string) => void;
  /** R18: move the in-world clock (GM), run a rest for the table (GM), or ask for one (player). */
  advanceTime: (minutes: number) => void;
  tableRest: (kind: "short" | "long") => void;
  askRest: (kind: "short" | "long") => void;
  /** R17: save the campaign's macros / rollable tables (GM). */
  saveMacros: (macros: Macro[]) => void;
  saveTables: (tables: RollTable[]) => void;
  /** R17: draw rows from a rollable table; the host rolls and posts the result. */
  rollTable: (name: string, count?: number, mode?: "public" | "gm" | "self") => void;
  /** R19: use an NPC trait; a per-day count the DM set is spent. */
  useTrait: (actor: ActorRef, name: string) => void;
  /** R16: put a summoned creature on the board (its own journal entry, controlled by the summoner's controller). */
  summon: (summoner: ActorRef, monsterId: string, options?: { count?: number; spellId?: string }) => void;
  /** R16: send this summoner's creatures away. */
  dismissSummons: (summoner: ActorRef, spellId?: string) => void;
  /** R12 (DM): Legendary Resistance on a failed save in a spell card. */
  resist: (messageId: string, targetId: string, tokenId?: string) => void;
  /** D96: the mover leaves `from`'s reach; the host asks `from`'s controller for an opportunity attack. */
  provoke: (mover: ActorRef, from: ActorRef) => void;
  /** D97: one of the official actions on the actor's turn. */
  act: (actor: ActorRef, kind: ActionKind, options?: { target?: ActorRef; skill?: string; dc?: number; note?: string; choice?: string; bonus?: boolean }) => void;
  /** D102: cast a spell at targets; the host pays and resolves. */
  cast: (caster: ActorRef, spellId: string, targets: ActorRef[], method?: CastMethod, overrides?: AttackOverrides, readied?: boolean, reaction?: string) => void;
  declineReaction: (messageId: string) => void;
  adjustAction: (messageId: string, overrides: AttackOverrides, reroll?: boolean) => void;
  undoAction: (messageId: string) => void;
  confirmAction: (messageId: string) => void;
}

const CampaignsContext = createContext<CampaignsState | null>(null);

const newUserId = () => `user_${Math.random().toString(36).slice(2, 10)}`;
/** Web storage can be absent or throw on access (a sandboxed frame, blocked site data): every use is guarded. */
function webStorage(kind: "local" | "session"): Storage | null {
  try { return kind === "local" ? window.localStorage : window.sessionStorage; } catch { return null; }
}
/** Browser tabs get their own id (DM and a player on one PC for verification); the exe keeps one id per PC. */
function scopedId(key: string) {
  try {
    const store = webStorage(tauriAvailable() ? "local" : "session");
    const existing = store?.getItem(key);
    if (existing) return existing;
    const value = newUserId();
    store?.setItem(key, value);
    return value;
  } catch { return newUserId(); }
}

export function CampaignsProvider({ children }: { children: ReactNode }) {
  const { store, ready, catalog } = useClient();
  const [userId] = useState(() => (typeof window === "undefined" ? newUserId() : scopedId("simplevtt-user-id")));
  const [displayName, setDisplayNameState] = useState(() => { try { return webStorage("local")?.getItem("simplevtt-display-name") ?? ""; } catch { return ""; } });
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [archives, setArchives] = useState<Record<string, ChatArchive>>({});
  const [journals, setJournals] = useState<Record<string, JournalEntry[]>>({});
  const [arts, setArts] = useState<Record<string, ArtAsset[]>>({});
  const [pages, setPages] = useState<Record<string, Page[]>>({});
  const [shows, setShows] = useState<string[]>([]);
  const [artUrls, setArtUrls] = useState<Record<string, string>>({});
  const [artPending, setArtPending] = useState(0);
  const artRequests = useRef(new Set<string>());
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
  const artsRef = useRef(arts);
  artsRef.current = arts;
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;
  const bump = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    if (!store || !ready) return;
    let cancelled = false;
    (async () => {
      const [rows, joinedRows] = await Promise.all([store.listDocuments(), store.getSetting<JoinedCampaign[]>("joined-campaigns")]);
      if (cancelled) return;
      // Rows of another shape (the rejected first campaign build, or a newer build) are skipped; the current
      // build's screens never see them.
      const docs = (rows as unknown[]).filter(isStoredDocument);
      const skipped = rows.length - docs.length;
      if (skipped) console.warn(`campaigns: skipped ${skipped} stored document(s) of another shape`);
      setCampaigns(docs.filter((doc): doc is Campaign => doc.kind === "campaign").map(repairCampaign).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      setArchives(Object.fromEntries(docs.filter((doc): doc is ChatArchive => doc.kind === "chat").map((doc) => [doc.campaignId, doc])));
      const byCampaign: Record<string, JournalEntry[]> = {};
      const artByCampaign: Record<string, ArtAsset[]> = {};
      const pagesByCampaign: Record<string, Page[]> = {};
      for (const doc of docs) {
        if (doc.kind === "handout" || doc.kind === "character") (byCampaign[doc.campaignId] ??= []).push(doc);
        else if (doc.kind === "art") (artByCampaign[doc.campaignId] ??= []).push(doc);
        else if (doc.kind === "page") (pagesByCampaign[doc.campaignId] ??= []).push(doc);
      }
      setJournals(byCampaign);
      setArts(artByCampaign);
      setPages(pagesByCampaign);
      setJoined(Array.isArray(joinedRows) ? joinedRows.filter((row) => row && typeof row.campaignId === "string" && typeof row.invite === "string") : []);
    })();
    return () => { cancelled = true; };
  }, [store, ready]);

  const setDisplayName = useCallback((name: string) => { setDisplayNameState(name); try { webStorage("local")?.setItem("simplevtt-display-name", name); } catch { /* private window */ } }, []);

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
    const assets = artsRef.current[id] ?? [];
    const pageDocs = pagesRef.current[id] ?? [];
    setJournals((map) => { const { [id]: _gone, ...rest } = map; return rest; });
    setArts((map) => { const { [id]: _gone, ...rest } = map; return rest; });
    setPages((map) => { const { [id]: _gone, ...rest } = map; return rest; });
    await store?.deleteDocument(id);
    await store?.deleteDocument(chatArchiveId(id));
    for (const entry of entries) await store?.deleteDocument(entry.id);
    for (const asset of assets) await store?.deleteDocument(asset.id);
    for (const page of pageDocs) await store?.deleteDocument(page.id);
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
    setArtUrls({});
    setArtPending(0);
    artRequests.current.clear();
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
      art: artsRef.current[campaign.id] ?? [],
      pages: pagesRef.current[campaign.id] ?? [],
      onPage: (change) => {
        if ("page" in change) { setPages((map) => { const list = map[campaign.id] ?? []; const index = list.findIndex((item) => item.id === change.page.id); return { ...map, [campaign.id]: index >= 0 ? list.map((item, at) => (at === index ? change.page : item)) : [...list, change.page] }; }); void store?.putDocument(change.page); }
        else { setPages((map) => ({ ...map, [campaign.id]: (map[campaign.id] ?? []).filter((item) => item.id !== change.removed) })); void store?.deleteDocument(change.removed); }
      },
      attributeOf: (entry, link) => attributeOf(entry, link, catalogRef.current),
      pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalogRef.current)),
      pcConcentrationKey,
      pcAttackSpec: (entry, attackId, riders) => pcAttackSpec(entry, derivedOf(entry, catalogRef.current), attackId, riders),
      pcStats: (entry) => pcStats(derivedOf(entry, catalogRef.current)),
      pcSpell: (entry, spellId, method) => pcSpell(entry, derivedOf(entry, catalogRef.current), catalogRef.current, spellId, method),
      pcRest: (entry, kind) => { const derived = derivedOf(entry, catalogRef.current); return kind === "long" ? longRest(entry.runtime, derived) : shortRest(entry.runtime, derived); },
      pcReactionSpell: (entry, spellId) => { const derived = derivedOf(entry, catalogRef.current); if (!castableSpells(derived).includes(spellId)) return null; const view = catalogRef.current.spellById(spellId); return view ? cheapestCast(derived, entry.runtime, view.level) : null; },
      pcItem: (entry, instanceId) => { const derived = derivedOf(entry, catalogRef.current); const item = derived.inventory.find((candidate) => candidate.instanceId === instanceId); if (!item || item.quantity <= 0) return null; const use = itemUse(item); return { name: item.name, heal: use.heal, text: use.text, consumes: use.consumes, consume: (runtime) => (use.consumes ? setItemQuantity(runtime, derived, instanceId, item.quantity - 1) : runtime) }; },
      artData: {
        get: async (hash) => (await store?.getAsset(hash))?.dataUrl,
        put: async (hash, dataUrl) => { await store?.putAsset({ hash, dataUrl, bytes: dataUrl.length, savedAt: new Date().toISOString() }); },
      },
      onArt: (change) => {
        if ("asset" in change) { setArts((map) => { const list = map[campaign.id] ?? []; const index = list.findIndex((item) => item.id === change.asset.id); return { ...map, [campaign.id]: index >= 0 ? list.map((item, at) => (at === index ? change.asset : item)) : [...list, change.asset] }; }); void store?.putDocument(change.asset); }
        else { setArts((map) => ({ ...map, [campaign.id]: (map[campaign.id] ?? []).filter((item) => item.id !== change.removed) })); void store?.deleteDocument(change.removed); }
      },
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

  const uploadArt = useCallback(async (file: File) => {
    const client = clientRef.current;
    if (!client || client.status !== "joined" || !client.snapshot) throw new Error("테이블에 들어가 있어야 올릴 수 있습니다");
    if (!ART_MIMES.includes(file.type)) throw new Error("png, jpg, gif, webp 이미지만 올릴 수 있습니다");
    if (file.size > ART_LIMIT) throw new Error("이미지가 너무 큽니다 (20MB까지)");
    const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error ?? new Error("read failed")); reader.readAsDataURL(file); });
    const probe = await imageProbe(dataUrl);
    const hash = await hashText(dataUrl);
    const asset = newArtAsset(client.snapshot.campaignId, userId, { name: file.name.replace(/\.[a-z0-9]+$/i, "") || "이미지", mime: file.type, bytes: file.size, hash, width: probe?.width, height: probe?.height, thumb: probe?.thumb });
    // The uploader already has the bytes: cache them now so its own thumbnails never wait on the host.
    await store?.putAsset({ hash, dataUrl, bytes: dataUrl.length, savedAt: new Date().toISOString() });
    setArtUrls((map) => ({ ...map, [asset.id]: dataUrl }));
    const chunks = chunkText(dataUrl);
    client.send({ type: "art.upload", asset, total: chunks.length });
    chunks.forEach((data, index) => client.send({ type: "art.chunk", id: asset.id, index, total: chunks.length, data }));
    return asset.id;
  }, [store, userId]);
  const putPage = useCallback((page: Page) => send({ type: "page.put", page }), [send]);
  const removePage = useCallback((id: string) => send({ type: "page.remove", id }), [send]);
  const setRibbon = useCallback((pageId: string) => send({ type: "page.ribbon", pageId }), [send]);
  const setBookmark = useCallback((target: string, pageId: string | null) => send({ type: "page.bookmark", userId: target, pageId }), [send]);
  const putToken = useCallback((pageId: string, token: Token) => send({ type: "token.put", pageId, token }), [send]);
  const removeToken = useCallback((pageId: string, id: string) => send({ type: "token.remove", pageId, id }), [send]);
  const setTracker = useCallback((tracker: Tracker) => send({ type: "tracker.set", tracker }), [send]);
  const addTurn = useCallback((turn: Omit<TrackerTurn, "id" | "initiative"> & { initiative?: number }, rollBonus?: number) => send({ type: "tracker.add", turn, rollBonus }), [send]);
  const nextTurn = useCallback(() => send({ type: "tracker.next" }), [send]);
  const swapTurn = useCallback((turnId: string) => send({ type: "tracker.swap", turnId }), [send]);
  const attack = useCallback((attacker: ActorRef, targets: ActorRef[], ref: AttackRef, riders?: AttackRiders, options?: { overrides?: AttackOverrides; reaction?: string; readied?: boolean }) => send({ type: "act.attack", attacker, targets, attack: ref, riders, overrides: options?.overrides, reaction: options?.reaction, readied: options?.readied }), [send]);
  const npcSave = useCallback((actor: ActorRef, actionName: string, targets: ActorRef[]) => send({ type: "act.npcSave", actor, actionName, targets }), [send]);
  const legendary = useCallback((actor: ActorRef, name: string, targets?: ActorRef[]) => send({ type: "act.legendary", actor, name, targets }), [send]);
  const useItem = useCallback((actor: ActorRef, target: ActorRef | undefined, instanceId: string) => send({ type: "act.item", actor, target, instanceId }), [send]);
  const advanceTime = useCallback((minutes: number) => send({ type: "table.clock", minutes }), [send]);
  const tableRest = useCallback((kind: "short" | "long") => send({ type: "table.rest", kind }), [send]);
  const askRest = useCallback((kind: "short" | "long") => send({ type: "act.rest", kind }), [send]);
  const saveMacros = useCallback((macros: Macro[]) => send({ type: "table.macros", macros }), [send]);
  const saveTables = useCallback((tables: RollTable[]) => send({ type: "table.tables", tables }), [send]);
  const rollTable = useCallback((name: string, count = 1, mode: "public" | "gm" | "self" = "public") => send({ type: "chat.table", name, count, mode }), [send]);
  const useTrait = useCallback((actor: ActorRef, name: string) => send({ type: "act.trait", actor, name }), [send]);
  const summon = useCallback((summoner: ActorRef, monsterId: string, options: { count?: number; spellId?: string } = {}) => send({ type: "act.summon", summoner, monsterId, ...(options.count ? { count: options.count } : {}), ...(options.spellId ? { spellId: options.spellId } : {}) }), [send]);
  const dismissSummons = useCallback((summoner: ActorRef, spellId?: string) => send({ type: "act.dismiss", summoner, ...(spellId ? { spellId } : {}) }), [send]);
  const resist = useCallback((messageId: string, targetId: string, tokenId?: string) => send({ type: "act.resist", messageId, targetId, ...(tokenId ? { tokenId } : {}) }), [send]);
  const provoke = useCallback((mover: ActorRef, from: ActorRef) => send({ type: "act.provoke", mover, from }), [send]);
  const cast = useCallback((caster: ActorRef, spellId: string, targets: ActorRef[], method?: CastMethod, overrides?: AttackOverrides, readied?: boolean, reaction?: string) => send({ type: "act.cast", caster, spellId, targets, method, overrides, readied, reaction }), [send]);
  const act = useCallback((actor: ActorRef, kind: ActionKind, options: { target?: ActorRef; skill?: string; dc?: number; note?: string; choice?: string; bonus?: boolean } = {}) => send({ type: "act.action", actor, kind, ...options }), [send]);
  const declineReaction = useCallback((messageId: string) => send({ type: "act.decline", messageId }), [send]);
  const adjustAction = useCallback((messageId: string, overrides: AttackOverrides, reroll?: boolean) => send({ type: "act.adjust", messageId, overrides, reroll }), [send]);
  const undoAction = useCallback((messageId: string) => send({ type: "act.undo", messageId }), [send]);
  const confirmAction = useCallback((messageId: string) => send({ type: "act.confirm", messageId }), [send]);
  const updateArt = useCallback((id: string, patch: { name?: string; folder?: string; tags?: string[] }) => send({ type: "art.update", id, ...patch }), [send]);
  const removeArt = useCallback((id: string) => send({ type: "art.remove", id }), [send]);
  const requestArt = useCallback((id: string) => {
    const client = clientRef.current;
    if (!client || artRequests.current.has(id)) return;
    const asset = client.snapshot?.art.find((item) => item.id === id);
    if (!asset) return;
    artRequests.current.add(id);
    setArtUrls((map) => (map[id] ? map : { ...map, [id]: "loading" }));
    (async () => {
      const cached = await store?.getAsset(asset.hash);
      if (cached) { setArtUrls((map) => ({ ...map, [id]: cached.dataUrl })); return; }
      setArtPending((count) => count + 1);
      try {
        const { hash, dataUrl } = await client.fetchArt(id);
        await store?.putAsset({ hash, dataUrl, bytes: dataUrl.length, savedAt: new Date().toISOString() });
        setArtUrls((map) => ({ ...map, [id]: dataUrl }));
      } catch (error) {
        console.warn("art fetch failed", id, error);
        setArtUrls((map) => ({ ...map, [id]: "error" }));
        artRequests.current.delete(id);
      } finally { setArtPending((count) => Math.max(0, count - 1)); }
    })();
  }, [store]);

  useEffect(() => () => { clientRef.current?.leave(); hostRef.current?.close(); }, []);

  const client = clientRef.current;
  const table = useMemo<TableState>(() => ({ role, status: client ? client.status : "idle", reason: client?.reason ?? null, campaignId, snapshot: client?.snapshot ?? null, invite, invites, transportNote, refusals, shows, artUrls, artPending }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [role, client, campaignId, invite, invites, transportNote, refusals, shows, artUrls, artPending, tick]);
  const value = useMemo<CampaignsState>(() => ({ userId, displayName, setDisplayName, campaigns, joined, archives, journals, arts, pages, createCampaign, updateCampaign, deleteCampaign, regenerateJoinCode, forgetJoined, table, launch, join, leave, say, sendRoll, setRole, kick, putJournal, removeJournal, showJournal, dismissShow, uploadArt, updateArt, removeArt, requestArt, putPage, removePage, setRibbon, setBookmark, putToken, removeToken, setTracker, addTurn, nextTurn, swapTurn, attack, npcSave, legendary, useItem, useTrait, advanceTime, tableRest, askRest, saveMacros, saveTables, rollTable, summon, dismissSummons, resist, provoke, act, cast, declineReaction, adjustAction, undoAction, confirmAction }),
    [userId, displayName, setDisplayName, campaigns, joined, archives, journals, arts, pages, createCampaign, updateCampaign, deleteCampaign, regenerateJoinCode, forgetJoined, table, launch, join, leave, say, sendRoll, setRole, kick, putJournal, removeJournal, showJournal, dismissShow, uploadArt, updateArt, removeArt, requestArt, putPage, removePage, setRibbon, setBookmark, putToken, removeToken, setTracker, addTurn, nextTurn, swapTurn, attack, npcSave, legendary, useItem, useTrait, advanceTime, tableRest, askRest, saveMacros, saveTables, rollTable, summon, dismissSummons, resist, adjustAction, undoAction, confirmAction]);
  return <CampaignsContext.Provider value={value}>{children}</CampaignsContext.Provider>;
}

/** Token bar links (D78): what a character attribute is worth right now. */
export function attributeOf(entry: JournalCharacter, link: string, catalog: ReturnType<typeof useClient>["catalog"]): { value?: number; max?: number } | undefined {
  const runtime = entry.runtime;
  if (link === "hp") { const derived = deriveCharacter(entry.source, catalog, { equipped: runtime.equipped, inventory: runtime.inventory, effects: runtime.effects }); return { value: runtime.hp.current, max: derived.hp.max }; }
  if (link === "temp") return { value: runtime.hp.temp };
  if (link === "ac") return { value: deriveCharacter(entry.source, catalog, { equipped: runtime.equipped, inventory: runtime.inventory, effects: runtime.effects }).ac.value };
  if (link === "exhaustion") return { value: runtime.exhaustion, max: 6 };
  return undefined;
}

/** Dimensions and a small thumbnail (≤128px, webp) of an image data URL; null where there is no DOM. */
async function imageProbe(dataUrl: string): Promise<{ width: number; height: number; thumb?: string } | null> {
  if (typeof Image === "undefined" || typeof document === "undefined") return null;
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      let thumb: string | undefined;
      try {
        const scale = Math.min(1, 128 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
        thumb = canvas.toDataURL("image/webp", 0.7);
        if (thumb.length > 24_000) thumb = undefined;
      } catch { thumb = undefined; }
      resolve({ width: image.naturalWidth, height: image.naturalHeight, thumb });
    };
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
}

/** The bytes of an `art:<id>` reference (or a plain data URL) as this viewer has them; requests them when missing. */
export function useArtUrl(ref: string | undefined): { url: string | null; thumb?: string; status: "ready" | "loading" | "error" | "none" } {
  const c = useCampaigns();
  const id = ref && ref.startsWith("art:") ? ref.slice(4) : null;
  const state = id ? c.table.artUrls[id] : undefined;
  const asset = id ? c.table.snapshot?.art.find((item) => item.id === id) : undefined;
  useEffect(() => { if (id && !state && asset) c.requestArt(id); }, [id, state, asset, c]);
  if (!ref) return { url: null, status: "none" };
  if (!id) return { url: ref, status: "ready" };
  if (state && state !== "loading" && state !== "error") return { url: state, thumb: asset?.thumb, status: "ready" };
  return { url: null, thumb: asset?.thumb, status: state === "error" ? "error" : asset ? "loading" : "none" };
}

export function useCampaigns() {
  const value = useContext(CampaignsContext);
  if (!value) throw new Error("useCampaigns outside CampaignsProvider");
  return value;
}
