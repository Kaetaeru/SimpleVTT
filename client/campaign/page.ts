/**
 * Pages and tokens as Roll20 has them (ROLL20_TABLE_SPEC.md §2–§3): a page is a grid of cells with a background and
 * layers; a token is an image on a page that may represent a journal character (then bars link to the sheet, D78,
 * and markers are the sheet's conditions, D84). Players see only the page their ribbon (or a split-the-party
 * bookmark) points at, never the GM layer, and move only tokens they control.
 */
import { sizeCells } from "../compendium/monsters";
import type { Audience, JournalCharacter, JournalEntry, JournalNpc, JournalViewer } from "./journal";
import { audienceIncludes, canEdit } from "./journal";

export type Layer = "map" | "objects" | "gm";
export type GridType = "square" | "hex-h" | "hex-v";

export interface TokenBar {
  value?: number;
  max?: number;
  /** Character attribute the bar mirrors (hp, ac …); the host refreshes value/max from the sheet (D78). */
  link?: string;
  /** Players see the bar. */
  visible: boolean;
  /** Controllers may edit the value (a relative "-5" too). */
  editable: boolean;
}

export interface TokenAura { radius: number; color: string; square: boolean; visible: boolean }

export interface TokenMarker { name: string; badge?: number }

export interface Token {
  id: string;
  name: string;
  layer: Layer;
  /** Top-left in cells (fractions allowed when snapping is off). */
  x: number;
  y: number;
  /** Size in cells. */
  w: number;
  h: number;
  rotation: number;
  /** `art:<id>`, a data URL, or nothing (the initial letter is drawn). */
  image?: string;
  /** Journal character this token represents. */
  represents?: string;
  /** Who may move and edit it; "inherit" = the character's 고칠 수 있는 사람. */
  controlledBy: Audience | "inherit";
  showName: boolean;
  nameVisibleToPlayers: boolean;
  bars: [TokenBar, TokenBar, TokenBar];
  barStyle: { position: "above" | "below"; overlap: boolean; showNumbers: boolean };
  auras: [TokenAura, TokenAura];
  tint?: string;
  markers: TokenMarker[];
  gmNotes: string;
  locked: boolean;
  flipH: boolean;
  flipV: boolean;
  /** Stacking order within the layer (higher = in front). */
  z: number;
  vision: { sight: boolean; angle?: number; range?: number; nightVision?: number };
  light: { bright: number; dim: number; angle?: number; visibleToPlayers: boolean };
  isDrawing: boolean;
}

export interface Page {
  id: string;
  kind: "page";
  campaignId: string;
  name: string;
  order: number;
  /** Size in cells. */
  width: number;
  height: number;
  /** One cell = `scale` `unit` (5 ft). */
  scale: number;
  unit: string;
  grid: { enabled: boolean; type: GridType; cell: number; color: string; opacity: number; labels: boolean; snap: boolean };
  background: { color: string; image?: string };
  fog: { enabled: boolean };
  /** "scene" = Theatre of the Mind: tokens are icons on a board, positions and distances are not tracked. Missing = grid. */
  layout?: "grid" | "scene";
  archived: boolean;
  tokens: Token[];
  createdAt: string;
  updatedAt: string;
}

/** Roll20's default set plus the 5e conditions and a few named markers fixed by D84. */
export const CONDITION_MARKERS = ["장님", "매혹", "귀머거리", "공포", "붙잡힘", "행동불능", "투명", "마비", "석화", "중독", "넘어짐", "포박", "충격", "무의식"] as const;
export const NAMED_MARKERS = ["집중", "사망", "은신", "엄폐 1/2", "엄폐 3/4"] as const;
export const DOT_MARKERS = ["빨강", "파랑", "초록", "갈색", "보라", "분홍", "노랑"] as const;
export const MARKER_GLYPH: Record<string, string> = {
  장님: "🙈", 매혹: "💗", 귀머거리: "🙉", 공포: "😱", 붙잡힘: "✊", 행동불능: "💫", 투명: "👻", 마비: "⚡", 석화: "🗿", 중독: "☠", 넘어짐: "⬇", 포박: "⛓", 충격: "💥", 무의식: "💤",
  집중: "🎯", 사망: "✖", 은신: "🕶", "엄폐 1/2": "◧", "엄폐 3/4": "◨",
  빨강: "🔴", 파랑: "🔵", 초록: "🟢", 갈색: "🟤", 보라: "🟣", 분홍: "🩷", 노랑: "🟡",
};
export const ALL_MARKERS: string[] = [...CONDITION_MARKERS, ...NAMED_MARKERS, ...DOT_MARKERS];
export const isConditionMarker = (name: string) => (CONDITION_MARKERS as readonly string[]).includes(name);

const randomId = (prefix: string) => `${prefix}_${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 12) : Math.random().toString(36).slice(2, 14)}`;

export const emptyBar = (link?: string): TokenBar => ({ link, visible: true, editable: false });
export const emptyAura = (): TokenAura => ({ radius: 0, color: "#ffd166", square: false, visible: true });

export function newPage(campaignId: string, name: string, order: number, now = new Date().toISOString()): Page {
  return {
    id: randomId("page"), kind: "page", campaignId, name, order, width: 25, height: 25, scale: 5, unit: "ft",
    grid: { enabled: true, type: "square", cell: 70, color: "#000000", opacity: 0.35, labels: false, snap: true },
    background: { color: "#d9d2c5" }, fog: { enabled: false }, archived: false, tokens: [], createdAt: now, updatedAt: now,
  };
}

/** A Theatre-of-the-Mind scene: no grid, no distances; tokens are the actors present (D95). */
export function newScene(campaignId: string, name: string, order: number, now = new Date().toISOString()): Page {
  const page = newPage(campaignId, name, order, now);
  return { ...page, layout: "scene", grid: { ...page.grid, enabled: false } };
}

export const isScene = (page: Pick<Page, "layout"> | null | undefined) => page?.layout === "scene";

export function newToken(partial: Partial<Token> & { name: string }): Token {
  const { id, ...rest } = partial;
  return {
    id: id ?? randomId("tok"), layer: "objects", x: 0, y: 0, w: 1, h: 1, rotation: 0, controlledBy: partial.represents ? "inherit" : [], showName: true, nameVisibleToPlayers: true,
    bars: [emptyBar(partial.represents ? "hp" : undefined), emptyBar(), emptyBar()], barStyle: { position: "above", overlap: false, showNumbers: true }, auras: [emptyAura(), emptyAura()],
    markers: [], gmNotes: "", locked: false, flipH: false, flipV: false, z: 0, vision: { sight: Boolean(partial.represents) }, light: { bright: 0, dim: 0, visibleToPlayers: true }, isDrawing: false,
    ...rest,
  };
}

/** A token for a journal character: its default token if saved, else a 1×1 token with the avatar and HP on bar 1. */
export function tokenForCharacter(entry: JournalCharacter, at: { x: number; y: number }): Token {
  const { id: _ignored, ...base } = entry.defaultToken ?? {};
  return newToken({ ...base, name: entry.name, represents: entry.id, image: entry.avatar ?? base.image, x: at.x, y: at.y, layer: "objects" });
}

/** A token for an NPC: sized by the monster, bars unlinked (each token has its own HP, D78), controlled by the GM only. */
export function tokenForNpc(entry: JournalNpc, at: { x: number; y: number }): Token {
  const { id: _ignored, ...base } = entry.defaultToken ?? {};
  const cells = sizeCells(entry.statBlock.size);
  return newToken({ w: cells, h: cells, ...base, name: entry.name, represents: entry.id, image: entry.avatar ?? base.image, x: at.x, y: at.y, layer: "objects", controlledBy: [], bars: [{ value: entry.statBlock.hp, max: entry.statBlock.hp, visible: true, editable: false }, emptyBar(), emptyBar()], vision: { sight: true } });
}

export const tokenForEntry = (entry: JournalEntry, at: { x: number; y: number }) => (entry.kind === "character" ? tokenForCharacter(entry, at) : entry.kind === "npc" ? tokenForNpc(entry, at) : null);

/** Who controls a token: the token's own list, or (inherit) the character's 고칠 수 있는 사람. GM always. */
export function controlsToken(token: Token, viewer: JournalViewer, journal: JournalEntry[]): boolean {
  if (viewer.role === "gm") return true;
  if (token.controlledBy !== "inherit") return audienceIncludes(token.controlledBy, viewer.userId);
  const entry = token.represents ? journal.find((item) => item.id === token.represents) : undefined;
  return entry ? canEdit(entry, viewer) : false;
}

/** The page a viewer looks at: the GM chooses freely; a player follows their bookmark, else the ribbon. */
export function playerPageId(campaign: { playerPageId?: string; pageBookmarks?: Record<string, string> }, viewer: JournalViewer): string | undefined {
  return campaign.pageBookmarks?.[viewer.userId] ?? campaign.playerPageId;
}

/** What a player receives of a page: no GM-layer tokens, no GM notes, hidden bars and auras blanked. */
export function projectToken(token: Token, viewer: JournalViewer): Token | null {
  if (viewer.role === "gm") return token;
  if (token.layer === "gm") return null;
  return {
    ...token,
    gmNotes: "",
    bars: token.bars.map((bar) => (bar.visible ? bar : { ...bar, value: undefined, max: undefined })) as Token["bars"],
    auras: token.auras.map((aura) => (aura.visible ? aura : { ...aura, radius: 0 })) as Token["auras"],
    light: token.light.visibleToPlayers ? token.light : { ...token.light, bright: 0, dim: 0 },
  };
}

export function projectPage(page: Page, viewer: JournalViewer, campaign: { playerPageId?: string; pageBookmarks?: Record<string, string> }): Page | null {
  if (viewer.role === "gm") return page;
  if (page.archived || page.id !== playerPageId(campaign, viewer)) return null;
  return { ...page, tokens: page.tokens.map((token) => projectToken(token, viewer)).filter((token): token is Token => token !== null) };
}

/**
 * Merge a controller's edit of a token: position, rotation, flips, markers, and the values of editable bars.
 * Everything else (layer, size, image, permissions, links, GM notes, lock) stays as it was.
 */
export function mergeControllerTokenEdit(stored: Token, incoming: Token): Token {
  if (stored.locked) return stored;
  return {
    ...stored,
    x: incoming.x, y: incoming.y, rotation: incoming.rotation, flipH: incoming.flipH, flipV: incoming.flipV, markers: incoming.markers,
    bars: stored.bars.map((bar, index) => (bar.editable ? { ...bar, value: incoming.bars[index]?.value } : bar)) as Token["bars"],
  };
}

/** Snap a cell coordinate to the grid (whole cells; half cells for tokens smaller than one cell). */
export const snap = (value: number, size = 1) => (size >= 1 ? Math.round(value) : Math.round(value / size) * size);

export const clampToPage = (page: Page, token: Pick<Token, "x" | "y" | "w" | "h">) => ({ x: Math.min(Math.max(0, token.x), page.width - token.w), y: Math.min(Math.max(0, token.y), page.height - token.h) });

/** Column label A, B, … AA as Roll20's grid labels. */
export function columnLabel(index: number) { let label = ""; let n = index; do { label = String.fromCharCode(65 + (n % 26)) + label; n = Math.floor(n / 26) - 1; } while (n >= 0); return label; }

/** Apply a bar edit as our HP command grammar: "12" sets, "-4" and "+4" adjust. */
export function applyBarInput(bar: TokenBar, text: string): TokenBar | null {
  const trimmed = text.trim();
  if (!/^[+-]?\d+$/.test(trimmed)) return null;
  const current = bar.value ?? 0;
  const next = trimmed.startsWith("+") ? current + Number(trimmed.slice(1)) : trimmed.startsWith("-") ? current - Number(trimmed.slice(1)) : Number(trimmed);
  return { ...bar, value: bar.max !== undefined ? Math.max(0, Math.min(bar.max, next)) : Math.max(0, next) };
}

/** Distance between two cell points in page units (5e diagonal = 1 cell, Roll20's default "no diagonal cost"). */
export const cellDistance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
