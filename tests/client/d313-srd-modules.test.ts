/**
 * V0.9 D313 (SRD_MODULE_PLAN.md S4): the SRD rebuilt as modules from its source says what the old channels say.
 *
 * `content/modules/srd-5.2.1/*.module.json` is built from the SRD translation and `content/srd-authoring/*.json`
 * (`scripts/srd-build-modules.mjs`). A catalog made of those modules alone — no generated progression, no creation
 * index beyond the table's vocabulary, no extras — must derive the same characters as today's catalog, which is what
 * makes the switch in S5 safe. Also the two grammar pieces the rebuild needed: a species trait written whole with its
 * text, choices written as full objects, and a class feature whose entry id carries its rule key.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { ContentCatalog, createCatalog } from "../../client/catalog";
import { CREATION_INDEX, PROGRESSION_CATALOG } from "../../client/catalog/sources";
import type { RuleModuleJson } from "../../client/catalog/types";
import { deriveCharacter } from "../../client/character/derive";
import { featureRuleKey } from "../../client/rules/activation";
import { build } from "./support";

const DIR = "content/modules/srd-5.2.1";
function newOnly() {
  const modules = readdirSync(DIR).map((file) => JSON.parse(readFileSync(`${DIR}/${file}`, "utf8")) as RuleModuleJson);
  return new ContentCatalog({
    modules, installedModules: [], spellPresentations: [],
    index: { ...CREATION_INDEX, classes: {}, spellLists: {}, species: {} },
    progression: { ...PROGRESSION_CATALOG, classes: [] },
    extras: { classFeatures: {}, subclasses: [], species: {}, feats: {}, backgrounds: {}, spellLists: {}, classOptions: {} },
  });
}

const sheet = (derived: ReturnType<typeof deriveCharacter>) => ({
  hp: derived.hp.max, ac: derived.ac.value, slots: derived.spellSlots, pact: derived.pactMagic,
  features: derived.features.map((feature) => featureRuleKey(feature.id)).sort(),
  resources: derived.resources.map((pool) => `${pool.id}:${pool.max}`).sort(),
  casting: derived.spellcasting.map((entry) => `${entry.classId}:${entry.cantripsMax}/${entry.preparedMax}`).sort(),
  choices: derived.choices.map((choice) => `${choice.id}:${choice.count}`).sort(),
  riders: (derived.attackRiders ?? []).map((rider) => rider.key).sort(),
});

test("D313: the SRD modules alone derive the same sheets as the old channels", () => {
  const next = newOnly();
  const old = createCatalog([]);
  assert.equal(next.classes.length, old.classes.length);
  assert.equal(next.subclasses.length, old.subclasses.length);
  assert.equal(next.spells.length, old.spells.length);
  assert.equal(next.monsters.length, 329);
  for (const [spec, prefer] of [
    [{ name: "위", classes: "wizard", level: 5 }, {}],
    [{ name: "워", classes: "warlock", level: 7 }, {}],
    [{ name: "바", classes: "barbarian", level: 11 }, {}],
    [{ name: "용", classes: "fighter", level: 5, species: "dragonborn" }, { "origin.species.draconicAncestry": ["green"] }],
  ] as const) {
    const made = build(spec, prefer as Record<string, string[]>);
    assert.deepEqual(sheet(deriveCharacter(made.source, next)), sheet(made.derived), spec.name);
  }
});

test("D313: a species trait is written whole and its choices as objects; the text is the source's", () => {
  const next = newOnly();
  const dragonborn = next.speciesById("dnd.srd521.species.dragonborn")!;
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
