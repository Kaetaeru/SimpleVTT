/**
 * Option builders for the choices the engine asks: skills, tools, languages, feats by tier, spells by class list and
 * level, invocations, metamagic, weapon masteries, abilities. Every builder returns `ChoiceOption[]` with Korean names
 * and disabled reasons instead of silently filtering, so the wizard can show why something cannot be picked.
 */
import type { ContentCatalog, FeatTier, FeatView, ItemView, SpellView } from "../catalog/catalog";
import type { AbilityKey } from "../catalog/types";
import { ABILITY_KEYS, ABILITY_KO } from "../catalog/types";
import { ABILITY_SCORE_MAX } from "../rules/tables";
import { damageTypeKey, damageTypeKo } from "../rules/resolve";
import type { WeaponTraining } from "../rules/classes";
import type { ChoiceOption } from "./types";

export const SKILL_ABILITY: Record<string, AbilityKey> = {
  acrobatics: "dex", "animal-handling": "wis", arcana: "int", athletics: "str", deception: "cha", history: "int", insight: "wis", intimidation: "cha",
  investigation: "int", medicine: "wis", nature: "int", perception: "wis", performance: "cha", persuasion: "cha", religion: "int", "sleight-of-hand": "dex",
  stealth: "dex", survival: "wis",
};

/**
 * V1b (D253): a tool or item that comes in variants names them in its own config — `variants`, `variantNames`
 * (the label of each), `variantGroup` (the choice lists that offer it: `instrument`, `gaming-set`) and
 * `variantLabel: "alone"` when a variant is called by its own name ("류트", not "악기 (류트)").
 */
export const variantNameOf = (item: { config: Record<string, unknown> } | undefined, variant: string) => (item?.config.variantNames as Record<string, string> | undefined)?.[variant] ?? variant;
const variantTool = (catalog: ContentCatalog, group: string) => catalog.items.find((item) => item.config.variantGroup === group);
function variantOptions(catalog: ContentCatalog, group: string, label: string, taken?: (id: string) => boolean): ChoiceOption[] {
  const base = variantTool(catalog, group);
  const variants = Array.isArray(base?.config.variants) ? (base!.config.variants as string[]) : [];
  return variants.map((variant) => {
    const id = `${base!.id}:${variant}`;
    return { id, name: variantNameOf(base, variant), nameEn: variant, group: label, ...(taken?.(id) ? { disabledReason: "이미 숙련" } : {}) };
  });
}

export function skillOptions(catalog: ContentCatalog, filter?: string[] | "any", taken?: (id: string) => boolean): ChoiceOption[] {
  const ids = filter && filter !== "any" ? filter : Object.keys(catalog.skills);
  return ids.map((id) => ({
    id, name: catalog.skills[id] ?? id, nameEn: id, group: ABILITY_KO[SKILL_ABILITY[id] ?? "int"],
    ...(taken?.(id) ? { disabledReason: "이미 숙련" } : {}),
  }));
}

/**
 * R62 (D197): damage types as choice options, for the feats that ask the player to name one (원소 숙련자's element,
 * 에너지 저항의 은총's two). Ids stay canonical English; the label is the Korean the rest of the sheet prints.
 */
export function damageTypeOptions(types: string[], taken?: (type: string) => boolean): ChoiceOption[] {
  return types.map((type) => ({ id: damageTypeKey(type), name: damageTypeKo(type), nameEn: damageTypeKey(type), ...(taken?.(damageTypeKey(type)) ? { disabledReason: "이미 선택" } : {}) }));
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
  if (variant) return item?.config.variantLabel === "alone" ? variantNameOf(item, variant) : `${item?.name ?? base} (${variantNameOf(item, variant)})`;
  return item?.name ?? base;
}

export function instrumentOptions(catalog: ContentCatalog, taken?: (id: string) => boolean): ChoiceOption[] {
  return variantOptions(catalog, "instrument", "악기", taken);
}

export function gamingSetOptions(catalog: ContentCatalog, taken?: (id: string) => boolean): ChoiceOption[] {
  return variantOptions(catalog, "gaming-set", "게임 도구", taken);
}

export function artisanToolOptions(catalog: ContentCatalog, taken?: (id: string) => boolean): ChoiceOption[] {
  return catalog.artisanToolIds.map((id) => ({ id, name: catalog.itemById(id)?.name ?? id, nameEn: catalog.itemById(id)?.nameEn, group: "장인 도구", ...(taken?.(id) ? { disabledReason: "이미 숙련" } : {}) }));
}

/** Every tool proficiency a character can hold: artisan tools, other kits, instruments and gaming sets by variant. */
export function allToolOptions(catalog: ContentCatalog, taken?: (id: string) => boolean): ChoiceOption[] {
  const variants = new Set(["musical-instrument", "gaming-set"]);
  const kits = catalog.items
    .filter((item) => item.kind === "tool" && !catalog.artisanToolIds.includes(item.id) && !variants.has(item.id.split(".").pop() ?? ""))
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
  /** D330: what this character is trained in, for a feat that asks for armour or a shield first. */
  training?: { armor: string[]; shield: boolean };
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
  // D330: the training a feat asks for before it may be taken (중갑 달인: heavy armour training).
  const armor = /^armor-training:(light|medium|heavy)$/.exec(feat.requires ?? "");
  if (armor && !(context.training?.armor ?? []).includes(armor[1])) return `${{ light: "경장", medium: "평장", heavy: "중장" }[armor[1]]} 방어구 훈련 필요`;
  if (feat.requires === "shield-training" && !context.training?.shield) return "방패 훈련 필요";
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

/**
 * The options of a list, with what keeps one out of reach: the class level it needs and the option it needs first
 * (D310 — the gates are the list's data, so a module's list is gated the same way as the SRD's invocations).
 */
export function classOptionList(catalog: ContentCatalog, key: string, gate?: { className: string; level: number; selected: string[] }): ChoiceOption[] {
  const list = catalog.classOptions[key] ?? [];
  const leveled = list.some((option) => option.minLevel && option.minLevel > 1);
  return list.map((option) => {
    let reason: string | undefined;
    if (gate && option.minLevel && gate.level < option.minLevel) reason = `${gate.className} ${option.minLevel}레벨 이상`;
    else if (gate && option.prerequisiteOptionId && !gate.selected.includes(option.prerequisiteOptionId)) reason = `${list.find((item) => item.id === option.prerequisiteOptionId)?.name ?? option.prerequisiteOptionId} 필요`;
    const group = option.cost ? `${option.cost}점` : leveled ? (option.minLevel && option.minLevel > 1 ? `${option.minLevel}레벨+` : "1레벨+") : undefined;
    return { id: option.id, name: option.name, nameEn: option.nameEn, summary: option.description, description: option.description, ...(group ? { group } : {}), ...(reason ? { disabledReason: reason } : {}) };
  });
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
