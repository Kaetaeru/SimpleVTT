/**
 * H1 (V0.9, D238): monster trait rules. A stat-block trait says what it does as data — `traits[].rules`, a list of
 * generic patterns with their numbers — and the table runs the pattern. The engine never reads a trait's name or
 * sentence to guess its rule. Every stat block writes them on its traits — the SRD's in the SRD monsters module (D314),
 * a pasted or module monster itself (docs/guides/CUSTOM_NPC_JSON.md).
 */
import type { AbilityKey } from "../catalog/types";
import { monsterById, type MonsterAction, type MonsterView } from "./monsters";

export type TraitRule =
  /** Advantage on saving throws against spells. */
  | { pattern: "magic-resistance" }
  /** Turns a failed save into a success, `block.legendaryResistance` times a day. */
  | { pattern: "legendary-resistance" }
  /** Hit points back at the start of its turn while it has at least 1; not on a turn after taking one of these types. */
  | { pattern: "regeneration"; amount: number; suppressedByDamageTypes?: string[] }
  /** This damage type restores hit points instead of dealing damage. */
  | { pattern: "absorb"; damageType: string }
  /** Dropped to 0 hit points: a save against `dcBase` + the damage taken leaves it at 1, unless the damage was of these types or a critical hit. */
  | { pattern: "hold-at-one-hp"; ability: AbilityKey; dcBase: number; exceptDamageTypes?: string[]; exceptCritical?: boolean }
  /** Advantage on these rolls while at half its hit points or fewer. */
  | { pattern: "bloodied-advantage"; rolls: Array<"attack" | "save"> }
  /** A Dexterity save for half damage takes none on a success and half on a failure. */
  | { pattern: "evasion" }
  /** Damage to every creature marked inside its aura, once per `timing`. */
  | { pattern: "aura-damage"; dice: string; damageType: string; timing: "owner-turn-end" }
  /** A roll depends on a fact the scene cannot see — the attack dialog asks it as a checkbox. */
  | { pattern: "situational"; side: "attacker" | "target"; note: string; button?: string; grants?: "advantage" | "disadvantage" };

export const TRAIT_PATTERNS = ["magic-resistance", "legendary-resistance", "regeneration", "absorb", "hold-at-one-hp", "bloodied-advantage", "evasion", "aura-damage", "situational"] as const;

/**
 * Every rule on a stat block with the trait that carries it — its own `rules`, or, for a block saved before its traits
 * carried them (an NPC copied from the compendium earlier), the rules of the same trait on the compendium's block of
 * that id.
 */
export function traitRules(block: Pick<MonsterView, "id" | "traits">): Array<{ trait: MonsterAction; rule: TraitRule }> {
  const current = monsterById(block.id);
  const borrowed = (trait: MonsterAction) => (current && current.traits !== block.traits ? current.traits.find((item) => (item.nameEn ?? item.name) === (trait.nameEn ?? trait.name))?.rules : undefined);
  return block.traits.flatMap((trait) => (trait.rules ?? borrowed(trait) ?? []).map((rule) => ({ trait, rule })));
}

/** The first rule of one pattern, typed. */
export function traitRule<P extends TraitRule["pattern"]>(block: Pick<MonsterView, "id" | "traits">, pattern: P): { trait: MonsterAction; rule: Extract<TraitRule, { pattern: P }> } | undefined {
  return traitRules(block).find((item) => item.rule.pattern === pattern) as { trait: MonsterAction; rule: Extract<TraitRule, { pattern: P }> } | undefined;
}

/** A dice formula of this grammar ("3d8", "1d10+2") as count, sides and flat. */
export function diceParts(formula: string): { count: number; sides: number; flat: number } | null {
  const match = /^(\d+)d(\d+)(?:([+-])(\d+))?$/.exec(formula.replace(/\s+/g, ""));
  return match ? { count: Number(match[1]), sides: Number(match[2]), flat: match[3] ? (match[3] === "-" ? -1 : 1) * Number(match[4]) : 0 } : null;
}

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];

/** Read authored `rules` (a pasted NPC, a module): unknown patterns and missing numbers are dropped with a warning. */
export function readTraitRules(raw: unknown, where: string, warnings: string[]): TraitRule[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) { warnings.push(`${where}: 배열이어야 합니다`); return []; }
  return raw.flatMap((item, index): TraitRule[] => {
    const at = `${where}[${index}]`;
    const rule = item as Record<string, unknown>;
    const pattern = typeof rule?.pattern === "string" ? rule.pattern : "";
    const strings = (value: unknown) => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : undefined);
    switch (pattern) {
      case "magic-resistance": case "legendary-resistance": case "evasion": return [{ pattern }];
      case "regeneration": if (typeof rule.amount === "number" && rule.amount > 0) return [{ pattern, amount: rule.amount, ...(strings(rule.suppressedByDamageTypes) ? { suppressedByDamageTypes: strings(rule.suppressedByDamageTypes) } : {}) }]; break;
      case "absorb": if (typeof rule.damageType === "string") return [{ pattern, damageType: rule.damageType }]; break;
      case "hold-at-one-hp": if (typeof rule.ability === "string" && ABILITIES.includes(rule.ability) && typeof rule.dcBase === "number") return [{ pattern, ability: rule.ability as AbilityKey, dcBase: rule.dcBase, ...(strings(rule.exceptDamageTypes) ? { exceptDamageTypes: strings(rule.exceptDamageTypes) } : {}), ...(rule.exceptCritical === true ? { exceptCritical: true } : {}) }]; break;
      case "bloodied-advantage": { const rolls = (strings(rule.rolls) ?? ["attack"]).filter((roll): roll is "attack" | "save" => roll === "attack" || roll === "save"); if (rolls.length) return [{ pattern, rolls }]; break; }
      case "aura-damage": if (typeof rule.dice === "string" && diceParts(rule.dice) && typeof rule.damageType === "string") return [{ pattern, dice: rule.dice, damageType: rule.damageType, timing: "owner-turn-end" }]; break;
      case "situational": if (typeof rule.note === "string") return [{ pattern, side: rule.side === "target" ? "target" : "attacker", note: rule.note, ...(typeof rule.button === "string" ? { button: rule.button } : {}), ...(rule.grants === "advantage" || rule.grants === "disadvantage" ? { grants: rule.grants } : {}) }]; break;
      default: warnings.push(`${at}.pattern: "${pattern}"는 알 수 없는 패턴입니다 (${TRAIT_PATTERNS.join("/")})`); return [];
    }
    warnings.push(`${at}: ${pattern}에 필요한 값이 없습니다`);
    return [];
  });
}

/** What the table does with a rule, for the stat block line. */
export function traitRuleHint(rule: TraitRule): string {
  switch (rule.pattern) {
    case "magic-resistance": return "주문 내성 굴림에 앱이 유리를 적용합니다";
    case "legendary-resistance": return "실패한 내성을 성공으로 바꾸고 횟수를 깎습니다";
    case "regeneration": return `턴 시작마다 앱이 HP ${rule.amount}을 돌려줍니다${rule.suppressedByDamageTypes?.length ? " (막는 피해를 받은 다음 턴은 멈춤)" : ""}`;
    case "absorb": return "그 피해 유형은 HP를 회복시킵니다";
    case "hold-at-one-hp": return "0 HP가 될 때 앱이 내성을 굴려 HP 1로 버팁니다";
    case "bloodied-advantage": return "HP 절반 이하일 때 앱이 유리를 적용합니다";
    case "evasion": return "민첩 절반 피해 내성: 성공 0, 실패 절반";
    case "aura-damage": return `오라 안으로 표시된 크리처에게 턴 끝마다 ${rule.dice} 피해`;
    case "situational": return rule.button ? `판정 전 창에 "${rule.button}" 체크` : rule.note;
  }
}
