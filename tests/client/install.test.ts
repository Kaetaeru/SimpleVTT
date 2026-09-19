/**
 * Module install (M1 acceptance 5b): a supplement compiled to RuleModule JSON — species, background, origin feat,
 * general feat, subclass with level features, spell — flows into the catalog and the character engine exactly like
 * builtin content, and its origin feat never shows up among the ASI candidates.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { compileSupplement } from "../../tools/supplement/compileSupplement";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { missingDependencies, modulesReferencedBy, parseModuleJson } from "../../client/catalog/install";
import { autofill } from "../../client/character/autofill";
import { deriveCharacter } from "../../client/character/derive";
import { unknownContentIds } from "../../client/character/json";
import { emptySource } from "../../client/character/source";
import { choice, ids } from "./support";

const fixtureModule = () => compileSupplement({ sourceRoot: "tests/fixtures/supplement/translation", semanticsRoot: "tests/fixtures/supplement/semantics", moduleId: "fixture-supplement", moduleVersion: "1", idPrefix: "fx", document: "Fixture Supplement" }).module as unknown as RuleModuleJson;

test("parseModuleJson accepts the compiler's output and rejects broken files with every error listed", () => {
  const text = JSON.stringify(fixtureModule());
  const parsed = parseModuleJson(text);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.summary?.moduleId, "fixture-supplement");
  assert.deepEqual(parsed.summary?.counts, { feat: 2, background: 1, species: 1, option: 3, subclass: 1, spell: 1 });
  assert.ok(parsed.summary?.entries.some((entry) => entry.name === "나방족"));
  assert.ok(parseModuleJson("{not json").errors[0].includes("JSON"));
  assert.ok(parseModuleJson({ content: [] }).errors.some((line) => line.includes("moduleId")));
  const broken = parseModuleJson({ moduleId: "x", content: [{ id: "a", category: "feat" }, { id: "a", category: "feat" }, { category: "species" }, { id: "s", category: "subclass" }] });
  assert.ok(broken.errors.some((line) => line.includes("중복")));
  assert.ok(broken.errors.some((line) => line.includes("id가 없습니다")));
  assert.ok(broken.errors.some((line) => line.includes("parent")));
  const odd = parseModuleJson({ moduleId: "odd", content: [{ id: "odd.thing", category: "vehicle", presentation: { originalName: "Cart" } }] });
  assert.deepEqual(odd.errors, []);
  assert.ok(odd.warnings.some((line) => line.includes("vehicle")));
  const srd = parseModuleJson(JSON.stringify(createCatalog().artisanToolIds ? { moduleId: "dnd.srd-5.2.1.classes", dependencies: [{ moduleId: "dnd.srd-5.2.1.core" }], content: [{ id: "x.class", category: "class", presentation: { originalName: "X" } }] } : {}));
  assert.deepEqual(missingDependencies(srd.module!, ["dnd.srd-5.2.1.core"]), []);
  assert.deepEqual(missingDependencies(srd.module!, []), ["dnd.srd-5.2.1.core"]);
});

test("installed content joins the catalog: species with described traits, background with its origin feat, subclass features, spell lists", () => {
  const module = fixtureModule();
  const catalog = createCatalog([module]);
  assert.deepEqual(catalog.warnings, []);
  const species = catalog.speciesById("fx.species.mothfolk")!;
  assert.equal(species.scope, "installed");
  assert.deepEqual(species.sizes, ["small", "medium"]);
  assert.deepEqual(species.traits.map((trait) => trait.name), ["암시야", "달빛 감각", "가루 날개"]);
  assert.equal(species.traits[2].description, "짧은 휴식을 끝낼 때마다 1d4 임시 히트 포인트를 얻는다.");
  assert.equal(species.traits[2].descriptionSource, "module");
  const background = catalog.backgroundById("fx.background.lighthouse-keeper")!;
  assert.equal(background.originFeat, "fx.feat.lantern-bearer");
  assert.deepEqual(background.skills, ["perception", "survival"]);
  assert.equal(catalog.featById("fx.feat.lantern-bearer")?.tier, "origin");
  assert.equal(catalog.featById("fx.feat.steady-hands")?.tier, "general");
  assert.deepEqual(catalog.featById("fx.feat.steady-hands")?.abilityIncrease, { any: ["dex", "wis"], amount: 1, maximum: 20 });
  const subclass = catalog.subclassById("fx.subclass.storm-knight")!;
  assert.equal(subclass.classId, ids.cls("fighter"));
  assert.deepEqual(subclass.features.map((feature) => [feature.level, feature.name]), [[3, "번개 재정비"], [3, "폭풍의 감각"], [7, "폭풍 질주"]]);
  assert.ok(subclass.features.every((feature) => feature.description && feature.descriptionSource === "module"));
  assert.equal(catalog.subclassesOf(ids.cls("fighter")).length, 2);
  const spell = catalog.spellById("fx.spell.tide-bolt")!;
  assert.equal(spell.level, 0);
  assert.ok(spell.classes.includes(ids.cls("wizard")) && spell.classes.includes(ids.cls("sorcerer")));
  assert.equal(catalog.spells.length, 340);
});

test("a character built from installed content: traits on the sheet, origin feat from the background, storm knight features, no origin feat at level 4", () => {
  const module = fixtureModule();
  const catalog = createCatalog([module]);
  const source = emptySource({
    name: "나방 기사", rules: { profile: "dnd.srd-5.2.1", modules: ["fixture-supplement"] },
    origin: { speciesId: "fx.species.mothfolk", backgroundId: "fx.background.lighthouse-keeper" },
    abilities: { method: "manual", base: { str: 15, dex: 14, con: 13, int: 10, wis: 12, cha: 8 } },
    tracks: Array.from({ length: 7 }, () => ({ classId: ids.cls("fighter"), hp: { kind: "fixed" as const } })),
    choices: { "class.2.subclass": ["fx.subclass.storm-knight"], "class.3.asi": ["fx.feat.steady-hands"], "feat.class.3.asi.fx.feat.steady-hands.ability": ["dex"] },
  });
  const { derived } = autofill(source, catalog);
  assert.deepEqual(derived.validation.blocking, []);
  assert.equal(derived.species?.name, "나방족");
  assert.deepEqual(derived.features.filter((feature) => feature.source === "species").map((feature) => feature.name), ["암시야", "달빛 감각", "가루 날개"]);
  assert.equal(derived.senses.darkvision, 60);
  assert.ok(choice(derived, "origin.species.size"));
  assert.ok(derived.feats.some((feat) => feat.id === "fx.feat.lantern-bearer" && feat.tier === "origin"));
  assert.ok(derived.features.some((feature) => feature.name === "등불지기" && feature.description?.includes("길잡이")));
  assert.ok(derived.skills.find((skill) => skill.id === "perception")?.proficient);
  assert.ok(derived.proficiencies.tools.some((tool) => tool.includes("항해")), derived.proficiencies.tools.join(","));
  assert.equal(derived.classes[0].subclassName, "폭풍 기사");
  assert.deepEqual(derived.features.filter((feature) => feature.source === "subclass" && feature.level).map((feature) => [feature.level, feature.name]), [[3, "서브클래스: 폭풍 기사"], [3, "번개 재정비"], [3, "폭풍의 감각"], [7, "폭풍 질주"]]);
  const asi = choice(derived, "class.3.asi")!;
  assert.ok(asi.options.some((option) => option.id === "fx.feat.steady-hands"));
  assert.ok(!asi.options.some((option) => option.id === "fx.feat.lantern-bearer"), "installed origin feats stay out of the ASI list");
  assert.ok(derived.feats.some((feat) => feat.id === "fx.feat.steady-hands"));
  assert.equal(derived.abilities.dex.score, 15, "steady hands +1 DEX (14 + 1; background bonuses went to CON/WIS/CHA)");
  assert.deepEqual(modulesReferencedBy([source.origin.speciesId, source.origin.backgroundId, ...Object.values(source.choices).flat()], [module]), ["fixture-supplement"]);
  // Without the module, the same source reports what is missing instead of pretending.
  const bare = createCatalog();
  assert.deepEqual(unknownContentIds(source, bare), ["fx.species.mothfolk", "fx.background.lighthouse-keeper", "fx.subclass.storm-knight", "fx.feat.steady-hands"]);
  const missing = deriveCharacter(source, bare);
  assert.ok(missing.validation.blocking.some((line) => line.includes("fx.species.mothfolk")));
});

test("an installed cantrip is offered to the classes its definition names", () => {
  const catalog = createCatalog([fixtureModule()]);
  const wizard = emptySource({ name: "W", origin: { speciesId: ids.species("human"), backgroundId: ids.background("sage") }, abilities: { method: "manual", base: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 } }, tracks: [{ classId: ids.cls("wizard"), hp: { kind: "fixed" } }], choices: { "class.0.cantrips": ["fx.spell.tide-bolt"] } });
  const { derived } = autofill(wizard, catalog);
  const cantrips = choice(derived, "class.0.cantrips")!;
  assert.ok(cantrips.options.some((option) => option.id === "fx.spell.tide-bolt" && option.name === "조수 화살"));
  assert.ok(derived.spellcasting.find((entry) => entry.source === "class")!.cantrips.includes("fx.spell.tide-bolt"));
  const cleric = emptySource({ name: "C", origin: { speciesId: ids.species("human"), backgroundId: ids.background("acolyte") }, abilities: { method: "manual", base: { str: 8, dex: 14, con: 13, int: 10, wis: 15, cha: 10 } }, tracks: [{ classId: ids.cls("cleric"), hp: { kind: "fixed" } }] });
  const clericDerived = deriveCharacter(cleric, catalog);
  assert.ok(!choice(clericDerived, "class.0.cantrips")!.options.some((option) => option.id === "fx.spell.tide-bolt"));
});
