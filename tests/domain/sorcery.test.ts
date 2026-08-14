import assert from "node:assert/strict";
import test from "node:test";
import { recoverResources } from "../../src/domain/resources";
import {
  SORCERY_POINT_RESOURCE_ID,
  resolveFontOfMagic,
  sorceryPointMaximum,
} from "../../src/domain/sorcery";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function sorcererState() {
  const state = runtimeState();
  state.combatants.hero.resources.push(
    { id:"spell-slot-2", label:"2레벨 주문 슬롯", current:1, maximum:2, recovery:{ longRest:"all" } },
    { id:SORCERY_POINT_RESOURCE_ID, label:"소서리 포인트", current:1, maximum:5, recovery:{ longRest:"all" } },
  );
  return state;
}

test("Sorcery Point maximum follows Sorcerer class level rather than total character level", () => {
  assert.equal(sorceryPointMaximum(0), 0);
  assert.equal(sorceryPointMaximum(1), 0);
  assert.equal(sorceryPointMaximum(2), 2);
  assert.equal(sorceryPointMaximum(5), 5);
  assert.equal(sorceryPointMaximum(20), 20);
});

test("Font of Magic converts a spell slot to Sorcery Points with no action and rejects overflow atomically", () => {
  const state = sorcererState();
  const committed = resolveFontOfMagic(TEST_PROFILE, state, {
    id:"font.slot-to-points",
    actorId:"hero",
    expectedRevision:0,
    sorcererLevel:5,
    mode:"slot-to-points",
    slotLevel:2,
    slotResourceIds:{ 1:"spell-slot-1", 2:"spell-slot-2" },
  });
  assert.equal(committed.status, "committed");
  if (committed.status !== "committed") return;
  assert.equal(committed.state.combatants.hero.resources.find((pool) => pool.id === "spell-slot-2")?.current, 0);
  assert.equal(committed.state.combatants.hero.resources.find((pool) => pool.id === SORCERY_POINT_RESOURCE_ID)?.current, 3);
  assert.equal(committed.state.combatants.hero.economy.action, true);
  assert.equal(committed.state.combatants.hero.economy.bonusAction, true);

  const overflow = sorcererState();
  overflow.combatants.hero.resources.find((pool) => pool.id === SORCERY_POINT_RESOURCE_ID)!.current = 4;
  const rejected = resolveFontOfMagic(TEST_PROFILE, overflow, {
    id:"font.overflow",
    actorId:"hero",
    expectedRevision:0,
    sorcererLevel:5,
    mode:"slot-to-points",
    slotLevel:2,
    slotResourceIds:{ 2:"spell-slot-2" },
  });
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.state, overflow);
  assert.equal(overflow.combatants.hero.resources.find((pool) => pool.id === "spell-slot-2")?.current, 1);
  assert.match(rejected.status === "rejected" ? rejected.error : "", /cannot exceed maximum 5/);
});

test("Font of Magic creates a temporary spell-slot capacity with a Bonus Action and Long Rest removes that capacity", () => {
  const state = sorcererState();
  state.combatants.hero.resources.find((pool) => pool.id === SORCERY_POINT_RESOURCE_ID)!.current = 5;
  const committed = resolveFontOfMagic(TEST_PROFILE, state, {
    id:"font.points-to-slot",
    actorId:"hero",
    expectedRevision:0,
    sorcererLevel:5,
    mode:"points-to-slot",
    slotLevel:2,
    slotResourceIds:{ 1:"spell-slot-1", 2:"spell-slot-2" },
  });
  assert.equal(committed.status, "committed");
  if (committed.status !== "committed") return;
  const points = committed.state.combatants.hero.resources.find((pool) => pool.id === SORCERY_POINT_RESOURCE_ID)!;
  const slot = committed.state.combatants.hero.resources.find((pool) => pool.id === "spell-slot-2")!;
  assert.equal(points.current, 2);
  assert.equal(slot.current, 2);
  assert.equal(slot.maximum, 3);
  assert.equal(slot.maximumAfterLongRest, 2);
  assert.equal(committed.state.combatants.hero.economy.bonusAction, false);

  const rested = recoverResources(committed.state.combatants.hero.resources, "longRest").next;
  const restedSlot = rested.find((pool) => pool.id === "spell-slot-2")!;
  assert.equal(restedSlot.maximum, 2);
  assert.equal(restedSlot.current, 2);
  assert.equal(restedSlot.maximumAfterLongRest, undefined);
  assert.equal(rested.find((pool) => pool.id === SORCERY_POINT_RESOURCE_ID)?.current, 5);
});

test("Font of Magic can create a temporary slot pool and removes the whole temporary pool capacity on Long Rest", () => {
  const state = sorcererState();
  state.combatants.hero.resources.find((pool) => pool.id === SORCERY_POINT_RESOURCE_ID)!.current = 7;
  state.combatants.hero.resources.find((pool) => pool.id === SORCERY_POINT_RESOURCE_ID)!.maximum = 9;
  const committed = resolveFontOfMagic(TEST_PROFILE, state, {
    id:"font.create-new-level",
    actorId:"hero",
    expectedRevision:0,
    sorcererLevel:9,
    mode:"points-to-slot",
    slotLevel:5,
    slotResourceIds:{ 1:"spell-slot-1", 2:"spell-slot-2" },
  });
  assert.equal(committed.status, "committed");
  if (committed.status !== "committed") return;
  const created = committed.state.combatants.hero.resources.find((pool) => pool.id === "spell-slot-5")!;
  assert.equal(created.current, 1);
  assert.equal(created.maximum, 1);
  assert.equal(created.maximumAfterLongRest, 0);
  const rested = recoverResources(committed.state.combatants.hero.resources, "longRest").next;
  assert.equal(rested.find((pool) => pool.id === "spell-slot-5")?.current, 0);
  assert.equal(rested.find((pool) => pool.id === "spell-slot-5")?.maximum, 0);
});

test("Font of Magic enforces creation minimum level and available Bonus Action before spending Sorcery Points", () => {
  const tooLow = sorcererState();
  tooLow.combatants.hero.resources.find((pool) => pool.id === SORCERY_POINT_RESOURCE_ID)!.current = 5;
  const levelRejected = resolveFontOfMagic(TEST_PROFILE, tooLow, {
    id:"font.level-reject",
    actorId:"hero",
    expectedRevision:0,
    sorcererLevel:4,
    mode:"points-to-slot",
    slotLevel:3,
    slotResourceIds:{ 3:"spell-slot-3" },
  });
  assert.equal(levelRejected.status, "rejected");
  assert.equal(levelRejected.state, tooLow);

  const noBonus = sorcererState();
  noBonus.combatants.hero.resources.find((pool) => pool.id === SORCERY_POINT_RESOURCE_ID)!.current = 5;
  noBonus.combatants.hero.economy.bonusAction = false;
  const actionRejected = resolveFontOfMagic(TEST_PROFILE, noBonus, {
    id:"font.action-reject",
    actorId:"hero",
    expectedRevision:0,
    sorcererLevel:5,
    mode:"points-to-slot",
    slotLevel:2,
    slotResourceIds:{ 2:"spell-slot-2" },
  });
  assert.equal(actionRejected.status, "rejected");
  assert.equal(actionRejected.state, noBonus);
  assert.equal(noBonus.combatants.hero.resources.find((pool) => pool.id === SORCERY_POINT_RESOURCE_ID)?.current, 5);
});
