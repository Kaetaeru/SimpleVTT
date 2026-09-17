import type { SrdExtras } from "../../catalog/catalog";
import { CLASS_FEATURES } from "./classFeatures";
import { SRD_SUBCLASSES } from "./subclasses";
import { SRD_SPECIES } from "./species";
import { SRD_BACKGROUNDS, SRD_FEATS } from "./featsAndBackgrounds";
import { SRD_SPELL_LISTS } from "./spellLists";
import { SRD_CLASS_OPTIONS } from "./classOptions";

/** Builtin SRD data the modules do not carry, merged into the catalog (docs/design/v3/NEW_CLIENT.md §4.4). */
export const SRD_EXTRAS: SrdExtras = {
  classFeatures: CLASS_FEATURES,
  subclasses: SRD_SUBCLASSES.map((subclass) => ({ id: subclass.id, classId: subclass.classId, name: subclass.name, nameEn: subclass.nameEn, summary: subclass.summary, features: subclass.features, spells: subclass.spells })),
  species: Object.fromEntries(Object.entries(SRD_SPECIES).map(([id, data]) => [id, { description: data.description, traits: data.traits, choices: data.choices }])),
  feats: SRD_FEATS,
  backgrounds: SRD_BACKGROUNDS,
  spellLists: SRD_SPELL_LISTS,
  classOptions: SRD_CLASS_OPTIONS,
};

export { SRD_SUBCLASSES } from "./subclasses";
export { SRD_SPECIES } from "./species";
