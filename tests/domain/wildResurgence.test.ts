import assert from "node:assert/strict";
import test from "node:test";
import {
  DRUID_WILD_RESURGENCE_LONG_REST_RESOURCE_ID,
  DRUID_WILD_RESURGENCE_TURN_RESOURCE_ID,
  DRUID_WILD_SHAPE_RESOURCE_ID,
} from "../../src/domain/coreClassResources";
import { recoverResources } from "../../src/domain/resources";
import { resolveWildResurgence } from "../../src/domain/wildResurgence";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function druidState() {
  const state = runtimeState();
  const resources = state.combatants.hero.resources;
  resources.find((pool) => pool.id === "spell-slot-1")!.current = 2;
  resources.find((pool) => pool.id === "spell-slot-1")!.maximum = 4;
  resources.push(
    { id:"spell-slot-2", label:"2레벨 주문 슬롯", current:2, maximum:3, recovery:{ longRest:"all" } },
    { id:DRUID_WILD_SHAPE_RESOURCE_ID, label:"야생 변신", current:0, maximum:3, recovery:{ shortRest:1, longRest:"all" } },
    { id:DRUID_WILD_RESURGENCE_TURN_RESOURCE_ID, label:"야생의 재기 · 슬롯→야생 변신", current:1, maximum:1, recovery:{ turnStart:"all" } },
    { id:DRUID_WILD_RESURGENCE_LONG_REST_RESOURCE_ID, label:"야생의 재기 · 야생 변신→1레벨 슬롯", current:1, maximum:1, recovery:{ longRest:"all" } },
  );
  return state;
}

test("Wild Resurgence converts a spell slot into one Wild Shape use only when Wild Shape is empty, with no action cost", () => {
  const state = druidState();
  const result = resolveWildResurgence(TEST_PROFILE, state, {
    id:"wild-resurgence.slot-to-shape",
    actorId:"hero",
    expectedRevision:0,
    druidLevel:6,
    mode:"slot-to-wild-shape",
    slotLevel:2,
    slotResourceIds:{ 1:"spell-slot-1", 2:"spell-slot-2" },
  });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  const resources = result.state.combatants.hero.resources;
  assert.equal(resources.find((pool) => pool.id === "spell-slot-2")?.current, 1);
  assert.equal(resources.find((pool) => pool.id === DRUID_WILD_SHAPE_RESOURCE_ID)?.current, 1);
  assert.equal(resources.find((pool) => pool.id === DRUID_WILD_RESURGENCE_TURN_RESOURCE_ID)?.current, 0);
  assert.equal(result.state.combatants.hero.economy.action, true);
  assert.equal(result.state.combatants.hero.economy.bonusAction, true);

  const notEmpty = druidState();
  notEmpty.combatants.hero.resources.find((pool) => pool.id === DRUID_WILD_SHAPE_RESOURCE_ID)!.current = 1;
  const rejected = resolveWildResurgence(TEST_PROFILE, notEmpty, {
    id:"wild-resurgence.not-empty",
    actorId:"hero",
    expectedRevision:0,
    druidLevel:6,
    mode:"slot-to-wild-shape",
    slotLevel:1,
    slotResourceIds:{ 1:"spell-slot-1" },
  });
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.state, notEmpty);
  assert.match(rejected.status === "rejected" ? rejected.error : "", /only when no Wild Shape uses remain/);
});

test("slot-to-Wild-Shape conversion is limited once per turn and the turn gate recovers at turn start", () => {
  const state = druidState();
  const first = resolveWildResurgence(TEST_PROFILE, state, {
    id:"wild-resurgence.turn-1",
    actorId:"hero",
    expectedRevision:0,
    druidLevel:6,
    mode:"slot-to-wild-shape",
    slotLevel:1,
    slotResourceIds:{ 1:"spell-slot-1" },
  });
  assert.equal(first.status, "committed");
  if (first.status !== "committed") return;
  const sameTurn = structuredClone(first.state);
  sameTurn.combatants.hero.resources.find((pool) => pool.id === DRUID_WILD_SHAPE_RESOURCE_ID)!.current = 0;
  const second = resolveWildResurgence(TEST_PROFILE, sameTurn, {
    id:"wild-resurgence.turn-2",
    actorId:"hero",
    expectedRevision:sameTurn.revision,
    druidLevel:6,
    mode:"slot-to-wild-shape",
    slotLevel:1,
    slotResourceIds:{ 1:"spell-slot-1" },
  });
  assert.equal(second.status, "rejected");
  assert.equal(second.state, sameTurn);
  assert.match(second.status === "rejected" ? second.error : "", /cannot spend 1/);

  const recovered = recoverResources(sameTurn.combatants.hero.resources, "turnStart").next;
  assert.equal(recovered.find((pool) => pool.id === DRUID_WILD_RESURGENCE_TURN_RESOURCE_ID)?.current, 1);
});

test("Wild Resurgence spends one Wild Shape to restore one level-1 slot once per Long Rest", () => {
  const state = druidState();
  state.combatants.hero.resources.find((pool) => pool.id === DRUID_WILD_SHAPE_RESOURCE_ID)!.current = 2;
  const result = resolveWildResurgence(TEST_PROFILE, state, {
    id:"wild-resurgence.shape-to-slot",
    actorId:"hero",
    expectedRevision:0,
    druidLevel:6,
    mode:"wild-shape-to-slot",
    slotResourceIds:{ 1:"spell-slot-1" },
  });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  const resources = result.state.combatants.hero.resources;
  assert.equal(resources.find((pool) => pool.id === DRUID_WILD_SHAPE_RESOURCE_ID)?.current, 1);
  assert.equal(resources.find((pool) => pool.id === "spell-slot-1")?.current, 3);
  assert.equal(resources.find((pool) => pool.id === DRUID_WILD_RESURGENCE_LONG_REST_RESOURCE_ID)?.current, 0);
  assert.equal(result.state.combatants.hero.economy.action, true);
  assert.equal(result.state.combatants.hero.economy.bonusAction, true);

  const second = resolveWildResurgence(TEST_PROFILE, result.state, {
    id:"wild-resurgence.shape-to-slot-again",
    actorId:"hero",
    expectedRevision:result.state.revision,
    druidLevel:6,
    mode:"wild-shape-to-slot",
    slotResourceIds:{ 1:"spell-slot-1" },
  });
  assert.equal(second.status, "rejected");
  assert.equal(second.state, result.state);

  const recovered = recoverResources(result.state.combatants.hero.resources, "longRest").next;
  assert.equal(recovered.find((pool) => pool.id === DRUID_WILD_RESURGENCE_LONG_REST_RESOURCE_ID)?.current, 1);
});

test("restoring a full level-1 slot pool rejects atomically without spending Wild Shape or the Long-Rest gate", () => {
  const state = druidState();
  state.combatants.hero.resources.find((pool) => pool.id === DRUID_WILD_SHAPE_RESOURCE_ID)!.current = 2;
  state.combatants.hero.resources.find((pool) => pool.id === "spell-slot-1")!.current = 4;
  const result = resolveWildResurgence(TEST_PROFILE, state, {
    id:"wild-resurgence.full-slot",
    actorId:"hero",
    expectedRevision:0,
    druidLevel:6,
    mode:"wild-shape-to-slot",
    slotResourceIds:{ 1:"spell-slot-1" },
  });
  assert.equal(result.status, "rejected");
  assert.equal(result.state, state);
  assert.equal(state.combatants.hero.resources.find((pool) => pool.id === DRUID_WILD_SHAPE_RESOURCE_ID)?.current, 2);
  assert.equal(state.combatants.hero.resources.find((pool) => pool.id === DRUID_WILD_RESURGENCE_LONG_REST_RESOURCE_ID)?.current, 1);
  assert.match(result.status === "rejected" ? result.error : "", /cannot exceed maximum 4/);
});

test("Wild Resurgence rejects below Druid level 5 without mutating state", () => {
  const state = druidState();
  const result = resolveWildResurgence(TEST_PROFILE, state, {
    id:"wild-resurgence.too-low",
    actorId:"hero",
    expectedRevision:0,
    druidLevel:4,
    mode:"slot-to-wild-shape",
    slotLevel:1,
    slotResourceIds:{ 1:"spell-slot-1" },
  });
  assert.equal(result.status, "rejected");
  assert.equal(result.state, state);
  assert.match(result.status === "rejected" ? result.error : "", /requires Druid level 5-20/);
});
