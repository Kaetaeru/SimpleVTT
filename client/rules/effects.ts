/**
 * What an effect in force does to the sheet. Rage adds its damage bonus to Strength attacks and resistance to the
 * three weapon damage types; Bless adds 1d4 to attack rolls and saves; Shield adds 5 AC; Mage Armor replaces the
 * unarmored base; Haste doubles speed… Each change lands as a Term with the effect's name, so the sheet's hover
 * shows where the number came from. Effects without a rule are listed as "적용 안 됨" so the text is applied by hand.
 */
import type { ContentCatalog } from "../catalog/catalog";
import type { AbilityKey } from "../catalog/types";
import { ABILITY_KEYS } from "../catalog/types";
import type { RollAdvantage } from "./actions";
import type { ActiveEffect, AppliedEffect, DerivedAttack, DerivedCharacter, Term } from "../character/types";
import { featureRuleKey, qualifyRuleKey } from "./activation";
import { characterScope } from "./contract";
import { contractEffect } from "./contractEffects";
import { contractSuppressions, featureContract, selectorMatches } from "./contractActivation";
import { onHitOf, spellExec, type SpellDice } from "../compendium/spells";


export interface EffectApplication {
  /** AC: a flat bonus, a replacement unarmored base (Mage Armor: 13 + Dex), or a floor (Barkskin 17). */
  ac?: { add?: number; unarmoredBase?: number; min?: number };
  /** Attack rolls: a number or dice, optionally only for some attacks. */
  attack?: { value?: number; dice?: string; filter?: (attack: DerivedAttack) => boolean };
  damage?: { value?: number; dice?: string; filter?: (attack: DerivedAttack) => boolean };
  saves?: { value?: number; dice?: string; keys?: AbilityKey[] };
  /** Every ability check and skill. */
  checks?: { value?: number; dice?: string };
  skills?: Array<{ id: string; value: number }>;
  speed?: { add?: number; multiply?: number; fly?: number; climbAsWalk?: boolean; flyAsWalk?: boolean };
  hpMax?: number;
  spellDc?: number;
  /** Class slug the spell DC/attack bonus is limited to (Innate Sorcery: sorcerer only). */
  spellcastingClass?: string;
  spellAttack?: number;
  /** Club/quarterstaff attacks use the best spellcasting ability and a bigger die (Shillelagh). */
  shillelagh?: boolean;
  /** R43 (D183): the lowest d20 that counts as a critical hit (Improved Critical 19, Superior Critical 18). */
  critRange?: number;
  /** R95 (D230): 회피술 — a Dexterity save for half damage takes none on a success and half on a failure. */
  evasion?: boolean;
  /** R96 (D231): class slugs whose cantrips add the spellcasting modifier to damage (강력한 주문 시전). */
  cantripModifierClasses?: string[];
  /** R96 (D231): a healing spell cast with a slot heals 2 + the slot level more (생명의 제자). */
  healingSlotBonus?: boolean;
  /** R96 (D231): healing spell dice count as their maximum (최상급 치유). */
  healingMaximized?: boolean;
  spellDamageMaximizedUpTo?: number;
  /** R96 (D231): attacks against this character cannot have advantage unless it is incapacitated (포착 불가). */
  elusive?: boolean;
  /** H2 (D239): per marking spell id, the die its extra damage rolls (적 학살자); the marking spells whose target this character attacks with advantage (정밀한 사냥꾼); the spells whose concentration damage never breaks (끈질긴 사냥꾼). */
  markedSpellDice?: Record<string, number>;
  markedSpellAdvantage?: string[];
  concentrationDamageImmune?: string[];
  /** H2 (D239): spells whose damage adds the spellcasting modifier (고통스러운 폭발, from the feature's target). */
  spellDamageModifier?: string[];
  /** R98 (D233): a damage cantrip deals half on a miss or a successful save (강력한 소마법). */
  potentCantrip?: boolean;
  /** R99 (D234): a miss gives advantage on the next attack against that creature (연구된 공격). */
  studiedAttacks?: boolean;
  /** H2 (D239): a school of one class's spells adds the spellcasting modifier to one damage roll (강화된 방출). */
  schoolDamageModifier?: Array<{ school: string; classSlug: string }>;
  /** H3 (D240): abilities whose saves total at least the ability score. */
  minimumScoreRolls?: AbilityKey[];
  /** V3c (D257): the lowest d20 a proficient check counts (믿음직한 재능). */
  checkMinimumD20?: number;
  /** V3f (D260): reasons opportunity attacks against the bearer are at disadvantage. */
  opportunityDisadvantage?: string[];
  hitDefense?: string;
  extraTurns?: Array<{ offset: number; label: string }>;
  attunementBonus?: number;
  slotHealSelf?: number;
  revealDefenses?: string[];
  /** H3d (D242): damage types whose spells add the spellcasting modifier to one damage roll. */
  damageTypeModifier?: string[];
  /** R72 (D207): how many attacks one Attack action makes (Extra Attack 2, the fighter's 3 and 4); the most wins. */
  attackActionAttacks?: number;
  /** Korean damage type labels. */
  resistances?: string[];
  conditionImmunities?: string[];
  darkvision?: number;
  /** R51 (D186): 맹목 전투, 잠행자 — sight that does not need eyes, in feet. */
  blindsight?: number;
  /** R51 (D186): 중갑 달인 — this much off every hit of these damage types. */
  damageReduction?: { types: string[]; amount: number };
  /** R51 (D186): 원소 숙련자, 독 제조자 — damage types this character deals that ignore resistance. */
  ignoresResistance?: string[];
  /** R55 (D190): reasons this character's attacks are advantaged, each with the weapon filter it applies to. */
  advantageOn?: Array<{ reason: string; scope?: string }>;
  /** R55 (D190): reasons attacks *against* this character are advantaged. */
  grantsAdvantage?: string[];
  /** R55 (D190): this character's attacks ignore half and three-quarters cover. */
  ignoresCover?: boolean;
  /** R61 (D196): reasons this character's checks and saves are advantaged. */
  rollAdvantage?: RollAdvantage[];
  /** R56 (D191): armour and weapon training a feat hands out, and skills it makes expert. */
  armorTraining?: string[];
  weaponTraining?: string[];
  expertise?: string[];
  /** What the rule cannot put in a number (advantage, extra action, immunities). */
  notes?: string[];
  /** Applied once when the effect starts (Aid: +5 current HP with the +5 maximum). */
  onStart?: { heal?: number };
}

const WEAPON_TYPES = ["타격", "관통", "참격"];
const strengthMelee = (attack: DerivedAttack) => attack.ability === "str" && !attack.properties.includes("ammunition");
const weaponOnly = (attack: DerivedAttack) => Boolean(attack.itemId);

/** What casting does at once, before any lasting effect: temporary HP (False Life) or damage dice to roll (Divine Smite). */
export interface CastHook { tempHp?: string; damage?: { formula: string; type: string }; notes?: string[] }

/** The dice of a spell at the slot it is cast with (`dicePerSlotAboveBase`, `flatPerSlotAboveBase`). */
function diceAtSlot(dice: SpellDice, above: number, modifier: number): string {
  const count = dice.count + (dice.dicePerSlotAboveBase ?? 0) * above;
  const flat = (dice.flat ?? 0) + (dice.flatPerSlotAboveBase ?? 0) * above + (dice.addSpellcastingModifier ? modifier : 0);
  return `${count}d${dice.sides}${flat ? `${flat > 0 ? "+" : "-"}${Math.abs(flat)}` : ""}`;
}

/**
 * H5d (D247): what the sheet rolls when a spell is cast away from the table, read from the spell's execution data —
 * its temporary hit points, its healing, the damage it adds on a hit. It used to be a table keyed by English spell name.
 */
export function castHook(spell: { id: string }, slotLevel: number, derived: DerivedCharacter): CastHook | undefined {
  const exec = spellExec(spell.id);
  if (!exec) return undefined;
  const above = Math.max(0, slotLevel - exec.baseLevel);
  const modifier = Math.max(0, ...derived.spellcasting.map((entry) => derived.abilities[entry.ability].modifier));
  if (exec.primary.kind === "temporary-hp") return { tempHp: diceAtSlot(exec.primary.dice, above, modifier) };
  if (exec.primary.kind === "healing") return { notes: [`회복 ${diceAtSlot(exec.primary.dice, above, modifier)} — 대상 HP는 직접`] };
  const hit = onHitOf(exec);
  if (hit?.damage) {
    const notes = [...(hit.versus ? [`${hit.versus.creatureTypes.join("·")}에게 +${hit.versus.damage.count}d${hit.versus.damage.sides}`] : []), ...(hit.note ? [hit.note] : [])];
    return { damage: { formula: `${hit.damage.count + (hit.damage.perSlot ?? 0) * above}d${hit.damage.sides}`, type: hit.damage.type }, ...(notes.length ? { notes } : {}) };
  }
  return undefined;
}

export function effectRuleKey(effect: ActiveEffect, catalog: ContentCatalog): string {
  if (effect.source === "feature") return qualifyRuleKey(featureRuleKey(effect.key.replace(/^feature:/, "")));
  const spellId = effect.key.replace(/^spell:/, "");
  // H6c (D250): a spell's effect contract is keyed by the spell's id, not a slug of its English name. An effect saved
  // before ids were used (`spell:bless`) still finds its spell by the id's last segment.
  const spell = catalog.spellById(spellId) ?? (spellId.includes(".") ? undefined : catalog.spells.find((item) => item.id.split(".").pop() === spellId));
  return `spell:${spell?.id ?? spellId}`;
}

/**
 * R43 (D183): the features whose contract changes a number all the time rather than while an effect runs — 향상된
 * 치명타 and its kin. They are always-on effects, so they go through the same merge, just without being listed as
 * something the player could end.
 */
export function applyPassiveContracts(derived: DerivedCharacter, catalog: ContentCatalog): DerivedCharacter {
  const passives: ActiveEffect[] = [];
  for (const feature of derived.features) {
    const contract = featureContract(catalog, featureRuleKey(feature.id));
    if (!contract) continue;
    const { hasProperties } = contractEffect(contract, characterScope(derived));
    const starts = contract.entryPoints.some((entry) => entry.operations.some((operation) => operation.kind === "effect.apply"));
    if (!hasProperties || starts) continue;
    // H2 (D239): a feature taken for something (a cantrip) runs once per target, with the target in its scope.
    for (const target of feature.targets?.length ? feature.targets : [undefined]) passives.push({ key: qualifyRuleKey(featureRuleKey(feature.id)), name: feature.name, source: "feature", duration: "상시", concentration: false, elapsed: 0, startedAt: "", ...(target ? { target } : {}) });
  }
  return passives.length ? applyActiveEffects(derived, passives, catalog, { list: false }) : derived;
}

/** The application an effect would make, or undefined when there is no rule for it. */
export function effectApplication(effect: ActiveEffect, derived: DerivedCharacter, catalog: ContentCatalog): EffectApplication | undefined {
  const key = effectRuleKey(effect, catalog);
  // R38 (D178): the contract is the source of truth where the content ships one; the hand-written rule is what is
  // left of the ones nobody has written yet. A test asserts the two agree for every effect that has both.
  const contract = catalog.contractFor(key);
  if (contract) {
    // R39: a contract that only says when the effect *ends* (`effect.apply`) says nothing about what it does, so it
    // must not stand in for a hand-written rule that does. Only `property.modify` makes it the source of truth.
    const { application, unknown, hasProperties } = contractEffect(contract, characterScope(derived, effect.target ? { "effect.target": effect.target } : {}));
    if (hasProperties && !unknown.length) return application;
  }
  return undefined;
}

const sum = (terms: Term[]) => terms.reduce((total, term) => total + term.value, 0);
const term = (label: string, value?: number, dice?: string): Term | null => (dice ? { label, value: 0, dice } : value ? { label, value } : null);
const describe = (label: string, value?: number, dice?: string) => (dice ? `+${dice}` : value !== undefined ? `${value >= 0 ? "+" : ""}${value}` : "") + ` ${label}`;

/** Apply every effect in force to a derived character: new arrays, totals recomputed from terms, a summary per effect. */
export function applyActiveEffects(derived: DerivedCharacter, effects: ActiveEffect[], catalog: ContentCatalog, options: { list?: boolean; /** R75 (D210): applications given directly (a pasted magic item), keyed by effect key. */ inline?: Record<string, EffectApplication> } = {}): DerivedCharacter {
  let next: DerivedCharacter = { ...derived, activeEffects: options.list === false ? derived.activeEffects : [], checkTerms: [...derived.checkTerms] };
  const applied: AppliedEffect[] = [];
  // AC terms added by effects so far, so a replacement base (Mage Armor) compares against the real base and keeps them.
  const acEffectTerms: Term[] = [];
  // R39 (D179): an effect in force may pause others (`effect.suppress`). A paused effect stays on the sheet and
  // changes nothing, and the card says what is holding it down instead of quietly dropping it.
  const suppressors = effects.flatMap((effect) => {
    const contract = catalog.contractFor(effectRuleKey(effect, catalog));
    return contract ? contractSuppressions(contract, characterScope(next)).filter((item) => item.suppressed).map((item) => ({ ...item, by: effect.name, key: effect.key })) : [];
  });
  const pausedBy = (effect: ActiveEffect) => effect.suppressed ?? suppressors.find((item) => item.key !== effect.key && selectorMatches(item.selector, effectRuleKey(effect, catalog)))?.reason;
  for (const effect of effects) {
    const paused = pausedBy(effect);
    if (paused) { applied.push({ key: effect.key, name: effect.name, applied: false, notes: [`멈춤 — ${paused}`], narrative: true }); continue; }
    const application = options.inline?.[effect.key] ?? effectApplication(effect, next, catalog);
    if (!application) { applied.push({ key: effect.key, name: effect.name, applied: false, notes: ["규칙 없음 — 설명대로 수동 적용"] }); continue; }
    const notes: string[] = [];
    const label = effect.name;

    if (application.ac) {
      let baseTerms = next.ac.terms.filter((item) => !acEffectTerms.includes(item));
      let source = next.ac.source;
      const shield = baseTerms.find((item) => item.label === "방패");
      const wearingArmor = next.inventory.some((item) => item.equipped && item.kind === "armor");
      if (application.ac.unarmoredBase !== undefined && !wearingArmor) {
        const dex = next.abilities.dex.modifier;
        const candidate = application.ac.unarmoredBase + dex + (shield?.value ?? 0);
        if (candidate > sum(baseTerms)) { baseTerms = [{ label, value: application.ac.unarmoredBase }, { label: "민첩 수정치", value: dex }, ...(shield ? [shield] : [])]; source = label; notes.push(`AC ${application.ac.unarmoredBase} + 민첩`); }
        else notes.push("AC: 지금 AC가 더 높아 적용 안 됨");
      }
      if (application.ac.add) { acEffectTerms.push({ label, value: application.ac.add }); notes.push(`AC +${application.ac.add}`); }
      let terms = [...baseTerms, ...acEffectTerms];
      if (application.ac.min !== undefined && sum(terms) < application.ac.min) { const floor = { label: `${label} (최소 ${application.ac.min})`, value: application.ac.min - sum(terms) }; acEffectTerms.push(floor); terms = [...terms, floor]; notes.push(`AC 최소 ${application.ac.min}`); }
      next = { ...next, ac: { ...next.ac, value: sum(terms), terms, source } };
    }
    if (application.attack || application.damage) {
      next = { ...next, attacks: next.attacks.map((attack) => {
        let changed = attack;
        const hit = application.attack && (!application.attack.filter || application.attack.filter(attack)) ? term(label, application.attack.value, application.attack.dice) : null;
        if (hit) changed = { ...changed, attackTerms: [...changed.attackTerms, hit], attackBonus: sum([...changed.attackTerms, hit]) };
        const dmg = application.damage && (!application.damage.filter || application.damage.filter(attack)) ? term(label, application.damage.value, application.damage.dice) : null;
        if (dmg) changed = { ...changed, damageTerms: [...changed.damageTerms, dmg], damageBonus: sum([...changed.damageTerms, dmg]) };
        return changed;
      }) };
      if (application.attack) notes.push(`명중 ${describe(application.attack.filter === strengthMelee ? "근력 근접 공격" : application.attack.filter ? "무기 공격" : "모든 공격", application.attack.value, application.attack.dice)}`);
      if (application.damage) notes.push(`피해 ${describe(application.damage.filter === strengthMelee ? "근력 근접 공격" : application.damage.filter ? "무기 공격" : "모든 공격", application.damage.value, application.damage.dice)}`);
    }
    if (application.saves) {
      const keys = application.saves.keys ?? [...ABILITY_KEYS];
      const saves = { ...next.saves };
      for (const key of keys) { const extra = term(label, application.saves.value, application.saves.dice); if (extra) saves[key] = { ...saves[key], terms: [...saves[key].terms, extra], bonus: sum([...saves[key].terms, extra]) }; }
      next = { ...next, saves };
      notes.push(`내성 ${describe(keys.length === 6 ? "전부" : keys.join("/"), application.saves.value, application.saves.dice)}`);
    }
    if (application.checks) {
      const extra = term(label, application.checks.value, application.checks.dice);
      if (extra) next = { ...next, checkTerms: [...next.checkTerms, extra], skills: next.skills.map((skill) => ({ ...skill, terms: [...skill.terms, extra], bonus: sum([...skill.terms, extra]) })) };
      notes.push(`능력 판정 ${describe("전부", application.checks.value, application.checks.dice)}`);
    }
    if (application.skills) {
      next = { ...next, skills: next.skills.map((skill) => { const bonus = application.skills!.find((item) => item.id === skill.id); return bonus ? { ...skill, terms: [...skill.terms, { label, value: bonus.value }], bonus: skill.bonus + bonus.value } : skill; }) };
      for (const bonus of application.skills) notes.push(`${next.skills.find((skill) => skill.id === bonus.id)?.name ?? bonus.id} +${bonus.value}`);
    }
    if (application.speed) {
      let terms = [...next.speed.terms];
      let walk = next.speed.walk;
      if (application.speed.add) { terms.push({ label, value: application.speed.add }); walk += application.speed.add; notes.push(`이동 속도 +${application.speed.add}`); }
      if (application.speed.multiply) { const extra = walk * (application.speed.multiply - 1); terms.push({ label: `${label} (×${application.speed.multiply})`, value: extra }); walk += extra; notes.push(`이동 속도 ×${application.speed.multiply}`); }
      const speed = { ...next.speed, walk, terms };
      if (application.speed.fly) { speed.fly = Math.max(speed.fly ?? 0, application.speed.fly); notes.push(`비행 ${application.speed.fly}ft`); }
      if (application.speed.climbAsWalk) { speed.climb = walk; notes.push(`등반 ${walk}ft`); }
      if (application.speed.flyAsWalk) { speed.fly = Math.max(speed.fly ?? 0, walk); notes.push(`비행 ${walk}ft`); }
      next = { ...next, speed };
    }
    if (application.hpMax) { next = { ...next, hp: { ...next.hp, max: next.hp.max + application.hpMax, terms: [...next.hp.terms, { label, value: application.hpMax }], breakdown: [...next.hp.breakdown, `${label} +${application.hpMax}`] } }; notes.push(`최대 HP +${application.hpMax}`); }
    if (application.spellDc || application.spellAttack) {
      next = { ...next, spellcasting: next.spellcasting.map((entry) => (application.spellcastingClass && !(entry.source === "class" && catalog.classBySlug(application.spellcastingClass)?.id === entry.classId) ? entry : {
        ...entry,
        ...(application.spellDc ? { saveDc: entry.saveDc + application.spellDc, saveDcTerms: [...entry.saveDcTerms, { label, value: application.spellDc }] } : {}),
        ...(application.spellAttack ? { attackBonus: entry.attackBonus + application.spellAttack, attackTerms: [...entry.attackTerms, { label, value: application.spellAttack }] } : {}),
      })) };
      if (application.spellDc) notes.push(`주문 DC +${application.spellDc}`);
      if (application.spellAttack) notes.push(`주문 명중 +${application.spellAttack}`);
    }
    if (application.shillelagh) {
      const best = next.spellcasting.reduce<{ mod: number; label: string } | null>((acc, entry) => { const mod = next.abilities[entry.ability].modifier; return !acc || mod > acc.mod ? { mod, label: entry.ability } : acc; }, null);
      if (best) {
        const die = next.level >= 17 ? "1d20" : next.level >= 11 ? "1d12" : next.level >= 5 ? "1d10" : "1d8";
        next = { ...next, attacks: next.attacks.map((attack) => {
          if (!attack.itemId || !/\.(club|quarterstaff)$/.test(attack.itemId)) return attack;
          const delta = best.mod - next.abilities[attack.ability].modifier;
          const hit: Term = { label: `${label} (주문 능력치로)`, value: delta };
          return { ...attack, damage: die, attackTerms: [...attack.attackTerms, hit], attackBonus: sum([...attack.attackTerms, hit]), damageTerms: [...attack.damageTerms, hit], damageBonus: sum([...attack.damageTerms, hit]) };
        }) };
        notes.push(`곤봉·육척봉: 주문 능력치, 피해 ${die}`);
      }
    }
    if (application.resistances?.length) { const has = (type: string) => next.defenses.resistances.some((line) => line === type || line.startsWith(`${type} (`)); next = { ...next, defenses: { ...next.defenses, resistances: [...next.defenses.resistances, ...application.resistances.filter((type) => !has(type)).map((type) => `${type} (${label})`)] } }; notes.push(`저항: ${application.resistances.join("·")}`); }
    if (application.conditionImmunities?.length) { next = { ...next, defenses: { ...next.defenses, conditionImmunities: [...next.defenses.conditionImmunities, ...application.conditionImmunities.map((condition) => `${condition} (${label})`)] } }; notes.push(`상태 면역: ${application.conditionImmunities.join("·")}`); }
    if (application.darkvision) { next = { ...next, senses: { ...next.senses, darkvision: Math.max(next.senses.darkvision ?? 0, application.darkvision) } }; notes.push(`암시야 ${application.darkvision}ft`); }
    if (application.blindsight) { next = { ...next, senses: { ...next.senses, blindsight: Math.max(next.senses.blindsight ?? 0, application.blindsight) } }; notes.push(`맹시 ${application.blindsight}ft`); }
    // R51 (D186): flat damage reduction travels to the table as `Combatant.reduction`; the sheet only records it.
    if (application.damageReduction?.amount) {
      const rule = { types: application.damageReduction.types, amount: application.damageReduction.amount, source: label };
      next = { ...next, damageReduction: [...(next.damageReduction ?? []), rule] };
      notes.push(`받는 피해 −${rule.amount} (${rule.types.join("·") || "모든 유형"})`);
    }
    // R55 (D190): the two sides of an advantage rule, each naming the effect that granted it.
    if (application.advantageOn?.length) {
      const named = application.advantageOn.map((item) => ({ reason: item.reason ? `${label}: ${item.reason}` : label, ...(item.scope ? { scope: item.scope } : {}) }));
      next = { ...next, advantageOn: [...(next.advantageOn ?? []), ...named] };
      notes.push(`공격 굴림 유리 (${named.map((item) => item.reason).join(", ")})`);
    }
    if (application.grantsAdvantage?.length) {
      const named = application.grantsAdvantage.map((reason) => (reason ? `${label}: ${reason}` : label));
      next = { ...next, grantsAdvantage: [...(next.grantsAdvantage ?? []), ...named] };
      notes.push(`이 캐릭터를 향한 공격 유리 (${named.join(", ")})`);
    }
    if (application.ignoresCover) { next = { ...next, ignoresCover: true }; notes.push("엄폐 무시"); }
    if (application.rollAdvantage?.length) {
      const named = application.rollAdvantage.map((item) => ({ ...item, reason: item.reason ? `${label}: ${item.reason}` : label }));
      next = { ...next, rollAdvantage: [...(next.rollAdvantage ?? []), ...named] };
      notes.push(`유리: ${named.map((item) => item.reason).join(", ")}`);
    }
    // R56 (D191): training and expertise land on the sheet's own lists, with the proficiency bonus doubled where
    // expertise says so — the same arithmetic the derivation does, applied after it.
    for (const [key, values, label2] of [["armor", application.armorTraining, "방어구 훈련"], ["weapons", application.weaponTraining, "무기 숙련"]] as Array<["armor" | "weapons", string[] | undefined, string]>) {
      const fresh = (values ?? []).filter((item) => item && !next.proficiencies[key].includes(item));
      if (!fresh.length) continue;
      next = { ...next, proficiencies: { ...next.proficiencies, [key]: [...next.proficiencies[key], ...fresh] } };
      notes.push(`${label2}: ${fresh.join("·")}`);
    }
    if (application.expertise?.length) {
      const wanted = new Set(application.expertise);
      next = { ...next, skills: next.skills.map((skill) => {
        if (!wanted.has(skill.id) || skill.expertise || !skill.proficient) return skill;
        const extra: Term = { label: `${label} (전문화)`, value: next.proficiencyBonus };
        return { ...skill, expertise: true, terms: [...skill.terms, extra], bonus: skill.bonus + next.proficiencyBonus };
      }) };
      notes.push(`전문화: ${application.expertise.join("·")}`);
    }
    if (application.ignoresResistance?.length) {
      next = { ...next, ignoresResistance: [...new Set([...(next.ignoresResistance ?? []), ...application.ignoresResistance])] };
      notes.push(`${application.ignoresResistance.join("·")} 저항 무시`);
    }
    notes.push(...(application.notes ?? []));
    // R28 (D153): an application that carries nothing but prose is the table's to run, and says so.
    // R43 (D183): 향상된 치명타 lowers the die that counts as a critical hit; the lowest wins if two effects say so.
    if (application.cantripModifierClasses?.length) { next = { ...next, cantripModifierClasses: [...new Set([...(next.cantripModifierClasses ?? []), ...application.cantripModifierClasses])] }; notes.push("소마법 피해에 주문 능력 수정치"); }
    if (application.healingSlotBonus) { next = { ...next, healingSlotBonus: true }; notes.push("슬롯 치유 주문 +2+슬롯 레벨"); }
    if (application.spellDamageMaximizedUpTo) { next = { ...next, spellDamageMaximizedUpTo: Math.max(next.spellDamageMaximizedUpTo ?? 0, application.spellDamageMaximizedUpTo) }; notes.push(`${application.spellDamageMaximizedUpTo}레벨 이하 주문 피해 최대값`); }
    if (application.healingMaximized) { next = { ...next, healingMaximized: true }; notes.push("치유 주사위 최대값"); }
    if (application.markedSpellDice) { next = { ...next, markedSpellDice: { ...(next.markedSpellDice ?? {}), ...application.markedSpellDice } }; notes.push(`표식 추가 피해 d${Object.values(application.markedSpellDice).join("/d")}`); }
    if (application.markedSpellAdvantage?.length) { next = { ...next, markedSpellAdvantage: [...new Set([...(next.markedSpellAdvantage ?? []), ...application.markedSpellAdvantage])] }; notes.push("표식한 대상 공격에 유리"); }
    if (application.concentrationDamageImmune?.length) { next = { ...next, concentrationDamageImmune: [...new Set([...(next.concentrationDamageImmune ?? []), ...application.concentrationDamageImmune])] }; notes.push("피해로 그 주문의 집중이 깨지지 않음"); }
    if (application.spellDamageModifier?.length) { next = { ...next, spellDamageModifier: [...new Set([...(next.spellDamageModifier ?? []), ...application.spellDamageModifier])] }; notes.push("고른 주문의 피해에 주문 능력 수정치"); }
    if (application.studiedAttacks) { next = { ...next, studiedAttacks: true }; notes.push("빗나간 대상에게 다음 공격 유리"); }
    if (application.potentCantrip) { next = { ...next, potentCantrip: true }; notes.push("피해 소마법: 빗나감·내성 성공에도 절반"); }
    if (application.damageTypeModifier?.length) { next = { ...next, damageTypeModifier: [...new Set([...(next.damageTypeModifier ?? []), ...application.damageTypeModifier])] }; notes.push(`${application.damageTypeModifier.join("·")} 주문 피해 한 번에 주문 능력 수정치`); }
    if (application.opportunityDisadvantage?.length) { next = { ...next, opportunityDisadvantage: [...(next.opportunityDisadvantage ?? []), ...application.opportunityDisadvantage.map((reason) => reason || label)] }; notes.push("나를 향한 기회 공격 불리"); }
    if (application.hitDefense !== undefined) { next = { ...next, hitDefense: application.hitDefense || label }; notes.push("나를 맞힌 생물은 이번 턴 다른 공격이 불리"); }
    if (application.extraTurns?.length) { next = { ...next, extraTurns: [...(next.extraTurns ?? []), ...application.extraTurns.map((turn) => ({ ...turn, label: turn.label || label }))] }; notes.push("전투 첫 라운드에 턴 하나 더"); }
    if (application.slotHealSelf) { next = { ...next, slotHealSelf: Math.max(next.slotHealSelf ?? 0, application.slotHealSelf) }; notes.push(`슬롯 주문으로 남을 치유하면 자신도 ${application.slotHealSelf} + 슬롯 레벨 회복`); }
    if (application.revealDefenses?.length) { next = { ...next, revealDefenses: [...new Set([...(next.revealDefenses ?? []), ...application.revealDefenses])] }; notes.push("표식 주문 대상의 저항·면역·취약을 앎"); }
    if (application.attunementBonus) { next = { ...next, attunementBonus: (next.attunementBonus ?? 0) + application.attunementBonus }; notes.push(`조율 슬롯 +${application.attunementBonus}`); }
    if (application.checkMinimumD20) { next = { ...next, checkMinimumD20: Math.max(next.checkMinimumD20 ?? 0, application.checkMinimumD20) }; notes.push(`숙련 판정 d20 최소 ${application.checkMinimumD20}`); }
    if (application.minimumScoreRolls?.length) { next = { ...next, minimumScoreRolls: [...new Set([...(next.minimumScoreRolls ?? []), ...application.minimumScoreRolls])] }; notes.push(`${application.minimumScoreRolls.join("·")} 내성은 최소 능력치 점수`); }
    if (application.schoolDamageModifier?.length) { next = { ...next, schoolDamageModifier: [...(next.schoolDamageModifier ?? []), ...application.schoolDamageModifier] }; notes.push("그 학파 주문 피해 한 번에 주문 능력 수정치"); }
    if (application.elusive) { next = { ...next, elusive: true }; notes.push("나를 향한 공격에 유리 없음"); }
    if (application.evasion) { next = { ...next, evasion: true }; notes.push("회피술: 민첩 내성 절반 피해 — 성공 0, 실패 절반"); }
    if (application.critRange !== undefined) { next = { ...next, critRange: Math.min(next.critRange ?? 20, application.critRange) }; notes.push(`치명타 범위 ${application.critRange}–20`); }
    if (application.attackActionAttacks !== undefined) { next = { ...next, attackActionAttacks: Math.max(next.attackActionAttacks ?? 1, application.attackActionAttacks) }; notes.push(`공격 행동에 ${application.attackActionAttacks}번 공격`); }
    const mechanical = Object.keys(application).some((field) => field !== "notes" && application[field as keyof typeof application] !== undefined);
    applied.push({ key: effect.key, name: effect.name, applied: true, notes, ...(mechanical ? {} : { narrative: true }) });
  }
  return { ...next, activeEffects: options.list === false ? next.activeEffects : applied };
}
