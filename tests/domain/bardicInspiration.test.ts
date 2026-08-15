import assert from "node:assert/strict";
import test from "node:test";
import {
  BARDIC_INSPIRATION_RESOURCE_ID,
  bardicInspirationDieSides,
  bardicInspirationMaximum,
  bardicInspirationResourceDefinition,
  resolveFontOfInspirationSlotRecovery,
  resolveGrantBardicInspiration,
  resolveSuperiorInspirationOnInitiative,
  resolveUseBardicInspiration,
} from "../../src/domain/bardicInspiration";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function addInspiration(state:ReturnType<typeof runtimeState>,current:number,maximum:number,recovery:{ shortRest?:number|"all"; longRest?:number|"all" } = { longRest:"all" }) {
  state.combatants.hero.resources.push({
    id:BARDIC_INSPIRATION_RESOURCE_ID,
    label:"바드의 영감",
    current,
    maximum,
    recovery,
  });
}

test("Bardic Inspiration scaling and resource maximum follow Bard level and Charisma", () => {
  assert.equal(bardicInspirationDieSides(1),6);
  assert.equal(bardicInspirationDieSides(5),8);
  assert.equal(bardicInspirationDieSides(10),10);
  assert.equal(bardicInspirationDieSides(15),12);
  assert.equal(bardicInspirationMaximum(-2),1);
  assert.equal(bardicInspirationMaximum(4),4);
  assert.deepEqual(bardicInspirationResourceDefinition(4,3).recovery,{ longRest:"all" });
  assert.deepEqual(bardicInspirationResourceDefinition(5,3).recovery,{ shortRest:"all", longRest:"all" });
});

test("granting Bardic Inspiration spends Bonus Action and one use and creates a one-hour die effect on another creature", () => {
  const state = runtimeState();
  addInspiration(state,3,3);
  const result = resolveGrantBardicInspiration(TEST_PROFILE,state,{
    id:"bard.inspire",
    actorId:"hero",
    targetId:"goblin",
    expectedRevision:0,
    bardLevel:5,
    distanceFeet:30,
    targetCanSeeOrHearBard:true,
    useBonusAction:true,
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.hero.economy.bonusAction,false);
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === BARDIC_INSPIRATION_RESOURCE_ID)?.current,2);
  const effect = result.state.effects.find((entry) => entry.targetId === "goblin" && entry.tags.includes("bardic-inspiration"));
  assert.ok(effect);
  assert.equal(effect?.metadata?.dieSides,8);
  assert.deepEqual(effect?.expiry,{ kind:"time", elapsedSeconds:3600 });
});

test("a creature cannot receive a second Bardic Inspiration die while one is active", () => {
  const state = runtimeState();
  addInspiration(state,3,3);
  const first = resolveGrantBardicInspiration(TEST_PROFILE,state,{
    id:"bard.inspire.first",
    actorId:"hero",
    targetId:"goblin",
    expectedRevision:0,
    bardLevel:1,
    distanceFeet:30,
    targetCanSeeOrHearBard:true,
    useBonusAction:false,
  });
  assert.equal(first.status,"committed");
  if (first.status !== "committed") return;
  const second = resolveGrantBardicInspiration(TEST_PROFILE,first.state,{
    id:"bard.inspire.second",
    actorId:"hero",
    targetId:"goblin",
    expectedRevision:1,
    bardLevel:1,
    distanceFeet:30,
    targetCanSeeOrHearBard:true,
    useBonusAction:false,
  });
  assert.equal(second.status,"rejected");
  assert.equal(second.state,first.state);
  assert.match(second.status === "rejected" ? second.error : "",/only one Bardic Inspiration die/);
});

test("using Bardic Inspiration after a failed d20 test always consumes the effect and may turn failure into success", () => {
  const state = runtimeState();
  addInspiration(state,2,2);
  const granted = resolveGrantBardicInspiration(TEST_PROFILE,state,{
    id:"bard.inspire.use.grant",
    actorId:"hero",
    targetId:"goblin",
    expectedRevision:0,
    bardLevel:10,
    distanceFeet:20,
    targetCanSeeOrHearBard:true,
    useBonusAction:false,
  });
  assert.equal(granted.status,"committed");
  if (granted.status !== "committed") return;
  const used = resolveUseBardicInspiration(TEST_PROFILE,granted.state,{
    id:"bard.inspire.use",
    actorId:"goblin",
    expectedRevision:1,
    failedTotal:11,
    target:15,
    dieFace:5,
  });
  assert.equal(used.status,"committed");
  if (used.status !== "committed") return;
  assert.deepEqual(used.check,{ initialTotal:11, target:15, bonus:5, finalTotal:16, outcome:"success", effectId:used.check?.effectId });
  assert.equal(used.state.effects.some((entry) => entry.tags.includes("bardic-inspiration") && entry.targetId === "goblin"),false);
});

test("Font of Inspiration converts one spell slot into one Bardic Inspiration use atomically", () => {
  const state = runtimeState();
  addInspiration(state,1,3,{ shortRest:"all", longRest:"all" });
  const result = resolveFontOfInspirationSlotRecovery(TEST_PROFILE,state,{
    id:"bard.font",
    actorId:"hero",
    expectedRevision:0,
    bardLevel:5,
    spellSlotResourceId:"spell-slot-1",
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === "spell-slot-1")?.current,1);
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === BARDIC_INSPIRATION_RESOURCE_ID)?.current,2);
});

test("Superior Inspiration restores uses up to two when Initiative is rolled", () => {
  const state = runtimeState();
  addInspiration(state,0,4,{ shortRest:"all", longRest:"all" });
  const result = resolveSuperiorInspirationOnInitiative(TEST_PROFILE,state,{
    id:"bard.superior-inspiration",
    actorId:"hero",
    expectedRevision:0,
    bardLevel:18,
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === BARDIC_INSPIRATION_RESOURCE_ID)?.current,2);
});
