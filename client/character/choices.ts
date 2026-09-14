/**
 * Option builders for the choices the engine asks: skills, tools, languages, feats by tier, spells by class list and
 * level, invocations, metamagic, weapon masteries, abilities. Every builder returns `ChoiceOption[]` with Korean names
 * and disabled reasons instead of silently filtering, so the wizard can show why something cannot be picked.
 */
import type { ContentCatalog, FeatTier, FeatView, ItemView, SpellView } from "../catalog/catalog";
import type { AbilityKey } from "../catalog/types";
import { ABILITY_KEYS, ABILITY_KO } from "../catalog/types";
import { ABILITY_SCORE_MAX } from "../rules/tables";
import type { WeaponTraining } from "../rules/classes";
import type { ChoiceOption } from "./types";

export const SKILL_ABILITY: Record<string, AbilityKey> = {
  acrobatics: "dex", "animal-handling": "wis", arcana: "int", athletics: "str", deception: "cha", history: "int", insight: "wis", intimidation: "cha",
  investigation: "int", medicine: "wis", nature: "int", perception: "wis", performance: "cha", persuasion: "cha", religion: "int", "sleight-of-hand": "dex",
  stealth: "dex", survival: "wis",
};

export const INSTRUMENT_KO: Record<string, string> = {
  bagpipes: "백파이프", drum: "북", dulcimer: "덜시머", flute: "플루트", horn: "호른", lute: "류트", lyre: "리라", "pan-flute": "팬플루트", shawm: "숌", viol: "비올",
};
export const GAMING_SET_KO: Record<string, string> = { dice: "주사위 세트", dragonchess: "드래곤체스 세트", "playing-cards": "카드 세트", "three-dragon-ante": "삼룡 앤티 세트" };

export const TOOL_ID_PREFIX = "dnd.srd521.item.tool.";
export const instrumentToolId = (variant: string) => `${TOOL_ID_PREFIX}musical-instrument:${variant}`;
export const gamingSetToolId = (variant: string) => `${TOOL_ID_PREFIX}gaming-set:${variant}`;

export function skillOptions(catalog: ContentCatalog, filter?: string[] | "any", taken?: (id: string) => boolean): ChoiceOption[] {
  const ids = filter && filter !== "any" ? filter : Object.keys(catalog.skills);
  return ids.map((id) => ({
    id, name: catalog.skills[id] ?? id, nameEn: id, group: ABILITY_KO[SKILL_ABILITY[id] ?? "int"],
    ...(taken?.(id) ? { disabledReason: "이미 숙련" } : {}),
  }));
}

export function abilityOptions(keys: readonly AbilityKey[] = ABILITY_KEYS, scoreOf?: (key: AbilityKey) => number, increase = 1, cap = ABILITY_SCORE_MAX): ChoiceOption[] {
  return keys.map((key) => {
    const score = scoreOf?.(key);
    const disabled = score !== undefined && score + increase > cap;
    return { id: key, name: ABILITY_KO[key], nameEn: key.toUpperCase(), summary: score !== undefined ? `현재 ${score}` : undefined, ...(disabled ? { disabledReason: `${cap}을 넘길 수 없음` } : {}) };
  });
}

export function toolName(catalog: ContentCatalog, toolId: string) {
  const [base, variant] = toolId.split(":");
  const item = catalog.itemById(base);
  if (variant) {
    if (base.endsWith("musical-instrument")) return INSTRUMENT_KO[variant] ?? variant;
    if (base.endsWith("gaming-set")) return GAMING_SET_KO[variant] ?? variant;
    return `${item?.name ?? base} (${variant})`;
  }
  return item?.name ?? base;
}

export function instrumentOptions(catalog: ContentCatalog, taken?: (id: string) => boolean): ChoiceOption[] {
  return catalog.index.instrumentVariants.map((variant) => {
    const id = instrumentToolId(variant);
    return { id, name: INSTRUMENT_KO[variant] ?? variant, nameEn: variant, group: "악기", ...(taken?.(id) ? { disabledReason: "이미 숙련" } : {}) };
  });
}

export function gamingSetOptions(catalog: ContentCatalog, taken?: (id: string) => boolean): ChoiceOption[] {
  return catalog.index.gamingSetVariants.map((variant) => {
    const id = gamingSetToolId(variant);
    return { id, name: GAMING_SET_KO[variant] ?? variant, nameEn: variant, group: "게임 도구", ...(taken?.(id) ? { disabledReason: "이미 숙련" } : {}) };
  });
}

export function artisanToolOptions(catalog: ContentCatalog, taken?: (id: string) => boolean): ChoiceOption[] {
  return catalog.index.artisanToolIds.map((id) => ({ id, name: catalog.itemById(id)?.name ?? id, nameEn: catalog.itemById(id)?.nameEn, group: "장인 도구", ...(taken?.(id) ? { disabledReason: "이미 숙련" } : {}) }));
}

/** Every tool proficiency a character can hold: artisan tools, other kits, instruments and gaming sets by variant. */
export function allToolOptions(catalog: ContentCatalog, taken?: (id: string) => boolean): ChoiceOption[] {
  const variants = new Set(["musical-instrument", "gaming-set"]);
  const kits = catalog.items
    .filter((item) => item.kind === "tool" && !catalog.index.artisanToolIds.includes(item.id) && !variants.has(item.id.split(".").pop() ?? ""))
    .map((item): ChoiceOption => ({ id: item.id, name: item.name, nameEn: item.nameEn, group: "기타 도구", ...(taken?.(item.id) ? { disabledReason: "이미 숙련" } : {}) }));
  return [...artisanToolOptions(catalog, taken), ...kits, ...instrumentOptions(catalog, taken), ...gamingSetOptions(catalog, taken)];
}

export function languageOptions(catalog: ContentCatalog, pool: "standard" | "general", taken?: (id: string) => boolean): ChoiceOption[] {
  const list = pool === "standard" ? catalog.languages.standard : catalog.languages.general;
  return list.map((language) => ({ id: language.id, name: language.name, nameEn: language.nameEn, group: pool === "standard" ? "표준 언어" : "희귀 언어", ...(taken?.(language.id) ? { disabledReason: "이미 앎" } : {}) }));
}

export const FEAT_TIER_KO: Record<FeatTier, string> = { origin: "기원 재주", general: "일반 재주", "fighting-style": "전투 방식 재주", "epic-boon": "에픽 은총 재주" };

export interface FeatContext {
  level: number;
  abilityScore: (key: AbilityKey) => number;
  taken: (featId: string) => boolean;
  hasSpellcasting: boolean;
  hasFightingStyle: boolean;
}

export function featDisabledReason(feat: FeatView, context: FeatContext): string | undefined {
  if (!feat.repeatable && context.taken(feat.id)) return "이미 보유";
  if (feat.minimumLevel && context.level < feat.minimumLevel) return `${feat.minimumLevel}레벨 이상`;
  if (feat.abilityPrerequisite) {
    const ok = feat.abilityPrerequisite.any.some((key) => context.abilityScore(key) >= feat.abilityPrerequisite!.minimum);
    if (!ok) return `${feat.abilityPrerequisite.any.map((key) => ABILITY_KO[key]).join(" 또는 ")} ${feat.abilityPrerequisite.minimum} 이상`;
  }
  if (feat.requires === "spellcasting-feature" && !context.hasSpellcasting) return "주문 시전 특성 필요";
  if (feat.requires === "fighting-style-feature" && !context.hasFightingStyle) return "전투 방식 특성 필요";
  return undefined;
}

export function featOption(feat: FeatView, context: FeatContext): ChoiceOption {
  const reason = featDisabledReason(feat, context);
  return { id: feat.id, name: feat.name, nameEn: feat.nameEn, summary: feat.description?.split(/(?<=\.)\s/)[0], description: feat.description, group: FEAT_TIER_KO[feat.tier], ...(reason ? { disabledReason: reason } : {}) };
}

export function featOptions(catalog: ContentCatalog, tiers: FeatTier[], context: FeatContext, first?: string[]): ChoiceOption[] {
  const feats = catalog.feats.filter((feat) => tiers.includes(feat.tier));
  const order = (feat: FeatView) => {
    const index = first?.indexOf(feat.id) ?? -1;
    return index >= 0 ? index : 100 + tiers.indexOf(feat.tier);
  };
  return feats.sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name, "ko")).map((feat) => featOption(feat, context));
}

export const SPELL_LEVEL_KO = (level: number) => (level === 0 ? "소마법" : `${level}레벨`);

export function spellOption(spell: SpellView): ChoiceOption {
  return { id: spell.id, name: spell.name, nameEn: spell.nameEn, summary: spell.summary, description: spell.description, group: SPELL_LEVEL_KO(spell.level) };
}

/** Spells of the given class lists at the given levels, deduplicated and sorted by level then name. */
export function spellOptions(catalog: ContentCatalog, classIds: string[], levels: number[], filter?: (spell: SpellView) => boolean, disabled?: (spell: SpellView) => string | undefined): ChoiceOption[] {
  const seen = new Set<string>();
  const options: ChoiceOption[] = [];
  for (const level of levels) {
    for (const classId of classIds) {
      for (const spell of catalog.spellsFor(classId, level)) {
        if (seen.has(spell.id)) continue;
        if (filter && !filter(spell)) continue;
        seen.add(spell.id);
        const reason = disabled?.(spell);
        options.push({ ...spellOption(spell), ...(reason ? { disabledReason: reason } : {}) });
      }
    }
  }
  return options.sort((a, b) => (a.group ?? "").localeCompare(b.group ?? "", "ko") || a.name.localeCompare(b.name, "ko"));
}

export function invocationOptions(catalog: ContentCatalog, warlockLevel: number, selected: string[]): ChoiceOption[] {
  const list = catalog.classOptions["warlock.invocations"] ?? [];
  return list.map((option) => {
    let reason: string | undefined;
    if (option.minLevel && warlockLevel < option.minLevel) reason = `워락 ${option.minLevel}레벨 이상`;
    else if (option.prerequisiteOptionId && !selected.includes(option.prerequisiteOptionId)) {
      const needed = list.find((item) => item.id === option.prerequisiteOptionId);
      reason = `${needed?.name ?? option.prerequisiteOptionId} 필요`;
    }
    return { id: option.id, name: option.name, nameEn: option.nameEn, summary: option.description, description: option.description, group: option.minLevel && option.minLevel > 1 ? `${option.minLevel}레벨+` : "1레벨+", ...(reason ? { disabledReason: reason } : {}) };
  });
}

export function classOptionList(catalog: ContentCatalog, key: string): ChoiceOption[] {
  return (catalog.classOptions[key] ?? []).map((option) => ({ id: option.id, name: option.name, nameEn: option.nameEn, summary: option.description, description: option.description, ...(option.cost ? { group: `${option.cost}점` } : {}) }));
}

export type WeaponMasteryFilter = "simple-or-martial-melee" | "all-simple-or-martial" | "rogue-proficient" | string;

export function weaponIsProficient(item: ItemView, weapons: Set<WeaponTraining>) {
  const weapon = item.weapon;
  if (!weapon) return false;
  if (weapon.training === "simple") return weapons.has("simple");
  if (weapons.has("martial")) return true;
  const light = weapon.properties.includes("light");
  const finesse = weapon.properties.includes("finesse");
  if (weapons.has("martial-light") && light) return true;
  if (weapons.has("martial-finesse-or-light") && (light || finesse)) return true;
  return false;
}

export const MASTERY_KO: Record<string, string> = { cleave: "쪼개기", graze: "스치기", nick: "베기", push: "밀치기", sap: "약화", slow: "둔화", topple: "넘어뜨리기", vex: "교란" };

export function weaponMasteryOptions(catalog: ContentCatalog, filter: WeaponMasteryFilter, weapons: Set<WeaponTraining>): ChoiceOption[] {
  return catalog.items
    .filter((item) => item.kind === "weapon" && item.weapon?.mastery)
    .filter((item) => {
      const weapon = item.weapon!;
      if (filter === "simple-or-martial-melee") return weapon.mode === "melee";
      if (filter === "rogue-proficient") return weaponIsProficient(item, weapons);
      return true;
    })
    .map((item) => {
      const weapon = item.weapon!;
      const proficient = weaponIsProficient(item, weapons);
      return {
        id: item.id, name: item.name, nameEn: item.nameEn,
        summary: `${MASTERY_KO[weapon.mastery ?? ""] ?? weapon.mastery} · ${weapon.damage} ${weapon.damageType}`,
        group: `${weapon.training === "simple" ? "단순" : "군용"} ${weapon.mode === "melee" ? "근접" : "원거리"}`,
        ...(proficient ? {} : { disabledReason: "숙련 없음" }),
      };
    })
    .sort((a, b) => (a.group ?? "").localeCompare(b.group ?? "", "ko") || a.name.localeCompare(b.name, "ko"));
}

export function subclassOptions(catalog: ContentCatalog, classId: string): ChoiceOption[] {
  return catalog.subclassesOf(classId).map((subclass) => ({ id: subclass.id, name: subclass.name, nameEn: subclass.nameEn, summary: subclass.summary, description: subclass.description }));
}

export function fixedOptions(options: Array<{ id: string; name: string; nameEn?: string; summary?: string }>): ChoiceOption[] {
  return options.map((option) => ({ id: option.id, name: option.name, nameEn: option.nameEn, summary: option.summary }));
}
