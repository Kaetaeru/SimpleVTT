/**
 * R32 (ROLL20_TABLE_SPEC.md D165–D167): the SRD's seventeen feats, one at a time.
 *
 * Measured first, then fixed. 궁술 and 방어 were already on the numbers; 경계 already adds its proficiency bonus to
 * initiative (an earlier reading of this said otherwise — the baseline build had autofilled Alert as its own origin
 * feat, so both sides of the comparison had it). The two that really did nothing were 대형 무기 전투, whose ledger
 * flag was set and read by no one, and 야만적 공격자, which had no reroll seam anywhere.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { addItem } from "../../client/character/play";
import { deriveCharacter } from "../../client/character/derive";
import { initialRuntime } from "../../client/character/runtime";
import { applyDamage, diceFrom, type Combatant } from "../../client/rules/resolve";
import { hasSavageAttacker, pcAttackSpec } from "../../client/rules/attackSpec";
import { build, catalog, ids } from "./support";

const target = (): Combatant => ({ id: "t", name: "대상", kind: "npc", ac: 13, hp: { current: 60, max: 60, temp: 0 }, conditions: [], defenses: { resistances: [], immunities: [], vulnerabilities: [] }, conSave: 0, effects: [] });
/** Dice that walk a fixed list, so "which roll was kept" is not a matter of luck. */
const scripted = (...values: number[]) => ({ d: (sides: number) => { const value = values.shift(); if (value === undefined) throw new Error("dice ran out"); return Math.min(sides, value); } });

/** 군인 hands out 야만적 공격자 as its own origin feat, so a build that must not have it uses another background. */
function fighter(style: string, originFeat?: string, background = "criminal") {
  const made = build({ name: "전사", classes: "fighter", level: 4, background, abilities: { str: 16, dex: 16 } }, {
    "class.0.fighting-style": [`dnd.srd521.feat.fighting-style.${style}`],
    ...(originFeat ? { "origin.species.originFeat": [`dnd.srd521.feat.${originFeat}`] } : {}),
  });
  let runtime = initialRuntime(made.derived);
  runtime = addItem(runtime, { itemId: "dnd.srd521.item.weapon.greatsword", name: "대검" });
  runtime = addItem(runtime, { itemId: "dnd.srd521.item.weapon.longbow", name: "장궁" });

  const derived = deriveCharacter(made.source, catalog(), { equipped: runtime.equipped, inventory: runtime.inventory });
  return { made, runtime, derived };
}

test("feats: 궁술 and 방어 were already on the numbers, and 경계 already adds its proficiency bonus (D167)", () => {
  const archery = fighter("archery").derived;
  const defense = fighter("defense").derived;
  assert.equal(archery.attacks.find((attack) => attack.name === "장궁")!.attackBonus - defense.attacks.find((attack) => attack.name === "장궁")!.attackBonus, 2, "궁술 is +2 on a ranged weapon");
  assert.equal(defense.ac.value - archery.ac.value, 1, "방어 is +1 AC in armour");
  const alert = build({ name: "t", classes: "fighter", level: 4, abilities: { dex: 16 } }, { "origin.species.originFeat": ["dnd.srd521.feat.alert"] }).derived;
  const skilled = build({ name: "t", classes: "fighter", level: 4, abilities: { dex: 16 } }, { "origin.species.originFeat": ["dnd.srd521.feat.skilled"] }).derived;
  assert.equal(alert.initiative - skilled.initiative, alert.proficiencyBonus, "경계 adds the proficiency bonus to initiative");
  assert.ok(alert.initiativeTerms.some((term) => term.label.includes("경계")), JSON.stringify(alert.initiativeTerms));
  void ids;
});

test("feats: 대형 무기 전투 lifts a damage die of 1 or 2 to 3, on a two-handed weapon only (D165)", () => {
  const gwf = fighter("great-weapon-fighting");
  const plain = fighter("defense");
  const swordOf = (made: ReturnType<typeof fighter>) => made.derived.attacks.find((attack) => attack.name === "대검")!;
  assert.equal(swordOf(gwf).dieMinimum, 3, "the style reaches the weapon");
  assert.equal(swordOf(plain).dieMinimum, undefined);
  // 2024 GWF reads "a weapon with the Two-Handed or Versatile property", so a shortsword (light, finesse) is out
  // — and a longbow, being Two-Handed, is in, quirk and all.
  const oneHanded = gwf.derived.attacks.find((attack) => !attack.properties.includes("two-handed") && !attack.properties.some((property) => property.startsWith("versatile")) && attack.itemId)!;
  assert.ok(oneHanded, gwf.derived.attacks.map((attack) => `${attack.name}:${attack.properties.join("/")}`).join(" | "));
  assert.equal(oneHanded.dieMinimum, undefined, `${oneHanded.name} is neither two-handed nor versatile, so the style leaves it alone`);
  // 2d6 + 3, both dice rolling a 1: plain is 1+1+3 = 5, the style is 3+3+3 = 9.
  const spec = (made: ReturnType<typeof fighter>) => pcAttackSpec({ runtime: made.runtime } as never, made.derived, swordOf(made).id, {})!.spec;
  const plainRoll = applyDamage(target(), spec(plain).damage, scripted(1, 1), {});
  const gwfRoll = applyDamage(target(), spec(gwf).damage, scripted(1, 1), {});
  assert.equal(gwfRoll.damageTotal - plainRoll.damageTotal, 4, `${plainRoll.damageTotal} → ${gwfRoll.damageTotal}`);
  // A die that already beats the floor is untouched.
  assert.equal(applyDamage(target(), spec(gwf).damage, scripted(6, 5), {}).damageTotal, applyDamage(target(), spec(plain).damage, scripted(6, 5), {}).damageTotal);
});

test("feats: 야만적 공격자 rerolls the weapon dice and keeps the better set (D166)", () => {
  const savage = fighter("defense", "savage-attacker");
  const plain = fighter("defense", "skilled");
  assert.ok(!plain.derived.features.some((feature) => /야만적 공격자/.test(feature.name)), plain.derived.features.map((feature) => feature.name).join(","));
  assert.equal(hasSavageAttacker(savage.derived), true);
  assert.equal(hasSavageAttacker(plain.derived), false);
  const sword = savage.derived.attacks.find((attack) => attack.name === "대검")!;
  const entry = { runtime: savage.runtime } as never;
  const off = pcAttackSpec(entry, savage.derived, sword.id, {})!.spec;
  const on = pcAttackSpec(entry, savage.derived, sword.id, { savage: true })!.spec;
  assert.equal(off.savage, undefined, "not asked for, not applied");
  assert.equal(on.savage, true);
  assert.ok(on.name.includes("야만적 공격자"), on.name);
  const bonus = sword.damageBonus;
  // First roll 1+1, second 6+6: the second set is kept.
  assert.equal(applyDamage(target(), on.damage, scripted(1, 1, 6, 6), { savage: true }).damageTotal, 6 + 6 + bonus);
  // First roll 6+6, second 1+1: the first set stands.
  assert.equal(applyDamage(target(), on.damage, scripted(6, 6, 1, 1), { savage: true }).damageTotal, 6 + 6 + bonus);
  // Without the feat asked for, the dice are rolled once.
  assert.equal(applyDamage(target(), off.damage, scripted(1, 1), {}).damageTotal, 1 + 1 + bonus);
});
