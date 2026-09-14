/**
 * Character model of the new client (CHARACTER_SYSTEM.md §4): the source (what the player chose), the derived
 * character (everything computed, never stored) and the runtime (usage). Only source and runtime are persisted.
 */
import type { AbilityKey } from "../catalog/types";

export type AbilityScores = Record<AbilityKey, number>;

export type HitPointChoiceValue = { kind: "fixed" } | { kind: "roll"; value: number };

/** One level gained, in the order it was gained. Class level = how many earlier tracks share the class + 1. */
export interface TrackLevel { classId: string; hp: HitPointChoiceValue }

export interface CharacterSource {
  schema: 2;
  id: string;
  name: string;
  portrait?: string;
  alignment?: string;
  notes?: { appearance?: string; personality?: string; backstory?: string };
  rules: { profile: string; modules: string[] };
  origin: { speciesId: string; backgroundId: string };
  abilities: { method: "point-buy" | "standard-array" | "manual"; base: AbilityScores };
  tracks: TrackLevel[];
  /**
   * Every answer the player gave, keyed by the choice id the engine asks for (`origin.species.lineage`,
   * `class.2.asi`, `feat.origin.dnd.srd521.feat.skilled.proficiencies` …). Unused answers are ignored.
   */
  choices: Record<string, string[]>;
  equipment: { mode: "loadout" | "gold"; startingGold?: number };
  xp?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChoiceOption {
  id: string;
  name: string;
  nameEn?: string;
  summary?: string;
  description?: string;
  disabledReason?: string;
  /** Grouping hint for the UI (spell level, feat tier…). */
  group?: string;
}

export type ChoiceScope = "identity" | "abilities" | "origin" | "class" | "feat" | "equipment" | "languages";

export interface ChoiceRequest {
  id: string;
  scope: ChoiceScope;
  /** Where the choice comes from, for the wizard's grouping ("종족 · 엘프", "파이터 3레벨 · 서브클래스"). */
  sourceLabel: string;
  trackIndex?: number;
  label: string;
  description?: string;
  count: number;
  /** Minimum picks before the choice counts as answered; defaults to `count`. */
  minimum?: number;
  options: ChoiceOption[];
  selected: string[];
  satisfied: boolean;
  /** Optional choices (spell swaps) never block. */
  optional?: boolean;
}

export type FeatureSource = "class" | "subclass" | "species" | "background" | "feat" | "invocation" | "metamagic";

export interface DerivedFeature {
  id: string;
  name: string;
  nameEn?: string;
  source: FeatureSource;
  sourceLabel: string;
  level?: number;
  description?: string;
  descriptionSource?: "module" | "srd-summary";
}

export interface DerivedSkill { id: string; name: string; ability: AbilityKey; proficient: boolean; expertise: boolean; bonus: number }

export interface DerivedAttack {
  id: string;
  name: string;
  itemId?: string;
  ability: AbilityKey;
  attackBonus: number;
  damage: string;
  damageBonus: number;
  damageType: string;
  properties: string[];
  mastery?: string;
  masteryActive: boolean;
  range?: string;
}

export interface DerivedSpellcasting {
  /** `class:<classId>`, `species`, `feat:<instance>:<featId>`. */
  key: string;
  source: "class" | "species" | "feat";
  classId: string;
  className: string;
  ability: AbilityKey;
  saveDc: number;
  attackBonus: number;
  cantrips: string[];
  prepared: string[];
  alwaysPrepared: string[];
  spellbook?: string[];
  preparedMax: number;
  cantripsMax: number;
}

export interface DerivedResource { id: string; label: string; max: number; recovery: string; source: string }

export interface DerivedItem { instanceId: string; itemId: string; name: string; kind: string; quantity: number; equipped?: boolean; wieldSlot?: "main-hand" | "off-hand" | "two-hand"; source: string }

export interface DerivedCharacter {
  id: string;
  name: string;
  portrait?: string;
  level: number;
  proficiencyBonus: number;
  species: { id: string; name: string } | null;
  background: { id: string; name: string } | null;
  classes: Array<{ classId: string; name: string; level: number; subclassId?: string; subclassName?: string; hitDie: number }>;
  abilities: Record<AbilityKey, { score: number; modifier: number; base: number; bonuses: Array<{ source: string; value: number }> }>;
  hp: { max: number; breakdown: string[] };
  ac: { value: number; source: string; breakdown: string[] };
  speed: { walk: number; climb?: number; swim?: number; fly?: number };
  senses: { darkvision?: number; blindsight?: number; truesight?: number };
  size: string;
  initiative: number;
  passivePerception: number;
  saves: Record<AbilityKey, { proficient: boolean; bonus: number }>;
  skills: DerivedSkill[];
  proficiencies: { armor: string[]; weapons: string[]; tools: string[]; languages: string[] };
  features: DerivedFeature[];
  feats: Array<{ id: string; name: string; tier: string; source: string }>;
  spellcasting: DerivedSpellcasting[];
  spellSlots: Record<number, number>;
  pactMagic?: { count: number; level: number };
  resources: DerivedResource[];
  attacks: DerivedAttack[];
  defenses: { resistances: string[]; immunities: string[]; vulnerabilities: string[]; conditionImmunities: string[] };
  inventory: DerivedItem[];
  gold: number;
  weaponMasteries: string[];
  hitDice: Record<string, number>;
  choices: ChoiceRequest[];
  validation: { blocking: string[]; warnings: string[] };
}
