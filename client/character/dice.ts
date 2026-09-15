/**
 * Dice: formula parsing ("2d6+3", "d20", "1d8 + 1d6 - 1"), rolling with an injectable RNG, and the roll record the
 * sheet logs and the overlay animates. Sides outside the physical set (d4–d20) still roll; they just render as d20.
 */
export type DieSides = 4 | 6 | 8 | 10 | 12 | 20;
export interface DieResult { sides: number; value: number }
export interface DiceFormula { dice: Array<{ count: number; sides: number }>; modifier: number }
export interface RollSpec { label: string; formula: string; note?: string; kind?: "check" | "attack" | "damage" | "save" | "initiative" | "hit-die" | "custom" }
export interface RollResult extends RollSpec { id: string; dice: DieResult[]; modifier: number; total: number; natural?: number; at: string }

export function parseFormula(text: string): DiceFormula | null {
  const cleaned = text.replace(/\s+/g, "").toLowerCase();
  if (!cleaned || !/^[+-]?(\d*d\d+|\d+)([+-](\d*d\d+|\d+))*$/.test(cleaned)) return null;
  const dice: DiceFormula["dice"] = [];
  let modifier = 0;
  for (const part of cleaned.match(/[+-]?[^+-]+/g) ?? []) {
    const sign = part.startsWith("-") ? -1 : 1;
    const body = part.replace(/^[+-]/, "");
    const die = /^(\d*)d(\d+)$/.exec(body);
    if (die) {
      const count = Number(die[1] || 1) * sign;
      const sides = Number(die[2]);
      if (sides < 1 || Math.abs(count) > 100) return null;
      dice.push({ count, sides });
    } else modifier += sign * Number(body);
  }
  return { dice, modifier };
}

export const formatFormula = (formula: DiceFormula) => {
  const parts = formula.dice.map((die, index) => `${index > 0 && die.count > 0 ? "+" : ""}${die.count < 0 ? "-" : ""}${Math.abs(die.count)}d${die.sides}`);
  if (formula.modifier) parts.push(`${formula.modifier > 0 ? "+" : "-"}${Math.abs(formula.modifier)}`);
  return parts.join("") || "0";
};

export const signedFormula = (dice: string, modifier: number) => `${dice}${modifier ? `${modifier > 0 ? "+" : "-"}${Math.abs(modifier)}` : ""}`;

export function rollFormula(spec: RollSpec, random: () => number = Math.random): RollResult {
  const formula = parseFormula(spec.formula) ?? { dice: [], modifier: 0 };
  const dice: DieResult[] = [];
  let total = formula.modifier;
  for (const die of formula.dice) {
    for (let index = 0; index < Math.abs(die.count); index += 1) {
      const value = 1 + Math.floor(random() * die.sides);
      dice.push({ sides: die.sides, value });
      total += die.count < 0 ? -value : value;
    }
  }
  const natural = dice.length === 1 && dice[0].sides === 20 ? dice[0].value : undefined;
  return { ...spec, id: `roll_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, dice, modifier: formula.modifier, total, natural, at: new Date().toISOString() };
}

export const physicalSides = (sides: number): DieSides => ([4, 6, 8, 10, 12, 20] as DieSides[]).includes(sides as DieSides) ? (sides as DieSides) : 20;

export function describeRoll(result: RollResult) {
  const dice = result.dice.map((die) => `${die.value}`).join("+");
  const modifier = result.modifier ? ` ${result.modifier > 0 ? "+" : "−"} ${Math.abs(result.modifier)}` : "";
  return `${result.label}: ${result.formula} → [${dice}]${modifier} = ${result.total}${result.natural === 20 ? " (자연 20!)" : result.natural === 1 ? " (자연 1)" : ""}`;
}
