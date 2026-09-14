import { ContentCatalog } from "./catalog";
import { BUILTIN_MODULES, CREATION_INDEX, PROGRESSION_CATALOG, SPELL_PRESENTATIONS } from "./sources";
import { SRD_EXTRAS } from "../data/srd";
import type { RuleModuleJson } from "./types";

export * from "./catalog";
export * from "./types";

/** The catalog every screen and the character engine read: SRD 5.2.1 plus whatever modules are installed. */
export function createCatalog(installedModules: readonly RuleModuleJson[] = []) {
  return new ContentCatalog({ modules: BUILTIN_MODULES, installedModules, index: CREATION_INDEX, progression: PROGRESSION_CATALOG, spellPresentations: SPELL_PRESENTATIONS, extras: SRD_EXTRAS });
}
