import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealResolutionAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { ActionVm } from "../../src/app/contracts";
import { phase09ReferenceSaveModifier } from "../../src/app/phase09ReferenceRulesFacts";
import { resolveSavingThrowResolution } from "../../src/app/realSavingThrowService";

const THUNDERWAVE:ActionVm = {
  id:"action.test.thunderwave",
  actorId:"char.mira",
  name:"천둥파",
  category:"magic",
  target:"multi-enemy",
  economy:"행동",
  resolutionKind:"saving-throw",
  summary:"건강 내성 DC 14",
  available:true,
  eligibleTargetIds:["goblin","guardian"],
  maxTargets:4,
  saveDc:14,
  saveAbility:"건강",
  saveHalf:true,
  damage:[{ type:"천둥", dice:"2d8", flat:0, average:9 }],
  details:[],
};

test("Phase 09 reference save facts are target-based rather than target-index based", () => {
  assert.equal(phase09ReferenceSaveModifier("combatant.goblin-a","건강").modifier,0);
  assert.equal(phase09ReferenceSaveModifier("combatant.training-guardian","건강").modifier,3);
  assert.equal(phase09ReferenceSaveModifier("combatant.goblin-a","지혜").modifier,-1);
});

test("saving-throw service projects each target modifier through the canonical d20 resolver", () => {
  const result = resolveSavingThrowResolution({
    resolutionId:"phase09.save.service",
    action:THUNDERWAVE,
    targets:[
      { id:"goblin", name:"Goblin", modifier:0, modifierSource:"fixture:goblin:con" },
      { id:"guardian", name:"Guardian", modifier:3, modifierSource:"fixture:guardian:con" },
    ],
    diceFaces:[7,18],
  });

  assert.equal(result.stage,"save-animation");
  assert.deepEqual(result.saveResults.map((entry) => [entry.targetId,entry.d20,entry.total,entry.outcome]),[
    ["goblin",7,7,"실패"],
    ["guardian",18,21,"성공"],
  ]);
  assert.ok(result.provenance.some((entry) => entry.includes("fixture:goblin:con")));
  assert.ok(result.provenance.some((entry) => entry.includes("fixture:guardian:con")));
});

test("MockAdapter Thunderwave uses explicit target save facts and domain typed damage independent of target index", async () => {
  const adapter = new MockAdapter();
  await adapter.setCurrentActor("char.mira");
  await adapter.resolveAction("action.thunderwave",["combatant.goblin-a","combatant.training-guardian"]);
  let snapshot = await adapter.getSnapshot();

  assert.equal(snapshot.resolution?.stage,"save-animation");
  const goblinSave = snapshot.resolution?.saveResults.find((entry) => entry.targetId === "combatant.goblin-a");
  const guardianSave = snapshot.resolution?.saveResults.find((entry) => entry.targetId === "combatant.training-guardian");
  assert.equal((goblinSave?.total ?? 0) - (goblinSave?.d20 ?? 0),0);
  assert.equal((guardianSave?.total ?? 0) - (guardianSave?.d20 ?? 0),3);
  assert.equal(goblinSave?.outcome,"실패");
  assert.equal(guardianSave?.outcome,"성공");
  assert.ok(snapshot.resolution?.provenance.some((entry) => entry.includes("phase09:reference-save:combatant.goblin-a:건강")));

  await adapter.advanceResolution();
  await adapter.advanceResolution();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"damage-animation");
  await adapter.advanceResolution();
  snapshot = await adapter.getSnapshot();

  const goblin = snapshot.scene.entities.find((entity) => entity.id === "combatant.goblin-a");
  const guardian = snapshot.scene.entities.find((entity) => entity.id === "combatant.training-guardian");
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(goblin?.hp,3,"failed save takes 9 thunder damage");
  assert.equal(guardian?.tempHp,2,"successful save halves 9 to 4, then thunder resistance halves 4 to 2, absorbed by Temporary HP");
  assert.equal(guardian?.hp,30);
  assert.equal(snapshot.scene.economyByActor["char.mira"]?.action,false);
  assert.equal(snapshot.resolution?.saveResults.find((entry) => entry.targetId === "combatant.goblin-a")?.finalDamage,9);
  assert.equal(snapshot.resolution?.saveResults.find((entry) => entry.targetId === "combatant.training-guardian")?.finalDamage,2);
  assert.ok(snapshot.resolution?.provenance.some((entry) => entry.includes("고블린 A") && entry.includes("Incoming thunder damage 9")));
  assert.ok(snapshot.resolution?.provenance.some((entry) => entry.includes("훈련용 수호체") && entry.includes("Resistance 4 -> 2")));
  assert.ok(snapshot.resolution?.stateChanges.includes("고블린 A HP 12 → 3"));
  assert.ok(snapshot.resolution?.stateChanges.includes("훈련용 수호체 임시 HP 4 → 2"));
  assert.ok(snapshot.resolution?.stateChanges.includes("행동 사용"));
});

test("reordering targets does not reassign their saving-throw modifiers", async () => {
  const adapter = new MockAdapter();
  await adapter.setCurrentActor("char.mira");
  await adapter.resolveAction("action.thunderwave",["combatant.training-guardian","combatant.goblin-a"]);
  const snapshot = await adapter.getSnapshot();
  const guardian = snapshot.resolution?.saveResults.find((entry) => entry.targetId === "combatant.training-guardian");
  const goblin = snapshot.resolution?.saveResults.find((entry) => entry.targetId === "combatant.goblin-a");

  assert.equal((guardian?.total ?? 0) - (guardian?.d20 ?? 0),3);
  assert.equal((goblin?.total ?? 0) - (goblin?.d20 ?? 0),0);
});
