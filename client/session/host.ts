/**
 * The host: owns the session state, validates every command (token, ownership), applies sheet ops with the same
 * reducer the offline sheet uses, numbers the resulting events and sends them to every connected peer. A peer that
 * reconnects with its last event number gets the missing events replayed (buffer of 5,000) or a fresh snapshot.
 */
import type { ContentCatalog } from "../catalog/catalog";
import { applyOp, describeOp } from "../character/ops";
import { noteLog } from "../character/play";
import type { ClientCommand, HostMessage, Participant, SessionCharacter, SessionEvent, SessionLogEntry, SessionSnapshot } from "./protocol";
import { PROTOCOL_VERSION, isClientCommand } from "./protocol";
import type { Transport } from "./transport";

const EVENT_BUFFER = 5000;
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

export interface HostOptions { sessionId: string; name: string; token: string; hostUserId: string; hostName: string; catalog: ContentCatalog; now?: () => string; /** Shared only with the host's own UI mirror. */ hostSecret?: string }

export class SessionHost {
  readonly sessionId: string;
  readonly token: string;
  readonly hostUserId: string;
  private readonly participants = new Map<string, Participant>();
  private readonly characters = new Map<string, SessionCharacter>();
  private readonly peerUsers = new Map<string, string>();
  private log: SessionLogEntry[] = [];
  private events: SessionEvent[] = [];
  private round = 0;
  private n = 0;
  private readonly listeners = new Set<(event: SessionEvent) => void>();
  private readonly unsubscribe: Array<() => void> = [];
  private readonly now: () => string;

  constructor(private readonly transport: Transport, private readonly options: HostOptions) {
    this.sessionId = options.sessionId;
    this.token = options.token;
    this.hostUserId = options.hostUserId;
    this.now = options.now ?? (() => new Date().toISOString());
    this.participants.set(options.hostUserId, { userId: options.hostUserId, name: options.hostName, role: "host", connected: true, characterIds: [] });
    this.unsubscribe.push(transport.onMessage((from, message) => { if (isClientCommand(message)) this.handle(from, message); }));
    this.unsubscribe.push(transport.onPeer((peerId, state) => { if (state === "disconnected") this.peerLeft(peerId); }));
  }

  /** Local listeners (the host's own UI mirror) receive every event too. */
  onEvent(listener: (event: SessionEvent) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }

  snapshot(): SessionSnapshot {
    return { sessionId: this.sessionId, name: this.options.name, hostUserId: this.hostUserId, participants: [...this.participants.values()], characters: [...this.characters.values()], log: this.log.slice(-500), round: this.round, lastEventN: this.n };
  }

  get state() { return this.snapshot(); }

  close() {
    this.emit({ type: "closed" });
    for (const off of this.unsubscribe) off();
    this.transport.close();
  }

  /** The host's own commands (its UI) go through the same path as a peer's, as user `hostUserId`. */
  handleLocal(command: ClientCommand) { this.apply(this.hostUserId, command, "local"); }

  private handle(peerId: string, command: ClientCommand) {
    if (command.type === "hello") {
      if (command.protocol !== PROTOCOL_VERSION) return this.reply(peerId, { type: "refused", reason: `프로토콜 버전이 다릅니다 (호스트 ${PROTOCOL_VERSION}, 참가자 ${command.protocol})`, commandType: "hello" });
      if (command.token !== this.token) return this.reply(peerId, { type: "refused", reason: "초대 코드가 맞지 않습니다", commandType: "hello" });
      if (command.userId === this.hostUserId && (!this.options.hostSecret || command.hostSecret !== this.options.hostSecret)) return this.reply(peerId, { type: "refused", reason: "호스트와 같은 사용자 id입니다", commandType: "hello" });
      this.peerUsers.set(peerId, command.userId);
      const existing = this.participants.get(command.userId);
      const participant: Participant = existing ? { ...existing, name: command.name, connected: true } : { userId: command.userId, name: command.name, role: "player", connected: true, characterIds: [] };
      this.participants.set(command.userId, participant);
      const since = command.lastEventN;
      if (since !== undefined && since < this.n && this.events.length && this.events[0].n <= since + 1) {
        this.reply(peerId, { type: "events", events: this.events.filter((event) => event.n > since) });
      } else this.reply(peerId, { type: "welcome", snapshot: this.snapshot() });
      this.emit({ type: "participant", participant });
      this.emit({ type: "log", entry: this.entry("system", `${command.name} 입장`, command.userId, command.name) });
      return;
    }
    const userId = this.peerUsers.get(peerId);
    if (!userId) return this.reply(peerId, { type: "refused", reason: "먼저 hello로 입장하세요", commandType: command.type });
    if (command.type === "bye") { this.peerLeft(peerId); return; }
    this.apply(userId, command, peerId);
  }

  private apply(userId: string, command: ClientCommand, peerId: string) {
    const participant = this.participants.get(userId);
    if (!participant) return;
    const isHost = userId === this.hostUserId;
    switch (command.type) {
      case "character.join": {
        const characterId = command.source.id;
        const existing = this.characters.get(characterId);
        if (existing && existing.ownerUserId !== userId && !isHost) return this.reply(peerId, { type: "refused", reason: "다른 참가자의 캐릭터입니다", commandType: command.type });
        const character: SessionCharacter = { characterId, ownerUserId: existing?.ownerUserId ?? userId, source: command.source, runtime: command.runtime, version: (existing?.version ?? 0) + 1 };
        this.characters.set(characterId, character);
        if (!participant.characterIds.includes(characterId)) { participant.characterIds = [...participant.characterIds, characterId]; this.emit({ type: "participant", participant: { ...participant } }); }
        this.emit({ type: "character.upsert", character });
        this.emit({ type: "log", entry: this.entry("system", `${command.source.name} 합류 (${participant.name})`, userId, participant.name) });
        return;
      }
      case "character.leave": {
        const character = this.characters.get(command.characterId);
        if (!character) return;
        if (character.ownerUserId !== userId && !isHost) return this.reply(peerId, { type: "refused", reason: "다른 참가자의 캐릭터입니다", commandType: command.type });
        this.characters.delete(command.characterId);
        const owner = this.participants.get(character.ownerUserId);
        if (owner) { owner.characterIds = owner.characterIds.filter((id) => id !== command.characterId); this.emit({ type: "participant", participant: { ...owner } }); }
        this.emit({ type: "character.remove", characterId: command.characterId });
        this.emit({ type: "log", entry: this.entry("system", `${character.source.name} 퇴장`, userId, participant.name) });
        return;
      }
      case "sheet.op": {
        const character = this.characters.get(command.characterId);
        if (!character) return this.reply(peerId, { type: "refused", reason: "세션에 없는 캐릭터입니다", commandType: command.type });
        if (character.ownerUserId !== userId && !isHost) return this.reply(peerId, { type: "refused", reason: "자기 캐릭터만 조작할 수 있습니다", commandType: command.type });
        const dmAct = isHost && character.ownerUserId !== userId;
        const result = applyOp(character.runtime, character.source, this.options.catalog, command.op);
        if (result.refused) return this.reply(peerId, { type: "refused", reason: result.refused, commandType: command.type });
        let runtime = result.runtime;
        if (dmAct) runtime = noteLog(runtime, `DM: ${describeOp(command.op)}`);
        const next: SessionCharacter = { ...character, runtime, version: character.version + 1 };
        this.characters.set(next.characterId, next);
        this.emit({ type: "character.upsert", character: next });
        const line = runtime.log.at(-1)?.text;
        if (line && runtime.log.length !== character.runtime.log.length) this.emit({ type: "log", entry: this.entry(dmAct ? "dm" : "sheet", `${character.source.name}: ${line}`, userId, participant.name) });
        return;
      }
      case "dice.result": {
        const who = command.characterId ? this.characters.get(command.characterId)?.source.name ?? participant.name : participant.name;
        this.emit({ type: "log", entry: this.entry("dice", `${who}: ${command.text}`, userId, participant.name) });
        return;
      }
      case "chat.say": this.emit({ type: "log", entry: this.entry("chat", `${participant.name}: ${command.text}`, userId, participant.name) }); return;
      case "round.advance": {
        if (!isHost) return this.reply(peerId, { type: "refused", reason: "라운드는 호스트가 진행합니다", commandType: command.type });
        this.round += 1;
        for (const character of this.characters.values()) {
          if (!character.runtime.effects?.length) continue;
          const result = applyOp(character.runtime, character.source, this.options.catalog, { type: "round.advance" });
          const next: SessionCharacter = { ...character, runtime: result.runtime, version: character.version + 1 };
          this.characters.set(next.characterId, next);
          this.emit({ type: "character.upsert", character: next });
        }
        this.emit({ type: "round", round: this.round });
        this.emit({ type: "log", entry: this.entry("system", `라운드 ${this.round}`, userId, participant.name) });
        return;
      }
      default: return;
    }
  }

  private peerLeft(peerId: string) {
    const userId = this.peerUsers.get(peerId);
    this.peerUsers.delete(peerId);
    const participant = userId ? this.participants.get(userId) : undefined;
    if (!participant || !participant.connected) return;
    participant.connected = false;
    this.emit({ type: "participant", participant: { ...participant } });
    this.emit({ type: "log", entry: this.entry("system", `${participant.name} 연결 끊김`, userId, participant.name) });
  }

  private entry(kind: SessionLogEntry["kind"], text: string, userId?: string, who?: string): SessionLogEntry {
    const entry = { n: this.n + 1, at: this.now(), userId, who, kind, text };
    this.log = [...this.log, entry].slice(-2000);
    return entry;
  }

  private emit(body: DistributiveOmit<SessionEvent, "n">) {
    this.n += 1;
    const event = { ...body, n: this.n } as SessionEvent;
    this.events = [...this.events, event].slice(-EVENT_BUFFER);
    this.transport.send("*", { type: "events", events: [event] } satisfies HostMessage);
    for (const listener of [...this.listeners]) listener(event);
  }

  private reply(peerId: string, message: HostMessage) {
    if (peerId === "local") { for (const listener of [...this.listeners]) listener({ n: this.n, type: "log", entry: { n: this.n, at: this.now(), kind: "system", text: message.type === "refused" ? `거절: ${message.reason}` : message.type } }); return; }
    this.transport.send(peerId, message);
  }
}
