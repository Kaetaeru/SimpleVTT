/**
 * What an effect in force does to the sheet. Rage adds its damage bonus to Strength attacks and resistance to the
 * three weapon damage types; Bless adds 1d4 to attack rolls and saves; Shield adds 5 AC; Mage Armor replaces the
 * unarmored base; Haste doubles speed… Each change lands as a Term with the effect's name, so the sheet's hover
 * shows where the number came from. Effects without a rule are listed as "적용 안 됨" so the text is applied by hand.
 */
import type { ContentCatalog } from "../catalog/catalog";
import type { AbilityKey } from "../catalog/types";
import { ABILITY_KEYS } from "../catalog/types";
import type { ActiveEffect, AppliedEffect, DerivedAttack, DerivedCharacter, Term } from "../character/types";
import { featureRuleKey } from "./activation";
import { characterScope } from "./contract";
import { contractEffect } from "./contractEffects";

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
  /** Korean damage type labels. */
  resistances?: string[];
  conditionImmunities?: string[];
  darkvision?: number;
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
  "feature:barbarian.rage": ({ classLevel }) => {
    const level = classLevel("barbarian");
    const bonus = level >= 16 ? 4 : level >= 9 ? 3 : 2;
    return { damage: { value: bonus, filter: strengthMelee }, resistances: WEAPON_TYPES, notes: ["근력 판정·근력 내성 유리", "주문 시전·집중 불가", "턴이 끝날 때 공격도 피해도 없었으면 종료 (추가 행동으로 연장 가능)"] };
  },
  "feature:barbarian.reckless-attack": () => ({ notes: ["이 턴의 근력 근접 공격 유리", "다음 턴 시작까지 받는 공격 유리"] }),
  "feature:sorcerer.innate-sorcery": () => ({ spellDc: 1, spellcastingClass: "sorcerer", notes: ["소서러 주문 명중 굴림 유리"] }),
  "feature:species.draconic-flight": () => ({ speed: { flyAsWalk: true }, notes: ["10분 동안 비행 속도 = 이동 속도"] }),
  "feature:species.large-form": () => ({ speed: { add: 10 }, notes: ["크기 대형", "근력 판정·내성 유리"] }),
  "feature:species.stonecunning": () => ({ notes: ["돌 표면과 닿아 있을 때 60피트 진동 감각"] }),
  "feature:paladin.oath-of-devotion.sacred-weapon": ({ derived }) => ({ attack: { value: Math.max(1, derived.abilities.cha.modifier), filter: weaponOnly }, notes: ["무기 하나에만 (마법 무기, 20피트 빛)"] }),
  "feature:paladin.oath-of-devotion.holy-nimbus": () => ({ notes: ["30피트 빛, 적이 턴을 시작하면 광휘 피해", "악마·언데드의 주문에 내성 유리"] }),
  "feature:monk.superior-defense": () => ({ notes: ["역장을 뺀 모든 피해에 저항"] }),
  "feature:monk.open-hand.quivering-palm": () => ({ notes: ["떨림 진동: 행동으로 터뜨리면 건강 내성 아니면 10d12"] }),
  "feature:sorcerer.draconic.dragon-wings": () => ({ speed: { fly: 60 } }),
  "feature:druid.circle-of-the-land.natures-sanctuary": () => ({ notes: ["나무 벽 15피트: 벽 안의 아군은 절반 엄폐"] }),
  "feature:barbarian.berserker.intimidating-presence": () => ({ notes: ["대상은 매 턴 끝에 다시 내성"] }),
  "feature:ranger.favored-enemy": () => ({ damage: { dice: "1d6", filter: weaponOnly }, notes: ["표식한 대상에게만 추가 피해", "표식 대상을 찾는 지혜(지각/생존) 판정 유리"] }),
  "feature:ranger.natures-veil": () => ({ notes: ["투명 (다음 턴 시작까지)"] }),
  "feature:druid.wild-shape": () => ({ notes: ["야수 형태: 야수의 이동 속도·감각·특성, 임시 HP = 드루이드 레벨 (사용 시 부여됨)", "야수 능력치는 수동"] }),
  "feature:paladin.channel-divinity": () => ({ notes: ["선택한 신성 변환 효과를 수동 적용"] }),
  "spell:bless": () => ({ attack: { dice: "1d4" }, saves: { dice: "1d4" }, notes: ["대상 최대 3명 (자신 포함 시 적용)"] }),
  "spell:shield": () => ({ ac: { add: 5 }, notes: ["다음 턴 시작까지", "마법 화살 피해 없음"] }),
  "spell:shield-of-faith": () => ({ ac: { add: 2 } }),
  "spell:mage-armor": () => ({ ac: { unarmoredBase: 13 }, notes: ["갑옷을 입으면 종료"] }),
  "spell:barkskin": () => ({ ac: { min: 17 } }),
  "spell:haste": () => ({ ac: { add: 2 }, speed: { multiply: 2 }, notes: ["민첩 내성 유리", "추가 행동 하나: 공격(1회)·질주·이탈·숨기·사용", "끝나면 한 턴 행동 불가"] }),
  "spell:longstrider": () => ({ speed: { add: 10 } }),
  "spell:expeditious-retreat": () => ({ notes: ["추가 행동으로 질주"] }),
  "spell:jump": () => ({ notes: ["이동 10피트마다 30피트 도약"] }),
  "spell:fly": () => ({ speed: { fly: 60 } }),
  "spell:spider-climb": () => ({ speed: { climbAsWalk: true }, notes: ["벽·천장 이동, 손 자유"] }),
  "spell:aid": () => ({ hpMax: 5, onStart: { heal: 5 }, notes: ["최대 HP와 현재 HP +5"] }),
  "spell:guidance": () => ({ checks: { dice: "1d4" }, notes: ["능력 판정 하나에만 (굴린 뒤 종료)"] }),
  "spell:resistance": () => ({ notes: ["시전할 때 고른 피해 속성의 피해를 받을 때마다 1d4 줄임"] }),
  "spell:protection-from-poison": () => ({ resistances: ["독"], notes: ["독 피해 저항, 중독 내성 유리"] }),
  "spell:protection-from-energy": () => ({ notes: ["시전할 때 고른 속성(산성·냉기·화염·번개·천둥) 저항 — 피해 계산에 손으로 반영"] }),
  "spell:fire-shield": () => ({ notes: ["따뜻함: 냉기 저항 / 서늘함: 화염 저항 (시전 때 선택)", "5피트 안에서 근접 명중당하면 2d8 (화염 또는 냉기)"] }),
  "spell:aura-of-life": () => ({ notes: ["오라 안: 괴저 저항, 최대 HP 감소 불가, 0 HP 아군은 턴 시작에 1 HP"] }),
  "spell:shillelagh": () => ({ shillelagh: true, notes: ["곤봉·육척봉 공격이 주문 시전 능력치와 d8(5레벨 d10, 11레벨 d12, 17레벨 d20)을 씀"] }),
  "spell:enlarge-reduce": () => ({ damage: { dice: "1d4", filter: weaponOnly }, notes: ["확대: 크기 한 단계 커짐, 근력 판정·내성 유리 (축소면 −1d4·불리)"] }),
  "spell:divine-favor": () => ({ damage: { dice: "1d4", filter: weaponOnly }, notes: ["추가 피해는 광휘"] }),
  "spell:hunters-mark": () => ({ damage: { dice: "1d6", filter: weaponOnly }, notes: ["표식한 대상에게만 추가 피해 (역장)", "표식 대상을 찾는 지혜(지각/생존) 판정 유리"] }),
  "spell:magic-weapon": () => ({ attack: { value: 1, filter: weaponOnly }, damage: { value: 1, filter: weaponOnly }, notes: ["무기 하나에만 (마법 무기가 됨) · 3레벨 슬롯 +2, 5레벨 슬롯 +3은 수동"] }),
  "spell:pass-without-trace": () => ({ skills: [{ id: "stealth", value: 10 }], notes: ["30피트 안의 아군도"] }),
  "spell:stoneskin": () => ({ resistances: WEAPON_TYPES }),
  "spell:protection-from-evil-and-good": () => ({ notes: ["악마·요정·이계인·언데드 등의 공격 불리, 매혹·공포·빙의 면역"] }),
  "spell:heroism": () => ({ conditionImmunities: ["공포"], notes: ["매 턴 시작에 임시 HP (시전 능력치 수정치)"] }),
  "spell:invisibility": () => ({ notes: ["투명 — 공격하거나 주문을 시전하면 종료"] }),
  "spell:greater-invisibility": () => ({ notes: ["투명"] }),
  "spell:mirror-image": () => ({ notes: ["환영 3개: 공격받을 때 d20으로 환영이 맞을 수 있음 (AC 10 + 민첩)"] }),
  "spell:blur": () => ({ notes: ["당신을 공격하는 명중 굴림 불리"] }),
  "spell:sanctuary": () => ({ notes: ["공격·해로운 주문의 대상이 되면 지혜 내성 (실패 시 다른 대상)", "공격하면 종료"] }),
  "spell:freedom-of-movement": () => ({ notes: ["어려운 지형·마비·포박 무시, 붙잡힘 탈출에 5피트"] }),
  "spell:death-ward": () => ({ notes: ["HP가 0이 될 때 대신 1로"] }),
  "spell:foresight": () => ({ notes: ["공격·판정·내성 유리, 당신을 공격하는 굴림 불리, 기습 불가"] }),
  "spell:warding-bond": () => ({ ac: { add: 1 }, saves: { value: 1 }, notes: ["모든 피해 저항, 시전자도 같은 피해"] }),
  "spell:darkvision": () => ({ darkvision: 150 }),
  "spell:mage-hand": () => ({ notes: ["30피트 안의 유령 손"] }),
  "spell:light": () => ({ notes: ["밝은 빛 20피트, 약한 빛 20피트"] }),
  "spell:dancing-lights": () => ({ notes: ["빛 4개"] }),
  "spell:detect-magic": () => ({ notes: ["30피트 안 마법 감지, 행동으로 오라 보기"] }),
  "spell:detect-poison-and-disease": () => ({ notes: ["30피트 안 독·병 감지"] }),
  "spell:speak-with-animals": () => ({ notes: ["짐승과 대화"] }),
  "spell:comprehend-languages": () => ({ notes: ["모든 언어 이해"] }),
  "spell:alarm": () => ({ notes: ["경보 설정"] }),
  "spell:hex": () => ({ damage: { dice: "1d6", filter: weaponOnly }, notes: ["저주 대상에게만 추가 피해 (괴저), 대상의 고른 능력 판정 불리"] }),
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
  if (effect.source === "feature") return `feature:${featureRuleKey(effect.key.replace(/^feature:/, ""))}`;
  const spellId = effect.key.replace(/^spell:/, "");
  const spell = catalog.spellById(spellId);
  return `spell:${spellSlug(spell?.nameEn ?? spellId.split(".").pop() ?? spellId)}`;
}

/** The application an effect would make, or undefined when there is no rule for it. */
export function effectApplication(effect: ActiveEffect, derived: DerivedCharacter, catalog: ContentCatalog): EffectApplication | undefined {
  const key = effectRuleKey(effect, catalog);
  // R38 (D178): the contract is the source of truth where the content ships one; the hand-written rule is what is
  // left of the ones nobody has written yet. A test asserts the two agree for every effect that has both.
  const contract = catalog.contractFor(key);
  if (contract) {
    const { application, unknown } = contractEffect(contract, characterScope(derived));
    if (!unknown.length) return application;
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
export function applyActiveEffects(derived: DerivedCharacter, effects: ActiveEffect[], catalog: ContentCatalog): DerivedCharacter {
  let next: DerivedCharacter = { ...derived, activeEffects: [], checkTerms: [...derived.checkTerms] };
  const applied: AppliedEffect[] = [];
  // AC terms added by effects so far, so a replacement base (Mage Armor) compares against the real base and keeps them.
  const acEffectTerms: Term[] = [];
  for (const effect of effects) {
    const application = effectApplication(effect, next, catalog);
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
    notes.push(...(application.notes ?? []));
    // R28 (D153): an application that carries nothing but prose is the table's to run, and says so.
    const mechanical = Object.keys(application).some((field) => field !== "notes" && application[field as keyof typeof application] !== undefined);
    applied.push({ key: effect.key, name: effect.name, applied: true, notes, ...(mechanical ? {} : { narrative: true }) });
  }
  return { ...next, activeEffects: applied };
}
