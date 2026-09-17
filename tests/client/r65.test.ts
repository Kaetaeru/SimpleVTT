/**
 * R65 (ROLL20_TABLE_SPEC.md D200): the turn panel is rows, one per part of the turn.
 *
 * The panel was a pile of menus — 행동▾ 추가 행동▾ 판정▾ 반응▾ 특성▾ 아이템▾ — and what a character could use this
 * turn had to be opened to be found. The 특성 menu also listed every feature with an activation, including lines
 * that do nothing when pressed ("서브클래스: 챔피언"). Now each usable feature says which part of the turn it belongs
 * to and whether pressing it does anything, and the panel puts the pressable ones on their row as buttons.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { featureEconomy, usableFeatures } from "../../client/character/activate";
import { initialRuntime } from "../../client/character/runtime";
import { build, catalog } from "./support";

const usable = (cls: string, level: number) => {
  const made = build({ name: cls, classes: cls, level });
  return usableFeatures(made.derived, initialRuntime(made.derived), catalog());
};
const named = (list: ReturnType<typeof usable>, name: string) => list.find((item) => item.feature.name.startsWith(name))!;

test("R65: the activation note decides the part of the turn (D200)", () => {
  // V1a (D253): the contract's economy payment, not the reminder text.
  assert.equal(featureEconomy("bonus-action"), "bonus");
  assert.equal(featureEconomy("reaction"), "reaction");
  assert.equal(featureEconomy("action"), "action");
  assert.equal(featureEconomy(undefined), "free");
});

test("R65: only what pressing does something for becomes a button (D200)", () => {
  const fighter = usable("fighter", 11);
  const secondWind = named(fighter, "재기의 바람");
  assert.equal(secondWind.economy, "bonus");
  assert.equal(secondWind.pressable, true, "a pool and a heal");
  const surge = named(fighter, "행동 폭증");
  assert.equal(surge.economy, "free", "행동 폭증 costs nothing of the turn by itself");
  assert.equal(surge.pressable, true);
  assert.equal(named(fighter, "서브클래스").pressable, false, "a subclass line is a sentence, not a button");
  // R72 (D207): Extra Attack is a number in a contract now, so it has no activation at all — still not a button.
  const extra = named(fighter, "추가 공격");
  assert.ok(!extra || !extra.pressable, "and neither is Extra Attack");

  const barbarian = usable("barbarian", 5);
  assert.equal(named(barbarian, "격노").economy, "bonus");
  assert.equal(named(barbarian, "격노").pressable, true, "an effect with rounds");
  // R96 (D231): 위험 감지 is a passive now, so it has no button at all.
  assert.ok(!named(barbarian, "위험 감지")?.pressable);
});
