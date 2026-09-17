/**
 * The grant ledger: everything the derivation accumulates while walking origin → tracks, plus the choice registry.
 * `ask()` registers a choice request and returns the answers the source already holds for it (validated against the
 * options), so later steps can read earlier answers in the same pass.
 */
import type { ContentCatalog } from "../catalog/catalog";
import type { AbilityKey } from "../catalog/types";
import { ABILITY_KEYS } from "../catalog/types";
import { abilityModifier, proficiencyBonusForLevel, ABILITY_SCORE_MAX } from "../rules/tables";
import type { ArmorTraining, WeaponTraining } from "../rules/classes";
import type { FeatBonus, FeatDieMinimum } from "./featRules";
import type { CharacterSource, ChoiceOption, ChoiceRequest, ChoiceScope, DerivedFeature, DerivedItem, DerivedResource } from "./types";

export interface AbilityBonus { source: string; value: number; cap?: number }

export interface SpellcastingAccumulator {
  key: string;
  classId: string;
  className: string;
  ability: AbilityKey;
  cantrips: Set<string>;
  /** Cantrips granted outside the class count (Blessed Warrior, Pact of the Tome). */
  extraCantrips: Set<string>;
  prepared: Set<string>;
  alwaysPrepared: Set<string>;
  spellbook?: Set<string>;
  cantripsMax: number;
  preparedMax: number;
  /** Spells prepared through class features that cast once free per long rest (species, feats). */
  freeCasts: string[];
}

export interface ClassState {
  classId: string;
  slug: string;
  name: string;
  level: number;
  firstTrack: number;
  subclassId?: string;
  subclassChoices: Record<string, string>;
  hitDie: number;
}

export interface AskRequest {
  id: string;
  scope: ChoiceScope;
  sourceLabel: string;
  trackIndex?: number;
  label: string;
  description?: string;
  count: number;
  minimum?: number;
  options: ChoiceOption[];
  optional?: boolean;
  /** Allow answers outside the option list (free text ids such as installed content). */
  allowUnknown?: boolean;
}

export class Ledger {
  readonly choices: ChoiceRequest[] = [];
  readonly abilityBonuses: Record<AbilityKey, AbilityBonus[]> = { str: [], dex: [], con: [], int: [], wis: [], cha: [] };
  readonly skills = new Map<string, { proficient: string[]; expertise: string[] }>();
  readonly saves = new Map<AbilityKey, string>();
  readonly armor = new Set<ArmorTraining>();
  readonly weapons = new Set<WeaponTraining>();
  readonly tools = new Map<string, string>();
  readonly languages = new Map<string, string>();
  readonly features: DerivedFeature[] = [];
  readonly feats: Array<{ id: string; name: string; tier: string; source: string; instanceKey: string }> = [];
  readonly resources: DerivedResource[] = [];
  readonly spellcasting = new Map<string, SpellcastingAccumulator>();
  readonly classes = new Map<string, ClassState>();
  readonly flags = new Set<string>();
  readonly resistances = new Set<string>();
  /** R62 (D197): damage types this character's own damage ignores resistance to (원소 숙련자). */
  readonly ignoresResistance = new Set<string>();
  readonly immunities = new Set<string>();
  readonly conditionImmunities = new Set<string>();
  readonly weaponMasteries = new Set<string>();
  /**
   * R33 (D168): the numbers the feat catalog hands the derivation. They are entries rather than a single total so
   * the sheet's AC and attack breakdowns can name the feat that paid for them, and so a second feat granting the
   * same key adds instead of overwriting.
   */
  readonly featEffects: {
    armorAcBonus: FeatBonus[];
    rangedWeaponAttackBonus: FeatBonus[];
    damageDieMinimum: FeatDieMinimum[];
    /** Feats whose weapon damage dice may be rerolled once a turn (야만적 공격자). */
    rerollWeaponDamage: string[];
    /** Feats that keep the ability modifier on a Light weapon's extra attack (쌍수 전투). */
    lightOffHandAbilityModifier: string[];
  } = { armorAcBonus: [], rangedWeaponAttackBonus: [], damageDieMinimum: [], rerollWeaponDamage: [], lightOffHandAbilityModifier: [] };
  readonly inventory: DerivedItem[] = [];
  readonly blocking: string[] = [];
  readonly warnings: string[] = [];
  gold = 0;
  speedBase = 30;
  speedBonus = 0;
  extraSpeeds: { climb?: number; swim?: number; fly?: number } = {};
  /** H3 (D240): per class id, other classes whose spell lists it may choose from (마법의 비밀). */
  readonly extraSpellLists = new Map<string, string[]>();
  senses: { darkvision?: number; blindsight?: number; truesight?: number } = {};
  size = "medium";
  hpPerLevelBonus = 0;
  hpPerLevelSource: string | undefined;
  hpFlatBonus = 0;
  initiativeBonus = 0;
  private instanceCounter = 0;

  constructor(readonly source: CharacterSource, readonly catalog: ContentCatalog) {}

  get level() { return this.source.tracks.length; }
  get proficiencyBonus() { return proficiencyBonusForLevel(Math.max(1, this.level)); }

  /** Ability score so far (base + every bonus registered up to now), capped per bonus. */
  abilityScore(key: AbilityKey) {
    let score = this.source.abilities.base[key] ?? 10;
    for (const bonus of this.abilityBonuses[key]) score = Math.min(bonus.cap ?? ABILITY_SCORE_MAX, score + bonus.value);
    return score;
  }
  abilityMod(key: AbilityKey) { return abilityModifier(this.abilityScore(key)); }
  abilities(): Record<AbilityKey, number> {
    const out = {} as Record<AbilityKey, number>;
    for (const key of ABILITY_KEYS) out[key] = this.abilityScore(key);
    return out;
  }

  addAbilityBonus(key: AbilityKey, value: number, source: string, cap?: number) {
    this.abilityBonuses[key].push({ source, value, cap });
  }

  addSkill(id: string, source: string) {
    const entry = this.skills.get(id) ?? { proficient: [], expertise: [] };
    entry.proficient.push(source);
    this.skills.set(id, entry);
  }
  addExpertise(id: string, source: string) {
    const entry = this.skills.get(id) ?? { proficient: [], expertise: [] };
    entry.expertise.push(source);
    this.skills.set(id, entry);
  }
  hasSkill(id: string) { return (this.skills.get(id)?.proficient.length ?? 0) > 0; }
  hasExpertise(id: string) { return (this.skills.get(id)?.expertise.length ?? 0) > 0; }

  /** H2 (D239): record what a feature was taken for; a repeatable option picked twice keeps both. */
  addFeatureTarget(featureId: string, target: string) {
    const feature = this.features.find((item) => item.id === featureId);
    if (feature && !(feature.targets ?? []).includes(target)) feature.targets = [...(feature.targets ?? []), target];
  }

  addFeature(feature: DerivedFeature) {
    if (this.features.some((item) => item.id === feature.id && item.sourceLabel === feature.sourceLabel)) return;
    this.features.push(feature);
  }

  /** Register a pool; the short-rest restore rule is read from the recovery text unless given. */
  addResource(input: Omit<DerivedResource, "restore"> & { restore?: DerivedResource["restore"] }) {
    const text = input.recovery;
    const short: DerivedResource["restore"]["short"] = input.restore?.short ?? (text.includes("짧은 휴식마다 1회") ? 1 : text.includes("절반") ? Math.ceil(input.max / 2) : text.startsWith("짧은 휴식") ? "all" : 0);
    const resource: DerivedResource = { ...input, restore: { short } };
    const existing = this.resources.findIndex((item) => item.id === resource.id);
    if (existing >= 0) this.resources[existing] = resource; else this.resources.push(resource);
  }

  spellcastingEntry(key: string, init: () => Omit<SpellcastingAccumulator, "key" | "cantrips" | "extraCantrips" | "prepared" | "alwaysPrepared" | "freeCasts">) {
    let entry = this.spellcasting.get(key);
    if (!entry) {
      entry = { key, cantrips: new Set(), extraCantrips: new Set(), prepared: new Set(), alwaysPrepared: new Set(), freeCasts: [], ...init() };
      this.spellcasting.set(key, entry);
    }
    return entry;
  }

  hasSpellcasting() { return this.spellcasting.size > 0 || this.flags.has("pact-magic") || [...this.flags].some((flag) => flag.startsWith("spellcasting:")); }

  classBySlug(slug: string) { return [...this.classes.values()].find((state) => state.slug === slug); }
  classLevel(slug: string) { return this.classBySlug(slug)?.level ?? 0; }

  nextInstance(prefix: string) { this.instanceCounter += 1; return `${prefix}#${this.instanceCounter}`; }

  /** Register a choice and return the validated answers the source holds for it. */
  ask(request: AskRequest): string[] {
    const raw = this.source.choices[request.id] ?? [];
    const optionIds = new Set(request.options.filter((option) => !option.disabledReason).map((option) => option.id));
    const seen = new Set<string>();
    const selected: string[] = [];
    for (const value of raw) {
      if (seen.has(value)) continue;
      if (!optionIds.has(value) && !request.allowUnknown) continue;
      seen.add(value);
      selected.push(value);
      if (selected.length >= request.count) break;
    }
    const minimum = request.minimum ?? request.count;
    const satisfied = request.optional === true || selected.length >= Math.min(minimum, request.options.length === 0 && !request.allowUnknown ? 0 : minimum);
    const { allowUnknown: _unused, ...rest } = request;
    void _unused;
    this.choices.push({ ...rest, selected, satisfied });
    return selected;
  }

  /** A choice the source answers with exactly one value. */
  askOne(request: Omit<AskRequest, "count">): string | undefined {
    return this.ask({ ...request, count: 1 })[0];
  }
}
