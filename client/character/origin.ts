/**
 * Origin: species and background. Species traits (with level gates), lineage/ancestry/legacy choices and their
 * effects (cantrips, always-prepared spells by level, speed, darkvision, resistances, extra features), species
 * resources; background ability increases (+2/+1 or +1/+1/+1), skills, tool, origin feat and the shared languages.
 */
import type { SpeciesChoice, SpeciesView } from "../catalog/catalog";
import type { AbilityKey } from "../catalog/types";
import { ABILITY_KO } from "../catalog/types";
import { SIZE_KO } from "../rules/tables";
import type { SpeciesOptionEffect } from "../catalog/catalog";
import { abilityOptions, featOptions, fixedOptions, gamingSetOptions, languageOptions, skillOptions, toolName } from "./choices";
import { slugOfId } from "../catalog/catalog";
import { applyFeat } from "./feats";
import { applyGainContract } from "./tracks";
import type { Ledger } from "./ledger";

const DAMAGE_KO: Record<string, string> = { acid: "산성", cold: "냉기", fire: "화염", lightning: "번개", poison: "독", necrotic: "사령", radiant: "광휘", thunder: "천둥", psychic: "정신", force: "역장", bludgeoning: "타격", piercing: "관통", slashing: "참격" };
export const damageTypeKo = (type: string) => DAMAGE_KO[type] ?? type;

function speciesEffect(species: SpeciesView, choiceId: string, optionId: string): SpeciesOptionEffect | undefined {
  const authored = species.effects[choiceId]?.[optionId];
  if (authored) return authored;
  const semantic = species.semantics.byChoice?.[choiceId]?.[optionId];
  if (!semantic) return undefined;
  return {
    cantrips: semantic.cantrips,
    spellsByLevel: semantic.prepared ? { 1: semantic.prepared } : undefined,
    speed: semantic.speed,
    features: semantic.features?.map((name) => ({ name, nameEn: name, description: name })),
  };
}

export function applySpecies(ledger: Ledger) {
  const { catalog, source } = ledger;
  const species = catalog.speciesById(source.origin.speciesId);
  if (!species) {
    if (source.origin.speciesId) ledger.blocking.push(`종족 "${source.origin.speciesId}"을(를) 찾을 수 없습니다.`);
    else ledger.blocking.push("종족을 고르세요.");
    return;
  }
  const sourceLabel = `종족 · ${species.name}`;
  const ask = { scope: "origin" as const, sourceLabel };
  ledger.speedBase = species.speed;
  if (species.darkvision) ledger.senses.darkvision = Math.max(ledger.senses.darkvision ?? 0, species.darkvision);
  ledger.size = species.sizes.length === 1 ? species.sizes[0] : (ledger.askOne({ ...ask, id: "origin.species.size", label: "크기", options: species.sizes.map((size) => ({ id: size, name: SIZE_KO[size] ?? size })) }) ?? species.sizes[0]);

  for (const trait of species.traits) {
    if (trait.minLevel && ledger.level < trait.minLevel) continue;
    ledger.addFeature({ id: trait.id, name: trait.name, nameEn: trait.nameEn, source: "species", sourceLabel, level: trait.minLevel, description: trait.description, descriptionSource: trait.descriptionSource });
    // H7a (D251): what a trait grants — hit points, resistances, pools — is in its gain contract.
    applyGainContract(ledger, undefined, -1, trait.id, trait.name, species.name);
  }

  const cantrips = new Set<string>(species.semantics.baseCantrips ?? []);
  const spellsByLevel: Record<number, string[]> = {};
  for (const names of [species.semantics.basePrepared ?? []]) if (names.length) spellsByLevel[1] = [...(spellsByLevel[1] ?? []), ...names];
  let castingAbility: AbilityKey | undefined;

  for (const choice of species.choices) {
    const options = speciesChoiceOptions(ledger, choice);
    const id = `origin.${choice.id}`;
    const picked = ledger.ask({ ...ask, id, label: choice.label, description: choice.description, count: choice.count, options });
    if (choice.options === "any-skill") { for (const skill of picked) ledger.addSkill(skill, species.name); continue; }
    if (choice.options === "any-origin-feat") {
      for (const featId of picked) {
        const feat = catalog.featById(featId);
        if (feat) applyFeat(ledger, feat, { key: "species.originFeat", sourceLabel });
      }
      continue;
    }
    if (choice.options === "spellcasting-ability") { castingAbility = picked[0] as AbilityKey | undefined; continue; }
    for (const optionId of picked) {
      const option = choice.options.find((item) => item.id === optionId);
      // Option lists made of skill ids (the elf's Keen Senses) grant the skill.
      if (catalog.skills[optionId] && choice.options.every((item) => catalog.skills[item.id])) { ledger.addSkill(optionId, `${species.name} ${choice.label}`); continue; }
      const effect = speciesEffect(species, choice.id, optionId);
      if (option) ledger.addFeature({ id: `${species.id}.${choice.id}.${optionId}`, name: `${choice.label}: ${option.name}`, nameEn: option.nameEn, source: "species", sourceLabel, description: option.summary, descriptionSource: "srd-summary" });
      if (!effect) continue;
      for (const name of effect.cantrips ?? []) cantrips.add(name);
      for (const [level, names] of Object.entries(effect.spellsByLevel ?? {})) spellsByLevel[Number(level)] = [...(spellsByLevel[Number(level)] ?? []), ...names];
      if (effect.speed) ledger.speedBase = effect.speed;
      if (effect.darkvision) ledger.senses.darkvision = Math.max(ledger.senses.darkvision ?? 0, effect.darkvision);
      for (const type of effect.resistances ?? []) ledger.resistances.add(type);
      for (const feature of effect.features ?? []) ledger.addFeature({ id: `${species.id}.${choice.id}.${optionId}.${feature.nameEn}`, name: feature.name, nameEn: feature.nameEn, source: "species", sourceLabel, description: feature.description, descriptionSource: "srd-summary" });
    }
  }

  const spellNames = Object.entries(spellsByLevel).filter(([level]) => Number(level) <= ledger.level).flatMap(([, names]) => names);
  if (cantrips.size > 0 || spellNames.length > 0) {
    const ability = castingAbility ?? bestCastingAbility(ledger);
    const entry = ledger.spellcastingEntry("species", () => ({ classId: "species", className: `종족 주문 (${species.name})`, ability, cantripsMax: 0, preparedMax: 0 }));
    entry.ability = ability;
    for (const name of cantrips) { const spell = catalog.spellByName(name); if (spell) entry.cantrips.add(spell.id); else ledger.warnings.push(`종족 소마법 "${name}"을(를) 찾을 수 없습니다.`); }
    for (const name of spellNames) {
      const spell = catalog.spellByName(name);
      if (!spell) { ledger.warnings.push(`종족 주문 "${name}"을(를) 찾을 수 없습니다.`); continue; }
      entry.alwaysPrepared.add(spell.id);
      entry.freeCasts.push(spell.id);
      const usesPb = species.semantics.spellUses === "proficiency-bonus";
      ledger.addResource({ id: `resource.species.spell.${spell.id}`, label: `${spell.name} 무료 시전`, max: usesPb ? ledger.proficiencyBonus : 1, recovery: "긴 휴식", source: species.name, freeCastSpellId: spell.id });
    }
    if (!castingAbility && species.choices.some((choice) => choice.options === "spellcasting-ability")) ledger.warnings.push("종족 주문의 시전 능력치를 고르세요.");
  }
}

function bestCastingAbility(ledger: Ledger): AbilityKey {
  const keys: AbilityKey[] = ["int", "wis", "cha"];
  return keys.reduce((best, key) => (ledger.abilityScore(key) > ledger.abilityScore(best) ? key : best), "cha");
}

function speciesChoiceOptions(ledger: Ledger, choice: SpeciesChoice) {
  const { catalog } = ledger;
  if (choice.options === "any-skill") return skillOptions(catalog, "any", (id) => ledger.hasSkill(id));
  if (choice.options === "any-origin-feat") return featOptions(catalog, ["origin"], { level: ledger.level, abilityScore: (key) => ledger.abilityScore(key), taken: (id) => ledger.feats.some((feat) => feat.id === id), hasSpellcasting: ledger.hasSpellcasting(), hasFightingStyle: false });
  if (choice.options === "spellcasting-ability") return abilityOptions(["int", "wis", "cha"]);
  return fixedOptions(choice.options);
}

/** `calligrapher-supplies` / `thieves-tools` / a full id → the catalog tool id. */
export function resolveToolId(ledger: Ledger, ref: string): string {
  const { catalog } = ledger;
  if (catalog.itemById(ref)) return ref;
  const candidates = [ref, ref.replace(/-(supplies|tools)$/, "s-$1"), ref.replace(/s-(supplies|tools)$/, "-$1")];
  // V1b (D253): a tool named by its slug is found among the catalog's tools, whatever module prefix its id has.
  return catalog.items.find((item) => item.kind === "tool" && candidates.includes(slugOfId(item.id)))?.id ?? ref;
}

export function applyBackground(ledger: Ledger) {
  const { catalog, source } = ledger;
  const background = catalog.backgroundById(source.origin.backgroundId);
  if (!background) {
    if (source.origin.backgroundId) ledger.blocking.push(`배경 "${source.origin.backgroundId}"을(를) 찾을 수 없습니다.`);
    else ledger.blocking.push("배경을 고르세요.");
    return;
  }
  const sourceLabel = `배경 · ${background.name}`;
  const ask = { scope: "origin" as const, sourceLabel };
  ledger.addFeature({ id: background.id, name: background.name, nameEn: background.nameEn, source: "background", sourceLabel, description: background.description, descriptionSource: background.scope === "installed" ? "module" : "srd-summary" });

  const abilityNames = background.abilityChoices.map((key) => ABILITY_KO[key]).join("·");
  const mode = ledger.askOne({ ...ask, id: "origin.background.abilityMode", label: "능력치 증가 방식", description: `${abilityNames} 중에서 배분합니다.`, options: [
    { id: "2+1", name: "한 능력치 +2, 다른 능력치 +1" }, { id: "1+1+1", name: "세 능력치 모두 +1" },
  ] });
  if (mode === "1+1+1") {
    for (const key of background.abilityChoices) ledger.addAbilityBonus(key, 1, sourceLabel);
  } else if (mode === "2+1") {
    const plus2 = ledger.askOne({ ...ask, id: "origin.background.abilityPlus2", label: "+2 능력치", options: abilityOptions(background.abilityChoices, (key) => ledger.abilityScore(key), 2) }) as AbilityKey | undefined;
    if (plus2) ledger.addAbilityBonus(plus2, 2, sourceLabel);
    const plus1 = ledger.askOne({ ...ask, id: "origin.background.abilityPlus1", label: "+1 능력치", options: abilityOptions(background.abilityChoices, (key) => ledger.abilityScore(key), 1).map((option) => (option.id === plus2 ? { ...option, disabledReason: "+2를 받음" } : option)) }) as AbilityKey | undefined;
    if (plus1) ledger.addAbilityBonus(plus1, 1, sourceLabel);
  }

  for (const skill of background.skills) ledger.addSkill(skill, background.name);
  if (background.tool) {
    const id = resolveToolId(ledger, background.tool);
    ledger.tools.set(id, toolName(catalog, id));
  }
  if (background.toolChoice) {
    const options = background.toolChoice === "gaming-set" ? gamingSetOptions(catalog, (id) => ledger.tools.has(id)) : [];
    const picked = ledger.askOne({ ...ask, id: "origin.background.tool", label: "도구 숙련", options });
    if (picked) ledger.tools.set(picked, toolName(catalog, picked));
  }

  if (!background.originFeat) return;
  const feat = catalog.featById(background.originFeat);
  if (feat) applyFeat(ledger, feat, { key: "background", sourceLabel, preset: background.originFeatPreset });
  else ledger.warnings.push(`배경의 기원 재주 "${background.originFeat}"을(를) 찾을 수 없습니다.`);
}

/** Every character knows Common and two standard languages of choice. */
export function applyLanguages(ledger: Ledger) {
  const { catalog } = ledger;
  ledger.languages.set("common", "공용어");
  const picked = ledger.ask({ scope: "languages", sourceLabel: "언어", id: "origin.languages", label: "언어 (공용어 외 2개)", count: 2, options: languageOptions(catalog, "standard", (id) => ledger.languages.has(id)) });
  for (const id of picked) ledger.languages.set(id, catalog.languages.standard.find((language) => language.id === id)?.name ?? id);
}
