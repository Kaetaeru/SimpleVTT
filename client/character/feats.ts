/**
 * Feat application: what a feat grants and what it asks. SRD feats are handled by their mechanics config (ability
 * increase, magic initiate spell choices, skilled proficiencies, alert initiative, fighting styles, epic boons); the
 * same config keys drive installed feats, so a supplement feat with `abilityIncrease` or `proficiencyChoice` works
 * without code.
 */
import type { FeatView } from "../catalog/catalog";
import type { AbilityKey } from "../catalog/types";
import { ABILITY_KEYS, ABILITY_KO } from "../catalog/types";
import { ABILITY_SCORE_MAX } from "../rules/tables";
import { abilityOptions, allToolOptions, damageTypeOptions, skillOptions, spellOptions, toolName, weaponMasteryOptions } from "./choices";
import { featDieMinimum, featExecutionStatus, featNotes, resetKo } from "./featRules";
import type { Ledger } from "./ledger";

export interface FeatInstance {
  /** Unique key of this feat grant (`background`, `species.originFeat`, `class.4.asi`, `invocation.2`). */
  key: string;
  sourceLabel: string;
  trackIndex?: number;
  preset?: Record<string, string>;
}

const CASTER_ABILITY_KEYS: AbilityKey[] = ["int", "wis", "cha"];

export function applyFeat(ledger: Ledger, feat: FeatView, instance: FeatInstance) {
  const { catalog } = ledger;
  const prefix = `feat.${instance.key}.${feat.id}`;
  ledger.feats.push({ id: feat.id, name: feat.name, tier: feat.tier, source: instance.sourceLabel, instanceKey: instance.key });
  // R33 (D168): the sheet's line for this feat is written from the same config keys the derivation below reads, so
  // the two cannot drift; `execution` marks the feats that are prose for the table rather than a number the app applies.
  ledger.addFeature({ id: `${prefix}`, name: feat.name, nameEn: feat.nameEn, source: "feat", sourceLabel: instance.sourceLabel, description: feat.description, descriptionSource: feat.scope === "installed" && feat.description ? "module" : "srd-summary", rules: featNotes(feat.config), execution: featExecutionStatus(feat.config) });
  const ask = { scope: "feat" as const, sourceLabel: `${instance.sourceLabel} · ${feat.name}`, trackIndex: instance.trackIndex };
  const config = feat.config;

  // Ability Score Improvement feat: +2 to one or +1 to two.
  if (Array.isArray(config.choices) && (config.choices as string[]).includes("+2-one-ability")) {
    const mode = ledger.askOne({ ...ask, id: `${prefix}.mode`, label: "능력치 향상 방식", options: [
      { id: "+2-one-ability", name: "한 능력치 +2" }, { id: "+1-two-abilities", name: "두 능력치 +1" },
    ] }) ?? "+2-one-ability";
    const amount = mode === "+2-one-ability" ? 2 : 1;
    const picked = ledger.ask({ ...ask, id: `${prefix}.abilities`, label: amount === 2 ? "+2를 받을 능력치" : "+1을 받을 능력치 둘", count: amount === 2 ? 1 : 2, options: abilityOptions(ABILITY_KEYS, (key) => ledger.abilityScore(key), amount, ABILITY_SCORE_MAX) });
    for (const key of picked) ledger.addAbilityBonus(key as AbilityKey, amount, instance.sourceLabel, ABILITY_SCORE_MAX);
  }

  /** R62 (D197): which ability this feat raised. 회복력's save and the spell feats' casting ability are both "the ability you increased". */
  let raised: AbilityKey | undefined;
  // Generic ability increase (general feats +1 to one of a set, epic boons +1 up to 30).
  if (feat.abilityIncrease) {
    const keys = feat.abilityIncrease.any ?? ABILITY_KEYS;
    const cap = feat.abilityIncrease.maximum ?? ABILITY_SCORE_MAX;
    raised = (keys.length === 1 ? keys[0] : ledger.askOne({ ...ask, id: `${prefix}.ability`, label: `+${feat.abilityIncrease.amount} 능력치`, options: abilityOptions(keys, (item) => ledger.abilityScore(item), feat.abilityIncrease.amount, cap) })) as AbilityKey | undefined;
    if (raised) ledger.addAbilityBonus(raised, feat.abilityIncrease.amount, `${instance.sourceLabel} · ${feat.name}`, cap);
  }

  // Magic Initiate and similar: a spell list, cantrips, level-1 spells, a casting ability.
  const spellChoices = config.choices as { spellList?: string[]; cantrips?: number; level1Spells?: number; spellcastingAbility?: AbilityKey[] } | undefined;
  if (spellChoices && typeof spellChoices === "object" && !Array.isArray(spellChoices) && spellChoices.spellList) {
    const listSlugs = spellChoices.spellList;
    const listSlug = instance.preset?.spellList ?? ledger.askOne({ ...ask, id: `${prefix}.spellList`, label: "주문 목록", options: listSlugs.map((slug) => ({ id: slug, name: catalog.classBySlug(slug)?.name ?? slug })) });
    const abilityKeys = spellChoices.spellcastingAbility ?? CASTER_ABILITY_KEYS;
    const ability = (instance.preset?.spellcastingAbility as AbilityKey | undefined) ?? (ledger.askOne({ ...ask, id: `${prefix}.ability`, label: "주문 시전 능력치", options: abilityOptions(abilityKeys) }) as AbilityKey | undefined);
    const listClass = listSlug ? catalog.classBySlug(listSlug) : undefined;
    if (listClass) {
      const entry = ledger.spellcastingEntry(`feat:${instance.key}:${feat.id}`, () => ({ classId: listClass.id, className: `${feat.name} (${listClass.name})`, ability: ability ?? listClass.rules.spellcastingAbility ?? "cha", cantripsMax: spellChoices.cantrips ?? 0, preparedMax: 0 }));
      if (ability) entry.ability = ability;
      const cantrips = ledger.ask({ ...ask, id: `${prefix}.cantrips`, label: `${listClass.name} 소마법`, count: spellChoices.cantrips ?? 0, options: spellOptions(catalog, [listClass.id], [0]) });
      for (const id of cantrips) entry.cantrips.add(id);
      const spells = ledger.ask({ ...ask, id: `${prefix}.spells`, label: `${listClass.name} 1레벨 주문 (항상 준비, 긴 휴식마다 1회 무료)`, count: spellChoices.level1Spells ?? 0, options: spellOptions(catalog, [listClass.id], [1]) });
      for (const id of spells) {
        entry.alwaysPrepared.add(id);
        entry.freeCasts.push(id);
        // R33 (D168): the pool refreshes on whatever the catalog's `freeCastReset` says, not on a hardcoded long rest.
        ledger.addResource({ id: `resource.${prefix}.${id}`, label: `${feat.name}: ${catalog.spellById(id)?.name ?? id} 무료 시전`, max: 1, recovery: resetKo(typeof config.freeCastReset === "string" ? config.freeCastReset : "long-rest"), source: feat.name, freeCastSpellId: id });
      }
    }
  }

  // Skilled and similar: proficiency choices among skills and tools.
  /**
   * R62 (D197): `skills` narrows the list to the ones the feat names (예리한 정신's five, 관찰력's three), and
   * `upgradeToExpertise` is those two feats' second sentence — "숙련이 없다면 숙련을, 이미 숙련되어 있다면
   * 전문화를". Without it the pick silently did nothing for a character who already had the skill.
   */
  const proficiencyChoice = config.proficiencyChoice as { count: number; kinds: string[]; skills?: string[]; upgradeToExpertise?: boolean } | undefined;
  if (proficiencyChoice) {
    const skills = proficiencyChoice.skills?.length ? proficiencyChoice.skills : "any";
    const options = [
      ...(proficiencyChoice.kinds.includes("skill") ? skillOptions(catalog, skills, (id) => ledger.hasSkill(id) && !proficiencyChoice.upgradeToExpertise) : []),
      ...(proficiencyChoice.kinds.includes("tool") ? allToolOptions(catalog, (id) => ledger.tools.has(id)) : []),
    ];
    const label = proficiencyChoice.kinds.includes("tool") ? "숙련 (기술 또는 도구)" : proficiencyChoice.upgradeToExpertise ? "숙련 (이미 숙련이면 전문화)" : "기술 숙련";
    const picked = ledger.ask({ ...ask, id: `${prefix}.proficiencies`, label, count: proficiencyChoice.count, options });
    for (const id of picked) {
      if (!catalog.skills[id]) { ledger.tools.set(id, toolName(catalog, id)); continue; }
      if (proficiencyChoice.upgradeToExpertise && ledger.hasSkill(id)) ledger.addExpertise(id, feat.name);
      else ledger.addSkill(id, feat.name);
    }
  }

  /** R62 (D197): 기술의 은총 — proficiency in every skill, no question to ask. */
  if (config.allSkillProficiencies === true) for (const id of Object.keys(catalog.skills)) if (!ledger.hasSkill(id)) ledger.addSkill(id, feat.name);

  /**
   * R62 (D197): expertise on a skill this character is already proficient in. `expertiseChoice: { count }` asks for
   * that many; a skill without proficiency is not offered, because expertise doubles a bonus that has to exist.
   */
  const expertiseChoice = config.expertiseChoice as { count?: number; skills?: string[] } | undefined;
  if (expertiseChoice) {
    const options = skillOptions(catalog, expertiseChoice.skills?.length ? expertiseChoice.skills : "any", (id) => !ledger.hasSkill(id) || ledger.hasExpertise(id));
    const picked = ledger.ask({ ...ask, id: `${prefix}.expertise`, label: "전문화 (숙련된 기술)", count: expertiseChoice.count ?? 1, options });
    for (const id of picked) ledger.addExpertise(id, feat.name);
  }

  /**
   * R62 (D197): 회복력 — "위에서 올린 능력치의 내성 굴림에 숙련". `follows: "ability-increase"` takes the ability
   * the feat already asked for rather than asking a second time; `any` is there for a feat that does ask.
   */
  const saveChoice = config.saveProficiencyChoice as { any?: string[]; follows?: string } | undefined;
  if (saveChoice) {
    if (saveChoice.follows === "ability-increase") { if (raised && !ledger.saves.has(raised)) ledger.saves.set(raised, feat.name); }
    else {
      const keys = (saveChoice.any?.length ? saveChoice.any : [...ABILITY_KEYS]).filter((key): key is AbilityKey => (ABILITY_KEYS as readonly string[]).includes(key));
      const picked = ledger.ask({ ...ask, id: `${prefix}.save`, label: "내성 굴림 숙련", count: 1, options: abilityOptions(keys) });
      for (const key of picked) if (!ledger.saves.has(key as AbilityKey)) ledger.saves.set(key as AbilityKey, feat.name);
    }
  }

  /** R62 (D197): 에너지 저항의 은총 — resistance to damage types the player picks, rather than a fixed list. */
  const resistanceChoice = config.resistanceChoice as { count?: number; any?: string[] } | undefined;
  if (resistanceChoice?.any?.length) {
    const picked = ledger.ask({ ...ask, id: `${prefix}.resistances`, label: "저항할 피해 유형", count: resistanceChoice.count ?? 1, options: damageTypeOptions(resistanceChoice.any, (type) => ledger.resistances.has(type)) });
    for (const type of picked) ledger.resistances.add(type);
  }

  /**
   * R62 (D197): 원소 숙련자 — "자신이 시전한 주문은 선택한 피해 유형에 대한 저항을 무시한다". The resolver has
   * carried `ignoresResistance` since R51; what was missing was anything that could name the type.
   */
  const ignoreChoice = config.ignoreResistanceChoice as { count?: number; any?: string[] } | undefined;
  if (ignoreChoice?.any?.length) {
    const picked = ledger.ask({ ...ask, id: `${prefix}.ignore-resistance`, label: "저항을 무시할 피해 유형", count: ignoreChoice.count ?? 1, options: damageTypeOptions(ignoreChoice.any, (type) => ledger.ignoresResistance.has(type)) });
    for (const type of picked) ledger.ignoresResistance.add(type);
  }

  /** R62 (D197): 무기 달인 — one more weapon whose mastery property this character may use. */
  const masteryChoice = config.weaponMasteryChoice as { count?: number; filter?: string } | undefined;
  if (masteryChoice) {
    const picked = ledger.ask({ ...ask, id: `${prefix}.weapon-mastery`, label: "무기 통달", description: "고른 무기의 통달 속성을 쓸 수 있습니다. 긴 휴식마다 하나를 바꿀 수 있습니다.", count: masteryChoice.count ?? 1, options: weaponMasteryOptions(catalog, masteryChoice.filter ?? "all-simple-or-martial", ledger.weapons) });
    for (const id of picked) ledger.weaponMasteries.add(id);
  }

  /**
   * R62 (D197): spells a feat simply hands over. `grantCantrips` are learned outright (염동력's 마법사의 손);
   * `grantSpells` are always prepared with one free casting per long rest each (요정의 손길's 안개 걸음, 그림자의
   * 손길's 투명화, 텔레파시 능력's 생각 탐지); `grantSpellChoice` asks for a filtered list (의식 시전자's rituals).
   * The school-restricted half of 요정의 손길 and 그림자의 손길 stays the table's: a school is not in the index.
   * The casting ability is "이 재주로 올린 능력치" unless the config names one.
   */
  const strings = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
  const grantCantrips = strings(config.grantCantrips);
  const grantSpells = strings(config.grantSpells);
  const grantChoice = config.grantSpellChoice as { count?: number | string; spellList?: string[]; levels?: number[]; ritual?: boolean } | undefined;
  if (grantCantrips.length || grantSpells.length || grantChoice) {
    const ability = (config.grantSpellAbility as AbilityKey | undefined) ?? raised ?? "cha";
    const lists = (grantChoice?.spellList?.length ? grantChoice.spellList : ["wizard"]).map((slug) => catalog.classBySlug(slug)).filter((item) => item !== undefined);
    const anchor = lists[0];
    if (anchor) {
      const entry = ledger.spellcastingEntry(`feat:${instance.key}:${feat.id}:grant`, () => ({ classId: anchor.id, className: feat.name, ability, cantripsMax: 0, preparedMax: 0 }));
      entry.ability = ability;
      for (const id of grantCantrips) entry.cantrips.add(id);
      for (const id of grantSpells) {
        entry.alwaysPrepared.add(id);
        entry.freeCasts.push(id);
        ledger.addResource({ id: `resource.${prefix}.${id}`, label: `${feat.name}: ${catalog.spellById(id)?.name ?? id} 무료 시전`, max: 1, recovery: resetKo(typeof config.freeCastReset === "string" ? config.freeCastReset : "long-rest"), source: feat.name, freeCastSpellId: id });
      }
      if (grantChoice) {
        const count = grantChoice.count === "proficiency-bonus" ? ledger.proficiencyBonus : typeof grantChoice.count === "number" ? grantChoice.count : 1;
        const levels = grantChoice.levels?.length ? grantChoice.levels : [1];
        const options = spellOptions(catalog, lists.map((item) => item.id), levels, (spell) => !grantChoice.ritual || spell.ritual);
        const picked = ledger.ask({ ...ask, id: `${prefix}.granted-spells`, label: grantChoice.ritual ? "의식 주문 (항상 준비)" : "주문 (항상 준비)", count, options });
        for (const id of picked) entry.alwaysPrepared.add(id);
      }
    }
  }

  // Alert: initiative proficiency.
  if (feat.grants.includes("initiative-proficiency")) ledger.flags.add("initiative-proficiency");
  // Fighting styles keep their flag for the features that name a style by slug; the numbers come from the config below.
  if (feat.tier === "fighting-style") {
    const slug = feat.id.split(".").pop() ?? feat.id;
    ledger.flags.add(`fighting-style:${slug}`);
  }

  /**
   * R51 (D186): a feat may carry its own pools. `resources: [{ id, label, max, reset }]`, where `max` is a number or
   * `"proficiency-bonus"`. Until this a feat could describe a per-rest ability but had nothing to spend, which is
   * exactly why 운명의 은총's own `execution.reason` reads "needs feat-granted resources … before the 2d4
   * interceptor can be paid". A contract keyed `feat:<slug>` names the same id in its `payments`.
   */
  const pools = config.resources as Array<{ id?: string; label?: string; max?: number | string; reset?: string }> | undefined;
  for (const pool of pools ?? []) {
    const slug = feat.id.split(".").pop() ?? feat.id;
    const id = pool.id ?? `resource.feat.${slug}`;
    const max = pool.max === "proficiency-bonus" ? ledger.proficiencyBonus : typeof pool.max === "number" ? pool.max : 1;
    if (max > 0) ledger.addResource({ id, label: pool.label ?? feat.name, max, recovery: resetKo(pool.reset ?? "long-rest"), source: feat.name });
  }

  // R33 (D168): the mechanical numbers. Every one of these keys used to sit in the code as a constant next to a
  // `fighting-style:` flag; an installed feat carrying the same key now gets the same treatment without a code change.
  const armorAc = config.armorAcBonus;
  if (typeof armorAc === "number") ledger.featEffects.armorAcBonus.push({ source: feat.name, value: armorAc });
  const rangedAttack = config.rangedWeaponAttackBonus;
  if (typeof rangedAttack === "number") ledger.featEffects.rangedWeaponAttackBonus.push({ source: feat.name, value: rangedAttack });
  const dieMinimum = featDieMinimum(config, feat.name);
  if (dieMinimum) ledger.featEffects.damageDieMinimum.push(dieMinimum);
  if (config.oncePerTurn === "reroll-weapon-damage-use-either") ledger.featEffects.rerollWeaponDamage.push(feat.name);
  if (typeof config.lightExtraAttackAbilityModifier === "string") ledger.featEffects.lightOffHandAbilityModifier.push(feat.name);
  if (typeof config.truesight === "number") ledger.senses.truesight = Math.max(ledger.senses.truesight ?? 0, config.truesight);
  if (typeof config.darkvision === "number") ledger.senses.darkvision = Math.max(ledger.senses.darkvision ?? 0, config.darkvision);
  if (typeof config.speedBonus === "number") ledger.speedBonus += config.speedBonus;
  if (typeof config.hitPointsPerLevel === "number") { ledger.hpPerLevelBonus += config.hitPointsPerLevel; ledger.hpPerLevelSource = feat.name; }
  for (const key of ABILITY_KEYS) {
    const save = config[`${key}SaveProficiency`];
    if (save === true && !ledger.saves.has(key)) ledger.saves.set(key, feat.name);
  }
  const resistances = config.resistances as string[] | undefined;
  for (const type of resistances ?? []) ledger.resistances.add(type);
  const languages = config.languages as string[] | undefined;
  for (const id of languages ?? []) ledger.languages.set(id, catalog.languages.standard.concat(catalog.languages.general).find((language) => language.id === id)?.name ?? id);
  void ABILITY_KO;
}
