/**
 * Roll20 chat commands (ROLL20_MODEL.md §3.3): `/roll` `/r`, `/gmroll` `/gr`, `/w <name> text`, `/em`, `/desc`,
 * `/talktomyself`, inline rolls `[[1d8+3]]`. Parsing is pure; who sees a message is decided by `visibleTo`.
 */
import type { ChatMessage, PlayerRole } from "../campaign/model";
import { parseFormula } from "../character/dice";

export type ChatInput =
  | { kind: "say"; text: string; inline: string[] }
  | { kind: "whisper"; target: string; text: string }
  | { kind: "emote"; text: string }
  | { kind: "desc"; text: string }
  | { kind: "roll"; formula: string; label?: string; mode: "public" | "gm" | "self" }
  /** R17: `/roll 2t[조우]` — the host draws from the rollable table, because players never hold its rows. */
  | { kind: "table"; name: string; count: number; mode: "public" | "gm" | "self" }
  | { kind: "empty" };

const INLINE = /\[\[([^\]]+)\]\]/g;
/** R17: `2t[조우]` — draw two rows from the "조우" table. */
const TABLE_ROLL = /^(\d*)t\[([^\]]+)\]$/i;

/**
 * R17: `#이름` at the head of a line runs that macro — its text replaces the line and is parsed as if typed.
 * Anything typed after the name is appended, so `#공격 유리` works. Nesting is followed a few levels and no further.
 */
export function expandMacros(raw: string, macros: Array<{ name: string; text: string }>, depth = 0): string {
  const trimmed = raw.trim();
  if (depth > 4 || !trimmed.startsWith("#")) return raw;
  const name = trimmed.slice(1).split(/\s/)[0];
  const macro = macros.find((item) => item.name === name);
  if (!macro) return raw;
  const rest = trimmed.slice(1 + name.length).trim();
  return expandMacros(rest ? `${macro.text} ${rest}` : macro.text, macros, depth + 1);
}

export function parseChatInput(raw: string): ChatInput {
  const text = raw.trim();
  if (!text) return { kind: "empty" };
  const rollMatch = /^\/(roll|r|gmroll|gr|selfroll|sr)\s+(.+)$/i.exec(text);
  if (rollMatch) {
    const command = rollMatch[1].toLowerCase();
    const mode = command.startsWith("gm") || command === "gr" ? "gm" : command.startsWith("s") ? "self" : "public";
    const [formulaPart, ...labelParts] = rollMatch[2].split("#");
    const formula = formulaPart.trim();
    const table = TABLE_ROLL.exec(formula);
    if (table) return { kind: "table", name: table[2].trim(), count: Number(table[1] || 1), mode };
    return parseFormula(formula) ? { kind: "roll", formula, label: labelParts.join("#").trim() || undefined, mode } : { kind: "say", text, inline: [] };
  }
  const whisper = /^\/w(?:hisper)?\s+(?:"([^"]+)"|(\S+))\s+([\s\S]+)$/i.exec(text);
  if (whisper) return { kind: "whisper", target: (whisper[1] ?? whisper[2]).trim(), text: whisper[3].trim() };
  const emote = /^\/(em|me|emote)\s+([\s\S]+)$/i.exec(text);
  if (emote) return { kind: "emote", text: emote[2].trim() };
  const desc = /^\/desc\s+([\s\S]+)$/i.exec(text);
  if (desc) return { kind: "desc", text: desc[1].trim() };
  const inline = [...text.matchAll(INLINE)].map((match) => match[1].trim()).filter((formula) => parseFormula(formula));
  return { kind: "say", text, inline };
}

/** Replace each `[[formula]]` with its rolled total, in order. */
export function renderInline(text: string, totals: number[]) {
  let index = 0;
  return text.replace(INLINE, (whole, formula: string) => (parseFormula(formula.trim()) && index < totals.length ? `[${totals[index++]}]` : whole));
}

export interface ChatViewer { userId: string; role: PlayerRole }

/** Roll20 visibility: whispers reach sender, target and every GM; GM rolls reach the roller and GMs; the rest everyone. */
export function visibleTo(message: ChatMessage, viewer: ChatViewer): boolean {
  if (viewer.role === "gm") return true;
  if (message.type === "whisper") return message.playerId === viewer.userId || message.target === viewer.userId;
  if (message.type === "gmroll") return message.playerId === viewer.userId;
  return true;
}

export const describeChatRoll = (roll: NonNullable<ChatMessage["roll"]>) => {
  const kept = roll.dice.filter((die) => !die.dropped).map((die) => `${die.value}${die.exploded ? "!" : ""}`).join(", ");
  const dropped = roll.dice.filter((die) => die.dropped).map((die) => die.value);
  const modifier = roll.modifier && roll.successes === undefined ? ` ${roll.modifier > 0 ? "+" : "−"} ${Math.abs(roll.modifier)}` : "";
  return `${roll.label ? `${roll.label}: ` : ""}${roll.formula} → [${kept}]${dropped.length ? ` (버림 ${dropped.join(", ")})` : ""}${modifier} = ${roll.successes !== undefined ? `성공 ${roll.successes}` : roll.total}`;
};
