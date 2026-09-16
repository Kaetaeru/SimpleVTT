import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createCatalog } from "../../client/catalog";
import { featureActivation, featureRuleKey } from "../../client/rules/activation";
import { featureContract } from "../../client/rules/contractActivation";
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

/**
 * R43 (D183): how much of each class the app says something about. A feature is covered by a contract, by a
 * hand-written activation, or by being named somewhere in the rules code; anything else is silent — the sheet
 * prints its description and nothing happens. Shared by plan.test.ts and coverage.test.ts so the two agree.
 */
export const CLASS_SLUGS = ["barbarian", "bard", "cleric", "druid", "fighter", "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard"];

export function classCoverage() {
  const cat = catalog();
  let code = "";
  for (const dir of ["client/character", "client/rules", "client/session", "client/screens", "client/compendium"]) {
    for (const file of readdirSync(dir)) if (/\.tsx?$/.test(file)) code += readFileSync(join(dir, file), "utf8");
  }
  const seen = new Set<string>();
  const counts = { contract: 0, activation: 0, mentioned: 0, silent: 0 };
  const silent: Record<string, string[]> = {};
  for (const slug of CLASS_SLUGS) {
    const made = build({ name: slug, classes: slug, level: 20 });
    silent[slug] = [];
    for (const feature of made.derived.features) {
      if (feature.source !== "class" && feature.source !== "subclass") continue;
      const key = featureRuleKey(feature.id);
      if (seen.has(key)) continue;
      seen.add(key);
      if (featureContract(cat, key)) { counts.contract += 1; continue; }
      if (featureActivation(feature, made.derived)) { counts.activation += 1; continue; }
      const tail = key.split(".").pop()!;
      if (tail.length > 3 && code.includes(tail)) { counts.mentioned += 1; continue; }
      counts.silent += 1;
      silent[slug].push(`${feature.name} (${key})`);
    }
  }
  return { counts, silent, total: seen.size };
}
