/**
 * The launched table's authority (the DM's app). Validates the campaign's fixed join code, refuses kicked players,
 * keeps presence, turns chat commands into archive messages, applies GM-only player management, and numbers every
 * event for the mirrors. Persistence happens through callbacks: the campaign (players) and the chat archive.
 */
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

export interface TableHostOptions {
  campaign: Campaign;
  hostUserId: string;
  hostSecret?: string;
  archive?: ChatMessage[];
  onCampaign?: (campaign: Campaign) => void;
  onChat?: (message: ChatMessage) => void;
  now?: () => string;
  random?: () => number;
}

export class TableHost {
  private campaign: Campaign;
  private chat: ChatMessage[];
  private readonly connected = new Set<string>();
  private readonly peerUsers = new Map<string, string>();
  private readonly peerTransports = new Map<string, Transport>();
  private readonly transports: Transport[] = [];
  private readonly unsubscribe: Array<() => void> = [];
  private events: TableEvent[] = [];
  private n = 0;
  private readonly listeners = new Set<(event: TableEvent) => void>();
  private readonly now: () => string;

  constructor(transport: Transport | Transport[], private readonly options: TableHostOptions) {
    this.campaign = options.campaign;
    this.chat = [...(options.archive ?? [])];
    this.now = options.now ?? (() => new Date().toISOString());
    this.connected.add(options.hostUserId);
    for (const carrier of Array.isArray(transport) ? transport : [transport]) this.attach(carrier);
  }

  get state() { return this.campaign; }
  get archive() { return this.chat; }

  attach(carrier: Transport) {
    if (this.transports.includes(carrier)) return;
    this.transports.push(carrier);
    this.unsubscribe.push(carrier.onMessage((from, message) => { if (isClientCommand(message)) { this.peerTransports.set(from, carrier); this.handle(from, message); } }));
    this.unsubscribe.push(carrier.onPeer((peerId, state) => { if (state === "disconnected") this.peerLeft(peerId); }));
  }

  onEvent(listener: (event: TableEvent) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }

  /** The campaign document changed outside (GM edited settings or the code): take it, re-check kicked players. */
  updateCampaign(campaign: Campaign) {
    this.campaign = campaign;
    for (const [peerId, userId] of [...this.peerUsers]) {
      if (campaign.players.find((player) => player.userId === userId)?.kicked) { this.reply(peerId, { type: "refused", reason: "GM이 내보냈습니다", commandType: "kicked" }); this.peerLeft(peerId); }
    }
    for (const player of campaign.players) this.emit({ type: "presence", player: this.presence(player.userId) });
  }

  snapshot(viewer: { userId: string; role: PlayerRole }): TableSnapshot {
    return { campaignId: this.campaign.id, name: this.campaign.name, players: this.campaign.players.filter((player) => !player.kicked).map((player) => this.presence(player.userId)), chat: this.chat.filter((message) => visibleTo(message, viewer)).slice(-SNAPSHOT_CHAT), lastEventN: this.n };
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
      const viewer = { userId: command.userId, role: this.roleOf(command.userId) };
      const since = command.lastEventN;
      if (since !== undefined && since < this.n && this.events.length && this.events[0].n <= since + 1) this.reply(peerId, { type: "events", events: this.events.filter((event) => event.n > since && this.eventVisible(event, viewer)) });
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
            if (!target) return this.reply(peerId, { type: "refused", reason: `"${input.target}"라는 참가자가 없습니다 (/w gm 도 됩니다)`, commandType: command.type });
            this.say({ type: "whisper", who: player.displayName, playerId: userId, target, content: input.text });
            return;
          }
          case "emote": this.say({ type: "emote", who: player.displayName, playerId: userId, content: input.text }); return;
          case "desc": if (!isGm) return this.reply(peerId, { type: "refused", reason: "/desc 는 GM만 씁니다", commandType: command.type }); this.say({ type: "desc", who: player.displayName, playerId: userId, content: input.text }); return;
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
        if (!isGm) return this.reply(peerId, { type: "refused", reason: "GM만 역할을 바꿉니다", commandType: command.type });
        if (command.userId === this.options.hostUserId && command.role !== "gm") return this.reply(peerId, { type: "refused", reason: "호스트는 GM에서 내릴 수 없습니다", commandType: command.type });
        this.setCampaign(withPlayerRole(this.campaign, command.userId, command.role));
        this.emit({ type: "presence", player: this.presence(command.userId) });
        this.say({ type: "system", who: "", content: `${this.presence(command.userId).displayName} → ${command.role === "gm" ? "GM" : "플레이어"}` });
        return;
      }
      case "player.kick": {
        if (!isGm) return this.reply(peerId, { type: "refused", reason: "GM만 내보냅니다", commandType: command.type });
        if (command.userId === this.options.hostUserId) return this.reply(peerId, { type: "refused", reason: "호스트는 내보낼 수 없습니다", commandType: command.type });
        const name = this.presence(command.userId).displayName;
        this.setCampaign(withPlayerKicked(this.campaign, command.userId, true));
        for (const [otherPeer, otherUser] of [...this.peerUsers]) if (otherUser === command.userId) { this.reply(otherPeer, { type: "refused", reason: "GM이 내보냈습니다", commandType: "kicked" }); this.peerLeft(otherPeer); }
        this.emit({ type: "kicked", userId: command.userId });
        this.say({ type: "system", who: "", content: `${name} 내보냄` });
        return;
      }
      default: return;
    }
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

  private eventVisible(event: TableEvent, viewer: { userId: string; role: PlayerRole }) { return event.type !== "chat" || visibleTo(event.message, viewer); }

  private emit(body: DistributiveOmit<TableEvent, "n">) {
    this.n += 1;
    const event = { ...body, n: this.n } as TableEvent;
    this.events = [...this.events, event].slice(-EVENT_BUFFER);
    // Chat is projected per peer (whispers, GM rolls); other events go to everyone.
    for (const [peerId, userId] of this.peerUsers) if (this.eventVisible(event, { userId, role: this.roleOf(userId) })) this.reply(peerId, { type: "events", events: [event] });
    for (const listener of [...this.listeners]) listener(event);
  }

  private reply(peerId: string, message: HostMessage) { (this.peerTransports.get(peerId) ?? this.transports[0]).send(peerId, message); }
}
