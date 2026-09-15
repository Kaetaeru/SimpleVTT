/**
 * Campaign objects as Roll20 has them (ROLL20_MODEL.md §7): a campaign is the unit — there is no session object.
 * A campaign keeps its players, one fixed join code, its settings, and (in later slices) journal, pages, art and
 * the chat archive. Every object is stored as one JSON document row keyed by id; `kind` says what it is.
 */
export type PlayerRole = "gm" | "player";

export interface CampaignPlayer {
  userId: string;
  displayName: string;
  role: PlayerRole;
  color: string;
  joinedAt: string;
  lastSeenAt?: string;
  /** Kicked players are refused by the host until the GM lets them back in. */
  kicked?: boolean;
}

export interface CampaignSettings {
  /** Roll20 "players can create characters": new characters from inside the table. */
  playersCanCreateCharacters: boolean;
  /** Roll20 Vault export permission: players may copy their in-campaign character back to their library. */
  playersCanExportToVault: boolean;
  chatAvatars: boolean;
}

export interface Campaign {
  id: string;
  kind: "campaign";
  name: string;
  avatar?: string;
  ruleset: string;
  moduleIds: string[];
  /** Six-character join code, fixed for the campaign's life (D71); "코드 다시 만들기" replaces it. */
  joinCode: string;
  settings: CampaignSettings;
  description: string;
  players: CampaignPlayer[];
  createdAt: string;
  updatedAt: string;
  lastLaunchedAt?: string;
}

/** One chat message of the archive (Roll20 chat types), stored per campaign in month files (§7). */
export interface ChatMessage {
  id: string;
  at: string;
  type: "general" | "whisper" | "emote" | "desc" | "rollresult" | "gmroll" | "system";
  /** Display name at the time. */
  who: string;
  playerId?: string;
  /** Whisper target user id (or "gm"). */
  target?: string;
  content: string;
  roll?: { formula: string; total: number; dice: Array<{ sides: number; value: number }>; modifier: number; label?: string };
}

export interface ChatArchive {
  id: string;
  kind: "chat";
  campaignId: string;
  messages: ChatMessage[];
  updatedAt: string;
}

/** A campaign another host runs that this user joined (Roll20 "Games I'm Playing"). */
export interface JoinedCampaign {
  campaignId: string;
  name: string;
  hostName: string;
  invite: string;
  lastSeenAt: string;
}

export type StoredDocument = Campaign | ChatArchive;

export const PLAYER_COLORS = ["#e0a458", "#7fb3d5", "#a3c585", "#d98cb3", "#c3a6ff", "#f28b82", "#8fd3c8", "#f6c177"];

const randomId = (prefix: string) => `${prefix}_${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 12) : Math.random().toString(36).slice(2, 14)}`;

export function newJoinCode(random: () => number = Math.random) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let index = 0; index < 6; index += 1) out += alphabet[Math.floor(random() * alphabet.length)];
  return out;
}

export function newCampaign(name: string, owner: { userId: string; displayName: string }): Campaign {
  const now = new Date().toISOString();
  return {
    id: randomId("camp"),
    kind: "campaign",
    name: name.trim() || "새 캠페인",
    ruleset: "dnd.srd-5.2.1",
    moduleIds: [],
    joinCode: newJoinCode(),
    settings: { playersCanCreateCharacters: true, playersCanExportToVault: true, chatAvatars: true },
    description: "",
    players: [{ userId: owner.userId, displayName: owner.displayName || "DM", role: "gm", color: PLAYER_COLORS[0], joinedAt: now, lastSeenAt: now }],
    createdAt: now,
    updatedAt: now,
  };
}

export const newMessageId = () => randomId("msg");

export function chatArchiveId(campaignId: string) { return `chat_${campaignId}`; }

export function emptyChatArchive(campaignId: string): ChatArchive {
  return { id: chatArchiveId(campaignId), kind: "chat", campaignId, messages: [], updatedAt: new Date().toISOString() };
}

/** Upsert a player (rejoin keeps role and color; a new one gets the next free color). */
export function withPlayer(campaign: Campaign, player: { userId: string; displayName: string }, now = new Date().toISOString()): Campaign {
  const index = campaign.players.findIndex((item) => item.userId === player.userId);
  if (index >= 0) return { ...campaign, updatedAt: now, players: campaign.players.map((item, at) => (at === index ? { ...item, displayName: player.displayName, lastSeenAt: now } : item)) };
  const used = new Set(campaign.players.map((item) => item.color));
  const color = PLAYER_COLORS.find((candidate) => !used.has(candidate)) ?? PLAYER_COLORS[campaign.players.length % PLAYER_COLORS.length];
  return { ...campaign, updatedAt: now, players: [...campaign.players, { userId: player.userId, displayName: player.displayName, role: "player", color, joinedAt: now, lastSeenAt: now }] };
}

export function withPlayerRole(campaign: Campaign, userId: string, role: PlayerRole): Campaign {
  return { ...campaign, updatedAt: new Date().toISOString(), players: campaign.players.map((item) => (item.userId === userId ? { ...item, role } : item)) };
}

export function withPlayerKicked(campaign: Campaign, userId: string, kicked: boolean): Campaign {
  return { ...campaign, updatedAt: new Date().toISOString(), players: campaign.players.map((item) => (item.userId === userId ? { ...item, kicked } : item)) };
}

/** The GM who created the campaign (first gm). */
export const campaignOwner = (campaign: Campaign) => campaign.players.find((item) => item.role === "gm") ?? campaign.players[0];
