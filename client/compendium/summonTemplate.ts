/**
 * R84 (ROLL20_TABLE_SPEC.md D219): a summon spell's creature, written once and filled in at the slot it was cast.
 *
 * 야수 소환, 요정 소환 and the rest of the 2024 summons each bring one stat block whose AC, HP, attack bonus, damage and
 * number of attacks follow the spell's level and the caster's spellcasting. A module writes that block in the custom
 * NPC shape (docs/guides/CUSTOM_NPC_JSON.md) with `{…}` where a number depends on the cast: `{level}`, `{attack}` (the
 * caster's spell attack bonus), `{dc}` (spell save DC), `{mod}` (spellcasting modifier), `+ - * /`, parentheses and
 * `floor(…)`. A string that is only `{…}` becomes a number; elsewhere the value is written into the text.
 */
import { parseCustomMonster } from "./customMonster";
import type { MonsterView } from "./monsters";

export interface SummonForm { name: string; template: Record<string, unknown> }
export interface SpellSummon { forms: SummonForm[]; note?: string }
export interface SummonVars { level: number; attack: number; dc: number; mod: number }

/** `+ - * /`, parentheses, numbers, the four names and floor — nothing else is read. */
export function evaluateExpression(source: string, vars: SummonVars): number {
  const tokens = source.match(/\d+(?:\.\d+)?|[a-z]+|[-+*/()]/g) ?? [];
  let at = 0;
  const peek = () => tokens[at];
  const primary = (): number => {
    const token = tokens[at++];
    if (token === undefined) throw new Error(`식이 끝났습니다: ${source}`);
    if (token === "(") { const value = sum(); if (tokens[at++] !== ")") throw new Error(`괄호가 닫히지 않았습니다: ${source}`); return value; }
    if (token === "-") return -primary();
    if (token === "floor") { if (tokens[at++] !== "(") throw new Error(`floor 다음에는 (: ${source}`); const value = sum(); if (tokens[at++] !== ")") throw new Error(`괄호가 닫히지 않았습니다: ${source}`); return Math.floor(value); }
    if (/^\d/.test(token)) return Number(token);
    if (token in vars) return vars[token as keyof SummonVars];
    throw new Error(`모르는 이름 ${token}: ${source}`);
  };
  const product = (): number => { let value = primary(); while (peek() === "*" || peek() === "/") { const op = tokens[at++]; const right = primary(); value = op === "*" ? value * right : value / right; } return value; };
  const sum = (): number => { let value = product(); while (peek() === "+" || peek() === "-") { const op = tokens[at++]; const right = product(); value = op === "+" ? value + right : value - right; } return value; };
  const value = sum();
  if (at !== tokens.length) throw new Error(`읽지 못한 부분이 있습니다: ${source}`);
  return value;
}

function fill(value: unknown, vars: SummonVars): unknown {
  if (typeof value === "string") {
    const whole = /^\{([^{}]+)\}$/.exec(value.trim());
    if (whole) return evaluateExpression(whole[1], vars);
    return value.replace(/\{([^{}]+)\}/g, (_, expr: string) => String(evaluateExpression(expr, vars)));
  }
  if (Array.isArray(value)) return value.map((item) => fill(item, vars));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, fill(item, vars)]));
  return value;
}

/** The creature a form becomes at this cast, or why it cannot be made. */
export function summonMonster(form: SummonForm, vars: SummonVars): { monster: MonsterView } | { error: string } {
  let filled: unknown;
  try { filled = fill(form.template, vars); } catch (error) { return { error: error instanceof Error ? error.message : String(error) }; }
  const parsed = parseCustomMonster(JSON.stringify(filled));
  return "error" in parsed ? parsed : { monster: parsed.monster };
}
