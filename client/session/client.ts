/**
 * A session participant's mirror of the host state: sends commands, applies the host's events in order, keeps
 * the last event number for reconnects, and tells the app when one of its own characters changed (write-back to
 * the library, D60). Also used by the host's own UI through an in-process transport.
 */
import type { CharacterRuntime } from "../character/runtime";
import type { CharacterSource } from "../character/types";
import type { ClientCommand, HostMessage, SessionEvent, SessionSnapshot } from "./protocol";
import { PROTOCOL_VERSION, isHostMessage } from "./protocol";
import type { Transport } from "./transport";

export type SessionStatus = "connecting" | "joined" | "refused" | "disconnected" | "closed";

export interface ClientOptions { userId: string; name: string; token: string; hostSecret?: string }

export class SessionClient {
  private snapshotState: SessionSnapshot | null = null;
  private statusState: SessionStatus = "connecting";
  private refusal: string | null = null;
  private lastEventN = 0;
  private readonly listeners = new Set<() => void>();
  private readonly characterListeners = new Set<(characterId: string, source: CharacterSource, runtime: CharacterRuntime) => void>();
  private readonly refusedListeners = new Set<(reason: string, commandType?: string) => void>();
  private readonly unsubscribe: Array<() => void> = [];

  constructor(private readonly transport: Transport, private readonly options: ClientOptions) {
    this.unsubscribe.push(transport.onMessage((_from, message) => { if (isHostMessage(message)) this.receive(message); }));
    this.unsubscribe.push(transport.onPeer((peerId, state) => {
      if (peerId !== "host") return;
      if (state === "connected") this.hello();
      else if (this.statusState !== "closed") { this.statusState = "disconnected"; this.notify(); }
    }));
  }

  get status() { return this.statusState; }
  get reason() { return this.refusal; }
  get snapshot() { return this.snapshotState; }
  get userId() { return this.options.userId; }

  /** Send hello now (memory transports report the host at once; BroadcastChannel answers `join` with `pong` first). */
  hello() {
    this.statusState = this.snapshotState ? "connecting" : this.statusState;
    this.send({ type: "hello", protocol: PROTOCOL_VERSION, userId: this.options.userId, name: this.options.name, token: this.options.token, lastEventN: this.snapshotState ? this.lastEventN : undefined, hostSecret: this.options.hostSecret });
  }

  send(command: ClientCommand) { this.transport.send("host", command); }

  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  onCharacter(listener: (characterId: string, source: CharacterSource, runtime: CharacterRuntime) => void) { this.characterListeners.add(listener); return () => { this.characterListeners.delete(listener); }; }
  onRefused(listener: (reason: string, commandType?: string) => void) { this.refusedListeners.add(listener); return () => { this.refusedListeners.delete(listener); }; }

  leave() {
    if (this.statusState === "joined") this.send({ type: "bye" });
    this.statusState = "closed";
    for (const off of this.unsubscribe) off();
    this.transport.close();
    this.notify();
  }

  private receive(message: HostMessage) {
    switch (message.type) {
      case "welcome":
      case "resync":
        this.snapshotState = message.snapshot;
        this.lastEventN = message.snapshot.lastEventN;
        this.statusState = "joined";
        this.refusal = null;
        for (const character of message.snapshot.characters) if (character.ownerUserId === this.options.userId) this.emitCharacter(character.characterId, character.source, character.runtime);
        break;
      case "events":
        if (!this.snapshotState) { this.snapshotState = { sessionId: "", name: "", hostUserId: "", participants: [], characters: [], log: [], round: 0, lastEventN: 0 }; }
        this.statusState = "joined";
        for (const event of message.events) this.applyEvent(event);
        break;
      case "refused":
        if (message.commandType === "hello") { this.statusState = "refused"; this.refusal = message.reason; }
        for (const listener of [...this.refusedListeners]) listener(message.reason, message.commandType);
        break;
    }
    this.notify();
  }

  private applyEvent(event: SessionEvent) {
    const state = this.snapshotState!;
    if (event.n <= this.lastEventN) return;
    this.lastEventN = event.n;
    state.lastEventN = event.n;
    switch (event.type) {
      case "participant": {
        const index = state.participants.findIndex((item) => item.userId === event.participant.userId);
        state.participants = index >= 0 ? state.participants.map((item, at) => (at === index ? event.participant : item)) : [...state.participants, event.participant];
        break;
      }
      case "character.upsert": {
        const index = state.characters.findIndex((item) => item.characterId === event.character.characterId);
        state.characters = index >= 0 ? state.characters.map((item, at) => (at === index ? event.character : item)) : [...state.characters, event.character];
        if (event.character.ownerUserId === this.options.userId) this.emitCharacter(event.character.characterId, event.character.source, event.character.runtime);
        break;
      }
      case "character.remove": state.characters = state.characters.filter((item) => item.characterId !== event.characterId); break;
      case "log": state.log = [...state.log, event.entry].slice(-500); break;
      case "round": state.round = event.round; break;
      case "closed": this.statusState = "closed"; break;
    }
    this.snapshotState = { ...state };
  }

  private emitCharacter(characterId: string, source: CharacterSource, runtime: CharacterRuntime) { for (const listener of [...this.characterListeners]) listener(characterId, source, runtime); }
  private notify() { for (const listener of [...this.listeners]) listener(); }
}
