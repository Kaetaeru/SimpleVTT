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

interface EffectContext { derived: DerivedCharacter; classLevel: (slug: string) => number; name: string }

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

export type EffectRule = (context: EffectContext) => EffectApplication;

const WEAPON_TYPES = ["타격", "관통", "참격"];
const strengthMelee = (attack: DerivedAttack) => attack.ability === "str" && !attack.properties.includes("ammunition");
const weaponOnly = (attack: DerivedAttack) => Boolean(attack.itemId);

/** Keyed by `feature:<rule key>` or `spell:<English name slug>`. */
export const EFFECT_RULES: Record<string, EffectRule> = {
  "spell:aid": () => ({ hpMax: 5, onStart: { heal: 5 }, notes: ["최대 HP와 현재 HP +5"] }),
};

/** What casting does at once, before any lasting effect: temporary HP (False Life) or damage dice to roll (Divine Smite). */
export interface CastHook { tempHp?: string; damage?: { formula: string; type: string }; notes?: string[] }
const CAST_HOOKS: Record<string, (slotLevel: number, derived: DerivedCharacter) => CastHook> = {
  "false-life": (slotLevel) => ({ tempHp: `2d4+${4 + Math.max(0, slotLevel - 1) * 5}` }),
  "divine-smite": (slotLevel) => ({ damage: { formula: `${1 + Math.max(1, slotLevel)}d8`, type: "광휘" }, notes: ["악마·언데드에게 +1d8"] }),
  "searing-smite": (slotLevel) => ({ damage: { formula: `${Math.max(1, slotLevel)}d6`, type: "화염" }, notes: ["매 턴 시작에 건강 내성 아니면 다시 1d6 (1분)"] }),
  "shining-smite": (slotLevel) => ({ damage: { formula: `${1 + Math.max(1, slotLevel)}d6`, type: "광휘" }, notes: ["대상은 1분 동안 빛나고 투명 불가, 명중 유리"] }),
  "cure-wounds": (slotLevel, derived) => ({ notes: [`회복 ${2 * Math.max(1, slotLevel)}d8 + ${Math.max(...derived.spellcasting.map((entry) => derived.abilities[entry.ability].modifier), 0)} — 대상 HP는 직접`] }),
  "healing-word": (slotLevel, derived) => ({ notes: [`회복 ${2 * Math.max(1, slotLevel)}d4 + ${Math.max(...derived.spellcasting.map((entry) => derived.abilities[entry.ability].modifier), 0)}`] }),
};
export function castHook(spell: { nameEn: string }, slotLevel: number, derived: DerivedCharacter): CastHook | undefined {
  return CAST_HOOKS[spellSlug(spell.nameEn)]?.(slotLevel, derived);
}

const spellSlug = (nameEn: string) => nameEn.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export function effectRuleKey(effect: ActiveEffect, catalog: ContentCatalog): string {
  if (effect.source === "feature") return qualifyRuleKey(featureRuleKey(effect.key.replace(/^feature:/, "")));
  const spellId = effect.key.replace(/^spell:/, "");
  const spell = catalog.spellById(spellId);
  return `spell:${spellSlug(spell?.nameEn ?? spellId.split(".").pop() ?? spellId)}`;
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
    passives.push({ key: qualifyRuleKey(featureRuleKey(feature.id)), name: feature.name, source: "feature", duration: "상시", concentration: false, elapsed: 0, startedAt: "" });
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
    const { application, unknown, hasProperties } = contractEffect(contract, characterScope(derived));
    if (hasProperties && !unknown.length) return application;
  }
  const rule = EFFECT_RULES[key];
  if (!rule) return undefined;
  const classLevel = (slug: string) => derived.classes.find((cls) => cls.classId.endsWith(`.${slug}`) || cls.classId === slug)?.level ?? 0;
  return rule({ derived, classLevel, name: effect.name });
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
      next = { ...next, spellcasting: next.spellcasting.map((entry) => (application.spellcastingClass && !(entry.source === "class" && entry.classId.endsWith(`.${application.spellcastingClass}`)) ? entry : {
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
    if (application.evasion) { next = { ...next, evasion: true }; notes.push("회피술: 민첩 내성 절반 피해 — 성공 0, 실패 절반"); }
    if (application.critRange !== undefined) { next = { ...next, critRange: Math.min(next.critRange ?? 20, application.critRange) }; notes.push(`치명타 범위 ${application.critRange}–20`); }
    if (application.attackActionAttacks !== undefined) { next = { ...next, attackActionAttacks: Math.max(next.attackActionAttacks ?? 1, application.attackActionAttacks) }; notes.push(`공격 행동에 ${application.attackActionAttacks}번 공격`); }
    const mechanical = Object.keys(application).some((field) => field !== "notes" && application[field as keyof typeof application] !== undefined);
    applied.push({ key: effect.key, name: effect.name, applied: true, notes, ...(mechanical ? {} : { narrative: true }) });
  }
  return { ...next, activeEffects: options.list === false ? next.activeEffects : applied };
}
