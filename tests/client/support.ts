import { createCatalog } from "../../client/catalog";
import type { ContentCatalog } from "../../client/catalog/catalog";
import { autofill } from "../../client/character/autofill";
import { deriveCharacter } from "../../client/character/derive";
import { emptySource } from "../../client/character/source";
import type { CharacterSource, DerivedCharacter, HitPointChoiceValue } from "../../client/character/types";

let shared: ContentCatalog | undefined;
export const catalog = () => (shared ??= createCatalog());

export const ids = {
  species: (slug: string) => `dnd.srd521.species.${slug}`,
  background: (slug: string) => `dnd.srd521.background.${slug}`,
  cls: (slug: string) => `dnd.srd521.class.${slug}`,
  feat: (slug: string) => `dnd.srd521.feat.${slug}`,
};

export interface BuildSpec {
  name?: string;
  species?: string;
  background?: string;
  classes: string[] | string;
  level?: number;
  abilities?: Partial<CharacterSource["abilities"]["base"]>;
  method?: CharacterSource["abilities"]["method"];
  choices?: Record<string, string[]>;
  hp?: HitPointChoiceValue;
  equipment?: CharacterSource["equipment"];
}

/** A source from a compact spec: classes as slugs (a string repeats the class up to `level`). */
export function sourceOf(spec: BuildSpec): CharacterSource {
  const slugs = typeof spec.classes === "string" ? Array.from({ length: spec.level ?? 1 }, () => spec.classes as string) : spec.classes;
  const base = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8, ...(spec.abilities ?? {}) };
  return emptySource({
    name: spec.name ?? "테스트",
    origin: { speciesId: ids.species(spec.species ?? "human"), backgroundId: ids.background(spec.background ?? "soldier") },
    abilities: { method: spec.method ?? "manual", base },
    tracks: slugs.map((slug) => ({ classId: ids.cls(slug), hp: spec.hp ?? { kind: "fixed" } })),
    choices: spec.choices ?? {},
    equipment: spec.equipment ?? { mode: "loadout" },
  });
}

export function derive(spec: BuildSpec): DerivedCharacter {
  return deriveCharacter(sourceOf(spec), catalog());
}

/** Build and auto-answer every choice (preferring the given answers). */
export function build(spec: BuildSpec, prefer: Record<string, string[]> = {}) {
  return autofill(sourceOf(spec), catalog(), { prefer: { ...(spec.choices ?? {}), ...prefer } });
}

export const choice = (derived: DerivedCharacter, id: string) => derived.choices.find((item) => item.id === id);
export const classCasting = (derived: DerivedCharacter, slug: string) => derived.spellcasting.find((entry) => entry.source === "class" && entry.classId === ids.cls(slug));
export const featureNames = (derived: DerivedCharacter) => derived.features.map((feature) => feature.name);
export const spellNames = (derived: DerivedCharacter, list: string[]) => list.map((id) => catalog().spellById(id)?.nameEn ?? id);
