/**
 * R52 (ROLL20_TABLE_SPEC.md D187): what a contract may add to one swing, declared before the dice.
 *
 * The pre-roll dialog used to offer exactly five things — 암습, 신성한 강타, 쪼개기, 야만적 공격자, 보조 손 — because
 * `AttackRiders` named those five and nothing else. Every other rule written as "declare it before the roll" (광란,
 * 대형 무기 달인의 중량 무기 숙달, 돌격자의 돌격 공격, 관통자의 꿰뚫기 …) could be described by a contract and then
 * had nowhere to appear. A contract entry point invoked as `pre-roll-attack` becomes a checkbox here instead: its
 * `damage.apply` is the extra damage, its `resource.change` the cost, its `adjudication.request` the line that says
 * what the player is promising the table.
 *
 * The turn-by-turn bookkeeping ("once per turn") stays the player's, exactly as it already is for 암습 — the app
 * says so on the checkbox rather than pretending to count.
 */
import type { ContentCatalog } from "../catalog/catalog";
import type { DerivedAttack, DerivedCharacter } from "../character/types";
import { characterScope, evaluate, type CommonPlayContract, type Scope } from "./contract";
import { diceRuleOf, type DiceRule } from "./resolve";
import { attackScopeFilter } from "./contractEffects";
import { featureRuleKey } from "./activation";
import { featureContract } from "./contractActivation";

const DICE_RULE_KO: Record<DiceRule["mode"], (value: number) => string> = {
  "reroll-lowest": (value) => `피해 주사위 ${value}개 다시 굴림`,
  "extra-die": (value) => `피해 주사위 ${value}개 추가`,
  "die-minimum": (value) => `피해 주사위 최소 ${value}`,
};

export interface ContractRider {
  /** The rule key, which is what travels over the wire in `AttackRiders.contracts`. */
  key: string;
  /** The feature or feat this came from. */
  label: string;
  /** What the player is declaring, for the checkbox. */
  hint: string;
  /** Weapon filter, in the same vocabulary `property.modify` uses (`heavy`, `strength-melee`, `unarmed` …). */
  scope?: string;
  oncePerTurn: boolean;
  /** Effects that must already be running for this to be offered (광란 needs 격노 and 무모한 공격). */
  requiresEffects: string[];
  /**
   * Extra damage parts. `type` of `"weapon"` means "the same type this weapon deals"; `factId` means the part only
   * lands when the player ticked that fact (R57 — 돌격자's 1d8 needs the ten feet the scene cannot measure).
   */
  damage: Array<{ formula: string; type: string; factId?: string }>;
  /** R57 (D192): the facts this rider asks the player to confirm, each a checkbox next to it. */
  facts: Array<{ id: string; question: string }>;
  /** R60 (D195): what declaring it does to the weapon's own damage dice. */
  dice: DiceRule[];
  resourceId?: string;
  cost: number;
}

/** The formula a `damage.apply` names, with its dice count resolved against the character. */
function formulaOf(operation: { dice?: string; diceCount?: unknown; amount?: unknown }, scope: Scope): string | undefined {
  const flat = operation.amount === undefined ? undefined : Number(evaluate(operation.amount as never, scope));
  const die = operation.dice?.trim();
  if (!die) return Number.isFinite(flat) && flat ? String(flat) : undefined;
  const count = operation.diceCount === undefined ? undefined : Number(evaluate(operation.diceCount as never, scope));
  const sides = /^(\d*)d(\d+)$/.exec(die);
  if (!sides) return undefined;
  const total = count !== undefined && Number.isFinite(count) ? Math.max(0, Math.floor(count)) : Number(sides[1] || 1);
  if (!total) return undefined;
  return `${total}d${sides[2]}${Number.isFinite(flat) && flat ? `${flat > 0 ? "+" : ""}${flat}` : ""}`;
}

/** Every pre-roll rider a contract declares, or an empty list when it declares none. */
export function contractRiders(contract: CommonPlayContract, key: string, label: string, scope: Scope): ContractRider[] {
  const riders: ContractRider[] = [];
  for (const entry of contract.entryPoints) {
    if (entry.invocation !== "pre-roll-attack" || !entry.attack) continue;
    const rider: ContractRider = {
      key, label, hint: "", ...(entry.attack.scope ? { scope: entry.attack.scope } : {}),
      oncePerTurn: entry.attack.oncePerTurn, requiresEffects: entry.attack.requiresEffects, damage: [], facts: [], dice: [], cost: 0,
    };
    const hints: string[] = [];
    // R57 (D192): a fact this entry point declares is a checkbox, not prose; an operation gated on one carries the
    // fact's id rather than being evaluated now, because only the player at the moment knows the answer.
    const declared = new Set(entry.operations.flatMap((operation) => (operation.kind === "adjudication.request" && operation.fact?.at === "pre-roll" ? [`fact:${operation.fact.id}`] : [])));
    const gatedOn = (operation: { when?: unknown }) => (operation.when && typeof operation.when === "object" && "ref" in operation.when && declared.has(String((operation.when as { ref: string }).ref)) ? String((operation.when as { ref: string }).ref).slice(5) : undefined);
    for (const operation of entry.operations) {
      const factId = gatedOn(operation as { when?: unknown });
      if (!factId && "when" in operation && operation.when && evaluate(operation.when, scope) !== true) continue;
      if (operation.kind === "damage.apply") {
        const formula = formulaOf(operation, scope);
        if (formula) rider.damage.push({ formula, type: operation.damageType, ...(factId ? { factId } : {}) });
      } else if (operation.kind === "resource.change") {
        const amount = Number(evaluate(operation.amount, scope));
        if (Number.isFinite(amount) && amount < 0) { rider.resourceId = operation.resourceId; rider.cost = -amount; }
      } else if (operation.kind === "property.modify") {
        // R60 (D195): a rule that touches the weapon's own dice rather than adding a part of its own.
        const rule = diceRuleOf(operation.property, Number(evaluate(operation.value, scope)), label);
        if (rule) rider.dice.push(rule);
      } else if (operation.kind === "adjudication.request") {
        if (operation.fact?.at === "pre-roll") rider.facts.push({ id: operation.fact.id, question: operation.question });
        else hints.push(operation.question);
      }
    }
    rider.hint = [...rider.damage.map((part) => `피해 +${part.formula}`), ...rider.dice.map((rule) => DICE_RULE_KO[rule.mode](rule.value)), ...hints, ...(rider.oncePerTurn ? ["턴당 한 번"] : [])].join(" · ");
    if (rider.damage.length || rider.dice.length || hints.length || rider.facts.length) riders.push(rider);
  }
  return riders;
}

/** Every pre-roll rider this character's own features and feats declare. Built once, at derivation (R49's lesson). */
export function characterRiders(derived: DerivedCharacter, catalog: ContentCatalog): ContractRider[] {
  const scope = characterScope(derived);
  const riders: ContractRider[] = [];
  const seen = new Set<string>();
  for (const feature of derived.features) {
    const key = featureRuleKey(feature.id);
    if (seen.has(key)) continue;
    seen.add(key);
    const contract = featureContract(catalog, key);
    if (contract) riders.push(...contractRiders(contract, key, feature.name, scope));
  }
  return riders;
}

/** Whether this rider may be declared on this weapon at all (its weapon filter). */
export const riderFitsAttack = (rider: ContractRider, attack: DerivedAttack) => {
  if (!rider.scope) return true;
  const filter = attackScopeFilter(rider.scope);
  return filter ? filter(attack) : false;
};

/**
 * The riders the dialog should offer for this swing: the weapon fits, the effects it names are running, and the pool
 * it spends has something left. A rider whose effects are not running is not offered rather than offered and refused.
 */
export function offeredRiders(derived: DerivedCharacter, attack: DerivedAttack, options: { effects?: string[]; left?: (resourceId: string) => number } = {}): ContractRider[] {
  const running = new Set([...(options.effects ?? []), ...derived.activeEffects.map((effect) => effect.name)]);
  return (derived.attackRiders ?? []).filter((rider) => {
    if (!riderFitsAttack(rider, attack)) return false;
    if (rider.requiresEffects.some((name) => !running.has(name))) return false;
    if (rider.resourceId && options.left && options.left(rider.resourceId) < rider.cost) return false;
    return true;
  });
}
