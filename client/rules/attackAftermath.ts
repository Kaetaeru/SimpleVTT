/**
 * R53 (ROLL20_TABLE_SPEC.md D188): what a rule does *after* the dice, once the swing has landed.
 *
 * The contract grammar had ten interceptor slots and only one of them had a customer: `d20.roll`, which lets a
 * feature rescue a failed roll. Nothing could hang off the other end of an attack — "when you score a critical hit",
 * "when you reduce a creature to 0 hit points", "when you hit with a Piercing weapon". That is where the 2024 feats
 * put half their text (강화된 치명타 ×3, 베어 넘기기, 저지), and the app could only print it.
 *
 * An interceptor timed `attack.resolved` is that seam. It fires on `hit`, `crit` or `downed`, narrows itself with the
 * same weapon vocabulary the pre-roll riders use, and may do three things: mark the target (`condition.apply`), hand
 * the attacker a turn-economy slot back (`economy.modify`), or say a sentence the table must judge
 * (`adjudication.request`). Extra damage on a critical hit is a fourth, and it travels a different road — it has to be
 * in the `AttackSpec` before the resolver rolls, so `critRiders` carries it there.
 */
import type { ContentCatalog } from "../catalog/catalog";
import type { DerivedAttack, DerivedCharacter } from "../character/types";
import { characterScope, evaluate, type CommonPlayContract, type ContractOperation, type Scope } from "./contract";
import { attackScopeFilter } from "./contractEffects";
import { featureRuleKey } from "./activation";
import { featureContract } from "./contractActivation";
import { diceRuleOf, type DamagePart, type DiceRule } from "./resolve";

export type AttackOutcomeKind = "hit" | "crit" | "downed";

export interface AttackAftermath {
  /** Conditions or marks to put on the target, with the attacker as their source. */
  marks: string[];
  /** Turn-economy the attacker gets back ("추가 행동" for 베어 넘기기). */
  economy: Array<{ bucket: string; amount: number; source: string }>;
  /** One line per clause the table has to judge, each already naming the feature it came from. */
  notes: string[];
}

export const emptyAftermath = (): AttackAftermath => ({ marks: [], economy: [], notes: [] });

const fits = (scope: string | undefined, attack: DerivedAttack) => {
  if (!scope) return true;
  const filter = attackScopeFilter(scope);
  return filter ? filter(attack) : false;
};

/** Every `attack.resolved` interceptor of this contract that fires for this outcome on this weapon. */
function resolvedFor(contract: CommonPlayContract, attack: DerivedAttack, outcomes: AttackOutcomeKind[], scope: Scope) {
  return contract.interceptors.filter((item) => item.timing === "attack.resolved"
    && (!item.outcomes.length || item.outcomes.some((name) => outcomes.includes(name as AttackOutcomeKind)))
    && fits(item.scope, attack)
    && (!item.when || evaluate(item.when, scope) === true));
}

/** Walk every feature and feat this character has, handing each matching interceptor to `visit`. */
function walk(derived: DerivedCharacter, catalog: ContentCatalog, attack: DerivedAttack, outcomes: AttackOutcomeKind[], visit: (operations: ContractOperation[], label: string, scope: Scope) => void) {
  const scope = characterScope(derived);
  const seen = new Set<string>();
  for (const feature of derived.features) {
    const key = featureRuleKey(feature.id);
    if (seen.has(key)) continue;
    seen.add(key);
    const contract = featureContract(catalog, key);
    if (!contract) continue;
    for (const item of resolvedFor(contract, attack, outcomes, scope)) visit(item.operations, feature.name, scope);
  }
}

/**
 * The damage parts that land only on a critical hit (관통자's extra die, 저항할 수 없는 공격의 은총's ability score).
 * They go into the `AttackSpec` because the resolver has to know about them before it rolls; `critDoubles: false`
 * keeps them from being doubled a second time by the critical that caused them.
 */
export function critRiders(derived: DerivedCharacter, catalog: ContentCatalog, attack: DerivedAttack): { parts: DamagePart[]; dice: DiceRule[] } {
  const parts: DamagePart[] = [];
  const dice: DiceRule[] = [];
  walk(derived, catalog, attack, ["crit"], (operations, label, scope) => {
    for (const operation of operations) {
      // R60 (D195): a critical that adds a die of the weapon's own size rather than a part of its own (관통자).
      if (operation.kind === "property.modify") {
        const rule = diceRuleOf(operation.property, Number(evaluate(operation.value, scope)), `${label} (치명타)`, true);
        if (rule) dice.push(rule);
        continue;
      }
      if (operation.kind !== "damage.apply") continue;
      if (operation.when && evaluate(operation.when, scope) !== true) continue;
      const flat = operation.amount === undefined ? undefined : Number(evaluate(operation.amount, scope));
      const die = operation.dice?.trim();
      const formula = die ?? (Number.isFinite(flat) && flat ? String(flat) : undefined);
      if (!formula) continue;
      parts.push({ formula, type: operation.damageType === "weapon" ? attack.damageType : operation.damageType, label: `${label} (치명타)`, critDoubles: false });
    }
  });
  return { parts, dice };
}

/** What the swing does to the target and to the attacker's turn once the outcome is known. */
export function attackAftermath(derived: DerivedCharacter, catalog: ContentCatalog, attack: DerivedAttack, outcomes: AttackOutcomeKind[]): AttackAftermath {
  const out = emptyAftermath();
  walk(derived, catalog, attack, outcomes, (operations, label, scope) => {
    for (const operation of operations) {
      if ("when" in operation && operation.when && evaluate(operation.when, scope) !== true) continue;
      if (operation.kind === "condition.apply") { if (!out.marks.includes(operation.condition)) out.marks.push(operation.condition); }
      else if (operation.kind === "economy.modify") { const amount = Number(evaluate(operation.amount, scope)); if (Number.isFinite(amount) && amount > 0) out.economy.push({ bucket: operation.bucket, amount, source: label }); }
      else if (operation.kind === "adjudication.request") out.notes.push(`${label}: ${operation.question}`);
    }
  });
  return out;
}
