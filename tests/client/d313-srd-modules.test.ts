/**
 * V0.9 D313, D314 (SRD_MODULE_PLAN.md S4, S5): the SRD is modules built from its source, and the catalog reads nothing
 * else.
 *
 * `content/modules/srd-5.2.1/*.module.json` is built from the SRD translation and `content/srd-authoring/*.json`
 * (`scripts/srd-build-modules.mjs`); before the switch, a catalog of those modules alone derived 100 characters the
 * same as the old channels (`scripts/srd-compare.ts`, D313). These pin what the switch must keep: the counts, a species
 * trait written whole with the translation's own name and text, choices as objects, a class feature's rule key, the
 * table's vocabulary from a module, and SRD spells and monsters that work before any catalog is built.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createCatalog } from "../../client/catalog";
import { BUILTIN_MODULES } from "../../client/catalog/sources";
import { monsterById } from "../../client/compendium/monsters";
import { traitRule } from "../../client/compendium/monsterTraits";
import { spellExec, sustainOf } from "../../client/compendium/spells";
import { featureRuleKey } from "../../client/rules/activation";

test("D314: the builtin catalog is the SRD modules, and they hold the whole SRD", () => {
  assert.deepEqual(BUILTIN_MODULES.map((module) => module.moduleId).sort(), ["dnd.srd-5.2.1.classes", "dnd.srd-5.2.1.core", "dnd.srd-5.2.1.equipment", "dnd.srd-5.2.1.magic-items", "dnd.srd-5.2.1.monsters", "dnd.srd-5.2.1.origins", "dnd.srd-5.2.1.rules", "dnd.srd-5.2.1.spells"]);
  const catalog = createCatalog([]);
  assert.equal(catalog.classes.length, 12);
  assert.equal(catalog.subclasses.length, 12);
  assert.equal(catalog.species.length, 9);
  assert.equal(catalog.backgrounds.length, 4);
  assert.equal(catalog.feats.length, 17);
  assert.equal(catalog.spells.length, 339);
  assert.equal(catalog.monsters.length, 329);
  // D355: the magic items, with an item per kind where the text lists kinds.
  assert.ok(catalog.items.filter((item) => item.kind === "magic").length >= 317);
  assert.equal(Object.keys(catalog.skills).length, 18, "the vocabulary comes from a module too");
  assert.ok(catalog.artisanToolIds.length > 0);
  assert.ok(catalog.classes.every((cls) => cls.progression.length === 20), "every class has its twenty rows");
});

test("D313: a species trait is written whole and its choices as objects; the text is the source's", () => {
  const dragonborn = createCatalog([]).speciesById("dnd.srd521.species.dragonborn")!;
  const breath = dragonborn.traits.find((trait) => trait.id.endsWith(".trait.breath-weapon"))!;
  assert.equal(breath.name, "숨결 무기", "the translation's own name");
  assert.ok((breath.description ?? "").length > 40, "and its text");
  const ancestry = dragonborn.choices.find((choice) => choice.id === "species.draconicAncestry")!;
  assert.ok(Array.isArray(ancestry.options) && ancestry.options.some((option) => option.id === "green"));
});

test("D313: a class feature entry id keeps the rule key its contracts are written for", () => {
  assert.equal(featureRuleKey("fighter.2.dnd.srd521.feature.fighter.action-surge"), "fighter.action-surge");
  assert.equal(featureRuleKey("fighter.2.fighter.action-surge"), "fighter.action-surge");
  assert.equal(featureRuleKey("tinker.1.test.d310.feature.tinker.sparks"), "test.d310.feature.tinker.sparks");
});

test("D314: SRD spells and monsters work before any catalog is built, from their modules", () => {
  const sphere = spellExec("dnd.srd521.spell.flaming-sphere")!;
  assert.ok(sphere, "the SRD spells module executes");
  assert.equal(sustainOf(sphere)?.economy, "bonus-action", "with the repeat the old index carried");
  assert.equal(traitRule(monsterById("dnd.srd521.monster.troll")!, "regeneration")?.rule.amount, 15, "a trait carries its rule");
  assert.ok(monsterById("dnd.srd521.monster.fire-elemental"), "the repaired id");
});
