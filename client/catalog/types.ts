/**
 * Content catalog types for the new client (docs/design/v3/NEW_CLIENT.md §2).
 *
 * A RuleModule is the JSON package format shared by the SRD modules under content/modules and by installed modules
 * (the supplement compiler's output, e.g. the PHB 2024 add-on). The catalog reads both through the same types and
 * gives every entry one long stable id.
 */
export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";
export const ABILITY_KEYS: readonly AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
export const ABILITY_KO: Record<AbilityKey, string> = { str: "근력", dex: "민첩", con: "건강", int: "지능", wis: "지혜", cha: "매력" };

export type EntryCategory =
  | "class" | "subclass" | "species" | "background" | "feat" | "spell" | "option"
  | "weapon" | "armor" | "shield" | "tool" | "item" | "adventuring-gear" | "ammunition" | "focus" | "starting-loadout"
  | "combatant" | "condition";

export interface EntryPresentationJson {
  originalName: string;
  defaultLocale?: string;
  locales?: Record<string, { name: string; summary?: string; description?: string }>;
}

export interface MechanicJson { kind: string; config?: Record<string, unknown> }

export interface RelationshipJson { kind: "parent" | "extends" | "replaces"; target: string }

export interface ProgressionContributionJson { track: string; threshold: number; grants: string[] }

export interface EntryJson {
  id: string;
  category: string;
  presentation?: EntryPresentationJson;
  tags?: string[];
  mechanics?: MechanicJson[];
  relationships?: RelationshipJson[];
  progressionContributions?: ProgressionContributionJson[];
  extensionPoints?: Array<{ id: string; acceptsCategories: string[] }>;
}

export interface RuleModuleJson {
  moduleId: string;
  moduleVersion?: string;
  schemaVersion?: string;
  defaultLocale?: string;
  source?: { document?: string; version?: string; license?: string; srdDerived?: boolean };
  dependencies?: Array<{ moduleId: string; version?: string }>;
  content: EntryJson[];
}

/** One entry after normalization: long id, Korean name, the module it came from. */
export interface CatalogEntry {
  id: string;
  category: EntryCategory | string;
  name: string;
  nameEn: string;
  summary?: string;
  description?: string;
  tags: string[];
  mechanics: MechanicJson[];
  relationships: RelationshipJson[];
  progressionContributions: ProgressionContributionJson[];
  moduleId: string;
  scope: "builtin" | "installed";
}

/** The generated class progression table (src/generated/progressionCatalog.generated.json). */
export interface ProgressionLevelRowJson {
  level: number;
  proficiencyBonus: number;
  features: string[];
  columns: Record<string, string | null>;
}
export interface ProgressionClassJson {
  id: string;
  slug: string;
  nameKo: string;
  nameEn: string;
  srdSubclassName: string;
  hitDie: number;
  primaryAbilitiesText: string;
  savingThrowsText: string;
  spellcastingMode: string | null;
  multiclassGrants: string[];
  progression: ProgressionLevelRowJson[];
  spellSlots: unknown;
}
export interface ProgressionCatalogJson {
  classes: ProgressionClassJson[];
  levelAdvancement: { growth: Array<Record<string, string>> };
  multiclass: {
    prerequisites: Array<Record<string, string>>;
    fullCasterClasses: string[];
    halfCasterClasses: string[];
    pactCasterClasses: string[];
    spellSlots: { headers: string[]; rows: Array<Record<string, string | null>> };
  };
}

/** The creation index (content/indexes/dnd-srd-5.2.1.character-creation.json). */
export interface IndexClassChoiceJson {
  id: string;
  kind: string;
  count: number;
  label: string;
  description?: string;
  weaponFilter?: string;
  languagePool?: string;
  options?: Array<{ id: string; name: string; nameEn?: string; summary?: string }>;
}
export interface IndexClassJson {
  skills: { count: number; options: string[] | "any" };
  choices?: IndexClassChoiceJson[];
  spells?: {
    cantrips?: number;
    prepared?: number;
    spellbook?: number;
    /** Spells added to the spellbook each class level after the first. */
    spellbookPerLevel?: number;
    preparedFromSpellbook?: number;
    alwaysPrepared?: string[];
    bonusCantripChoice?: { choiceId: string; value: string };
  };
}
export interface IndexSpeciesSemanticsJson {
  baseCantrips?: string[];
  basePrepared?: string[];
  baseFeatures?: string[];
  extraChoices?: IndexClassChoiceJson[];
  byChoice?: Record<string, Record<string, { cantrips?: string[]; prepared?: string[]; features?: string[]; speed?: number }>>;
  /** H7a (D251): how often each always-prepared species spell is cast free — once, or the proficiency bonus times per long rest. */
  spellUses?: "once" | "proficiency-bonus";
}
export interface CreationIndexJson {
  skills: Record<string, string>;
  standardLanguages: Array<{ id: string; name: string; nameEn: string }>;
  generalLanguages: Array<{ id: string; name: string; nameEn: string }>;
  classes: Record<string, IndexClassJson>;
  spellLists: Record<string, Record<string, string[]>>;
  artisanToolIds: string[];
  species: Record<string, IndexSpeciesSemanticsJson>;
}

export interface SpellPresentationJson {
  id: string;
  name: string;
  nameEn: string;
  level: number;
  school: string;
  ritual: boolean;
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  summary: string;
  description: string;
}
