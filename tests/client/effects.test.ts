/**
 * Effects in force change the sheet with provenance: Rage adds its damage bonus to Strength attacks and weapon
 * resistances; Bless adds 1d4 dice to attacks and saves; Shield +5 AC; Mage Armor replaces the unarmored base;
 * Haste doubles speed; Aid raises the maximum; an unknown effect is listed as not applied.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { deriveCharacter } from "../../client/character/derive";
import { castSpell, useFeature } from "../../client/character/play";
import { initialRuntime } from "../../client/character/runtime";
import type { ActiveEffect } from "../../client/character/types";
import { featureActivation } from "../../client/rules/activation";
import { build, catalog } from "./support";

const effect = (key: string, name: string, source: "feature" | "spell" = "spell"): ActiveEffect => ({ key, name, source, duration: "1분", concentration: false, elapsed: 0, startedAt: "2026-01-01T00:00:00.000Z" });
const spellId = (nameEn: string) => catalog().spellByName(nameEn)!.id;

test("Rage: +2 damage on Strength melee attacks (not bows), weapon resistances, listed as applied", () => {
  const { source, derived } = build({ classes: "barbarian", level: 3, abilities: { str: 16, dex: 12 } }, { "equipment.class": ["A"] });
  const rage = derived.features.find((feature) => feature.id.endsWith("barbarian.rage"))!;
  let runtime = initialRuntime(derived);
  runtime = useFeature(runtime, derived, rage, featureActivation(rage, derived)!)!;
  const raging = deriveCharacter(source, catalog(), { equipped: runtime.equipped, inventory: runtime.inventory, effects: runtime.effects });
  const before = derived.attacks.find((attack) => attack.itemId && attack.ability === "str" && !attack.properties.includes("ammunition"))!;
  const axe = raging.attacks.find((attack) => attack.id === before.id)!;
  assert.equal(axe.damageBonus, before.damageBonus + 2);
  assert.ok(axe.damageTerms.some((term) => term.label === "격노" && term.value === 2));
  const unarmed = raging.attacks.find((attack) => attack.name === "비무장 공격")!;
  assert.equal(unarmed.damageBonus, derived.attacks.find((attack) => attack.name === "비무장 공격")!.damageBonus + 2);
  const javelin = raging.attacks.find((attack) => attack.name.includes("투창"));
  if (javelin) assert.ok(javelin.damageTerms.some((term) => term.label === "격노"), "thrown Strength weapons rage too");
  assert.ok(raging.defenses.resistances.some((line) => line.startsWith("타격")) && raging.defenses.resistances.some((line) => line.startsWith("참격")));
  assert.equal(raging.activeEffects[0]?.applied, true);
  assert.ok(raging.activeEffects[0]?.notes.some((note) => note.includes("근력")));
  const level9 = build({ classes: "barbarian", level: 9 }).derived;
  const rage9 = deriveCharacter(build({ classes: "barbarian", level: 9 }).source, catalog(), { effects: [effect("feature:barbarian.rage", "격노", "feature")] });
  assert.ok(rage9.attacks.find((attack) => attack.name === "비무장 공격")!.damageTerms.some((term) => term.label === "격노" && term.value === 3), `rage +3 at level 9 (${level9.level})`);
});

test("Bless adds 1d4 dice terms to every attack and save; Guidance to checks; the numbers stay", () => {
  const { source, derived } = build({ classes: "cleric", level: 3 });
  const blessed = deriveCharacter(source, catalog(), { effects: [effect(`spell:${spellId("Bless")}`, "축복"), effect(`spell:${spellId("Guidance")}`, "인도")] });
  for (const attack of blessed.attacks) { assert.ok(attack.attackTerms.some((term) => term.dice === "1d4" && term.label === "축복"), attack.name); assert.equal(attack.attackBonus, derived.attacks.find((item) => item.id === attack.id)!.attackBonus); }
  assert.ok(blessed.saves.wis.terms.some((term) => term.dice === "1d4"));
  assert.ok(blessed.checkTerms.some((term) => term.dice === "1d4" && term.label === "인도"));
  assert.ok(blessed.skills[0].terms.some((term) => term.dice === "1d4"));
  assert.equal(blessed.activeEffects.length, 2);
});

test("Shield +5 AC, Mage Armor 13 + Dex only when unarmored and better, Haste doubles speed, Aid +5 max HP, unknown effect flagged", () => {
  const wizard = build({ classes: "wizard", level: 3, abilities: { dex: 14 } });
  const shielded = deriveCharacter(wizard.source, catalog(), { effects: [effect(`spell:${spellId("Shield")}`, "방패")] });
  assert.equal(shielded.ac.value, wizard.derived.ac.value + 5);
  assert.ok(shielded.ac.terms.some((term) => term.label === "방패" && term.value === 5));
  const armored = deriveCharacter(wizard.source, catalog(), { effects: [effect(`spell:${spellId("Mage Armor")}`, "마법 갑옷")] });
  assert.equal(armored.ac.value, 13 + 2);
  assert.equal(armored.ac.source, "마법 갑옷");
  const fighter = build({ classes: "fighter", level: 3 }, { "equipment.class": ["A"] });
  const fighterMageArmor = deriveCharacter(fighter.source, catalog(), { effects: [effect(`spell:${spellId("Mage Armor")}`, "마법 갑옷")] });
  assert.equal(fighterMageArmor.ac.value, fighter.derived.ac.value, "wearing armor: Mage Armor does nothing");
  const hasted = deriveCharacter(wizard.source, catalog(), { effects: [effect(`spell:${spellId("Haste")}`, "가속")] });
  assert.equal(hasted.speed.walk, wizard.derived.speed.walk * 2);
  assert.equal(hasted.ac.value, wizard.derived.ac.value + 2);
  const aided = deriveCharacter(wizard.source, catalog(), { effects: [effect(`spell:${spellId("Aid")}`, "지원")] });
  assert.equal(aided.hp.max, wizard.derived.hp.max + 5);
  assert.equal(aided.hp.terms.reduce((total, term) => total + term.value, 0), aided.hp.max);
  const unknown = deriveCharacter(wizard.source, catalog(), { effects: [effect("spell:dnd.srd521.spell.nonexistent", "이상한 주문")] });
  assert.equal(unknown.activeEffects[0]?.applied, false);
  assert.equal(unknown.ac.value, wizard.derived.ac.value);
});

test("casting Bless on the sheet path makes the effect reach the sheet", () => {
  const { source, derived } = build({ classes: "cleric", level: 3 });
  const bless = catalog().spellByName("Bless")!;
  let runtime = initialRuntime(derived);
  runtime = castSpell(runtime, derived, bless, { kind: "slot", level: 1 })!;
  const live = deriveCharacter(source, catalog(), { effects: runtime.effects });
  assert.ok(live.attacks[0].attackTerms.some((term) => term.dice === "1d4"));
});
