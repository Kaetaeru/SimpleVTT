import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealResolutionAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { ActionVm } from "../../src/app/contracts";
import { healingFactFromFaces } from "../../src/app/phase09ReferenceRulesFacts";
import { resolveHealingRollResolution } from "../../src/app/realHealingRollService";

function healingAction(id:string,dice:string,flat:number):ActionVm {
  return {
    id,
    actorId:"hero",
    name:id,
    category:"basic",
    target:"self",
    economy:"추가 행동",
    resolutionKind:"healing",
    summary:"healing",
    available:true,
    eligibleTargetIds:["hero"],
    healing:{ dice, flat, average:flat },
    details:[],
  };
}

test("healing roll service uses structured valid dice rather than parsing presentation formulas", () => {
  const secondWindAction=healingAction("unknown.external.second-wind","1d10",5);
  const secondWind = resolveHealingRollResolution({
    resolutionId:"phase09.healing.second-wind",
    action:secondWindAction,
    targetIds:["hero"],
    healingFact:healingFactFromFaces(secondWindAction,[5]),
  });
  assert.deepEqual(secondWind.authoritativeDice,[5]);
  assert.equal(secondWind.rollTotal,10);

  const healingWordAction=healingAction("unknown.external.healing-word","1d4",4);
  const healingWord = resolveHealingRollResolution({
    resolutionId:"phase09.healing.healing-word",
    action:healingWordAction,
    targetIds:["hero"],
    healingFact:healingFactFromFaces(healingWordAction,[3]),
  });
  assert.deepEqual(healingWord.authoritativeDice,[3]);
  assert.equal(healingWord.rollTotal,7);
  assert.ok(healingWord.provenance.some((entry) => entry.includes("1d4 [3] => 3")));

  const potionAction=healingAction("unknown.external.healing-potion","2d4",2);
  const potion = resolveHealingRollResolution({
    resolutionId:"phase09.healing.potion",
    action:potionAction,
    targetIds:["hero"],
    healingFact:healingFactFromFaces(potionAction,[3,4]),
  });
  assert.deepEqual(potion.authoritativeDice,[3,4]);
  assert.equal(potion.rollTotal,9);
});

test("Healing Word now resolves a valid d4 result and applies real healing plus Bonus Action cost", async () => {
  const adapter = new MockAdapter();
  await adapter.setCurrentActor("char.mira");
  await adapter.resolveAction("action.healing-word",["char.aelar"]);
  let snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"roll-animation");
  assert.deepEqual(snapshot.resolution?.authoritativeDice,[2]);
  assert.equal(snapshot.resolution?.rollTotal,6);
  assert.ok(snapshot.resolution?.provenance.some((entry) => entry.includes("action:action.healing-word:healing-d4")));

  await adapter.advanceResolution();
  await adapter.advanceResolution();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.activeCharacter.hp,37);
  assert.equal(snapshot.scene.economyByActor["char.mira"]?.bonusAction,false);
  assert.ok(snapshot.resolution?.stateChanges.includes("Aelar HP 31 → 37"));
  assert.ok(snapshot.resolution?.stateChanges.includes("추가 행동 사용"));
});

test("healing potion keeps its structured 2d4+2 total through the generic atomic item path", async () => {
  const adapter = new MockAdapter();
  await adapter.resolveAction("action.healing-potion",["char.aelar"]);
  let snapshot = await adapter.getSnapshot();
  assert.deepEqual(snapshot.resolution?.authoritativeDice,[2,2]);
  assert.equal(snapshot.resolution?.rollTotal,6);

  await adapter.advanceResolution();
  await adapter.advanceResolution();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.hp,37);
  assert.equal(snapshot.activeCharacter.items.find((item) => item.id === "item.potion.aelar")?.quantity,1);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false);
});

test("healing adapter accepts an unknown external action id", async () => {
  const adapter=new MockAdapter();
  const internal=adapter as unknown as {scene:{actionsByActor:Record<string,Array<{id:string}>>}};
  const action=internal.scene.actionsByActor["char.mira"].find((entry)=>entry.id==="action.healing-word")!;
  action.id="unknown.external.healing-action";
  await adapter.setCurrentActor("char.mira");
  const snapshot=await adapter.resolveAction(action.id,["char.aelar"]);
  assert.equal(snapshot.resolution?.actionId,action.id);
  assert.deepEqual(snapshot.resolution?.authoritativeDice,[2]);
  assert.equal(snapshot.resolution?.rollTotal,6);
});
