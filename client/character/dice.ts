/**
 * Dice: formula parsing, rolling with an injectable RNG, and the roll record the sheet logs and the overlay
 * animates. Sides outside the physical set (d4–d20) still roll; they just render as d20.
 *
 * R17 (ROLL20_TABLE_SPEC.md D114) added the modifiers a table actually asks for, on any die group:
 *   4d6kh3 / 4d6k3   keep the highest 3      4d6kl1   keep the lowest 1
 *   4d6dl1           drop the lowest 1       4d6dh1   drop the highest 1
 *   4d6r1  4d6r<2    reroll 1s (or 2 and under) until the condition fails
 *   4d6ro1           reroll once only
 *   3d6!   3d6!>5    exploding: a die at its maximum (or at/above the number) rolls another
 *   5d10>7  5d10<3   count successes instead of summing (dice at/above 7, or at/below 3)
 * They combine in that order: 6d6kh4!>5 explodes, then keeps the best four.
 */
export type DieSides = 4 | 6 | 8 | 10 | 12 | 20;
export interface DieResult {
  sides: number;
  value: number;
  /** R17: kept out of the total by kh/kl/dh/dl. */
  dropped?: boolean;
  /** R17: this die replaced an earlier roll (r/ro); the value it replaced. */
  rerolledFrom?: number;
  /** R17: this die came from an explosion. */
  exploded?: boolean;
  /** R17: counted as a success by a `>`/`<` group. */
  success?: boolean;
}
export interface DiceGroup {
  count: number;
  sides: number;
  keep?: { mode: "kh" | "kl" | "dh" | "dl"; amount: number };
  reroll?: { at: number; once: boolean };
  explode?: { at: number };
  success?: { at: number; below: boolean };
}
export interface DiceFormula { dice: DiceGroup[]; modifier: number }
export interface RollSpec { label: string; formula: string; note?: string; kind?: "check" | "attack" | "damage" | "save" | "initiative" | "hit-die" | "custom" }
export interface RollResult extends RollSpec { id: string; dice: DieResult[]; modifier: number; total: number; natural?: number; at: string; /** R17: set when the formula counts successes instead of summing. */ successes?: number }

/** One die term: `4d6`, with the R17 modifiers in order. */
const TERM = /^(\d*)d(\d+)(?:(kh|kl|dh|dl|k)(\d+))?(?:(ro|r)(?:<)?(\d+))?(?:(!)(?:>(\d+))?)?(?:([<>])(\d+))?$/;
const MAX_DICE = 100;

export function parseFormula(text: string): DiceFormula | null {
  const cleaned = text.replace(/\s+/g, "").toLowerCase();
  if (!cleaned) return null;
  const dice: DiceGroup[] = [];
  let modifier = 0;
  const parts = cleaned.match(/[+-]?[^+-]+/g);
  if (!parts) return null;
  for (const part of parts) {
    const sign = part.startsWith("-") ? -1 : 1;
    const body = part.replace(/^[+-]/, "");
    if (!body) return null;
    if (/^\d+$/.test(body)) { modifier += sign * Number(body); continue; }
    const match = TERM.exec(body);
    if (!match) return null;
    const count = Number(match[1] || 1) * sign;
    const sides = Number(match[2]);
    if (sides < 1 || Math.abs(count) > MAX_DICE) return null;
    const group: DiceGroup = { count, sides };
    if (match[3]) {
      const mode = (match[3] === "k" ? "kh" : match[3]) as DiceGroup["keep"] extends undefined ? never : "kh" | "kl" | "dh" | "dl";
      const amount = Number(match[4]);
      if (amount < 0 || amount > Math.abs(count)) return null;
      group.keep = { mode, amount };
    }
    if (match[5]) {
      const at = Number(match[6]);
      // A reroll that can never fail would loop forever.
      if (at >= sides) return null;
      group.reroll = { at, once: match[5] === "ro" };
    }
    if (match[7]) {
      const at = match[8] ? Number(match[8]) : sides;
      if (at <= 1) return null;
      group.explode = { at };
    }
    if (match[9]) group.success = { at: Number(match[10]), below: match[9] === "<" };
    dice.push(group);
  }
  return dice.length || modifier ? { dice, modifier } : null;
}

const groupText = (group: DiceGroup, first: boolean) => {
  const sign = group.count < 0 ? "-" : first ? "" : "+";
  const keep = group.keep ? `${group.keep.mode}${group.keep.amount}` : "";
  const reroll = group.reroll ? `${group.reroll.once ? "ro" : "r"}${group.reroll.at}` : "";
  const explode = group.explode ? (group.explode.at === group.sides ? "!" : `!>${group.explode.at}`) : "";
  const success = group.success ? `${group.success.below ? "<" : ">"}${group.success.at}` : "";
  return `${sign}${Math.abs(group.count)}d${group.sides}${keep}${reroll}${explode}${success}`;
};

export const formatFormula = (formula: DiceFormula) => {
  const parts = formula.dice.map((group, index) => groupText(group, index === 0));
  if (formula.modifier) parts.push(`${formula.modifier > 0 ? "+" : "-"}${Math.abs(formula.modifier)}`);
  return parts.join("") || "0";
};

export const signedFormula = (dice: string, modifier: number) => `${dice}${modifier ? `${modifier > 0 ? "+" : "-"}${Math.abs(modifier)}` : ""}`;

/** Roll one die group, applying reroll, explosion and keep/drop; returns the dice in roll order. */
function rollGroup(group: DiceGroup, random: () => number): DieResult[] {
  const die = () => 1 + Math.floor(random() * group.sides);
  const rolled: DieResult[] = [];
  const pushRolled = (exploded: boolean) => {
    let value = die();
    let from: number | undefined;
    if (group.reroll) {
      let guard = 0;
      while (value <= group.reroll.at && guard < 20) { from = from ?? value; value = die(); guard += 1; if (group.reroll.once) break; }
    }
    rolled.push({ sides: group.sides, value, ...(from !== undefined ? { rerolledFrom: from } : {}), ...(exploded ? { exploded: true } : {}) });
    return value;
  };
  for (let index = 0; index < Math.abs(group.count); index += 1) {
    let value = pushRolled(false);
    let guard = 0;
    while (group.explode && value >= group.explode.at && guard < MAX_DICE) { value = pushRolled(true); guard += 1; }
  }
  if (group.keep) {
    const order = [...rolled].sort((a, b) => a.value - b.value);
    const drop = group.keep.mode === "kh" ? order.slice(0, Math.max(0, order.length - group.keep.amount))
      : group.keep.mode === "kl" ? order.slice(group.keep.amount)
      : group.keep.mode === "dl" ? order.slice(0, group.keep.amount)
      : order.slice(Math.max(0, order.length - group.keep.amount));
    for (const item of drop) item.dropped = true;
  }
  if (group.success) for (const item of rolled) if (!item.dropped) item.success = group.success.below ? item.value <= group.success.at : item.value >= group.success.at;
  return rolled;
}

export function rollFormula(spec: RollSpec, random: () => number = Math.random): RollResult {
  const formula = parseFormula(spec.formula) ?? { dice: [], modifier: 0 };
  const dice: DieResult[] = [];
  const counting = formula.dice.some((group) => group.success);
  let total = counting ? 0 : formula.modifier;
  for (const group of formula.dice) {
    const rolled = rollGroup(group, random);
    dice.push(...rolled);
    for (const item of rolled) {
      if (item.dropped) continue;
      if (group.success) total += item.success ? 1 : 0;
      else total += group.count < 0 ? -item.value : item.value;
    }
  }
  const kept = dice.filter((item) => !item.dropped);
  const natural = kept.length === 1 && kept[0].sides === 20 ? kept[0].value : undefined;
  return { ...spec, id: `roll_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, dice, modifier: formula.modifier, total, natural, at: new Date().toISOString(), ...(counting ? { successes: total } : {}) };
}

export const physicalSides = (sides: number): DieSides => ([4, 6, 8, 10, 12, 20] as DieSides[]).includes(sides as DieSides) ? (sides as DieSides) : 20;

export function describeRoll(result: RollResult) {
  const kept = result.dice.filter((die) => !die.dropped).map((die) => `${die.value}${die.exploded ? "!" : ""}`).join("+");
  const dropped = result.dice.filter((die) => die.dropped);
  const modifier = result.modifier && result.successes === undefined ? ` ${result.modifier > 0 ? "+" : "−"} ${Math.abs(result.modifier)}` : "";
  const extra = `${dropped.length ? ` (버림 ${dropped.map((die) => die.value).join(", ")})` : ""}${result.dice.some((die) => die.rerolledFrom !== undefined) ? ` (다시 굴림 ${result.dice.filter((die) => die.rerolledFrom !== undefined).map((die) => `${die.rerolledFrom}→${die.value}`).join(", ")})` : ""}`;
  const total = result.successes !== undefined ? `성공 ${result.successes}` : `${result.total}`;
  return `${result.label}: ${result.formula} → [${kept}]${modifier}${extra} = ${total}${result.natural === 20 ? " (자연 20!)" : result.natural === 1 ? " (자연 1)" : ""}`;
}
