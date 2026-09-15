/**
 * Session wire protocol (CAMPAIGN_RESOURCES.md §5): clients send commands, the host applies them and broadcasts
 * numbered events. Everything is plain JSON so any carrier can move it.
 */
import type { SheetOp } from "../character/ops";
import type { CharacterRuntime } from "../character/runtime";
import type { CharacterSource } from "../character/types";

export const PROTOCOL_VERSION = 1;

export interface Participant { userId: string; name: string; role: "host" | "player"; connected: boolean; characterIds: string[] }

export interface SessionCharacter { characterId: string; ownerUserId: string; source: CharacterSource; runtime: CharacterRuntime; version: number }

export interface SessionLogEntry { n: number; at: string; userId?: string; who?: string; kind: "system" | "sheet" | "dice" | "dm" | "chat"; text: string }

/** The whole session as one user is allowed to see it (PCs are observer to the party, D63). */
export interface SessionSnapshot {
  sessionId: string;
  name: string;
  hostUserId: string;
  participants: Participant[];
  characters: SessionCharacter[];
  log: SessionLogEntry[];
  round: number;
  lastEventN: number;
}

export type ClientCommand =
  | { type: "hello"; protocol: number; userId: string; name: string; token: string; lastEventN?: number; /** Only the host's own mirror knows it: lets the host user connect through a peer transport. */ hostSecret?: string }
  | { type: "character.join"; source: CharacterSource; runtime: CharacterRuntime }
  | { type: "character.leave"; characterId: string }
  | { type: "sheet.op"; characterId: string; op: SheetOp; asDm?: boolean }
  | { type: "dice.result"; text: string; characterId?: string }
  | { type: "chat.say"; text: string }
  | { type: "round.advance" }
  | { type: "bye" };

export type SessionEvent =
  | { n: number; type: "participant"; participant: Participant }
  | { n: number; type: "character.upsert"; character: SessionCharacter }
  | { n: number; type: "character.remove"; characterId: string }
  | { n: number; type: "log"; entry: SessionLogEntry }
  | { n: number; type: "round"; round: number }
  | { n: number; type: "closed" };

export type HostMessage =
  | { type: "welcome"; snapshot: SessionSnapshot }
  | { type: "events"; events: SessionEvent[] }
  | { type: "refused"; reason: string; commandType?: string }
  | { type: "resync"; snapshot: SessionSnapshot };

export const isClientCommand = (value: unknown): value is ClientCommand => typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string";
export const isHostMessage = (value: unknown): value is HostMessage => typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string";

/** Invite code: `<carrier>:<address>-<token>`; carriers: `tab` (BroadcastChannel on this PC), `tcp` (LAN/Hamachi host:port). */
export interface Invite { carrier: "tab" | "tcp"; address: string; token: string }

export const encodeInvite = (invite: Invite) => `${invite.carrier}:${invite.address}-${invite.token}`;

export function decodeInvite(text: string): Invite | null {
  const value = text.trim();
  const match = /^(tab|tcp):(.+)-([A-Z0-9]{6})$/i.exec(value);
  if (match) return { carrier: match[1].toLowerCase() as Invite["carrier"], address: match[2], token: match[3].toUpperCase() };
  const bare = /^(\d{1,3}(?:\.\d{1,3}){3}|\[[0-9a-f:]+\]|[a-z0-9.-]+):(\d{2,5})-([A-Z0-9]{6})$/i.exec(value);
  if (bare) return { carrier: "tcp", address: `${bare[1]}:${bare[2]}`, token: bare[3].toUpperCase() };
  return null;
}

export function newToken(random: () => number = Math.random) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let index = 0; index < 6; index += 1) out += alphabet[Math.floor(random() * alphabet.length)];
  return out;
}

export function newSessionId() {
  return `sess_${Math.random().toString(36).slice(2, 10)}`;
}
