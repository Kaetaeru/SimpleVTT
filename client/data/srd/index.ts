/**
 * Builtin SRD data the modules do not carry, merged into the catalog (docs/design/v3/NEW_CLIENT.md §4.4).
 * H7b (D252): the data is JSON under content/srd-extras; this file only types it and hands it to the catalog.
 */
import type { SpeciesChoice, SrdExtras, ClassOptionDefinition } from "../../catalog/catalog";
import classFeaturesJson from "../../../content/srd-extras/dnd-srd-5.2.1.class-features.json";
import subclassesJson from "../../../content/srd-extras/dnd-srd-5.2.1.subclasses.json";
import speciesJson from "../../../content/srd-extras/dnd-srd-5.2.1.species.json";
import featsJson from "../../../content/srd-extras/dnd-srd-5.2.1.feats.json";
import backgroundsJson from "../../../content/srd-extras/dnd-srd-5.2.1.backgrounds.json";
import spellListsJson from "../../../content/srd-extras/dnd-srd-5.2.1.spell-lists.json";
import classOptionsJson from "../../../content/srd-extras/dnd-srd-5.2.1.class-options.json";

export interface SrdSubclassFeature { level: number; id: string; name: string; nameEn: string; description: string }
export interface SrdSubclassChoice { id: string; level: number; label: string; description: string; options: Array<{ id: string; name: string; nameEn: string; summary: string }> }
export interface SrdSubclassData {
  id: string;
  classId: string;
  name: string;
  nameEn: string;
  summary: string;
  features: SrdSubclassFeature[];
  /** Always-prepared spells by class level (English names). */
  spells?: Record<number, string[]>;
  /** A choice the subclass adds (Circle of the Land's land type, Hunter's Prey…). */
  choices?: SrdSubclassChoice[];
  /** Always-prepared spells that depend on a choice option: choiceId → optionId → level → names. */
  spellsByOption?: Record<string, Record<string, Record<number, string[]>>>;
}
export interface SpeciesOptionEffect {
  cantrips?: string[];
  /** Spells by total-level threshold, always prepared (cast once free per long rest). */
  spellsByLevel?: Record<number, string[]>;
  speed?: number;
  darkvision?: number;
  resistances?: string[];
  features?: Array<{ name: string; nameEn: string; description: string }>;
}
export interface SrdSpeciesData {
  description?: string;
  traits: Record<string, { name: string; nameEn: string; description: string }>;
  choices?: SpeciesChoice[];
  /** Effects keyed by choice id → option id. */
  effects?: Record<string, Record<string, SpeciesOptionEffect>>;
}

const data = <T>(json: unknown) => (json as { data: T }).data;

export const SRD_EXTRAS: SrdExtras = {
  classFeatures: data(classFeaturesJson),
  subclasses: data<SrdSubclassData[]>(subclassesJson),
  species: data<Record<string, SrdSpeciesData>>(speciesJson),
  feats: data(featsJson),
  backgrounds: data(backgroundsJson),
  spellLists: data(spellListsJson),
  classOptions: data<Record<string, ClassOptionDefinition[]>>(classOptionsJson),
};
