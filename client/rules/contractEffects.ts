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
import { ATTACK_INVOCATIONS, evaluate, GAIN_INVOCATION, resourceIdOf, type CommonPlayContract, type ContractOperation, type Scope } from "./contract";

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
  /** H5 (D244): 암습 — a Finesse weapon, or one shot or thrown with Dexterity. */
  "finesse-or-ranged": (attack) => attack.properties.includes("finesse") || attack.properties.includes("ammunition") || (attack.ability === "dex" && Boolean(attack.range)),
  thrown: (attack) => attack.properties.includes("thrown"),
  "two-handed": (attack) => attack.properties.includes("two-handed"),
  /** No weapon in hand at all: 비무장 전투 and 선술집 싸움꾼. */
  unarmed: (attack) => !attack.itemId,
  /** V4k (D273): a weapon, or one of an assumed form's own attacks (원초의 일격). */
  "weapon-or-form": (attack) => Boolean(attack.itemId) || attack.properties.includes("form"),
  /** 결투: a melee weapon held in one hand. Whether the other hand is empty is the table's to see. */
  "one-handed-melee": (attack) => Boolean(attack.itemId) && !attack.range && !attack.properties.includes("two-handed"),
  // R53 (D188): 분쇄자·관통자·참격자 narrow themselves by the damage type the weapon deals, not by its properties.
  /** D330: a weapon or a bare fist, but not an assumed form's own attack (열광자의 신성한 격노). */
  "weapon-or-unarmed": (attack) => !attack.properties.includes("form"),
  bludgeoning: (attack) => attack.damageType === "타격",
  piercing: (attack) => attack.damageType === "관통",
  slashing: (attack) => attack.damageType === "참격",
};

/** Every property this engine can change, and where it lands on the sheet. */
export const PROPERTIES = [
  "ac.bonus", "ac.unarmored-base", "ac.minimum",
  "attack-roll.bonus", "damage.bonus", "saving-throw.bonus", "ability-check.bonus", "skill.<id>.bonus",
  "speed.walk", "speed.fly", "speed.climb", "speed.fly-as-walk", "speed.swim", "speed.swim-as-walk", "weapon.shillelagh", "hp.maximum", "hp.heal-on-start", "spell.save-dc", "spell.attack-roll.bonus", "attack-roll.crit-range",
  "senses.darkvision", "senses.blindsight", "resistance", "condition-immunity",
  // R51 (D186): what the PHB feats needed and the vocabulary did not have.
  "damage-taken.reduce", "damage.ignore-resistance",
  // R95 (D230): 회피술 on a sheet, and 기묘한 회피 inside a reaction window.
  "saving-throw.evasion", "damage-taken.halve", "reaction.auto-miss", "reaction.strike-back", "reaction.redirect",
  // R96 (D231): 강력한 주문 시전, 생명의 제자, 최상급 치유, 포착 불가.
  "spell.cantrip-damage.ability-modifier", "healing.spell-slot-bonus", "healing.maximize", "spell.damage.maximize", "attack-roll.against-me.no-advantage", "initiative.advantage",
  // R98 (D233): 적 학살자, 정밀한 사냥꾼, 끈질긴 사냥꾼, 강력한 소마법, 강화된 방출.
  "spell.cantrip-potent",
  // H2 (D239): content-neutral — the spell or school they are about is a parameter in the data.
  "ability-check.minimum-score", "skill.ability-swap", "spell.metamagic", "spell.metamagic-limit", "spell.metamagic-free", "marked-spell.die", "marked-spell.advantage", "concentration.damage-immune", "spell.damage.ability-modifier", "spell.school-damage.ability-modifier", "saving-throw.minimum-score", "attack-roll.against-me.opportunity-disadvantage", "attack-roll.against-me.after-hit-disadvantage", "initiative.extra-turn", "attunement.slots", "healing.self-on-slot-heal", "marked-spell.reveal-defenses", "effect.upkeep", "effect.upkeep-waived", "hp.zero.hold", "aura.grant", "death-save.crit-range", "rider.forgo-limit", "form.assume", "death-save.advantage", "ability-check.minimum-d20", "spell.damage-type.ability-modifier",
  // R99 (D234): 연구된 공격.
  "attack-roll.studied",
  // R55 (D190): the three that decide a roll rather than a number.
  "attack-roll.advantage", "attack-roll.against-me.advantage", "attack-roll.ignore-cover",
  // R56 (D191): training a feat hands out. The sheet shows it; nothing else in this engine gates on it yet.
  "proficiency.armor", "proficiency.weapon", "skill.<id>.expertise",
  // R61 (D196): the other two kinds of d20 test, after R55 did attack rolls.
  "ability-check.advantage", "saving-throw.advantage", "saving-throw.advantage-vs-condition", "skill.<id>.advantage", "heroic-inspiration.gain",
  // R72 (D207): the number of attacks in one Attack action — Extra Attack is content, not a name the code knows.
  "attack-action.attacks",
  // R60 (D195): the weapon's own damage dice (read by the rider and crit paths, not as a standing effect).
  "damage.reroll-lowest", "damage.extra-die", "damage.die-minimum",
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
  // R52 (D187): a pre-roll rider is not a standing property; it belongs to the attack dialog. R63 (D198): nor an on-hit one.
  // H3 (D240): a gain entry point runs once while the character is built, never as a standing property.
  const operations = [...contract.entryPoints.filter((entry) => !ATTACK_INVOCATIONS.has(entry.invocation) && entry.invocation !== GAIN_INVOCATION && entry.invocation !== "turn-start" && entry.invocation !== "turn-end").flatMap((entry) => entry.operations), ...contract.interceptors.flatMap((item) => item.operations)];
  let describes = false;
  for (const operation of operations) {
    // R49 (D184): a question for the table is a line on the sheet too — that is what the hand-written rules' `notes`
    // were, and an effect whose whole rule is prose is described by its `adjudication.request`s.
    if (operation.kind === "adjudication.request") { if (!operation.when || evaluate(operation.when, scope) === true) { notes.push(operation.question); describes = true; } continue; }
    if (operation.kind !== "property.modify") continue;
    // V3b (D256): a note that the rule is applied elsewhere is not a standing property of this effect.
    if (operation.property === "rule.applied-elsewhere") continue;
    describes = true;
    if (operation.when && evaluate(operation.when, scope) !== true) continue;
    if (operation.note) notes.push(operation.note);
    // `skill.<id>.bonus` names its skill in the property itself, so it never needs an attack filter.
    const skill = /^skill\.([a-z-]+)\.bonus$/.exec(operation.property);
    if (skill) { application.skills = [...(application.skills ?? []), { id: skill[1], value: number(operation, scope) ?? 0 }]; continue; }
    // R56 (D191): expertise doubles the proficiency bonus on one skill, so it names the skill the same way.
    const expertise = /^skill\.([a-z-]+)\.expertise$/.exec(operation.property);
    if (expertise) { application.expertise = [...(application.expertise ?? []), expertise[1]]; continue; }
    // R61 (D196): advantage on one named skill (잠행자's 은신, 배우's 기만·공연).
    const skillAdvantage = /^skill\.([a-z-]+)\.advantage$/.exec(operation.property);
    if (skillAdvantage) { application.rollAdvantage = [...(application.rollAdvantage ?? []), { reason: operation.note ?? "", families: ["ability-check"], skills: [skillAdvantage[1]] }]; continue; }
    const filter = operation.scope ? SCOPES[operation.scope] : undefined;
    if (operation.scope && !filter) { unknown.push(`scope ${operation.scope}`); continue; }
    switch (operation.property) {
      case "ac.bonus": application.ac = { ...application.ac, add: (application.ac?.add ?? 0) + (number(operation, scope) ?? 0) }; break;
      case "ac.unarmored-base": application.ac = { ...application.ac, unarmoredBase: number(operation, scope) }; break;
      case "ac.minimum": application.ac = { ...application.ac, min: number(operation, scope) }; break;
      case "attack-roll.bonus": application.attack = { ...(operation.dice ? { dice: operation.dice } : { value: number(operation, scope) }), ...(filter ? { filter } : {}) }; break;
      case "damage.bonus": application.damage = { ...(operation.dice ? { dice: operation.dice } : { value: number(operation, scope) }), ...(filter ? { filter } : {}) }; break;
      case "saving-throw.bonus": application.saves = { ...(operation.dice ? { dice: operation.dice } : { value: number(operation, scope) }), ...(operation.abilities ? { keys: operation.abilities as AbilityKey[] } : {}) }; break;
      case "ability-check.bonus": application.checks = { ...(operation.dice ? { dice: operation.dice } : { value: number(operation, scope) }), ...(operation.abilities?.length ? { keys: operation.abilities as AbilityKey[] } : {}) }; break;

      case "speed.walk": application.speed = { ...application.speed, ...(operation.operation === "multiply" ? { multiply: number(operation, scope) } : { add: (application.speed?.add ?? 0) + (number(operation, scope) ?? 0) }) }; break;
      case "speed.fly": application.speed = { ...application.speed, fly: number(operation, scope) }; break;
      case "speed.climb": application.speed = { ...application.speed, climbAsWalk: true }; break;
      case "speed.fly-as-walk": application.speed = { ...application.speed, flyAsWalk: true }; break;
      // D300: a swimming speed of its own, or one equal to the walking speed (수중 친화, 원소 보행, 연어).
      case "speed.swim": application.speed = { ...application.speed, swim: number(operation, scope) }; break;
      case "speed.swim-as-walk": application.speed = { ...application.speed, swimAsWalk: true }; break;
      // R60 (D195): the weapon's own damage dice — read by the rider and critical paths, never as a standing property.
      case "damage.extra-die": case "damage.reroll-lowest": case "damage.die-minimum": break;
      // R54 (D189), D302: what a reaction window does, read by contractReactions rather than by the sheet.
      case "reaction.auto-miss": case "reaction.strike-back": case "reaction.redirect": case "damage-taken.halve": break;
      // V4s (D281): the spell names the weapons it arms and the die they roll — neither is in the code.
      case "weapon.shillelagh": { const p = operation.params ?? {}; const itemIds = Array.isArray(p.items) ? p.items.map(String) : []; if (itemIds.length && operation.dice) application.shillelagh = { itemIds, dice: operation.dice }; break; }
      case "hp.maximum": application.hpMax = (application.hpMax ?? 0) + (number(operation, scope) ?? 0); break;
      // H5d (D247): hit points healed once, when the effect starts (원조).
      case "hp.heal-on-start": application.onStart = { heal: (application.onStart?.heal ?? 0) + (number(operation, scope) ?? 0) }; break;
      case "spell.save-dc": application.spellDc = number(operation, scope); break;
      case "spell.attack-roll.bonus": application.spellAttack = number(operation, scope); break;
      case "senses.darkvision": application.darkvision = number(operation, scope); break;
      case "senses.blindsight": application.blindsight = number(operation, scope); break;
      // R51 (D186): 중갑 달인 — so many less of each of the three weapon damage types. `damageTypes` carries the
      // list, since a reduction that names no type would silently apply to everything.
      case "damage-taken.reduce": application.damageReduction = { types: (operation.damageTypes ?? []) as string[], amount: number(operation, scope) ?? 0 }; break;
      // R51 (D186): 원소 숙련자, 독 제조자 — this character's own damage of these types is not resisted.
      // R55 (D190): 무모한 공격 — my attacks are advantaged, and so are attacks against me. Each reason carries the
      // effect's own name, so the card says why the second die was rolled instead of just rolling it.
      case "attack-roll.advantage": application.advantageOn = [...(application.advantageOn ?? []), { reason: operation.note ?? "", ...(operation.scope ? { scope: operation.scope } : {}) }]; break;
      case "attack-roll.against-me.advantage": application.grantsAdvantage = [...(application.grantsAdvantage ?? []), operation.note ?? ""]; break;
      case "attack-roll.ignore-cover": application.ignoresCover = true; break;
      case "saving-throw.evasion": application.evasion = true; break;
      // D318: advantage on the Constitution save that keeps concentration (섬뜩한 정신, 전쟁 시전자).
      case "saving-throw.concentration-advantage": application.concentrationAdvantage = true; break;
      case "spell.cantrip-damage.ability-modifier": application.cantripModifierClasses = [...(application.cantripModifierClasses ?? []), text(operation, scope) ?? ""]; break;
      case "healing.spell-slot-bonus": application.healingSlotBonus = true; break;
      case "initiative.advantage": application.rollAdvantage = [...(application.rollAdvantage ?? []), { reason: operation.note ?? "", families: ["ability-check"], skills: ["initiative"] }]; break;
      case "marked-spell.die": if (operation.spell) application.markedSpellDice = { ...(application.markedSpellDice ?? {}), [operation.spell]: number(operation, scope) ?? 6 }; break;
      case "marked-spell.advantage": if (operation.spell) application.markedSpellAdvantage = [...(application.markedSpellAdvantage ?? []), operation.spell]; break;
      case "concentration.damage-immune": if (operation.spell) application.concentrationDamageImmune = [...(application.concentrationDamageImmune ?? []), operation.spell]; break;
      case "spell.damage.ability-modifier": { const spell = operation.spell ?? text(operation, scope); if (spell) application.spellDamageModifier = [...(application.spellDamageModifier ?? []), spell]; break; }
      case "attack-roll.studied": application.studiedAttacks = true; break;
      // V4c (D265): the host reads this from the effect contract to end the effect for want of a deed; nothing on the sheet.
      case "effect.upkeep": break;
      // V4h (D270): a death save this high counts as a 20 (생존자의 죽음 저항).
      case "death-save.crit-range": application.deathSaveCritRange = Math.min(application.deathSaveCritRange ?? 20, number(operation, scope) ?? 20); break;
      // V4h (D270): how many hit-window effects one rider may pay dice for (향상된 교활한 일격).
      case "rider.forgo-limit": application.forgoLimit = Math.max(application.forgoLimit ?? 0, number(operation, scope) ?? 1); break;
      // V4e (D267): what creatures marked "in" this character's aura get — a bonus to every save, condition immunities (보호의 오라).
      case "aura.grant": { const p = operation.params ?? {}; application.auras = [...(application.auras ?? []), { name: String(p.name ?? operation.note ?? ""), saveBonus: number(operation, scope) ?? 0, conditionImmunities: Array.isArray(p.conditionImmunities) ? p.conditionImmunities.map(String) : [] }]; break; }
      // V4d (D266): dropping to 0 hit points leaves this many instead — after a save, from a pool, while an effect runs (불굴의 격노, 끈질긴 인내).
      case "hp.zero.hold": { const p = operation.params ?? {}; const save = p.save as { ability?: string; dc?: unknown; step?: number; stepResource?: string } | undefined; application.zeroHolds = [...(application.zeroHolds ?? []), { label: operation.note ?? "", hp: Math.max(1, number(operation, scope) ?? 1), ...(save?.ability ? { save: { ability: save.ability, dc: typeof save.dc === "number" ? save.dc : Number(evaluate(save.dc as never, scope)) || 10, step: save.step ?? 0, ...(save.stepResource ? { stepResourceId: resourceIdOf(save.stepResource) } : {}) } } : {}), ...(p.resource ? { resourceId: resourceIdOf(String(p.resource)) } : {}), ...(p.requiresEffect ? { requiresEffect: String(p.requiresEffect) } : {}) }]; break; }
      // V4k (D273): the use turns its user into a creature the content names (야생 변신) — the value is the
      // highest challenge rating it may take, and the params say which creatures and which movement is allowed.
      case "form.assume": { const p = operation.params ?? {}; application.form = { creatureTypes: Array.isArray(p.creatureTypes) ? p.creatureTypes.map(String) : [], maxCr: Number(evaluate(operation.value, scope)) || 0, ...(typeof p.swimFrom === "number" ? { swimFrom: p.swimFrom } : {}), ...(typeof p.flyFrom === "number" ? { flyFrom: p.flyFrom } : {}), level: Number(evaluate(p.level as never, scope)) || 0 }; break; }
      case "spell.cantrip-potent": application.potentCantrip = true; break;
      case "spell.damage-type.ability-modifier": { const p = operation.params ?? {}; if (p.class) application.damageTypeModifierClass = String(p.class); } application.damageTypeModifier = [...(application.damageTypeModifier ?? []), ...(operation.damageTypes ?? [])]; break;
      // V3f (D260): opportunity attacks against this creature are made at disadvantage (기회 공격 회피).
      case "attack-roll.against-me.opportunity-disadvantage": application.opportunityDisadvantage = [...(application.opportunityDisadvantage ?? []), operation.note ?? ""]; break;
      // V3h (D262): who hit this creature attacks it at disadvantage for the rest of that turn (다중 공격 방어).
      case "attack-roll.against-me.after-hit-disadvantage": application.hitDefense = operation.note ?? ""; break;
      // V3h (D262): a second turn in the first round of combat, at this initiative offset (도둑의 반사신경).
      case "initiative.extra-turn": application.extraTurns = [...(application.extraTurns ?? []), { offset: number(operation, scope) ?? 0, label: operation.note ?? "" }]; break;
      // V3h (D262): more magic items attuned at once (마법 물건 사용).
      // V4a (D263): healing someone else with a slot spell heals you for this much plus the slot level (축복받은 치유사).
      case "healing.self-on-slot-heal": application.slotHealSelf = Math.max(application.slotHealSelf ?? 0, number(operation, scope) ?? 0); break;
      // V4a (D263): casting this spell tells the caster the target's resistances, immunities and vulnerabilities (사냥꾼의 지식).
      case "marked-spell.reveal-defenses": if (operation.spell) application.revealDefenses = [...(application.revealDefenses ?? []), operation.spell]; break;
      // V4c (D265): the named effect does not end for want of a deed each turn (지속되는 격노).
      case "effect.upkeep-waived": if (operation.params?.effect) application.upkeepWaived = [...(application.upkeepWaived ?? []), String(operation.params.effect)]; break;
      case "attunement.slots": application.attunementBonus = (application.attunementBonus ?? 0) + (number(operation, scope) ?? 0); break;
      // V3c (D257): advantage on death saving throws (생존자, 튼튼함).
      // V4m (D275): advantage only on saves against these conditions (요정 혈통, 용감함, 드워프 강인함, 마귀의 인내).
      case "saving-throw.advantage-vs-condition": { const p = operation.params ?? {}; const conditions = Array.isArray(p.conditions) ? p.conditions.map(String) : []; if (conditions.length) application.rollAdvantage = [...(application.rollAdvantage ?? []), { reason: operation.note ?? "", families: ["saving-throw"], conditions }]; break; }
      // V4m (D275): handed over by the rest itself (longRestGains), so there is nothing to put on the sheet here.
      case "heroic-inspiration.gain": break;
      case "death-save.advantage": application.rollAdvantage = [...(application.rollAdvantage ?? []), { reason: operation.note ?? "", families: ["death-save"] }]; break;
      // V3c (D257): a d20 below this counts as this on checks the character adds its proficiency bonus to (믿음직한 재능).
      case "ability-check.minimum-d20": application.checkMinimumD20 = Math.max(application.checkMinimumD20 ?? 0, number(operation, scope) ?? 0); break;
      // V4r (D280): what a metamagic does to a cast is read by the cast window, not by the sheet.
      case "spell.metamagic": break;
      // V5h (D296): 마법 화신 — two metamagics on one cast; 비전의 신격 — one of them costs nothing, once a turn.
      case "spell.metamagic-limit": application.metamagicLimit = Math.max(application.metamagicLimit ?? 1, number(operation, scope) ?? 1); break;
      case "spell.metamagic-free": application.metamagicFree = true; break;
      // V4o (D277): 원초적 지식 — these skills may be rolled with another ability while something is running.
      case "skill.ability-swap": { const p = operation.params ?? {}; const skills = Array.isArray(p.skills) ? p.skills.map(String) : []; if (skills.length && p.ability) application.skillAbility = { skills, ability: String(p.ability) as AbilityKey }; break; }
      // V4o (D277): 불굴의 힘 — a check of these abilities totals at least the score.
      case "ability-check.minimum-score": application.minimumScoreChecks = [...(application.minimumScoreChecks ?? []), ...((operation.abilities ?? []) as AbilityKey[])]; break;
      case "saving-throw.minimum-score": application.minimumScoreRolls = [...(application.minimumScoreRolls ?? []), ...((operation.abilities ?? []) as AbilityKey[])]; break;
      case "spell.school-damage.ability-modifier": if (operation.school) application.schoolDamageModifier = [...(application.schoolDamageModifier ?? []), { school: operation.school, classSlug: text(operation, scope) ?? "" }]; break;
      case "healing.maximize": application.healingMaximized = true; break;
      // V3g (D261): damage dice of spells up to this level count as their maximum (과부하).
      case "spell.damage.maximize": { application.spellDamageMaximizedUpTo = Math.max(application.spellDamageMaximizedUpTo ?? 0, number(operation, scope) ?? 0); const p = operation.params ?? {}; if (p.class) application.spellDamageMaximizedClass = String(p.class); break; }
      case "attack-roll.against-me.no-advantage": application.elusive = true; break;
      // R61 (D196): advantage on a check or a save, narrowed to the abilities the contract named.
      case "ability-check.advantage": application.rollAdvantage = [...(application.rollAdvantage ?? []), { reason: operation.note ?? "", families: ["ability-check"], ...(operation.abilities?.length ? { abilities: operation.abilities as AbilityKey[] } : {}) }]; break;
      case "saving-throw.advantage": application.rollAdvantage = [...(application.rollAdvantage ?? []), { reason: operation.note ?? "", families: ["saving-throw"], ...(operation.abilities?.length ? { abilities: operation.abilities as AbilityKey[] } : {}) }]; break;
      // R56 (D191): 중갑 훈련, 군용 무기 훈련 and their kin — the sheet's proficiency lists gain a line.
      case "proficiency.armor": application.armorTraining = [...(application.armorTraining ?? []), text(operation, scope) ?? ""]; break;
      case "proficiency.weapon": application.weaponTraining = [...(application.weaponTraining ?? []), text(operation, scope) ?? ""]; break;
      case "damage.ignore-resistance": application.ignoresResistance = [...(application.ignoresResistance ?? []), text(operation, scope) ?? ""]; break;
      case "attack-roll.crit-range": application.critRange = Math.min(application.critRange ?? 20, number(operation, scope) ?? 20); break;
      case "attack-action.attacks": application.attackActionAttacks = Math.max(application.attackActionAttacks ?? 1, number(operation, scope) ?? 1); break;
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
/**
 * D330: a scope may also be written as a little expression, so content can say exactly which weapons a rule is
 * about without the engine knowing their names: `a|b` is either, `a+b` is both, and `items:<id>,<id>` names the
 * weapons themselves (장병기 달인: a quarterstaff or a spear, or a Heavy weapon with Reach).
 */
export const attackScopeFilter = (scope: string): ((attack: DerivedAttack) => boolean) | undefined => {
  if (SCOPES[scope]) return SCOPES[scope];
  if (!/[|+]|^items:/.test(scope)) return undefined;
  const terms = scope.split("|").map((term) => term.trim()).filter(Boolean);
  const parts = terms.map((term) => {
    if (term.startsWith("items:")) { const ids = term.slice("items:".length).split(",").map((id) => id.trim()).filter(Boolean); return (attack: DerivedAttack) => Boolean(attack.itemId && ids.some((id) => attack.itemId === id || attack.itemId!.endsWith(`.${id}`))); }
    const each = term.split("+").map((name) => name.trim()).filter(Boolean).map((name) => SCOPES[name] ?? ((attack: DerivedAttack) => attack.properties.includes(name)));
    return (attack: DerivedAttack) => each.every((test) => test(attack));
  });
  return parts.length ? (attack) => parts.some((test) => test(attack)) : undefined;
};
