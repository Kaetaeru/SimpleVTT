import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealResolutionAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { ActionVm } from "../../src/app/contracts";
import { phase09ReferenceHealingFact } from "../../src/app/phase09ReferenceRulesFacts";
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
  const secondWind = resolveHealingRollResolution({
    resolutionId:"phase09.healing.second-wind",
    action:healingAction("action.second-wind","1d10",5),
    targetIds:["hero"],
    healingFact:phase09ReferenceHealingFact("action.second-wind"),
  });
  assert.deepEqual(secondWind.authoritativeDice,[5]);
  assert.equal(secondWind.rollTotal,10);

  const healingWord = resolveHealingRollResolution({
    resolutionId:"phase09.healing.healing-word",
    action:healingAction("action.healing-word","1d4",4),
    targetIds:["hero"],
    healingFact:phase09ReferenceHealingFact("action.healing-word"),
  });
  assert.deepEqual(healingWord.authoritativeDice,[3]);
  assert.equal(healingWord.rollTotal,7);
  assert.ok(healingWord.provenance.some((entry) => entry.includes("1d4 [3] => 3")));

  const potion = resolveHealingRollResolution({
    resolutionId:"phase09.healing.potion",
    action:healingAction("action.healing-potion","2d4",2),
    targetIds:["hero"],
    healingFact:phase09ReferenceHealingFact("action.healing-potion"),
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
  assert.deepEqual(snapshot.resolution?.authoritativeDice,[3]);
  assert.equal(snapshot.resolution?.rollTotal,7);
  assert.ok(snapshot.resolution?.provenance.some((entry) => entry.includes("phase09:reference-healing:action.healing-word:d4")));

  await adapter.advanceResolution();
  await adapter.advanceResolution();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.activeCharacter.hp,38);
  assert.equal(snapshot.scene.economyByActor["char.mira"]?.bonusAction,false);
  assert.ok(snapshot.resolution?.stateChanges.includes("Aelar HP 31 → 38"));
  assert.ok(snapshot.resolution?.stateChanges.includes("추가 행동 사용"));
});

test("healing potion keeps its structured 2d4+2 total while item spending remains on the transitional item path", async () => {
  const adapter = new MockAdapter();
  await adapter.resolveAction("action.healing-potion",["char.aelar"]);
  let snapshot = await adapter.getSnapshot();
  assert.deepEqual(snapshot.resolution?.authoritativeDice,[3,4]);
  assert.equal(snapshot.resolution?.rollTotal,9);

  await adapter.advanceResolution();
  await adapter.advanceResolution();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.hp,40);
  assert.equal(snapshot.activeCharacter.items.find((item) => item.id === "item.potion.aelar")?.quantity,1);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false);
});
