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
  /** R33 (D168): what the engine does with this feature, written from its catalog config — empty means nothing automatic. */
  rules?: string[];
  /** R33 (D168): `descriptive` marks prose the table adjudicates; the sheet says so instead of letting it look applied. */
  execution?: "derived" | "pre-roll" | "selection" | "common-play" | "descriptive";
}

/** One addend of a derived number, so the sheet can show where it came from ("민첩 +2", "숙련 보너스 +3"). */
export interface Term { label: string; value: number; /** Dice added instead of a number ("1d4" from Bless); value stays 0. */ dice?: string }

/** A feature or spell in effect (Rage, Bless): ended by its "종료" button, by the round counter, or by a rest. */
export interface ActiveEffect {
  /** `feature:<featureRuleKey>` or `spell:<spellId>`. */
  key: string;
  name: string;
  source: "feature" | "spell";
  duration: string;
  concentration: boolean;
  /** Round counter when the duration is short enough to track (10 rounds for one minute). */
  rounds?: number;
  elapsed: number;
  startedAt: string;
  /** R10: repeat this save at the end of each of the bearer's turns; on a success the effect and these conditions end. */
  endSave?: { ability: AbilityKey; dc: number; conditions: string[] };
}

/** What an active effect changed on the sheet, for the effects card. `applied` false: no rule yet, apply the text by hand. */
/**
 * R28 (D153): `narrative` marks an effect the engine cannot put a number on — the whole of its rule is the text in
 * `notes`, so the table adjudicates it. Two thirds of the effect rules are like this, and nothing used to say which
 * ones, so "the app tracks the rules" and "the app prints a sentence about the rules" looked identical on screen.
 */
export interface AppliedEffect { key: string; name: string; applied: boolean; notes: string[]; narrative?: boolean }

export interface DerivedSkill { id: string; name: string; ability: AbilityKey; proficient: boolean; expertise: boolean; bonus: number; terms: Term[] }

export interface DerivedAttack {
  id: string;
  name: string;
  itemId?: string;
  ability: AbilityKey;
  attackBonus: number;
  attackTerms: Term[];
  damage: string;
  damageBonus: number;
  damageTerms: Term[];
  damageType: string;
  properties: string[];
  mastery?: string;
  /** R32 (D165): 대형 무기 전투 — this weapon's damage dice never roll below 3. */
  dieMinimum?: number;
  /** The mastery property's rule key (graze, topple, vex, sap, slow, push, nick, cleave) for the table. */
  masteryKey?: string;
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
  saveDcTerms: Term[];
  attackBonus: number;
  attackTerms: Term[];
  cantrips: string[];
  prepared: string[];
  alwaysPrepared: string[];
  spellbook?: string[];
  preparedMax: number;
  cantripsMax: number;
}

export interface DerivedResource {
  id: string;
  label: string;
  max: number;
  /** Human recovery text ("짧은 휴식"). */
  recovery: string;
  /** Machine recovery: what a short rest gives back (`all`, a number of uses, or nothing); a long rest always restores all. */
  restore: { short: "all" | number | 0 };
  source: string;
  /** Spell this pool casts for free (Paladin's Smite, Find Steed, Mystic Arcanum, species/feat spells): the spell row offers it. */
  freeCastSpellId?: string;
}

export interface DerivedItem { instanceId: string; itemId: string; name: string; kind: string; quantity: number; equipped?: boolean; wieldSlot?: "main-hand" | "off-hand" | "two-hand"; source: string; custom?: boolean }

/** Runtime-side changes to the bag: items removed, quantities changed, items added during play. */
export interface InventoryPatch {
  removed: string[];
  quantities: Record<string, number>;
  extra: Array<{ instanceId: string; itemId?: string; name: string; quantity: number }>;
}

/** R33 (D168): feat numbers that only matter once a swing is being rolled. */
export interface DerivedFeatEffects {
  /** 야만적 공격자: the feat that lets this character reroll a weapon's damage dice once a turn and keep either set. */
  rerollWeaponDamage?: string;
  /** 쌍수 전투: the feat that keeps the ability modifier on the Light weapon's extra attack. */
  lightOffHandAbilityModifier?: string;
}

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
  hp: { max: number; breakdown: string[]; terms: Term[] };
  ac: { value: number; source: string; breakdown: string[]; terms: Term[] };
  speed: { walk: number; climb?: number; swim?: number; fly?: number; terms: Term[] };
  senses: { darkvision?: number; blindsight?: number; truesight?: number };
  size: string;
  initiative: number;
  initiativeTerms: Term[];
  passivePerception: number;
  passivePerceptionTerms: Term[];
  saves: Record<AbilityKey, { proficient: boolean; bonus: number; terms: Term[] }>;
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
  /** Effects in force when deriving (from the runtime) and what each one changed. */
  activeEffects: AppliedEffect[];
  /** Dice or numbers every ability check gets from effects (Guidance). Skills already carry them in their terms. */
  checkTerms: Term[];
  gold: number;
  weaponMasteries: string[];
  /**
   * R33 (D168): the feat rules the table reads at roll time rather than the sheet at derivation time. Named after
   * the catalog key that produced them, holding the feat's name so the card can say what paid for the reroll.
   */
  featEffects: DerivedFeatEffects;
  hitDice: Record<string, number>;
  choices: ChoiceRequest[];
  validation: { blocking: string[]; warnings: string[] };
}
