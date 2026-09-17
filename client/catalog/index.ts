import { ContentCatalog } from "./catalog";
import { BUILTIN_MODULES, CREATION_INDEX, PROGRESSION_CATALOG, SPELL_PRESENTATIONS } from "./sources";
import { SRD_EXTRAS } from "../data/srd";
import type { RuleModuleJson } from "./types";
import { registerCatalogSpells } from "../compendium/spells";

export * from "./catalog";
export * from "./types";

/** The catalog every screen and the character engine read: SRD 5.2.1 plus whatever modules are installed. */
export function createCatalog(installedModules: readonly RuleModuleJson[] = []) {
  const catalog = new ContentCatalog({ modules: BUILTIN_MODULES, installedModules, index: CREATION_INDEX, progression: PROGRESSION_CATALOG, spellPresentations: SPELL_PRESENTATIONS, extras: SRD_EXTRAS });
  // R76 (D211): every spell the catalog lists can be cast at the table — a module's own mechanics, or the plain record.
  registerCatalogSpells(catalog.spells.map((spell) => ({ ...spell, mechanic: catalog.entries.get(spell.id)?.mechanics.find((item) => item.kind === "spell-mechanic")?.config })));
  return catalog;
}
