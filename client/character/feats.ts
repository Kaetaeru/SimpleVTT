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
import { SPELLCASTING_ABILITY } from "../rules/classes";
import { abilityOptions, allToolOptions, skillOptions, spellOptions, toolName } from "./choices";
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
  ledger.addFeature({ id: `${prefix}`, name: feat.name, nameEn: feat.nameEn, source: "feat", sourceLabel: instance.sourceLabel, description: feat.description, descriptionSource: feat.scope === "installed" && feat.description ? "module" : "srd-summary" });
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

  // Generic ability increase (general feats +1 to one of a set, epic boons +1 up to 30).
  if (feat.abilityIncrease) {
    const keys = feat.abilityIncrease.any ?? ABILITY_KEYS;
    const cap = feat.abilityIncrease.maximum ?? ABILITY_SCORE_MAX;
    const key = keys.length === 1 ? keys[0] : ledger.askOne({ ...ask, id: `${prefix}.ability`, label: `+${feat.abilityIncrease.amount} 능력치`, options: abilityOptions(keys, (item) => ledger.abilityScore(item), feat.abilityIncrease.amount, cap) });
    if (key) ledger.addAbilityBonus(key as AbilityKey, feat.abilityIncrease.amount, `${instance.sourceLabel} · ${feat.name}`, cap);
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
      const entry = ledger.spellcastingEntry(`feat:${instance.key}:${feat.id}`, () => ({ classId: listClass.id, className: `${feat.name} (${listClass.name})`, ability: ability ?? SPELLCASTING_ABILITY[listSlug!] ?? "cha", cantripsMax: spellChoices.cantrips ?? 0, preparedMax: 0 }));
      if (ability) entry.ability = ability;
      const cantrips = ledger.ask({ ...ask, id: `${prefix}.cantrips`, label: `${listClass.name} 소마법`, count: spellChoices.cantrips ?? 0, options: spellOptions(catalog, [listClass.id], [0]) });
      for (const id of cantrips) entry.cantrips.add(id);
      const spells = ledger.ask({ ...ask, id: `${prefix}.spells`, label: `${listClass.name} 1레벨 주문 (항상 준비, 긴 휴식마다 1회 무료)`, count: spellChoices.level1Spells ?? 0, options: spellOptions(catalog, [listClass.id], [1]) });
      for (const id of spells) {
        entry.alwaysPrepared.add(id);
        entry.freeCasts.push(id);
        ledger.addResource({ id: `resource.${prefix}.${id}`, label: `${feat.name}: ${catalog.spellById(id)?.name ?? id} 무료 시전`, max: 1, recovery: "긴 휴식", source: feat.name });
      }
    }
  }

  // Skilled and similar: proficiency choices among skills and tools.
  const proficiencyChoice = config.proficiencyChoice as { count: number; kinds: string[] } | undefined;
  if (proficiencyChoice) {
    const options = [
      ...(proficiencyChoice.kinds.includes("skill") ? skillOptions(catalog, "any", (id) => ledger.hasSkill(id)) : []),
      ...(proficiencyChoice.kinds.includes("tool") ? allToolOptions(catalog, (id) => ledger.tools.has(id)) : []),
    ];
    const picked = ledger.ask({ ...ask, id: `${prefix}.proficiencies`, label: "숙련 (기술 또는 도구)", count: proficiencyChoice.count, options });
    for (const id of picked) {
      if (catalog.skills[id]) ledger.addSkill(id, feat.name); else ledger.tools.set(id, toolName(catalog, id));
    }
  }

  // Alert: initiative proficiency.
  if (feat.grants.includes("initiative-proficiency")) ledger.flags.add("initiative-proficiency");
  // Fighting styles.
  if (feat.tier === "fighting-style") {
    const slug = feat.id.split(".").pop() ?? feat.id;
    ledger.flags.add(`fighting-style:${slug}`);
  }
  if (typeof config.truesight === "number") ledger.senses.truesight = Math.max(ledger.senses.truesight ?? 0, config.truesight);
  if (typeof config.darkvision === "number") ledger.senses.darkvision = Math.max(ledger.senses.darkvision ?? 0, config.darkvision);
  if (typeof config.speedBonus === "number") ledger.speedBonus += config.speedBonus;
  if (typeof config.hitPointsPerLevel === "number") ledger.hpPerLevelBonus += config.hitPointsPerLevel;
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
