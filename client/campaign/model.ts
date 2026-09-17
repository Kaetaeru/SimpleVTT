/**
 * Campaign objects as Roll20 has them (ROLL20_MODEL.md §7): a campaign is the unit — there is no session object.
 * A campaign keeps its players, one fixed join code, its settings, and (in later slices) journal, pages, art and
 * the chat archive. Every object is stored as one JSON document row keyed by id; `kind` says what it is.
 */
import type { ArtAsset } from "./art";
import type { JournalEntry } from "./journal";
import type { Page } from "./page";
import type { Tracker } from "./tracker";
import type { ActResult } from "../rules/actions";
import type { AttackResolution } from "../rules/resolve";
import type { SpellResolution } from "../rules/spellcast";

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
  /**
   * R25 (D126): the secret the seat that first used this user id minted, kept by the host only. A snapshot hands
   * every participant everyone else's user id, so without this anyone with the join code could come back as
   * someone else — including a GM. Trust on first use: the first `hello` for a user id sets it, later ones must match.
   */
  seat?: string;
}

export interface CampaignSettings {
  /** Roll20 "players can create characters": new characters from inside the table. */
  playersCanCreateCharacters: boolean;
  /** Roll20 Vault export permission: players may copy their in-campaign character back to their library. */
  playersCanExportToVault: boolean;
  chatAvatars: boolean;
  /** D90: results wait for the GM's "적용" instead of landing at once. */
  dmConfirmsResults?: boolean;
  /**
   * R29 (D154): a downed character's death save is their player's to make. The host still rolls the die — the
   * player presses the button on their own card. Off means the host rolls it at the start of their turn, as before.
   */
  playersRollDeathSaves?: boolean;
  /** R13: how long a toast stays (seconds, default 4) and how many at once (default 3). */
  toastSeconds?: number;
  toastCount?: number;
}

/**
 * R17 (D114): a macro is a saved chat line. `#이름` in the chat box runs it, and it shows as a button in the macro
 * bar. Campaign macros belong to the GM (shared ones reach every player's bar); a journal entry may carry its own.
 */
export interface Macro { id: string; name: string; text: string; /** GM macros: shown in every player's macro bar too. */ shared?: boolean }

/** R17 (D114): a rollable table. `/roll 2t[조우]` draws two rows; weights make a row more likely. */
export interface RollTable { id: string; name: string; rows: Array<{ text: string; weight: number }>; /** R25: players may draw from a shared table; the GM's own stay the GM's (the rows are never sent either way). */ shared?: boolean }

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
  /** The page the player ribbon sits on (D81). */
  playerPageId?: string;
  /** Split the party: a player sent to another page than the ribbon. */
  pageBookmarks?: Record<string, string>;
  /** The turn tracker (ROLL20_TABLE_SPEC.md §6). */
  tracker?: Tracker;
  /** R17: campaign macros (the GM's; `shared` ones reach the players' macro bar). */
  macros?: Macro[];
  /** R17: rollable tables; players may roll on them but never see the rows. */
  tables?: RollTable[];
  /** R18: the in-world clock — the day since the campaign started and the minute of that day. */
  clock?: CampaignClock;
}

/** R18 (D115): in-world time. The DM moves it; timed effects run out and rests happen on it. */
export interface CampaignClock { day: number; minute: number }
export const emptyClock = (): CampaignClock => ({ day: 1, minute: 8 * 60 });
/** "2일차 14:30" */
export const clockText = (clock: CampaignClock) => `${clock.day}일차 ${String(Math.floor(clock.minute / 60) % 24).padStart(2, "0")}:${String(clock.minute % 60).padStart(2, "0")}`;
/** Move the clock by whole minutes; a day rolls over at 24 hours. */
export function advanceClock(clock: CampaignClock, minutes: number): CampaignClock {
  const total = clock.day * 24 * 60 + clock.minute + Math.max(0, Math.floor(minutes));
  return { day: Math.floor(total / (24 * 60)), minute: total % (24 * 60) };
}

/** One chat message of the archive (Roll20 chat types), stored per campaign in month files (§7). */
/** "○○이(가) △△에게서 벗어남": the reactor's controller may take an opportunity attack or let it go. */
export interface ReactionPrompt {
  /** "opportunity": the mover leaves the reactor's reach (D96). "shield": the mover's attack hit the reactor, who may cast Shield (R11). "counterspell": the mover is casting and the reactor may counter it (R16). */
  kind: "opportunity" | "shield" | "counterspell" | "death-save" | "rescue" | "guard" | "on-hit" | "trigger";
  mover: { name: string; entryId?: string; pageId?: string; tokenId?: string };
  reactor: { name: string; entryId?: string; pageId?: string; tokenId?: string };
  /** The held attack (shield prompts): what hit and by how much. */
  attack?: { name: string; total: number; ac: number };
  /** R16: the held spell (counterspell prompts): what is being cast and at what level. */
  spell?: { name: string; level: number };
  /**
   * R35 (D174): the failed roll a contract may redo — the card it belongs to, the feature that would pay for it, and
   * what the roll was, so the player can decide without scrolling back.
   */
  rescue?: { cardId: string; features: string[]; roll: string };
  /**
   * R54 (D189): the reactions a contract opened this window for — what each one is called and, in one line, what it
   * would do. The Shield spell rides here too when the reactor can cast it, so a player sees one question, not two.
   */
  guard?: { features: Array<{ name: string; hint: string; /** R57 (D192): facts the reactor confirms by pressing the button — the hint already spells them out. */ facts?: Array<{ id: string; question: string }> }>; shield?: boolean; /** R57 (D192): which window this is — the reactor's own skin, or an ally's. */ trigger?: string };
  /**
   * R63 (D198): the window a hit opens for the attacker. The reactor is the attacker (their controller answers), the
   * mover is the creature that was hit, and `offers` are what may still be added now that the hit is known.
   */
  /** R79 (D216), R81 (D215): a moment a character's features wait for — the end of a short rest, an initiative roll. */
  trigger?: { event: "short-rest" | "initiative"; offers: TriggerOffer[] };
  onHit?: { outcome: "hit" | "crit"; offers: HitOffer[]; /** R64 (D199): what the attacker's sheet takes without asking, by name, so the window can say so. */ auto?: string[] };
  /** Filled once answered: the attack card id, or declined; for shield: whether it was cast; for counterspell: whether it landed. R63: `chosen` names what an on-hit window added. */
  outcome?: { attacked?: string; declined?: boolean; shielded?: boolean; countered?: boolean; card?: string; rolled?: string; chosen?: string[] };
}

/** R79 (D216), R81 (D215): a feature a trigger window offers — and, for 비전 회복, the spent slots it may give back. */
export interface TriggerOffer { featureId: string; name: string; note?: string; heal?: string; slotLevels?: number; spent?: number[] }

/** R63 (D198): one thing the attacker may add after a hit — a built-in rider (`sneak`, `smite`, `savage`) or a contract's rule key. */
export interface HitOffer {
  key: string;
  label: string;
  /** What it does, in one line. */
  hint: string;
  /** Facts the scene cannot see, each a checkbox under it (돌격자's ten feet). */
  facts?: Array<{ id: string; question: string }>;
  /** 신성한 강타: the slots it may spend. */
  slots?: Array<{ level: number; free: number }>;
}

export interface ChatMessage {
  id: string;
  at: string;
  type: "general" | "whisper" | "emote" | "desc" | "rollresult" | "gmroll" | "system" | "action" | "prompt" | "act" | "spell";
  /** Display name at the time. */
  who: string;
  playerId?: string;
  /** Whisper target user id (or "gm"). */
  target?: string;
  content: string;
  /** R17: `dropped` dice are kept out of the total (kh/kl), `exploded` came from a `!`, `success` counted for a `>`/`<`. */
  roll?: { formula: string; total: number; dice: Array<{ sides: number; value: number; dropped?: boolean; exploded?: boolean; success?: boolean }>; modifier: number; label?: string; successes?: number; /** R17: rows drawn from a rollable table (then there are no dice). */ drawn?: string[] };
  /** A resolved attack (type "action"): the 판정 card with every die and what was applied. */
  action?: AttackResolution;
  /** This card replaces an earlier one (a DM palette edit, a confirmation, an undo). */
  supersedes?: string;
  /** Set on a card whose application was undone. */
  undone?: boolean;
  /** A question to one side (type "prompt"): an opportunity attack offered to the creature being left (D96). */
  prompt?: ReactionPrompt;
  /** One of the official actions taken on a turn (type "act", D97): the check, what it did, what it marked. */
  act?: ActResult;
  /** A spell cast at the table (type "spell", D102): every target's attack, save, damage, healing or effect. */
  spell?: SpellResolution;
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

export type StoredDocument = Campaign | ChatArchive | JournalEntry | ArtAsset | Page;

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
export function withPlayer(campaign: Campaign, player: { userId: string; displayName: string; seat?: string }, now = new Date().toISOString()): Campaign {
  const index = campaign.players.findIndex((item) => item.userId === player.userId);
  // R25 (D126): a seat secret is written once — the first time this user id arrives with one — and never replaced.
  if (index >= 0) return { ...campaign, updatedAt: now, players: campaign.players.map((item, at) => (at === index ? { ...item, displayName: player.displayName, lastSeenAt: now, seat: item.seat ?? player.seat } : item)) };
  const used = new Set(campaign.players.map((item) => item.color));
  const color = PLAYER_COLORS.find((candidate) => !used.has(candidate)) ?? PLAYER_COLORS[campaign.players.length % PLAYER_COLORS.length];
  return { ...campaign, updatedAt: now, players: [...campaign.players, { userId: player.userId, displayName: player.displayName, role: "player", color, joinedAt: now, lastSeenAt: now, seat: player.seat }] };
}

export function withPlayerRole(campaign: Campaign, userId: string, role: PlayerRole): Campaign {
  return { ...campaign, updatedAt: new Date().toISOString(), players: campaign.players.map((item) => (item.userId === userId ? { ...item, role } : item)) };
}

export function withPlayerKicked(campaign: Campaign, userId: string, kicked: boolean): Campaign {
  return { ...campaign, updatedAt: new Date().toISOString(), players: campaign.players.map((item) => (item.userId === userId ? { ...item, kicked } : item)) };
}

/** The GM who created the campaign (first gm). */
export const campaignOwner = (campaign: Campaign) => campaign.players.find((item) => item.role === "gm") ?? campaign.players[0];

/**
 * Only documents of the current shape are loaded. Rows from the rejected first campaign build (envelopes with
 * `data`, ownership maps) or from a newer build are skipped and reported, never rendered — a campaign card must not
 * take the app down with a missing field.
 */
export function isStoredDocument(value: unknown): value is StoredDocument {
  if (typeof value !== "object" || value === null) return false;
  const doc = value as Record<string, unknown>;
  if (typeof doc.id !== "string") return false;
  switch (doc.kind) {
    case "campaign": return typeof doc.name === "string" && typeof doc.joinCode === "string" && Array.isArray(doc.players) && typeof doc.settings === "object" && doc.settings !== null;
    case "chat": return typeof doc.campaignId === "string" && Array.isArray(doc.messages);
    case "handout": return typeof doc.campaignId === "string" && typeof doc.name === "string" && "canView" in doc && typeof doc.notes === "string";
    case "character": return typeof doc.campaignId === "string" && typeof doc.name === "string" && "canView" in doc && typeof doc.source === "object" && typeof doc.runtime === "object";
    case "npc": return typeof doc.campaignId === "string" && typeof doc.name === "string" && "canView" in doc && typeof doc.statBlock === "object" && typeof doc.runtime === "object";
    case "art": return typeof doc.campaignId === "string" && typeof doc.name === "string" && typeof doc.hash === "string" && typeof doc.mime === "string";
    case "page": return typeof doc.campaignId === "string" && typeof doc.name === "string" && Array.isArray(doc.tokens) && typeof doc.grid === "object";
    default: return false;
  }
}

/** Fill fields a slightly older row of the current shape may lack, so screens can rely on them. */
export function repairCampaign(campaign: Campaign): Campaign {
  const now = campaign.updatedAt ?? new Date().toISOString();
  return {
    ...campaign,
    ruleset: campaign.ruleset ?? "dnd.srd-5.2.1",
    moduleIds: campaign.moduleIds ?? [],
    description: campaign.description ?? "",
    createdAt: campaign.createdAt ?? now,
    updatedAt: now,
    settings: { playersCanCreateCharacters: true, playersCanExportToVault: true, chatAvatars: true, ...(campaign.settings as Partial<CampaignSettings>) },
    players: campaign.players.filter((player) => player && typeof player.userId === "string").map((player, index) => ({ ...player, displayName: player.displayName ?? "플레이어", role: player.role === "gm" ? "gm" : "player", color: player.color ?? PLAYER_COLORS[index % PLAYER_COLORS.length], joinedAt: player.joinedAt ?? now })),
  };
}
