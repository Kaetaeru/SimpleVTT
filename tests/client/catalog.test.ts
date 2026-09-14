import assert from "node:assert/strict";
import test from "node:test";
import { createCatalog } from "../../client/catalog";

/** The catalog is complete: every SRD class, species, background, feat and spell, with names, tables and lists resolved. */
test("the builtin catalog loads every SRD 5.2.1 module with no unresolved references", () => {
  const catalog = createCatalog();
  assert.deepEqual(catalog.warnings, [], catalog.warnings.slice(0, 20).join("\n"));
  assert.equal(catalog.classes.length, 12);
  assert.equal(catalog.subclasses.length, 12, catalog.subclasses.map((entry) => entry.id).join("\n"));
  assert.equal(catalog.species.length, 9);
  assert.equal(catalog.backgrounds.length, 4);
  assert.equal(catalog.feats.length, 17);
  assert.equal(catalog.spells.length, 339);
  assert.ok(catalog.items.length > 80, `items: ${catalog.items.length}`);
  assert.equal(catalog.loadouts.length, 16, "12 class + 4 background loadouts");
});

test("every class has 20 level rows with described features, and every subclass has its level-3 features", () => {
  const catalog = createCatalog();
  for (const cls of catalog.classes) {
    assert.equal(cls.progression.length, 20, cls.slug);
    for (const row of cls.progression) for (const feature of row.featureRecords) assert.ok(feature.description, `${cls.slug} L${row.level} ${feature.name}`);
    assert.ok(cls.savingThrows.length === 2, `${cls.slug} saves ${cls.savingThrows}`);
    assert.ok(cls.hitDie >= 6, cls.slug);
  }
  for (const subclass of catalog.subclasses) {
    assert.ok(subclass.features.some((feature) => feature.level === 3), subclass.id);
    assert.ok(catalog.classById(subclass.classId), subclass.id);
  }
});

test("spell lists: the whole SRD list is reachable from some class, and the casters see the right counts", () => {
  const catalog = createCatalog();
  const orphans = catalog.spells.filter((spell) => spell.classes.length === 0).map((spell) => spell.nameEn);
  assert.deepEqual(orphans, [], `spells on no class list: ${orphans.join(", ")}`);
  const wizard = catalog.classBySlug("wizard")!;
  assert.ok(catalog.spellsFor(wizard.id, 0).length >= 15);
  assert.ok(catalog.spellsFor(wizard.id, 9).length >= 10);
  const paladin = catalog.classBySlug("paladin")!;
  assert.equal(catalog.spellsFor(paladin.id, 6).length, 0, "paladin lists end at level 5");
  assert.ok(catalog.spellByName("Fireball")?.classes.includes(wizard.id));
  assert.equal(catalog.spellByName("Hunter's Mark")?.level, 1);
});

test("species carry described traits and their choices; backgrounds resolve origin feats (including magic-initiate variants)", () => {
  const catalog = createCatalog();
  const dwarf = catalog.speciesById("dnd.srd521.species.dwarf")!;
  assert.deepEqual(dwarf.traits.map((trait) => trait.name), ["독 저항", "드워프의 강인함", "돌 감각"]);
  assert.ok(dwarf.traits.every((trait) => trait.description));
  const elf = catalog.speciesById("dnd.srd521.species.elf")!;
  assert.ok(elf.choices.some((choice) => choice.id === "species.lineage"));
  const dragonborn = catalog.speciesById("dnd.srd521.species.dragonborn")!;
  assert.equal(dragonborn.traits.find((trait) => trait.nameEn === "Draconic Flight")?.minLevel, 5);
  const acolyte = catalog.backgroundById("dnd.srd521.background.acolyte")!;
  assert.equal(acolyte.originFeat, "dnd.srd521.feat.magic-initiate");
  assert.deepEqual(acolyte.originFeatPreset, { spellList: "cleric" });
  assert.equal(catalog.featById("dnd.srd521.feat.alert")?.tier, "origin");
  assert.equal(catalog.featById("dnd.srd521.feat.grappler")?.tier, "general");
  assert.equal(catalog.featById("dnd.srd521.feat.fighting-style.archery")?.tier, "fighting-style");
  assert.equal(catalog.featById("dnd.srd521.feat.epic.fate")?.tier, "epic-boon");
  assert.ok(catalog.feats.every((feat) => feat.description), "every feat is described");
});

test("items: armor formulas, weapon properties and loadouts are typed", () => {
  const catalog = createCatalog();
  const plate = catalog.itemById("dnd.srd521.item.armor.plate")!;
  assert.deepEqual(plate.armor, { training: "heavy", base: 18, dexMax: undefined, dexFull: false, strengthRequirement: 15, stealthDisadvantage: true });
  const chainShirt = catalog.itemById("dnd.srd521.item.armor.chain-shirt")!;
  assert.equal(chainShirt.armor?.dexMax, 2);
  const shield = catalog.itemById("dnd.srd521.item.armor.shield") ?? catalog.items.find((item) => item.kind === "shield");
  assert.equal(shield?.shieldBonus, 2);
  const greataxe = catalog.itemById("dnd.srd521.item.weapon.greataxe")!;
  assert.equal(greataxe.weapon?.mastery, "cleave");
  assert.ok(greataxe.weapon?.properties.includes("heavy"));
  const barbarianLoadout = catalog.loadoutFor("dnd.srd521.class.barbarian")!;
  assert.equal(barbarianLoadout.options.length, 2);
});
