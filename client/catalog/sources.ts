/**
 * Read-only data the new client ships with: the SRD 5.2.1 RuleModules, the creation index, the generated class
 * progression tables and the spell presentation catalog. Nothing here is code from the old app (see
 * scripts/check-client-boundary.mjs).
 */
import creationIndexJson from "../../content/indexes/dnd-srd-5.2.1.character-creation.json";
import progressionJson from "../../src/generated/progressionCatalog.generated.json";
import spellPresentationJson from "../../src/generated/spellPresentationCatalog.generated.json";
import { BUILTIN_MODULE_JSON } from "./builtinModules";
import type { CreationIndexJson, ProgressionCatalogJson, RuleModuleJson, SpellPresentationJson } from "./types";

export const CREATION_INDEX = creationIndexJson as unknown as CreationIndexJson;
export const PROGRESSION_CATALOG = progressionJson as unknown as ProgressionCatalogJson;
export const SPELL_PRESENTATIONS = (spellPresentationJson as unknown as { spells: SpellPresentationJson[] }).spells;
export const BUILTIN_MODULES = BUILTIN_MODULE_JSON as readonly RuleModuleJson[];
