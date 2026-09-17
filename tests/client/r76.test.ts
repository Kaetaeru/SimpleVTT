/**
 * R76 (ROLL20_TABLE_SPEC.md D211): every spell on a sheet is cast through the table.
 *
 * The table only knew how to cast spells in the generated SRD catalog. An installed module's spell (마녀 화살 from a
 * PHB supplement) carried its own `spell-mechanic` — a ranged spell attack — but nothing read it, so the turn panel
 * did not list it and the sheet's 시전 only spent a slot and started an effect. A spell with no mechanics at all
 * (a smite the module has not written up yet) could not be cast at the table either.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { execForCatalogSpell, spellExec } from "../../client/compendium/spells";
import { castableSpells, pcSpell } from "../../client/rules/spellcast";
import { initialRuntime } from "../../client/character/runtime";
import { build } from "./support";

const supplement = {
  moduleId: "test-supplement", moduleVersion: "1", schemaVersion: "0.1-draft", rulesProfile: { id: "dnd.srd-5.2.1", version: "0.1-draft" }, defaultLocale: "ko-KR",
  content: [
    { id: "test.spell.witch-bolt", category: "spell", presentation: { originalName: "Witch Bolt", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "마녀 화살" } } },
      mechanics: [
        { kind: "spell-definition", config: { level: 1, school: "evocation", castingTimeText: "행동", rangeText: "60피트", durationText: "집중, 최대 1분", classes: ["warlock"] } },
        { kind: "spell-mechanic", config: { baseLevel: 1, castingEconomy: "action", targeting: { kind: "creature", rangeFeet: 60, minTargets: 1, maxTargets: 1 }, primary: { kind: "attack-damage", damageType: "lightning", dice: { count: 2, sides: 12, dicePerSlotAboveBase: 1 } }, concentration: true } },
      ] },
    { id: "test.spell.wrathful-smite", category: "spell", presentation: { originalName: "Wrathful Smite", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "분노의 강타" } } },
      mechanics: [{ kind: "spell-definition", config: { level: 1, castingTimeText: "추가 행동", rangeText: "자신", durationText: "1분", summary: "다음 명중에 1d6 사령", classes: ["paladin"] } }] },
  ],
} as unknown as RuleModuleJson;

test("R76: a module's spell-mechanic is the spell's execution, and a spell without one still casts (D211)", () => {
  const made = build({ name: "워락", classes: "warlock", level: 3 });
  const catalog = createCatalog([supplement]);
  const bolt = spellExec("test.spell.witch-bolt");
  assert.equal(bolt?.primary.kind, "attack-damage");
  assert.equal(bolt?.targeting.rangeFeet, 60);
  const smite = spellExec("test.spell.wrathful-smite");
  assert.deepEqual([smite?.primary.kind, smite?.castingEconomy, smite?.targeting.allowedRelations, smite?.concentration], ["tracked-effect", "bonus-action", ["self"], false]);
  assert.ok(spellExec("dnd.srd521.spell.fire-bolt"), "the SRD catalog is still there");

  const derived = structuredClone(made.derived);
  derived.spellcasting[0].prepared.push("test.spell.witch-bolt");
  assert.ok(castableSpells(derived).includes("test.spell.witch-bolt"), "the turn panel lists it");
  const cast = pcSpell({ runtime: initialRuntime(made.derived) }, derived, catalog, "test.spell.witch-bolt", { kind: "pact" });
  assert.equal(cast?.spec.exec.primary.kind, "attack-damage", "and casting it is a spell attack");
});

test("R76: the plain record reads economy, range and concentration from the spell's text (D211)", () => {
  const exec = execForCatalogSpell({ id: "x", level: 2, castingTime: "반응행동", range: "90피트", duration: "집중, 최대 10분", ritual: false });
  assert.deepEqual([exec.castingEconomy, exec.targeting.rangeFeet, exec.concentration, exec.primary.kind], ["reaction", 90, true, "tracked-effect"]);
  const broken = execForCatalogSpell({ id: "y", level: 1, castingTime: "행동", range: "자신", duration: "즉시", ritual: true, mechanic: { primary: { kind: "no-such-kind" } } });
  assert.equal(broken.primary.kind, "tracked-effect", "a mechanic the table cannot read falls back instead of breaking the cast");
});
