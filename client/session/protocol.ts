/**
 * Wire protocol of a launched campaign table (ROLL20_MODEL.md §0, §6, §8). There is no session object: the host
 * launches a campaign, players enter with the campaign's fixed join code, and the host numbers every event.
 */
import type { ChatMessage, PlayerRole } from "../campaign/model";

export const PROTOCOL_VERSION = 2;

export interface Presence { userId: string; displayName: string; role: PlayerRole; color: string; connected: boolean }

export interface TableSnapshot {
  campaignId: string;
  name: string;
  players: Presence[];
  /** The archive as this viewer may see it (whispers and GM rolls filtered), newest last. */
  chat: ChatMessage[];
  lastEventN: number;
}

export interface RollPayload { formula: string; total: number; dice: Array<{ sides: number; value: number }>; modifier: number; label?: string }

export type ClientCommand =
  | { type: "hello"; protocol: number; userId: string; displayName: string; joinCode: string; lastEventN?: number; hostSecret?: string }
  | { type: "chat.say"; text: string }
  | { type: "chat.roll"; roll: RollPayload; mode: "public" | "gm" | "self" }
  | { type: "player.role"; userId: string; role: PlayerRole }
  | { type: "player.kick"; userId: string }
  | { type: "bye" };

export type TableEvent =
  | { n: number; type: "presence"; player: Presence }
  | { n: number; type: "chat"; message: ChatMessage }
  | { n: number; type: "kicked"; userId: string }
  | { n: number; type: "closed" };

export type HostMessage =
  | { type: "welcome"; snapshot: TableSnapshot }
  | { type: "events"; events: TableEvent[] }
  | { type: "refused"; reason: string; commandType?: string };

export const isClientCommand = (value: unknown): value is ClientCommand => typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string";
export const isHostMessage = (value: unknown): value is HostMessage => typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string";

/** Invite: `<carrier>:<address>-<joinCode>`; `tab:<campaignId>-CODE` on one PC, `tcp:<host:port>-CODE` over LAN/Hamachi. */
export interface Invite { carrier: "tab" | "tcp"; address: string; joinCode: string }

export const encodeInvite = (invite: Invite) => `${invite.carrier}:${invite.address}-${invite.joinCode}`;

export function decodeInvite(text: string): Invite | null {
  const value = text.trim();
  const match = /^(tab|tcp):(.+)-([A-Z0-9]{6})$/i.exec(value);
  if (match) return { carrier: match[1].toLowerCase() as Invite["carrier"], address: match[2], joinCode: match[3].toUpperCase() };
  const bare = /^(\d{1,3}(?:\.\d{1,3}){3}|\[[0-9a-f:]+\]|[a-z0-9.-]+):(\d{2,5})-([A-Z0-9]{6})$/i.exec(value);
  if (bare) return { carrier: "tcp", address: `${bare[1]}:${bare[2]}`, joinCode: bare[3].toUpperCase() };
  return null;
}
