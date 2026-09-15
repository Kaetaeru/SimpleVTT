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
  | { kind: "empty" };

const INLINE = /\[\[([^\]]+)\]\]/g;

export function parseChatInput(raw: string): ChatInput {
  const text = raw.trim();
  if (!text) return { kind: "empty" };
  const rollMatch = /^\/(roll|r|gmroll|gr|selfroll|sr)\s+(.+)$/i.exec(text);
  if (rollMatch) {
    const command = rollMatch[1].toLowerCase();
    const mode = command.startsWith("gm") || command === "gr" ? "gm" : command.startsWith("s") ? "self" : "public";
    const [formulaPart, ...labelParts] = rollMatch[2].split("#");
    const formula = formulaPart.trim();
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

export const describeChatRoll = (roll: NonNullable<ChatMessage["roll"]>) => `${roll.label ? `${roll.label}: ` : ""}${roll.formula} → [${roll.dice.map((die) => die.value).join(", ")}]${roll.modifier ? ` ${roll.modifier > 0 ? "+" : "−"} ${Math.abs(roll.modifier)}` : ""} = ${roll.total}`;
