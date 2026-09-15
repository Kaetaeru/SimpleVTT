/**
 * Wire protocol of a launched campaign table (ROLL20_MODEL.md §0, §6, §8). There is no session object: the host
 * launches a campaign, players enter with the campaign's fixed join code, and the host numbers every event.
 * Journal entries travel whole (they are small JSON); the host projects them per viewer (GM notes, permissions).
 */
import type { ArtAsset } from "../campaign/art";
import type { JournalEntry } from "../campaign/journal";
import type { CampaignSettings, ChatMessage, PlayerRole } from "../campaign/model";

export const PROTOCOL_VERSION = 4;

export interface Presence { userId: string; displayName: string; role: PlayerRole; color: string; connected: boolean }

export interface TableSnapshot {
  campaignId: string;
  name: string;
  settings: CampaignSettings;
  players: Presence[];
  /** The archive as this viewer may see it (whispers and GM rolls filtered), newest last. */
  chat: ChatMessage[];
  /** Journal entries this viewer may see (GM notes stripped for players). */
  journal: JournalEntry[];
  /** Art the viewer may see: their own uploads, and what visible entries reference (everything for the GM). */
  art: ArtAsset[];
  lastEventN: number;
}

export interface RollPayload { formula: string; total: number; dice: Array<{ sides: number; value: number }>; modifier: number; label?: string }

export type ClientCommand =
  | { type: "hello"; protocol: number; userId: string; displayName: string; joinCode: string; lastEventN?: number; hostSecret?: string }
  | { type: "chat.say"; text: string }
  | { type: "chat.roll"; roll: RollPayload; mode: "public" | "gm" | "self" }
  | { type: "player.role"; userId: string; role: PlayerRole }
  | { type: "player.kick"; userId: string }
  /** Create or replace a journal entry. Players may create characters (when the campaign allows) and edit what they control. */
  | { type: "journal.put"; entry: JournalEntry }
  | { type: "journal.remove"; id: string }
  /** "플레이어에게 보여주기": open the entry on every viewer who can see it. */
  | { type: "journal.show"; id: string }
  /** Upload: metadata first, then the data URL in base64 text chunks; the host stores it once every chunk arrived. */
  | { type: "art.upload"; asset: ArtAsset; total: number }
  | { type: "art.chunk"; id: string; index: number; total: number; data: string }
  | { type: "art.update"; id: string; name?: string; folder?: string; tags?: string[] }
  | { type: "art.remove"; id: string }
  /** Ask for the bytes of an asset this viewer may see; the host answers this peer with art.data chunks. */
  | { type: "art.fetch"; id: string }
  | { type: "bye" };

export type TableEvent =
  | { n: number; type: "presence"; player: Presence }
  | { n: number; type: "chat"; message: ChatMessage }
  | { n: number; type: "settings"; settings: CampaignSettings }
  | { n: number; type: "journal"; entry: JournalEntry }
  | { n: number; type: "journal.removed"; id: string }
  | { n: number; type: "journal.show"; id: string; by: string }
  | { n: number; type: "art"; asset: ArtAsset }
  | { n: number; type: "art.removed"; id: string }
  | { n: number; type: "kicked"; userId: string }
  | { n: number; type: "closed" };

export type HostMessage =
  | { type: "welcome"; snapshot: TableSnapshot }
  | { type: "events"; events: TableEvent[] }
  | { type: "art.data"; id: string; hash: string; index: number; total: number; data: string }
  | { type: "refused"; reason: string; commandType?: string; id?: string };

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
