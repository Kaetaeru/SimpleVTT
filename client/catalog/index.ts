import { ContentCatalog } from "./catalog";
import { BUILTIN_MODULES } from "./sources";
import type { RuleModuleJson } from "./types";
import { registerCatalogSpells } from "../compendium/spells";
import { registerCatalogMonsters } from "../compendium/monsters";

export * from "./catalog";
export * from "./types";

/** The catalog every screen and the character engine read: SRD 5.2.1 plus whatever modules are installed. */
export function createCatalog(installedModules: readonly RuleModuleJson[] = []) {
  const catalog = new ContentCatalog({ modules: BUILTIN_MODULES, installedModules });
  // R76 (D211): every spell the catalog lists can be cast at the table — a module's own mechanics, or the plain record.
  registerCatalogSpells(catalog.spells.map((spell) => ({ ...spell, mechanic: catalog.entries.get(spell.id)?.mechanics.find((item) => item.kind === "spell-mechanic")?.config })));
  // D311: and every monster a module defines can be dragged onto the board.
  registerCatalogMonsters(catalog.monsters);
  return catalog;
}
