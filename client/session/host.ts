/**
 * The launched table's authority (the DM's app). Validates the campaign's fixed join code, refuses kicked players,
 * keeps presence, turns chat commands into archive messages, applies GM-only player management, holds the journal
 * with its two permission fields, and numbers every event for the mirrors. Every event is projected per viewer
 * when sent (chat visibility, journal permissions and GM notes), also on a reconnect replay. Persistence happens
 * through callbacks: the campaign (players), the chat archive and journal entries.
 */
import type { ArtAsset } from "../campaign/art";
import { ART_LIMIT, artVisible, canManageArt, ChunkAssembler, chunkText } from "../campaign/art";
import type { JournalCharacter, JournalEntry } from "../campaign/journal";
import { canEdit, canView, mergePlayerEdit, projectEntry } from "../campaign/journal";
import type { Page, Token } from "../campaign/page";
import { controlsToken, mergeControllerTokenEdit, playerPageId, projectPage, projectToken } from "../campaign/page";
import type { Campaign, ChatMessage, PlayerRole } from "../campaign/model";
import { newMessageId, withPlayer, withPlayerKicked, withPlayerRole } from "../campaign/model";
import { rollFormula } from "../character/dice";
import { parseChatInput, renderInline, visibleTo } from "./chat";
import type { ClientCommand, HostMessage, Presence, TableEvent, TableSnapshot } from "./protocol";
import { PROTOCOL_VERSION, isClientCommand } from "./protocol";
import type { Transport } from "./transport";

const EVENT_BUFFER = 5000;
const SNAPSHOT_CHAT = 300;
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
type Viewer = { userId: string; role: PlayerRole };

export interface TableHostOptions {
  campaign: Campaign;
  hostUserId: string;
  hostSecret?: string;
  archive?: ChatMessage[];
  journal?: JournalEntry[];
  art?: ArtAsset[];
  /** Where the host keeps image bytes by hash (its store); uploads are put here, fetches read from here. */
  artData?: { get(hash: string): Promise<string | undefined>; put(hash: string, dataUrl: string): Promise<void> | void };
  onCampaign?: (campaign: Campaign) => void;
  onChat?: (message: ChatMessage) => void;
  /** An entry was created or changed (persist it), or removed (`{ removed: id }`). */
  onJournal?: (change: { entry: JournalEntry } | { removed: string }) => void;
  onArt?: (change: { asset: ArtAsset } | { removed: string }) => void;
  pages?: Page[];
  onPage?: (change: { page: Page } | { removed: string }) => void;
  /** Linked bars (D78): the host app derives a character's attribute values with its catalog; hp is at least current/max. */
  attributeOf?: (entry: JournalCharacter, link: string) => { value?: number; max?: number } | undefined;
  now?: () => string;
  random?: () => number;
}

export class TableHost {
  private campaign: Campaign;
  private chat: ChatMessage[];
  private journalEntries: Map<string, JournalEntry>;
  private artAssets: Map<string, ArtAsset>;
  private pages: Map<string, Page>;
  /** Uploads in flight: metadata waiting for its chunks. */
  private readonly uploads = new Map<string, { asset: ArtAsset; by: string }>();
  private readonly assembler = new ChunkAssembler();
  private readonly connected = new Set<string>();
  private readonly peerUsers = new Map<string, string>();
  private readonly peerTransports = new Map<string, Transport>();
  private readonly transports: Transport[] = [];
  private readonly unsubscribe: Array<() => void> = [];
  /** Buffered unprojected; projected per viewer when sent or replayed. */
  private events: TableEvent[] = [];
  private n = 0;
  private readonly listeners = new Set<(event: TableEvent) => void>();
  private readonly now: () => string;

  constructor(transport: Transport | Transport[], private readonly options: TableHostOptions) {
    this.campaign = options.campaign;
    this.chat = [...(options.archive ?? [])];
    this.journalEntries = new Map((options.journal ?? []).map((entry) => [entry.id, entry]));
    this.artAssets = new Map((options.art ?? []).map((asset) => [asset.id, asset]));
    this.pages = new Map((options.pages ?? []).map((page) => [page.id, page]));
    this.now = options.now ?? (() => new Date().toISOString());
    this.connected.add(options.hostUserId);
    for (const carrier of Array.isArray(transport) ? transport : [transport]) this.attach(carrier);
  }

  get state() { return this.campaign; }
  get archive() { return this.chat; }
  get journal() { return [...this.journalEntries.values()]; }
  get art() { return [...this.artAssets.values()]; }
  get pageList() { return [...this.pages.values()].sort((a, b) => a.order - b.order); }

  attach(carrier: Transport) {
    if (this.transports.includes(carrier)) return;
    this.transports.push(carrier);
    this.unsubscribe.push(carrier.onMessage((from, message) => { if (isClientCommand(message)) { this.peerTransports.set(from, carrier); this.handle(from, message); } }));
    this.unsubscribe.push(carrier.onPeer((peerId, state) => { if (state === "disconnected") this.peerLeft(peerId); }));
  }

  onEvent(listener: (event: TableEvent) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }

  /** The campaign document changed outside (GM edited settings or the code): take it, re-check kicked players. */
  updateCampaign(campaign: Campaign) {
    const before = this.campaign;
    this.campaign = campaign;
    for (const [peerId, userId] of [...this.peerUsers]) {
      if (campaign.players.find((player) => player.userId === userId)?.kicked) { this.reply(peerId, { type: "refused", reason: "GM이 내보냈습니다", commandType: "kicked" }); this.peerLeft(peerId); }
    }
    for (const player of campaign.players) this.emit({ type: "presence", player: this.presence(player.userId) });
    if (JSON.stringify(before.settings) !== JSON.stringify(campaign.settings)) this.emit({ type: "settings", settings: campaign.settings });
    if (before.playerPageId !== campaign.playerPageId || JSON.stringify(before.pageBookmarks ?? {}) !== JSON.stringify(campaign.pageBookmarks ?? {})) this.emitRibbon();
    // A role change alters what each viewer may see: resend the journal so mirrors converge.
    if (before.players.some((player) => player.role !== campaign.players.find((item) => item.userId === player.userId)?.role)) for (const entry of this.journalEntries.values()) this.emit({ type: "journal", entry });
  }

  /** The GM's own app edits an entry directly (same rules as a GM command). */
  putJournal(entry: JournalEntry) { this.storeEntry({ ...entry, campaignId: this.campaign.id, updatedAt: this.now() }); }
  removeJournal(id: string) { this.dropEntry(id); }

  snapshot(viewer: Viewer): TableSnapshot {
    return {
      campaignId: this.campaign.id,
      name: this.campaign.name,
      settings: this.campaign.settings,
      players: this.campaign.players.filter((player) => !player.kicked).map((player) => this.presence(player.userId)),
      chat: this.chat.filter((message) => visibleTo(message, viewer)).slice(-SNAPSHOT_CHAT),
      journal: [...this.journalEntries.values()].map((entry) => projectEntry(entry, viewer)).filter((entry): entry is JournalEntry => entry !== null),
      art: [...this.artAssets.values()].filter((asset) => artVisible(asset, viewer, this.journal)),
      pages: this.pageList.map((page) => projectPage(page, viewer, this.campaign)).filter((page): page is Page => page !== null),
      playerPageId: this.campaign.playerPageId,
      pageBookmarks: this.campaign.pageBookmarks ?? {},
      lastEventN: this.n,
    };
  }

  close() {
    this.emit({ type: "closed" });
    for (const off of this.unsubscribe) off();
    for (const carrier of this.transports) carrier.close();
  }

  private presence(userId: string): Presence {
    const player = this.campaign.players.find((item) => item.userId === userId)!;
    return { userId, displayName: player.displayName, role: player.role, color: player.color, connected: this.connected.has(userId) };
  }

  private roleOf(userId: string): PlayerRole { return this.campaign.players.find((item) => item.userId === userId)?.role ?? "player"; }
  private viewer(userId: string): Viewer { return { userId, role: this.roleOf(userId) }; }

  private setCampaign(campaign: Campaign) { this.campaign = campaign; this.options.onCampaign?.(campaign); }

  private handle(peerId: string, command: ClientCommand) {
    if (command.type === "hello") {
      if (command.protocol !== PROTOCOL_VERSION) return this.reply(peerId, { type: "refused", reason: `버전이 다릅니다 (호스트 ${PROTOCOL_VERSION}, 참가자 ${command.protocol}). 같은 빌드를 쓰세요.`, commandType: "hello" });
      if (command.joinCode.toUpperCase() !== this.campaign.joinCode) return this.reply(peerId, { type: "refused", reason: "참가 코드가 맞지 않습니다", commandType: "hello" });
      const isHostUser = command.userId === this.options.hostUserId;
      if (isHostUser && (!this.options.hostSecret || command.hostSecret !== this.options.hostSecret)) return this.reply(peerId, { type: "refused", reason: "호스트와 같은 사용자 id입니다", commandType: "hello" });
      const existing = this.campaign.players.find((player) => player.userId === command.userId);
      if (existing?.kicked) return this.reply(peerId, { type: "refused", reason: "GM이 이 캠페인에서 내보낸 참가자입니다", commandType: "hello" });
      const isNew = !existing;
      this.setCampaign(withPlayer(this.campaign, { userId: command.userId, displayName: command.displayName.trim() || "플레이어" }, this.now()));
      this.peerUsers.set(peerId, command.userId);
      this.connected.add(command.userId);
      const viewer = this.viewer(command.userId);
      const since = command.lastEventN;
      if (since !== undefined && since < this.n && this.events.length && this.events[0].n <= since + 1) this.reply(peerId, { type: "events", events: this.events.filter((event) => event.n > since).map((event) => this.project(event, viewer)).filter((event): event is TableEvent => event !== null) });
      else this.reply(peerId, { type: "welcome", snapshot: this.snapshot(viewer) });
      this.emit({ type: "presence", player: this.presence(command.userId) });
      if (!isHostUser) this.say({ type: "system", who: "", content: `${this.presence(command.userId).displayName} 입장${isNew ? " (처음)" : ""}` });
      return;
    }
    const userId = this.peerUsers.get(peerId);
    if (!userId) return this.reply(peerId, { type: "refused", reason: "먼저 입장하세요", commandType: command.type });
    if (command.type === "bye") { this.peerLeft(peerId); return; }
    this.apply(userId, command, peerId);
  }

  private apply(userId: string, command: ClientCommand, peerId: string) {
    const player = this.campaign.players.find((item) => item.userId === userId);
    if (!player) return;
    const isGm = player.role === "gm";
    const refuse = (reason: string) => this.reply(peerId, { type: "refused", reason, commandType: command.type });
    switch (command.type) {
      case "chat.say": {
        const input = parseChatInput(command.text);
        switch (input.kind) {
          case "empty": return;
          case "say": {
            const rolls = input.inline.map((formula) => rollFormula({ label: "", formula }, this.options.random));
            this.say({ type: "general", who: player.displayName, playerId: userId, content: rolls.length ? renderInline(input.text, rolls.map((roll) => roll.total)) : input.text });
            return;
          }
          case "whisper": {
            const target = input.target.toLowerCase() === "gm" ? "gm" : this.campaign.players.find((item) => item.displayName.toLowerCase() === input.target.toLowerCase())?.userId;
            if (!target) return refuse(`"${input.target}"라는 참가자가 없습니다 (/w gm 도 됩니다)`);
            this.say({ type: "whisper", who: player.displayName, playerId: userId, target, content: input.text });
            return;
          }
          case "emote": this.say({ type: "emote", who: player.displayName, playerId: userId, content: input.text }); return;
          case "desc": if (!isGm) return refuse("/desc 는 GM만 씁니다"); this.say({ type: "desc", who: player.displayName, playerId: userId, content: input.text }); return;
          case "roll": {
            const roll = rollFormula({ label: input.label ?? "", formula: input.formula }, this.options.random);
            this.say({ type: input.mode === "gm" ? "gmroll" : "rollresult", who: player.displayName, playerId: userId, target: input.mode === "self" ? userId : undefined, content: input.label ?? "", roll: { formula: input.formula, total: roll.total, dice: roll.dice.map((die) => ({ sides: die.sides, value: die.value })), modifier: roll.modifier, label: input.label } });
            return;
          }
        }
        return;
      }
      case "chat.roll": {
        const roll = command.roll;
        this.say({ type: command.mode === "gm" ? "gmroll" : "rollresult", who: player.displayName, playerId: userId, target: command.mode === "self" ? userId : undefined, content: roll.label ?? "", roll });
        return;
      }
      case "player.role": {
        if (!isGm) return refuse("GM만 역할을 바꿉니다");
        if (command.userId === this.options.hostUserId && command.role !== "gm") return refuse("호스트는 GM에서 내릴 수 없습니다");
        this.setCampaign(withPlayerRole(this.campaign, command.userId, command.role));
        this.emit({ type: "presence", player: this.presence(command.userId) });
        this.say({ type: "system", who: "", content: `${this.presence(command.userId).displayName} → ${command.role === "gm" ? "GM" : "플레이어"}` });
        for (const entry of this.journalEntries.values()) this.emit({ type: "journal", entry });
        return;
      }
      case "player.kick": {
        if (!isGm) return refuse("GM만 내보냅니다");
        if (command.userId === this.options.hostUserId) return refuse("호스트는 내보낼 수 없습니다");
        const name = this.presence(command.userId).displayName;
        this.setCampaign(withPlayerKicked(this.campaign, command.userId, true));
        for (const [otherPeer, otherUser] of [...this.peerUsers]) if (otherUser === command.userId) { this.reply(otherPeer, { type: "refused", reason: "GM이 내보냈습니다", commandType: "kicked" }); this.peerLeft(otherPeer); }
        this.emit({ type: "kicked", userId: command.userId });
        this.say({ type: "system", who: "", content: `${name} 내보냄` });
        return;
      }
      case "journal.put": {
        const incoming = command.entry;
        if (!incoming || typeof incoming.id !== "string" || (incoming.kind !== "handout" && incoming.kind !== "character")) return refuse("저널 항목 형식이 아닙니다");
        const stored = this.journalEntries.get(incoming.id);
        const now = this.now();
        if (isGm) { this.storeEntry({ ...incoming, campaignId: this.campaign.id, updatedAt: now, createdAt: stored?.createdAt ?? incoming.createdAt ?? now }); return; }
        if (!stored) {
          if (incoming.kind !== "character") return refuse("핸드아웃은 GM만 만듭니다");
          if (!this.campaign.settings.playersCanCreateCharacters) return refuse("이 캠페인에서는 플레이어가 캐릭터를 만들 수 없습니다 (캠페인 설정)");
          // A player's new character is theirs: in their journal, controlled by them, in the root folder.
          this.storeEntry({ ...incoming, campaignId: this.campaign.id, folder: "", canView: [userId], canEdit: [userId], gmNotes: "", archived: false, createdBy: userId, createdAt: now, updatedAt: now });
          this.say({ type: "system", who: "", content: `${player.displayName}이(가) 캐릭터 "${incoming.name}"을(를) 만들었습니다` });
          return;
        }
        if (!canEdit(stored, this.viewer(userId))) return refuse("이 항목을 고칠 권한이 없습니다");
        this.storeEntry(mergePlayerEdit(stored, incoming, now));
        return;
      }
      case "journal.remove": {
        if (!isGm) return refuse("GM만 저널 항목을 지웁니다");
        this.dropEntry(command.id);
        return;
      }
      case "journal.show": {
        if (!isGm) return refuse("GM만 플레이어에게 보여줍니다");
        if (!this.journalEntries.has(command.id)) return refuse("그 항목이 없습니다");
        this.emit({ type: "journal.show", id: command.id, by: userId });
        return;
      }
      case "art.upload": {
        const asset = command.asset;
        if (!asset || typeof asset.id !== "string" || typeof asset.hash !== "string") return refuse("아트 형식이 아닙니다");
        if (asset.bytes > ART_LIMIT) return refuse("이미지가 너무 큽니다 (20MB까지)");
        if (this.artAssets.has(asset.id)) return refuse("이미 있는 아트 id입니다");
        this.uploads.set(asset.id, { asset: { ...asset, campaignId: this.campaign.id, ownerId: userId, createdAt: this.now(), updatedAt: this.now() }, by: userId });
        if (command.total === 0) void this.finishUpload(asset.id, "");
        return;
      }
      case "art.chunk": {
        const upload = this.uploads.get(command.id);
        if (!upload || upload.by !== userId) return refuse("업로드 중인 아트가 아닙니다");
        const whole = this.assembler.add(command.id, command.index, command.total, command.data);
        if (whole !== null) void this.finishUpload(command.id, whole);
        return;
      }
      case "art.update": {
        const asset = this.artAssets.get(command.id);
        if (!asset) return refuse("그 아트가 없습니다");
        if (!canManageArt(asset, this.viewer(userId))) return refuse("이 아트를 고칠 권한이 없습니다");
        const next: ArtAsset = { ...asset, name: command.name?.trim() || asset.name, folder: command.folder ?? asset.folder, tags: command.tags ?? asset.tags, updatedAt: this.now() };
        this.artAssets.set(next.id, next);
        this.options.onArt?.({ asset: next });
        this.emit({ type: "art", asset: next });
        return;
      }
      case "art.remove": {
        const asset = this.artAssets.get(command.id);
        if (!asset) return refuse("그 아트가 없습니다");
        if (!canManageArt(asset, this.viewer(userId))) return refuse("이 아트를 지울 권한이 없습니다");
        this.artAssets.delete(command.id);
        this.options.onArt?.({ removed: command.id });
        this.emit({ type: "art.removed", id: command.id });
        return;
      }
      case "art.fetch": {
        const asset = this.artAssets.get(command.id);
        if (!asset || !artVisible(asset, this.viewer(userId), this.journal)) return this.reply(peerId, { type: "refused", reason: "볼 수 없는 아트입니다", commandType: command.type, id: command.id });
        void this.sendArt(peerId, asset);
        return;
      }
      case "page.put": {
        if (!isGm) return refuse("GM만 페이지를 만들고 고칩니다");
        const incoming = command.page;
        if (!incoming || typeof incoming.id !== "string" || typeof incoming.grid !== "object") return refuse("페이지 형식이 아닙니다");
        const stored = this.pages.get(incoming.id);
        const page: Page = { ...incoming, kind: "page", campaignId: this.campaign.id, tokens: stored ? stored.tokens : (incoming.tokens ?? []), createdAt: stored?.createdAt ?? incoming.createdAt ?? this.now(), updatedAt: this.now() };
        this.storePage(page);
        return;
      }
      case "page.remove": {
        if (!isGm) return refuse("GM만 페이지를 지웁니다");
        if (!this.pages.delete(command.id)) return refuse("그 페이지가 없습니다");
        this.options.onPage?.({ removed: command.id });
        this.emit({ type: "page.removed", id: command.id });
        if (this.campaign.playerPageId === command.id) { this.setCampaign({ ...this.campaign, playerPageId: undefined, updatedAt: this.now() }); this.emitRibbon(); }
        return;
      }
      case "page.ribbon": {
        if (!isGm) return refuse("GM만 플레이어 리본을 옮깁니다");
        if (!this.pages.has(command.pageId)) return refuse("그 페이지가 없습니다");
        this.setCampaign({ ...this.campaign, playerPageId: command.pageId, updatedAt: this.now() });
        this.emitRibbon();
        return;
      }
      case "page.bookmark": {
        if (!isGm) return refuse("GM만 파티를 나눕니다");
        if (command.pageId && !this.pages.has(command.pageId)) return refuse("그 페이지가 없습니다");
        const bookmarks = { ...(this.campaign.pageBookmarks ?? {}) };
        if (command.pageId) bookmarks[command.userId] = command.pageId; else delete bookmarks[command.userId];
        this.setCampaign({ ...this.campaign, pageBookmarks: bookmarks, updatedAt: this.now() });
        this.emitRibbon();
        return;
      }
      case "token.put": {
        const page = this.pages.get(command.pageId);
        if (!page) return refuse("그 페이지가 없습니다");
        const incoming = command.token;
        if (!incoming || typeof incoming.id !== "string" || !Array.isArray(incoming.bars)) return refuse("토큰 형식이 아닙니다");
        const stored = page.tokens.find((token) => token.id === incoming.id);
        const viewer = this.viewer(userId);
        let next: Token;
        if (isGm) next = this.withLinkedBars(incoming);
        else if (!stored) {
          // A player may put their own character on the page they are on.
          const entry = incoming.represents ? this.journalEntries.get(incoming.represents) : undefined;
          if (page.id !== playerPageId(this.campaign, viewer)) return refuse("지금 보는 페이지에만 토큰을 놓을 수 있습니다");
          if (!entry || !canEdit(entry, viewer)) return refuse("자기 캐릭터의 토큰만 놓을 수 있습니다");
          next = this.withLinkedBars({ ...incoming, layer: "objects", controlledBy: "inherit", gmNotes: "", locked: false });
        } else {
          if (!controlsToken(stored, viewer, this.journal)) return refuse("이 토큰을 움직일 권한이 없습니다");
          if (stored.locked) return refuse("잠긴 토큰입니다");
          next = mergeControllerTokenEdit(stored, incoming);
          this.applyBarEditsToCharacter(stored, next, userId);
          next = this.withLinkedBars(next);
        }
        this.storeToken(page, next);
        return;
      }
      case "token.remove": {
        const page = this.pages.get(command.pageId);
        const stored = page?.tokens.find((token) => token.id === command.id);
        if (!page || !stored) return refuse("그 토큰이 없습니다");
        if (!controlsToken(stored, this.viewer(userId), this.journal)) return refuse("이 토큰을 지울 권한이 없습니다");
        const next = { ...page, tokens: page.tokens.filter((token) => token.id !== command.id), updatedAt: this.now() };
        this.pages.set(page.id, next);
        this.options.onPage?.({ page: next });
        this.emit({ type: "token.removed", pageId: page.id, id: command.id });
        return;
      }
      case "ping": {
        const page = this.pages.get(command.pageId);
        if (!page) return;
        if (!isGm && page.id !== playerPageId(this.campaign, this.viewer(userId))) return;
        this.emit({ type: "ping", pageId: page.id, x: command.x, y: command.y, by: userId, color: player.color });
        return;
      }
      default: return;
    }
  }

  /** The ribbon or a bookmark moved: every mirror learns it, then every page is resent so each player ends up with exactly their page. */
  private emitRibbon() {
    this.emit({ type: "ribbon", playerPageId: this.campaign.playerPageId, pageBookmarks: this.campaign.pageBookmarks ?? {} });
    for (const page of this.pages.values()) this.emit({ type: "page", page });
  }

  private storePage(page: Page) {
    this.pages.set(page.id, page);
    this.options.onPage?.({ page });
    this.emit({ type: "page", page });
  }

  private storeToken(page: Page, token: Token) {
    const index = page.tokens.findIndex((item) => item.id === token.id);
    const next: Page = { ...page, tokens: index >= 0 ? page.tokens.map((item, at) => (at === index ? token : item)) : [...page.tokens, token], updatedAt: this.now() };
    this.pages.set(page.id, next);
    this.options.onPage?.({ page: next });
    this.emit({ type: "token", pageId: page.id, token });
  }

  /** Bars linked to a character attribute mirror the sheet (D78). */
  private withLinkedBars(token: Token): Token {
    const entry = token.represents ? this.journalEntries.get(token.represents) : undefined;
    if (!entry || entry.kind !== "character" || !this.options.attributeOf) return token;
    return { ...token, bars: token.bars.map((bar) => { if (!bar.link) return bar; const attribute = this.options.attributeOf!(entry, bar.link); return attribute ? { ...bar, value: attribute.value, max: attribute.max } : bar; }) as Token["bars"] };
  }

  /** A controller changed a linked, editable bar (bar 1 = hp): the character's sheet takes the value. */
  private applyBarEditsToCharacter(before: Token, after: Token, userId: string) {
    const entry = after.represents ? this.journalEntries.get(after.represents) : undefined;
    if (!entry || entry.kind !== "character") return;
    for (let index = 0; index < 3; index += 1) {
      const bar = after.bars[index];
      if (bar.link !== "hp" || !bar.editable || bar.value === undefined || bar.value === before.bars[index].value) continue;
      const runtime = { ...entry.runtime, hp: { ...entry.runtime.hp, current: Math.max(0, bar.value) }, updatedAt: this.now() };
      const player = this.campaign.players.find((item) => item.userId === userId);
      this.storeEntry({ ...entry, runtime, updatedAt: this.now() });
      this.say({ type: "system", who: "", content: `${player?.displayName ?? "?"}: ${entry.name} HP ${before.bars[index].value ?? "?"} → ${bar.value}` });
    }
  }

  /** Tokens representing a changed character refresh their linked bars. */
  private refreshTokensOf(entry: JournalEntry) {
    if (entry.kind !== "character") return;
    for (const page of this.pages.values()) {
      for (const token of page.tokens) {
        if (token.represents !== entry.id) continue;
        const next = this.withLinkedBars({ ...token, name: token.name === entry.name ? token.name : token.name, image: token.image ?? entry.avatar });
        if (JSON.stringify(next.bars) !== JSON.stringify(token.bars)) this.storeToken(this.pages.get(page.id)!, next);
      }
    }
  }

  private async finishUpload(id: string, dataUrl: string) {
    const upload = this.uploads.get(id);
    if (!upload) return;
    this.uploads.delete(id);
    await this.options.artData?.put(upload.asset.hash, dataUrl);
    this.artAssets.set(id, upload.asset);
    this.options.onArt?.({ asset: upload.asset });
    this.emit({ type: "art", asset: upload.asset });
  }

  private async sendArt(peerId: string, asset: ArtAsset) {
    const dataUrl = await this.options.artData?.get(asset.hash);
    if (dataUrl === undefined) return this.reply(peerId, { type: "refused", reason: "호스트에 이 아트의 파일이 없습니다", commandType: "art.fetch", id: asset.id });
    const chunks = chunkText(dataUrl);
    chunks.forEach((data, index) => this.reply(peerId, { type: "art.data", id: asset.id, hash: asset.hash, index, total: chunks.length, data }));
  }

  private storeEntry(entry: JournalEntry) {
    this.journalEntries.set(entry.id, entry);
    this.options.onJournal?.({ entry });
    this.emit({ type: "journal", entry });
    // The entry's avatar may now be visible to more (or fewer) viewers: resend that asset so mirrors converge.
    const ref = entry.avatar;
    if (ref?.startsWith("art:")) { const asset = this.artAssets.get(ref.slice(4)); if (asset) this.emit({ type: "art", asset }); }
    this.refreshTokensOf(entry);
  }

  private dropEntry(id: string) {
    if (!this.journalEntries.delete(id)) return;
    this.options.onJournal?.({ removed: id });
    this.emit({ type: "journal.removed", id });
  }

  private say(body: Omit<ChatMessage, "id" | "at">) {
    const message: ChatMessage = { ...body, id: newMessageId(), at: this.now() };
    this.chat = [...this.chat, message];
    this.options.onChat?.(message);
    this.emit({ type: "chat", message });
  }

  private peerLeft(peerId: string) {
    const userId = this.peerUsers.get(peerId);
    this.peerUsers.delete(peerId);
    if (!userId || [...this.peerUsers.values()].includes(userId)) return;
    if (!this.connected.delete(userId)) return;
    const player = this.campaign.players.find((item) => item.userId === userId);
    if (!player || player.kicked) return;
    this.emit({ type: "presence", player: this.presence(userId) });
    this.say({ type: "system", who: "", content: `${player.displayName} 연결 끊김` });
  }

  /**
   * The event as one viewer receives it: chat by Roll20 visibility; a journal entry projected (GM notes stripped),
   * or turned into a removal when this viewer may not see it (so a mirror that had it drops it); a "show" only to
   * those who can see the entry.
   */
  private project(event: TableEvent, viewer: Viewer): TableEvent | null {
    switch (event.type) {
      case "chat": return visibleTo(event.message, viewer) ? event : null;
      case "journal": { const entry = projectEntry(event.entry, viewer); return entry ? { ...event, entry } : { n: event.n, type: "journal.removed", id: event.entry.id }; }
      case "journal.show": { const entry = this.journalEntries.get(event.id); return entry && canView(entry, viewer) ? event : null; }
      case "art": return artVisible(event.asset, viewer, this.journal) ? event : { n: event.n, type: "art.removed", id: event.asset.id };
      case "page": { const page = projectPage(event.page, viewer, this.campaign); return page ? { ...event, page } : { n: event.n, type: "page.removed", id: event.page.id }; }
      case "token": { if (viewer.role === "gm") return event; const page = this.pages.get(event.pageId); if (!page || page.archived || page.id !== playerPageId(this.campaign, viewer)) return null; const token = projectToken(event.token, viewer); return token ? { ...event, token } : { n: event.n, type: "token.removed", pageId: event.pageId, id: event.token.id }; }
      case "token.removed": case "ping": { if (viewer.role === "gm") return event; return event.pageId === playerPageId(this.campaign, viewer) ? event : null; }
      case "ribbon": {
        if (viewer.role === "gm") return event;
        // A player's page changed: they get their new page whole (the mirror replaces what it had).
        return event;
      }
      default: return event;
    }
  }

  private emit(body: DistributiveOmit<TableEvent, "n">) {
    this.n += 1;
    const event = { ...body, n: this.n } as TableEvent;
    this.events = [...this.events, event].slice(-EVENT_BUFFER);
    for (const [peerId, userId] of this.peerUsers) { const projected = this.project(event, this.viewer(userId)); if (projected) this.reply(peerId, { type: "events", events: [projected] }); }
    for (const listener of [...this.listeners]) listener(event);
  }

  private reply(peerId: string, message: HostMessage) { (this.peerTransports.get(peerId) ?? this.transports[0]).send(peerId, message); }
}
