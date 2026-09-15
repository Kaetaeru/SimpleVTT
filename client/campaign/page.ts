/**
 * Scenes and tokens (D95, D109): a scene is a named board with a background and a description; a token is an actor
 * present in it, an icon that may represent a journal character (then bars link to the sheet, D78, and markers are
 * the sheet's conditions, D84). There are no positions and no distances — the DM narrates where everyone is.
 * Players see only the scene their ribbon (or a split-the-party bookmark) points at, never the GM layer.
 */
import type { Audience, JournalCharacter, JournalEntry, JournalNpc, JournalViewer } from "./journal";
import { audienceIncludes, canEdit } from "./journal";

/** "objects" = everyone sees it, "gm" = the GM alone (D109: the old map layer went with the grid). */
export type Layer = "objects" | "gm";

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

export interface TokenMarker { name: string; badge?: number; /** Who granted a turn-scoped mark such as 도움 (token id): it ends when their next turn starts. */ from?: string }

export interface Token {
  id: string;
  name: string;
  layer: Layer;
  /** `art:<id>`, a data URL, or nothing (the initial letter is drawn). */
  image?: string;
  /** Journal character this token represents. */
  represents?: string;
  /** Who may move and edit it; "inherit" = the character's 고칠 수 있는 사람. */
  controlledBy: Audience | "inherit";
  showName: boolean;
  nameVisibleToPlayers: boolean;
  bars: [TokenBar, TokenBar, TokenBar];
  tint?: string;
  markers: TokenMarker[];
  gmNotes: string;
  locked: boolean;
  /** Order within its row on the stage (higher = further right). */
  z: number;
}

export interface Page {
  id: string;
  kind: "page";
  campaignId: string;
  name: string;
  order: number;
  background: { color: string; image?: string };
  /** A few lines the DM writes for the scene ("비 오는 밤, 여관 뒷마당…"), shown on the stage card. */
  description?: string;
  archived: boolean;
  tokens: Token[];
  createdAt: string;
  updatedAt: string;
}

/** Roll20's default set plus the 5e conditions and a few named markers fixed by D84. */
export const CONDITION_MARKERS = ["장님", "매혹", "귀머거리", "공포", "붙잡힘", "행동불능", "투명", "마비", "석화", "중독", "넘어짐", "포박", "충격", "무의식"] as const;
export const NAMED_MARKERS = ["집중", "사망", "은신", "엄폐 1/2", "엄폐 3/4", "교란", "약화", "둔화"] as const;
export const DOT_MARKERS = ["빨강", "파랑", "초록", "갈색", "보라", "분홍", "노랑"] as const;
export const MARKER_GLYPH: Record<string, string> = {
  장님: "🙈", 매혹: "💗", 귀머거리: "🙉", 공포: "😱", 붙잡힘: "✊", 행동불능: "💫", 투명: "👻", 마비: "⚡", 석화: "🗿", 중독: "☠", 넘어짐: "⬇", 포박: "⛓", 충격: "💥", 무의식: "💤",
  집중: "🎯", 사망: "✖", 은신: "🕶", "엄폐 1/2": "◧", "엄폐 3/4": "◨",
  회피: "🛡", 이탈: "🌀", 도움: "🤝", 준비: "⏳", 질주: "💨", 교란: "🎯", 약화: "😵", 둔화: "🐌",
  빨강: "🔴", 파랑: "🔵", 초록: "🟢", 갈색: "🟤", 보라: "🟣", 분홍: "🩷", 노랑: "🟡",
};
export const ALL_MARKERS: string[] = [...CONDITION_MARKERS, ...NAMED_MARKERS, ...DOT_MARKERS];
export const isConditionMarker = (name: string) => (CONDITION_MARKERS as readonly string[]).includes(name);

const randomId = (prefix: string) => `${prefix}_${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 12) : Math.random().toString(36).slice(2, 14)}`;

export const emptyBar = (link?: string): TokenBar => ({ link, visible: true, editable: false });

/** A Theatre-of-the-Mind scene (D95): the actors present, no positions and no distances. */
export function newScene(campaignId: string, name: string, order: number, now = new Date().toISOString()): Page {
  return { id: randomId("page"), kind: "page", campaignId, name, order, background: { color: "#d9d2c5" }, archived: false, tokens: [], createdAt: now, updatedAt: now };
}

export function newToken(partial: Partial<Token> & { name: string }): Token {
  const { id, ...rest } = partial;
  return {
    id: id ?? randomId("tok"), layer: "objects", controlledBy: partial.represents ? "inherit" : [], showName: true, nameVisibleToPlayers: true,
    bars: [emptyBar(partial.represents ? "hp" : undefined), emptyBar(), emptyBar()], markers: [], gmNotes: "", locked: false, z: 0,
    ...rest,
  };
}

/** A token for a journal character: its default token if saved, else an icon with the avatar and HP on bar 1. */
export function tokenForCharacter(entry: JournalCharacter): Token {
  const { id: _ignored, ...base } = entry.defaultToken ?? {};
  return newToken({ ...base, name: entry.name, represents: entry.id, image: entry.avatar ?? base.image, layer: "objects" });
}

/** A token for an NPC: bars unlinked (each token has its own HP, D78), controlled by the GM only. */
export function tokenForNpc(entry: JournalNpc): Token {
  const { id: _ignored, ...base } = entry.defaultToken ?? {};
  return newToken({ ...base, name: entry.name, represents: entry.id, image: entry.avatar ?? base.image, layer: "objects", controlledBy: [], bars: [{ value: entry.statBlock.hp, max: entry.statBlock.hp, visible: true, editable: false }, emptyBar(), emptyBar()] });
}

export const tokenForEntry = (entry: JournalEntry) => (entry.kind === "character" ? tokenForCharacter(entry) : entry.kind === "npc" ? tokenForNpc(entry) : null);

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

/** What a player receives of a scene: no GM-layer tokens, no GM notes, hidden bars blanked. */
export function projectToken(token: Token, viewer: JournalViewer): Token | null {
  if (viewer.role === "gm") return token;
  if (token.layer === "gm") return null;
  return { ...token, gmNotes: "", bars: token.bars.map((bar) => (bar.visible ? bar : { ...bar, value: undefined, max: undefined })) as Token["bars"] };
}

export function projectPage(page: Page, viewer: JournalViewer, campaign: { playerPageId?: string; pageBookmarks?: Record<string, string> }): Page | null {
  if (viewer.role === "gm") return page;
  if (page.archived || page.id !== playerPageId(campaign, viewer)) return null;
  return { ...page, tokens: page.tokens.map((token) => projectToken(token, viewer)).filter((token): token is Token => token !== null) };
}

/**
 * Merge a controller's edit of a token: the order on the stage, markers, and the values of editable bars.
 * Everything else (layer, image, permissions, links, GM notes, lock) stays as it was.
 */
export function mergeControllerTokenEdit(stored: Token, incoming: Token): Token {
  if (stored.locked) return stored;
  return {
    ...stored, z: incoming.z, markers: incoming.markers,
    bars: stored.bars.map((bar, index) => (bar.editable ? { ...bar, value: incoming.bars[index]?.value } : bar)) as Token["bars"],
  };
}

/** Apply a bar edit as our HP command grammar: "12" sets, "-4" and "+4" adjust. */
export function applyBarInput(bar: TokenBar, text: string): TokenBar | null {
  const trimmed = text.trim();
  if (!/^[+-]?\d+$/.test(trimmed)) return null;
  const current = bar.value ?? 0;
  const next = trimmed.startsWith("+") ? current + Number(trimmed.slice(1)) : trimmed.startsWith("-") ? current - Number(trimmed.slice(1)) : Number(trimmed);
  return { ...bar, value: bar.max !== undefined ? Math.max(0, Math.min(bar.max, next)) : Math.max(0, next) };
}
