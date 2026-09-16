/**
 * R38 (D178): a standing effect, read out of its contract.
 *
 * `effects.ts` holds 63 hand-written functions saying what Bless, Shield, Haste and the rest do to a sheet. This is
 * the same thing expressed as data: a contract's `property.modify` operations, translated into the `EffectApplication`
 * the sheet already knows how to apply. The property names are this engine's vocabulary, and a contract naming one it
 * does not know is reported rather than silently dropped — a rule the app claims to run has to actually run.
 */
import type { AbilityKey } from "../catalog/types";
import type { DerivedAttack } from "../character/types";
import type { EffectApplication } from "./effects";
import { evaluate, type CommonPlayContract, type ContractOperation, type Scope } from "./contract";

/** Attack filters a `property.modify` may narrow itself to. */
const SCOPES: Record<string, (attack: DerivedAttack) => boolean> = {
  weapon: (attack) => Boolean(attack.itemId),
  melee: (attack) => !attack.range,
  ranged: (attack) => Boolean(attack.range),
  /** R49 (D184): 격노's bonus — a Strength attack that is not fired from a bow. */
  "strength-melee": (attack) => attack.ability === "str" && !attack.properties.includes("ammunition"),
  // R51 (D186): the PHB feats narrow themselves by weapon property, not by ability. 결투 wants "one-handed melee",
  // 투척 무기 전투 wants Thrown, 대형 무기 달인 wants Heavy — each one is a property the weapon already carries.
  heavy: (attack) => attack.properties.includes("heavy"),
  light: (attack) => attack.properties.includes("light"),
  finesse: (attack) => attack.properties.includes("finesse"),
  thrown: (attack) => attack.properties.includes("thrown"),
  "two-handed": (attack) => attack.properties.includes("two-handed"),
  /** No weapon in hand at all: 비무장 전투 and 선술집 싸움꾼. */
  unarmed: (attack) => !attack.itemId,
  /** 결투: a melee weapon held in one hand. Whether the other hand is empty is the table's to see. */
  "one-handed-melee": (attack) => Boolean(attack.itemId) && !attack.range && !attack.properties.includes("two-handed"),
};

/** Every property this engine can change, and where it lands on the sheet. */
export const PROPERTIES = [
  "ac.bonus", "ac.unarmored-base", "ac.minimum",
  "attack-roll.bonus", "damage.bonus", "saving-throw.bonus", "ability-check.bonus", "skill.<id>.bonus",
  "speed.walk", "speed.fly", "speed.climb", "speed.fly-as-walk", "weapon.shillelagh", "hp.maximum", "spell.save-dc", "spell.attack-roll.bonus", "attack-roll.crit-range",
  "senses.darkvision", "senses.blindsight", "resistance", "condition-immunity",
  // R51 (D186): what the PHB feats needed and the vocabulary did not have.
  "damage-taken.reduce", "damage.ignore-resistance",
] as const;

const number = (operation: Extract<ContractOperation, { kind: "property.modify" }>, scope: Scope) => {
  const value = evaluate(operation.value, scope);
  return typeof value === "number" ? value : undefined;
};
const text = (operation: Extract<ContractOperation, { kind: "property.modify" }>, scope: Scope) => {
  const value = evaluate(operation.value, scope);
  return typeof value === "string" ? value : undefined;
};

/**
 * The sheet change a contract's `property.modify` operations make, plus the names of any it could not run. An empty
 * `unknown` and a non-empty application means the contract can stand in for the hand-written rule.
 */
export function contractEffect(contract: CommonPlayContract, scope: Scope): { application: EffectApplication; unknown: string[]; /** R39/R49: whether the contract says anything at all about what the effect is or does — numbers or prose. */ hasProperties: boolean } {
  const application: EffectApplication = {};
  const unknown: string[] = [];
  const notes: string[] = [];
  // R52 (D187): a pre-roll rider is not a standing property; it belongs to the attack dialog.
  const operations = [...contract.entryPoints.filter((entry) => entry.invocation !== "pre-roll-attack").flatMap((entry) => entry.operations), ...contract.interceptors.flatMap((item) => item.operations)];
  let describes = false;
  for (const operation of operations) {
    // R49 (D184): a question for the table is a line on the sheet too — that is what the hand-written rules' `notes`
    // were, and an effect whose whole rule is prose is described by its `adjudication.request`s.
    if (operation.kind === "adjudication.request") { if (!operation.when || evaluate(operation.when, scope) === true) { notes.push(operation.question); describes = true; } continue; }
    if (operation.kind !== "property.modify") continue;
    describes = true;
    if (operation.when && evaluate(operation.when, scope) !== true) continue;
    if (operation.note) notes.push(operation.note);
    // `skill.<id>.bonus` names its skill in the property itself, so it never needs an attack filter.
    const skill = /^skill\.([a-z-]+)\.bonus$/.exec(operation.property);
    if (skill) { application.skills = [...(application.skills ?? []), { id: skill[1], value: number(operation, scope) ?? 0 }]; continue; }
    const filter = operation.scope ? SCOPES[operation.scope] : undefined;
    if (operation.scope && !filter) { unknown.push(`scope ${operation.scope}`); continue; }
    switch (operation.property) {
      case "ac.bonus": application.ac = { ...application.ac, add: (application.ac?.add ?? 0) + (number(operation, scope) ?? 0) }; break;
      case "ac.unarmored-base": application.ac = { ...application.ac, unarmoredBase: number(operation, scope) }; break;
      case "ac.minimum": application.ac = { ...application.ac, min: number(operation, scope) }; break;
      case "attack-roll.bonus": application.attack = { ...(operation.dice ? { dice: operation.dice } : { value: number(operation, scope) }), ...(filter ? { filter } : {}) }; break;
      case "damage.bonus": application.damage = { ...(operation.dice ? { dice: operation.dice } : { value: number(operation, scope) }), ...(filter ? { filter } : {}) }; break;
      case "saving-throw.bonus": application.saves = { ...(operation.dice ? { dice: operation.dice } : { value: number(operation, scope) }), ...(operation.abilities ? { keys: operation.abilities as AbilityKey[] } : {}) }; break;
      case "ability-check.bonus": application.checks = operation.dice ? { dice: operation.dice } : { value: number(operation, scope) }; break;

      case "speed.walk": application.speed = { ...application.speed, ...(operation.operation === "multiply" ? { multiply: number(operation, scope) } : { add: (application.speed?.add ?? 0) + (number(operation, scope) ?? 0) }) }; break;
      case "speed.fly": application.speed = { ...application.speed, fly: number(operation, scope) }; break;
      case "speed.climb": application.speed = { ...application.speed, climbAsWalk: true }; break;
      case "speed.fly-as-walk": application.speed = { ...application.speed, flyAsWalk: true }; break;
      case "weapon.shillelagh": application.shillelagh = true; break;
      case "hp.maximum": application.hpMax = (application.hpMax ?? 0) + (number(operation, scope) ?? 0); break;
      case "spell.save-dc": application.spellDc = number(operation, scope); break;
      case "spell.attack-roll.bonus": application.spellAttack = number(operation, scope); break;
      case "senses.darkvision": application.darkvision = number(operation, scope); break;
      case "senses.blindsight": application.blindsight = number(operation, scope); break;
      // R51 (D186): 중갑 달인 — so many less of each of the three weapon damage types. `damageTypes` carries the
      // list, since a reduction that names no type would silently apply to everything.
      case "damage-taken.reduce": application.damageReduction = { types: (operation.damageTypes ?? []) as string[], amount: number(operation, scope) ?? 0 }; break;
      // R51 (D186): 원소 숙련자, 독 제조자 — this character's own damage of these types is not resisted.
      case "damage.ignore-resistance": application.ignoresResistance = [...(application.ignoresResistance ?? []), text(operation, scope) ?? ""]; break;
      case "attack-roll.crit-range": application.critRange = Math.min(application.critRange ?? 20, number(operation, scope) ?? 20); break;
      case "resistance": application.resistances = [...(application.resistances ?? []), text(operation, scope) ?? ""]; break;
      case "condition-immunity": application.conditionImmunities = [...(application.conditionImmunities ?? []), text(operation, scope) ?? ""]; break;
      default: unknown.push(operation.property);
    }
  }
  if (notes.length) application.notes = notes;
  return { application, unknown, hasProperties: describes };
}

/** The attack scopes a `property.modify` may narrow itself to. */
export const attackScopes = () => Object.keys(SCOPES);
/** R52 (D187): the same filters, for a pre-roll rider that narrows itself to a weapon the same way. */
export const attackScopeFilter = (scope: string) => SCOPES[scope];
