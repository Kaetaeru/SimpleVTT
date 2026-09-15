/**
 * The campaign journal as Roll20 has it (ROLL20_TABLE_SPEC.md §4): handouts and characters in folders, each with
 * two permission fields — 볼 수 있는 사람 (In Player's Journals) and 고칠 수 있는 사람 (Can Be Edited By / Controlled By).
 * The GM sees and edits everything; GM notes never leave the host for players. A campaign character is a full
 * character (source + runtime) whose original lives in the campaign; the library copy is only a Vault (D73).
 */
import type { AbilityKey } from "../catalog/types";
import type { CharacterRuntime } from "../character/runtime";
import type { CharacterSource } from "../character/types";
import type { MonsterView } from "../compendium/monsters";
import type { PlayerRole } from "./model";

/** "all" = every player, otherwise the listed user ids (empty = nobody but the GM). */
export type Audience = "all" | string[];

interface JournalBase {
  id: string;
  campaignId: string;
  name: string;
  /** Data URL or (later, R4) an art id. */
  avatar?: string;
  /** Folder path "괴물/동굴" — empty = root. */
  folder: string;
  canView: Audience;
  canEdit: Audience;
  /** GM-only text; stripped from every player projection. */
  gmNotes: string;
  archived: boolean;
  /** Free tags (Roll20 character tags). */
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface JournalHandout extends JournalBase {
  kind: "handout";
  /** Player-visible body (light markup, see renderJournalText). */
  notes: string;
}

export interface JournalCharacter extends JournalBase {
  kind: "character";
  bio: string;
  source: CharacterSource;
  runtime: CharacterRuntime;
  /** Set by "라이브러리에서 가져오기": the library id the copy came from (export offers to overwrite it). */
  vaultId?: string;
  /** "기본 토큰으로 저장": what a token dragged from this character starts as (ROLL20_TABLE_SPEC.md §3.3). */
  defaultToken?: Partial<import("./page").Token>;
}

/** Play state of a monster sheet (its tokens usually carry their own HP, D78; this is the sheet's own). */
export interface NpcRuntime {
  hp: { current: number; max: number; temp: number };
  conditions: string[];
  /** Legendary actions spent this round (reset at the monster's turn start). */
  legendaryUsed: number;
  /** Recharge actions spent and waiting for their roll (action name → true = spent). */
  spent: Record<string, boolean>;
  /** R10: per-day spells used (spell id → count); the sheet's 초기화 clears it. */
  uses?: Record<string, number>;
  /** R10: effects the NPC may shake off with a save at the end of its turns. */
  endSaves?: Array<{ key: string; name: string; ability: AbilityKey; dc: number; conditions: string[] }>;
  updatedAt: string;
}

/** A monster from the compendium as a journal entry (Roll20's NPC sheet), with its own copy of the stat block. */
export interface JournalNpc extends JournalBase {
  kind: "npc";
  monsterId: string;
  statBlock: MonsterView;
  runtime: NpcRuntime;
  bio: string;
  defaultToken?: Partial<import("./page").Token>;
}

export type JournalEntry = JournalHandout | JournalCharacter | JournalNpc;

export interface JournalViewer { userId: string; role: PlayerRole }

const randomId = (prefix: string) => `${prefix}_${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 12) : Math.random().toString(36).slice(2, 14)}`;
export const newJournalId = (kind: JournalEntry["kind"]) => randomId(kind === "handout" ? "jh" : kind === "npc" ? "jn" : "jc");

export const audienceIncludes = (audience: Audience, userId: string) => audience === "all" || audience.includes(userId);

export function canView(entry: JournalEntry, viewer: JournalViewer) { return viewer.role === "gm" || (!entry.archived && audienceIncludes(entry.canView, viewer.userId)); }
export function canEdit(entry: JournalEntry, viewer: JournalViewer) { return viewer.role === "gm" || (!entry.archived && audienceIncludes(entry.canEdit, viewer.userId)); }

/** What a viewer receives: the GM everything; a player the entry without GM notes, or nothing. */
export function projectEntry(entry: JournalEntry, viewer: JournalViewer): JournalEntry | null {
  if (!canView(entry, viewer)) return null;
  if (viewer.role === "gm") return entry;
  return { ...entry, gmNotes: "" };
}

export function newHandout(campaignId: string, createdBy: string, name = "새 핸드아웃", now = new Date().toISOString()): JournalHandout {
  return { id: newJournalId("handout"), kind: "handout", campaignId, name, folder: "", canView: [], canEdit: [], gmNotes: "", archived: false, tags: [], createdBy, createdAt: now, updatedAt: now, notes: "" };
}

export function newJournalCharacter(campaignId: string, createdBy: string, source: CharacterSource, runtime: CharacterRuntime, options: { vaultId?: string; owner?: string; now?: string } = {}): JournalCharacter {
  const now = options.now ?? new Date().toISOString();
  const owner = options.owner ?? createdBy;
  return { id: newJournalId("character"), kind: "character", campaignId, name: source.name || "이름 없는 캐릭터", avatar: source.portrait, folder: "", canView: [owner], canEdit: [owner], gmNotes: "", archived: false, tags: [], createdBy, createdAt: now, updatedAt: now, bio: source.notes?.backstory ?? "", source, runtime, vaultId: options.vaultId };
}

export const newNpcRuntime = (monster: MonsterView, now = new Date().toISOString()): NpcRuntime => ({ hp: { current: monster.hp, max: monster.hp, temp: 0 }, conditions: [], legendaryUsed: 0, spent: {}, updatedAt: now });

/** An NPC from a compendium monster: GM-only, in the 괴물 folder, named after the monster. */
export function newJournalNpc(campaignId: string, createdBy: string, monster: MonsterView, options: { name?: string; now?: string } = {}): JournalNpc {
  const now = options.now ?? new Date().toISOString();
  return { id: newJournalId("npc"), kind: "npc", campaignId, name: options.name ?? monster.name, folder: "괴물", canView: [], canEdit: [], gmNotes: "", archived: false, tags: [monster.typeText, `CR ${monster.crText}`], createdBy, createdAt: now, updatedAt: now, monsterId: monster.id, statBlock: monster, runtime: newNpcRuntime(monster, now), bio: "" };
}

/**
 * Merge a player's edit into the stored entry: only the fields a controller may touch change (name, avatar, body,
 * the character's source and runtime, tags). Permissions, folder, GM notes and archive stay the GM's.
 */
export function mergePlayerEdit(stored: JournalEntry, incoming: JournalEntry, now = new Date().toISOString()): JournalEntry {
  const base = { ...stored, name: incoming.name, avatar: incoming.avatar, tags: incoming.tags, updatedAt: now };
  if (stored.kind === "handout" && incoming.kind === "handout") return { ...base, kind: "handout", notes: incoming.notes };
  if (stored.kind === "character" && incoming.kind === "character") return { ...base, kind: "character", bio: incoming.bio, source: incoming.source, runtime: incoming.runtime, vaultId: stored.vaultId, defaultToken: incoming.defaultToken ?? stored.defaultToken };
  if (stored.kind === "npc" && incoming.kind === "npc") return { ...base, kind: "npc", monsterId: stored.monsterId, statBlock: stored.statBlock, bio: incoming.bio, runtime: incoming.runtime, defaultToken: incoming.defaultToken ?? stored.defaultToken };
  return stored;
}

/** Folder tree for the list: entries grouped by their folder path, folders sorted, entries by name. */
export interface JournalFolder { path: string; name: string; entries: JournalEntry[]; folders: JournalFolder[] }

export function journalTree(entries: JournalEntry[]): JournalFolder {
  const root: JournalFolder = { path: "", name: "", entries: [], folders: [] };
  const folderAt = (path: string): JournalFolder => {
    if (!path) return root;
    const parts = path.split("/").map((part) => part.trim()).filter(Boolean);
    let node = root;
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      let next = node.folders.find((folder) => folder.path === current);
      if (!next) { next = { path: current, name: part, entries: [], folders: [] }; node.folders.push(next); node.folders.sort((a, b) => a.name.localeCompare(b.name, "ko")); }
      node = next;
    }
    return node;
  };
  for (const entry of [...entries].sort((a, b) => a.name.localeCompare(b.name, "ko"))) folderAt(entry.folder).entries.push(entry);
  return root;
}

export const journalFolders = (entries: JournalEntry[]) => [...new Set(entries.map((entry) => entry.folder).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));

/**
 * Handout body markup (a small subset of what Roll20's editor produces): `# 제목`, `- 항목`, `**굵게**`, `*기울임*`,
 * `[글](https://…)`, and journal links `@[항목 이름]` (D85). Returned as blocks the screen renders.
 */
export type TextSpan = { kind: "text"; text: string; bold?: boolean; italic?: boolean } | { kind: "link"; text: string; href: string } | { kind: "journal"; name: string };
export type TextBlock = { kind: "heading"; level: number; spans: TextSpan[] } | { kind: "paragraph"; spans: TextSpan[] } | { kind: "list"; items: TextSpan[][] };

export function parseSpans(text: string): TextSpan[] {
  const spans: TextSpan[] = [];
  const pattern = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))|(@\[([^\]]+)\])/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const at = match.index ?? 0;
    if (at > last) spans.push({ kind: "text", text: text.slice(last, at) });
    if (match[2] !== undefined) spans.push({ kind: "text", text: match[2], bold: true });
    else if (match[4] !== undefined) spans.push({ kind: "text", text: match[4], italic: true });
    else if (match[6] !== undefined) spans.push({ kind: "link", text: match[6], href: match[7] });
    else if (match[9] !== undefined) spans.push({ kind: "journal", name: match[9] });
    last = at + match[0].length;
  }
  if (last < text.length) spans.push({ kind: "text", text: text.slice(last) });
  return spans;
}

export function parseJournalText(text: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  let paragraph: string[] = [];
  let list: TextSpan[][] | null = null;
  const flush = () => {
    if (paragraph.length) { blocks.push({ kind: "paragraph", spans: parseSpans(paragraph.join("\n")) }); paragraph = []; }
    if (list) { blocks.push({ kind: "list", items: list }); list = null; }
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const item = /^[-*]\s+(.*)$/.exec(line);
    if (!line.trim()) { flush(); continue; }
    if (heading) { flush(); blocks.push({ kind: "heading", level: heading[1].length, spans: parseSpans(heading[2]) }); continue; }
    if (item) { if (paragraph.length) flush(); (list ??= []).push(parseSpans(item[1])); continue; }
    if (list) flush();
    paragraph.push(line);
  }
  flush();
  return blocks;
}

/** Journal link targets by name (the first entry with that name the viewer can see). */
export const findByName = (entries: JournalEntry[], name: string) => entries.find((entry) => entry.name.trim().toLowerCase() === name.trim().toLowerCase());
