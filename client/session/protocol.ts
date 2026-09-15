/**
 * Wire protocol of a launched campaign table (ROLL20_MODEL.md §0, §6, §8). There is no session object: the host
 * launches a campaign, players enter with the campaign's fixed join code, and the host numbers every event.
 * Journal entries travel whole (they are small JSON); the host projects them per viewer (GM notes, permissions).
 */
import type { ArtAsset } from "../campaign/art";
import type { JournalEntry } from "../campaign/journal";
import type { Page, Token } from "../campaign/page";
import type { Tracker, TrackerTurn } from "../campaign/tracker";
import type { ActionKind } from "../rules/actions";
import type { CastMethod } from "../character/play";
import type { AttackOverrides } from "../rules/resolve";
import type { CampaignSettings, ChatMessage, PlayerRole } from "../campaign/model";

export const PROTOCOL_VERSION = 15;

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
  /** Pages the viewer may see: every page for the GM, the page their ribbon/bookmark points at for a player. */
  pages: Page[];
  playerPageId?: string;
  pageBookmarks: Record<string, string>;
  tracker: Tracker;
  lastEventN: number;
}

/** Who acts or is targeted: a journal entry, usually through its token on a page. */
export interface ActorRef { entryId?: string; pageId?: string; tokenId?: string }
/** Which attack: a sheet attack row, an NPC action, or (R8) a spell. */
export type AttackRef = { source: "weapon"; attackId: string } | { source: "npc"; actionName: string } | { source: "spell"; spellId: string; slotLevel?: number };
export interface AttackRiders { sneak?: boolean; smiteSlot?: number; /** R12: the Cleave mastery's follow-up attack (no ability modifier to damage). */ cleave?: boolean }

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
  /** Page settings (GM). Tokens in the payload are ignored for an existing page — token.* changes them. */
  | { type: "page.put"; page: Page }
  | { type: "page.remove"; id: string }
  /** Move the player ribbon (GM). */
  | { type: "page.ribbon"; pageId: string }
  /** Split the party: send one player to a page, or null to rejoin the ribbon (GM). */
  | { type: "page.bookmark"; userId: string; pageId: string | null }
  /** Create or replace a token. A controller's put is merged (position, rotation, markers, editable bars). */
  | { type: "token.put"; pageId: string; token: Token }
  | { type: "token.remove"; pageId: string; id: string }
  /** Replace the tracker (GM): open/close, reorder, edit values, add custom rows, clear. */
  | { type: "tracker.set"; tracker: Tracker }
  /** Add (or refresh) a token's turn. With `rollBonus` the host rolls 1d20 + bonus and posts the card; else `initiative` (default 0). */
  | { type: "tracker.add"; turn: Omit<TrackerTurn, "id" | "initiative"> & { initiative?: number }; rollBonus?: number }
  /** "다음 턴" (GM, or the current turn's controller as "턴 마침"): turn-end and turn-start processing, then the highlight moves. */
  | { type: "tracker.next" }
  /** R11 (BG3 linked initiative): swap the current turn with a later party member of the same linked group; the GM or either creature's controller. */
  | { type: "tracker.swap"; turnId: string }
  /** Attack (§12.2): the host resolves and applies, one card per target. */
  | { type: "act.attack"; attacker: ActorRef; targets: ActorRef[]; attack: AttackRef; riders?: AttackRiders; overrides?: AttackOverrides; /** Answering an opportunity prompt (the prompt's message id): the attack is the reactor's reaction. */ reaction?: string; /** R9: the readied action goes off (the 준비 mark is spent as the reaction). */ readied?: boolean }
  /** D96: `mover` leaves `from`'s reach (the 벗어남 button); the host asks `from`'s controller for an opportunity attack. */
  | { type: "act.provoke"; mover: ActorRef; from: ActorRef }
  /** The reactor's controller lets the opportunity go. */
  | { type: "act.decline"; messageId: string }
  /** D102: cast a spell at the chosen targets; the host pays the slot, resolves every target and applies. */
  | { type: "act.cast"; caster: ActorRef; spellId: string; targets: ActorRef[]; method?: CastMethod; overrides?: AttackOverrides; readied?: boolean; /** R11: answering a shield prompt (its message id): the reaction spell against the held attack. */ reaction?: string }
  /** R9 (D103): an NPC's save action (breath, gaze …) at the chosen targets — resolved like a save spell; recharge is spent. */
  | { type: "act.npcSave"; actor: ActorRef; actionName: string; targets: ActorRef[] }
  /** R9 (D104): a legendary action from the pool (reset at the monster's turn start); a save action takes targets, the rest is a card. */
  | { type: "act.legendary"; actor: ActorRef; name: string; targets?: ActorRef[] }
  /** R10: use an item from the actor's bag on a creature (a potion poured into an ally's mouth); the host rolls and applies. */
  | { type: "act.item"; actor: ActorRef; target?: ActorRef; instanceId: string }
  /** R12 (DM): a monster spends Legendary Resistance on a failed save in a spell card — that row is re-applied as a success. */
  /** R16: put a summoned creature on the summoner's scene — its own journal entry, controlled by the summoner's controller. */
  | { type: "act.summon"; summoner: ActorRef; monsterId: string; count?: number; spellId?: string }
  /** R16: send this summoner's creatures away (the spell ended, or the DM says so). */
  | { type: "act.dismiss"; summoner: ActorRef; spellId?: string }
  | { type: "act.resist"; messageId: string; targetId: string; /** R15: the target token, so two copies of one stat block are told apart. */ tokenId?: string }
  /** D97: one of the official actions (dash, dodge, help, hide, grapple …) on the actor's turn; the host resolves and marks. */
  | { type: "act.action"; actor: ActorRef; kind: ActionKind; target?: ActorRef; skill?: string; dc?: number; note?: string; choice?: string; bonus?: boolean }
  /** DM palette: re-resolve a card with overrides (same dice unless `reroll`), superseding it. */
  | { type: "act.adjust"; messageId: string; overrides: AttackOverrides; reroll?: boolean }
  /** DM palette: take the card's application back. */
  | { type: "act.undo"; messageId: string }
  /** D90 "DM 확인 후 적용": apply a waiting card. */
  | { type: "act.confirm"; messageId: string }
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
  | { n: number; type: "page"; page: Page }
  | { n: number; type: "page.removed"; id: string }
  | { n: number; type: "ribbon"; playerPageId?: string; pageBookmarks: Record<string, string> }
  | { n: number; type: "token"; pageId: string; token: Token }
  | { n: number; type: "token.removed"; pageId: string; id: string }
  | { n: number; type: "tracker"; tracker: Tracker }
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
