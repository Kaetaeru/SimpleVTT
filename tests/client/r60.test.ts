/**
 * R60 (ROLL20_TABLE_SPEC.md D195): the three ways a rule touches the weapon's own damage dice.
 *
 * 대형 무기 전투 already lifted a 1 or a 2 to a 3, and it did it through a flag on the weapon that only the feat
 * catalog could set. Three more rules want the same seam and none could reach it: 관통자 rerolls one die and keeps
 * the new result, its critical adds a die of the weapon's own size, and 원소 숙련자 treats a 1 as a 2 on the damage
 * type it chose. `property.modify` says which — `damage.reroll-lowest`, `damage.extra-die`, `damage.die-minimum` —
 * and the swing carries them as `AttackSpec.diceRules`.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createCatalog } from "../../client/catalog";
import { autofill } from "../../client/character/autofill";
import { emptySource } from "../../client/character/source";
import { deriveCharacter } from "../../client/character/derive";
import { initialRuntime } from "../../client/character/runtime";
import { addItem } from "../../client/character/play";
import { offeredRiders } from "../../client/rules/attackRiders";
import { pcAttackSpec } from "../../client/rules/attackSpec";
import { applyDamage, diceRuleOf, resolveAttack, type Combatant, type DamagePart } from "../../client/rules/resolve";
import { ids } from "./support";

const CONTRACTS = JSON.parse(readFileSync("content/supplements/phb-2024.feat-common-play/module.json", "utf8"));
const featEntry = (slug: string, name: string) => ({
  id: `phb2024.feat.${slug}`, category: "feat",
  presentation: { defaultLocale: "ko-KR", originalName: name, locales: { "ko-KR": { name } } },
  mechanics: [{ kind: "feat-definition", config: { tier: "general", minimumLevel: 4, abilityIncrease: { any: ["str"], amount: 1, maximum: 20 } } }],
});
const supplement = (slug: string, name: string) => ({
  $schema: "https://simplevtt.local/schemas/rule-module.schema.json", schemaVersion: "0.1-draft",
  moduleId: "phb-2024-supplement", moduleVersion: "1", rulesProfile: { id: "dnd.srd-5.2.1", version: "0.1-draft" },
  defaultLocale: "ko-KR", dependencies: [], conflicts: [], capabilities: [], extensionPoints: [], content: [featEntry(slug, name)],
});

/** A fighter with a spear, which deals piercing damage. */
function piercerFighter(slug = "piercer", name = "관통자") {
  const catalog = createCatalog([supplement(slug, name), CONTRACTS] as never);
  const base = emptySource({
    name: "전사", origin: { speciesId: ids.species("human"), backgroundId: ids.background("criminal") },
    abilities: { method: "manual", base: { str: 17, dex: 12, con: 14, int: 10, wis: 10, cha: 8 } },
    tracks: Array.from({ length: 8 }, () => ({ classId: ids.cls("fighter"), hp: { kind: "fixed" as const } })),
    equipment: { mode: "loadout" },
  });
  const made = autofill(base, catalog, { prefer: { "class.3.asi": [`phb2024.feat.${slug}`] } });
  const runtime = addItem(initialRuntime(made.derived), { itemId: "dnd.srd521.item.weapon.spear", name: "창" });
  const derived = deriveCharacter(made.source, catalog, { equipped: runtime.equipped, inventory: runtime.inventory });
  return { catalog, runtime, derived };
}

const target = (): Combatant => ({ id: "t", name: "대상", kind: "npc", ac: 10, hp: { current: 80, max: 80, temp: 0 }, conditions: [], defenses: { resistances: [], immunities: [], vulnerabilities: [] }, conSave: 0, effects: [] });
/** Dice that walk a fixed list, so "which die was rerolled" is not a matter of luck. */
const scripted = (...values: number[]) => ({ d: (sides: number) => { const value = values.shift(); if (value === undefined) throw new Error("dice ran out"); return Math.min(sides, value); } });

test("R60: the three names, and only those three, become dice rules (D195)", () => {
  assert.deepEqual(diceRuleOf("damage.reroll-lowest", 1, "관통자"), { mode: "reroll-lowest", value: 1, label: "관통자" });
  assert.deepEqual(diceRuleOf("damage.extra-die", 1, "관통자", true), { mode: "extra-die", value: 1, label: "관통자", onCrit: true });
  assert.deepEqual(diceRuleOf("damage.die-minimum", 2, "원소 숙련자"), { mode: "die-minimum", value: 2, label: "원소 숙련자" });
  assert.equal(diceRuleOf("damage.bonus", 2, "무엇"), null, "an ordinary damage bonus is not a dice rule");
  // A missing or nonsense number falls back to what the rule means rather than to zero.
  assert.equal(diceRuleOf("damage.extra-die", Number.NaN, "x")!.value, 1);
  assert.equal(diceRuleOf("damage.die-minimum", Number.NaN, "x")!.value, 2);
});

test("R60: rerolling the lowest die keeps the new result, for better or worse (D195)", () => {
  const parts: DamagePart[] = [{ formula: "2d6+3", type: "관통", label: "창" }];
  const rules = [{ mode: "reroll-lowest" as const, value: 1, label: "관통자" }];
  // 2 and 5 are rolled; the 2 is rerolled into a 6.
  const better = applyDamage(target(), parts, scripted(2, 5, 6), { diceRules: rules });
  assert.deepEqual(better.damage[0].dice, [6, 5]);
  assert.equal(better.damageTotal, 6 + 5 + 3);
  // And the same reroll can come up worse; 2024 says you must use it.
  const worse = applyDamage(target(), parts, scripted(2, 5, 1), { diceRules: rules });
  assert.deepEqual(worse.damage[0].dice, [1, 5]);
  assert.equal(worse.damageTotal, 1 + 5 + 3);
  // With no rule the dice stand.
  assert.deepEqual(applyDamage(target(), parts, scripted(2, 5), {}).damage[0].dice, [2, 5]);
});

test("R60: an extra die is the weapon's own size, and a floor lifts every die (D195)", () => {
  const parts: DamagePart[] = [{ formula: "1d8+3", type: "관통", label: "창" }];
  const extra = applyDamage(target(), parts, scripted(4, 7), { diceRules: [{ mode: "extra-die", value: 1, label: "관통자" }] });
  assert.deepEqual(extra.damage[0].dice, [4, 7], "1d8 plus one more d8");
  assert.equal(extra.damageTotal, 4 + 7 + 3);
  const floored = applyDamage(target(), [{ formula: "2d6", type: "화염", label: "불꽃" }], scripted(1, 1), { diceRules: [{ mode: "die-minimum", value: 2, label: "원소 숙련자" }] });
  assert.deepEqual(floored.damage[0].dice, [2, 2]);
  // A flat rider has no dice of its own, so nothing touches it.
  const rider: DamagePart[] = [{ formula: "1d6", type: "관통", label: "창" }, { formula: "4", type: "화염", label: "리본", critDoubles: false }];
  const mixed = applyDamage(target(), rider, scripted(3, 6), { diceRules: [{ mode: "extra-die", value: 1, label: "관통자" }] });
  assert.deepEqual(mixed.damage[0].dice, [3, 6]);
  assert.deepEqual(mixed.damage[1].dice, []);
});

test("R60: an onCrit rule waits for the critical, and reused dice are never touched (D195)", () => {
  const parts: DamagePart[] = [{ formula: "1d8", type: "관통", label: "창" }];
  const rules = [{ mode: "extra-die" as const, value: 1, label: "관통자", onCrit: true }];
  assert.deepEqual(applyDamage(target(), parts, scripted(5), { diceRules: rules }).damage[0].dice, [5], "a plain hit gets nothing");
  // A critical doubles the weapon's dice first, then the rule adds its own.
  assert.deepEqual(applyDamage(target(), parts, scripted(5, 5, 8), { crit: true, diceRules: rules }).damage[0].dice, [5, 5, 8]);
  // Re-resolving a card hands the dice back; the rule must not roll again on numbers the player already saw.
  const again = applyDamage(target(), parts, scripted(), { crit: true, diceRules: rules, fixed: [[5, 5, 8]] });
  assert.deepEqual(again.damage[0].dice, [5, 5, 8]);
});

test("R60: 관통자 declares its reroll in the dialog and its extra die on a critical (D195)", () => {
  const { catalog, runtime, derived } = piercerFighter();
  const spear = derived.attacks.find((attack) => attack.itemId?.endsWith(".spear"))!;
  assert.equal(spear.damageType, "관통", spear.damageType);
  const [rider] = offeredRiders(derived, spear);
  assert.ok(rider, JSON.stringify(derived.attackRiders));
  assert.deepEqual(rider.dice, [{ mode: "reroll-lowest", value: 1, label: "관통자" }]);
  assert.ok(rider.hint.includes("다시 굴림"), rider.hint);

  const declared = pcAttackSpec({ runtime } as never, derived, spear.id, { contracts: ["feat:piercer"] }, catalog)!.spec;
  assert.deepEqual(declared.diceRules, [
    { mode: "reroll-lowest", value: 1, label: "관통자" },
    { mode: "extra-die", value: 1, label: "관통자 (치명타)", onCrit: true },
  ], "the critical's die rides along, waiting for the critical");
  // Undeclared, only the critical half is on the swing.
  const plain = pcAttackSpec({ runtime } as never, derived, spear.id, {}, catalog)!.spec;
  assert.deepEqual(plain.diceRules, [{ mode: "extra-die", value: 1, label: "관통자 (치명타)", onCrit: true }]);

  // And it really reaches the resolver: 1d6 rolling a 1, rerolled into a 6.
  const swing = resolveAttack({ ...target(), kind: "pc" }, target(), declared, { dice: scripted(1, 6), fixed: { d20s: [15] } });
  assert.equal(swing.outcome, "hit");
  assert.deepEqual(swing.damage[0].dice, [6]);
});
