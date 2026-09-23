/**
 * A table participant's mirror: sends commands, applies the host's numbered events, remembers the last event
 * number for a reconnect, and reports refusals (wrong code, kicked).
 */
import { ChunkAssembler } from "../campaign/art";
import { emptyTracker } from "../campaign/tracker";
import type { ClientCommand, HostMessage, TableEvent, TableSnapshot } from "./protocol";
import type { RuleModuleJson } from "../catalog/types";
import { PROTOCOL_VERSION, isHostMessage } from "./protocol";
import type { Transport } from "./transport";
import { emptyClock } from "../campaign/model";

export type TableStatus = "connecting" | "joined" | "refused" | "disconnected" | "closed";

export interface TableClientOptions { userId: string; displayName: string; joinCode: string; hostSecret?: string; /** R25 (D126): this browser profile's own secret, proving the user id is really theirs. */ seat?: string }

export class TableClient {
  private snapshotState: TableSnapshot | null = null;
  private statusState: TableStatus = "connecting";
  private refusal: string | null = null;
  private lastEventN = 0;
  /** R24 (D122): which run of the host `lastEventN` belongs to; a different one means the numbering is unrelated. */
  private sessionId: string | null = null;
  /** R24: one resync in flight at a time, so a burst of out-of-order frames asks for the snapshot once. */
  private resyncing = false;
  private readonly listeners = new Set<() => void>();
  private readonly refusedListeners = new Set<(reason: string, commandType?: string) => void>();
  private readonly showListeners = new Set<(id: string) => void>();
  private readonly assembler = new ChunkAssembler();
  /** R83 (D217): content modules being fetched from the host. */
  private readonly contentWaiters = new Map<string, { resolve: (module: RuleModuleJson) => void; reject: (error: Error) => void }>();
  private readonly artWaiters = new Map<string, { resolve: (value: { hash: string; dataUrl: string }) => void; reject: (error: Error) => void; progress?: (done: number, total: number) => void }>();
  private readonly unsubscribe: Array<() => void> = [];

  constructor(private readonly transport: Transport, private readonly options: TableClientOptions) {
    this.unsubscribe.push(transport.onMessage((_from, message) => { if (isHostMessage(message)) this.receive(message); }));
    this.unsubscribe.push(transport.onPeer((peerId, state) => {
      if (peerId !== "host") return;
      if (state === "connected") this.hello();
      else if (this.statusState !== "closed" && this.statusState !== "refused") { this.statusState = "disconnected"; this.notify(); }
    }));
  }

  get status() { return this.statusState; }
  get reason() { return this.refusal; }
  get snapshot() { return this.snapshotState; }
  get userId() { return this.options.userId; }

  hello() {
    this.send({ type: "hello", protocol: PROTOCOL_VERSION, userId: this.options.userId, displayName: this.options.displayName, joinCode: this.options.joinCode, lastEventN: this.snapshotState ? this.lastEventN : undefined, sessionId: this.sessionId ?? undefined, hostSecret: this.options.hostSecret, seat: this.options.seat });
  }

  send(command: ClientCommand) { this.transport.send("host", command); }

  /** Ask the host for an asset's bytes; resolves with the data URL once every chunk arrived (one request per id at a time). */
  fetchArt(id: string, progress?: (done: number, total: number) => void): Promise<{ hash: string; dataUrl: string }> {
    return new Promise((resolve, reject) => {
      if (this.artWaiters.has(id)) { reject(new Error("이미 받는 중입니다")); return; }
      this.artWaiters.set(id, { resolve, reject, progress });
      this.send({ type: "art.fetch", id });
    });
  }
  /** R83 (D217): fetch a content module the snapshot lists; resolves with the module once every chunk arrived. */
  fetchContent(moduleId: string): Promise<RuleModuleJson> {
    return new Promise((resolve, reject) => {
      if (this.contentWaiters.has(moduleId)) { reject(new Error("이미 받는 중입니다")); return; }
      this.contentWaiters.set(moduleId, { resolve, reject });
      this.send({ type: "content.fetch", moduleId });
    });
  }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  onRefused(listener: (reason: string, commandType?: string) => void) { this.refusedListeners.add(listener); return () => { this.refusedListeners.delete(listener); }; }
  /** The GM pressed "플레이어에게 보여주기" on an entry this viewer can see. */
  onShow(listener: (id: string) => void) { this.showListeners.add(listener); return () => { this.showListeners.delete(listener); }; }

  leave() {
    for (const [id, waiter] of this.artWaiters) { waiter.reject(new Error("연결이 끝났습니다")); this.assembler.drop(id); }
    this.artWaiters.clear();
    if (this.statusState === "joined") this.send({ type: "bye" });
    this.statusState = "closed";
    for (const off of this.unsubscribe) off();
    this.transport.close();
    this.notify();
  }

  private receive(message: HostMessage) {
    switch (message.type) {
      case "welcome":
        this.snapshotState = message.snapshot;
        this.lastEventN = message.snapshot.lastEventN;
        this.sessionId = message.snapshot.sessionId ?? null;
        this.resyncing = false;
        this.statusState = "joined";
        this.refusal = null;
        break;
      case "events":
        if (!this.snapshotState) this.snapshotState = { campaignId: "", name: "", settings: { playersCanCreateCharacters: true, playersCanExportToVault: true, chatAvatars: true }, players: [], chat: [], journal: [], art: [], pages: [], pageBookmarks: {}, tracker: emptyTracker(), macros: [], tables: [], clock: emptyClock(), lastEventN: 0, sessionId: "" };
        this.statusState = "joined";
        for (const event of message.events) this.applyEvent(event);
        break;
      case "art.data": {
        const waiter = this.artWaiters.get(message.id);
        const whole = this.assembler.add(message.id, message.index, message.total, message.data);
        if (whole === null) { const progress = this.assembler.progress(message.id); if (progress) waiter?.progress?.(progress.done, progress.total); return; }
        this.artWaiters.delete(message.id);
        waiter?.resolve({ hash: message.hash, dataUrl: whole });
        return;
      }
      case "content.data": {
        const whole = this.assembler.add(`content:${message.moduleId}`, message.index, message.total, message.data);
        if (whole === null) return;
        const waiter = this.contentWaiters.get(message.moduleId);
        this.contentWaiters.delete(message.moduleId);
        try { waiter?.resolve(JSON.parse(whole) as RuleModuleJson); } catch (error) { waiter?.reject(error as Error); }
        return;
      }
      case "refused":
        if (message.commandType === "content.fetch" && message.id) { const waiter = this.contentWaiters.get(message.id); this.contentWaiters.delete(message.id); this.assembler.drop(`content:${message.id}`); waiter?.reject(new Error(message.reason)); return; }
        if (message.commandType === "hello" || message.commandType === "kicked") { this.statusState = "refused"; this.refusal = message.reason; }
        if (message.commandType === "art.fetch" && message.id) { const waiter = this.artWaiters.get(message.id); this.artWaiters.delete(message.id); this.assembler.drop(message.id); waiter?.reject(new Error(message.reason)); return; }
        for (const listener of [...this.refusedListeners]) listener(message.reason, message.commandType);
        break;
    }
    this.notify();
  }

  private applyEvent(event: TableEvent) {
    const state = { ...this.snapshotState! };
    if (event.n <= this.lastEventN) return;
    // R24 (D122): a frame that skips a number means one was dropped on the way. Applying it anyway used to move
    // `lastEventN` past the hole, so the missing change never came back — the mirror diverged for good. Ask for a
    // whole snapshot instead and ignore events until it lands.
    if (this.lastEventN && event.n !== this.lastEventN + 1) { if (!this.resyncing) { this.resyncing = true; this.send({ type: "resync" }); } return; }
    if (this.resyncing) return;
    this.lastEventN = event.n;
    state.lastEventN = event.n;
    switch (event.type) {
      case "presence": {
        const index = state.players.findIndex((item) => item.userId === event.player.userId);
        state.players = index >= 0 ? state.players.map((item, at) => (at === index ? event.player : item)) : [...state.players, event.player];
        break;
      }
      case "chat": { const index = state.chat.findIndex((item) => item.id === event.message.id); state.chat = (index >= 0 ? state.chat.map((item, at) => (at === index ? event.message : item)) : [...state.chat, event.message]).slice(-500); break; }
      case "campaign": state.name = event.name; break;
      case "settings": state.settings = event.settings; break;
      case "clock": state.clock = event.clock; break;
      case "macros": state.macros = event.macros; break;
      case "tables": state.tables = event.tables; break;
      case "items": state.items = event.items; break;
      case "journal": {
        const index = state.journal.findIndex((item) => item.id === event.entry.id);
        state.journal = index >= 0 ? state.journal.map((item, at) => (at === index ? event.entry : item)) : [...state.journal, event.entry];
        break;
      }
      case "journal.removed": state.journal = state.journal.filter((item) => item.id !== event.id); break;
      case "art": {
        const index = state.art.findIndex((item) => item.id === event.asset.id);
        state.art = index >= 0 ? state.art.map((item, at) => (at === index ? event.asset : item)) : [...state.art, event.asset];
        break;
      }
      case "art.removed": state.art = state.art.filter((item) => item.id !== event.id); break;
      case "page": {
        const index = state.pages.findIndex((item) => item.id === event.page.id);
        state.pages = index >= 0 ? state.pages.map((item, at) => (at === index ? event.page : item)) : [...state.pages, event.page];
        break;
      }
      case "page.removed": state.pages = state.pages.filter((item) => item.id !== event.id); break;
      case "ribbon": state.playerPageId = event.playerPageId; state.pageBookmarks = event.pageBookmarks; break;
      case "token": {
        const page = state.pages.find((item) => item.id === event.pageId);
        if (!page) break;
        const index = page.tokens.findIndex((item) => item.id === event.token.id);
        const tokens = index >= 0 ? page.tokens.map((item, at) => (at === index ? event.token : item)) : [...page.tokens, event.token];
        state.pages = state.pages.map((item) => (item.id === page.id ? { ...page, tokens } : item));
        break;
      }
      case "token.removed": state.pages = state.pages.map((item) => (item.id === event.pageId ? { ...item, tokens: item.tokens.filter((token) => token.id !== event.id) } : item)); break;
      case "tracker": state.tracker = event.tracker; break;
      case "journal.show": if (event.by !== this.options.userId) for (const listener of [...this.showListeners]) listener(event.id); break;
      case "kicked": state.players = state.players.filter((item) => item.userId !== event.userId); if (event.userId === this.options.userId) { this.statusState = "refused"; this.refusal = "GM이 내보냈습니다"; } break;
      case "closed": this.statusState = "closed"; break;
    }
    this.snapshotState = state;
  }

  private notify() { for (const listener of [...this.listeners]) listener(); }
}
