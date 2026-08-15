import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealRuntimeStatAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { ActionVm } from "../../src/app/contracts";
import { resolveRuntimeSaveModifier } from "../../src/app/realRuntimeStatProvider";
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

test("runtime stat provider derives Character saves from canonical class proficiency and ability scores", async () => {
  const adapter = new MockAdapter();
  const snapshot = await adapter.getSnapshot();
  const aelar = snapshot.scene.entities.find((entity) => entity.id === snapshot.activeCharacter.id)!;
  const strength = resolveRuntimeSaveModifier(aelar,snapshot.activeCharacter,"근력");
  const wisdom = resolveRuntimeSaveModifier(aelar,snapshot.activeCharacter,"지혜");
  assert.equal(strength.modifier,7);
  assert.equal(wisdom.modifier,1);
  assert.match(strength.source,/runtime:character:char\.aelar:save:str:class:.*fighter.*:proficient/);
  assert.match(wisdom.source,/runtime:character:char\.aelar:save:wis:class:/);
});

test("runtime stat provider derives Combatant saves from structured ability-score definitions", async () => {
  const adapter = new MockAdapter();
  const snapshot = await adapter.getSnapshot();
  const goblin = snapshot.scene.entities.find((entity) => entity.id === "combatant.goblin-a")!;
  const guardian = snapshot.scene.entities.find((entity) => entity.id === "combatant.training-guardian")!;
  assert.equal(resolveRuntimeSaveModifier(goblin,snapshot.activeCharacter,"건강").modifier,0);
  assert.equal(resolveRuntimeSaveModifier(guardian,snapshot.activeCharacter,"건강").modifier,3);
  assert.equal(resolveRuntimeSaveModifier(goblin,snapshot.activeCharacter,"지혜").modifier,-1);
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

test("MockAdapter Thunderwave uses runtime Combatant stats and domain typed damage independent of target index", async () => {
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
  assert.ok(snapshot.resolution?.provenance.some((entry) => entry.includes("runtime:combatant:combatant.goblin:ability:con")));
  assert.ok(!snapshot.resolution?.provenance.some((entry) => entry.includes("phase09:reference-save")));

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
  assert.ok(snapshot.resolution?.provenance.some((entry) => entry.includes("고블린 A") && entry.includes("HP 12 -> 3")));
  assert.ok(snapshot.resolution?.provenance.some((entry) => entry.includes("훈련용 수호체") && entry.includes("Resistance 4 -> 2")));
  assert.ok(snapshot.resolution?.stateChanges.includes("고블린 A HP 12 → 3"));
  assert.ok(snapshot.resolution?.stateChanges.includes("훈련용 수호체 임시 HP 4 → 2"));
  assert.ok(snapshot.resolution?.stateChanges.includes("행동 사용"));
});

test("reordering targets does not reassign their runtime saving-throw modifiers", async () => {
  const adapter = new MockAdapter();
  await adapter.setCurrentActor("char.mira");
  await adapter.resolveAction("action.thunderwave",["combatant.training-guardian","combatant.goblin-a"]);
  const snapshot = await adapter.getSnapshot();
  const guardian = snapshot.resolution?.saveResults.find((entry) => entry.targetId === "combatant.training-guardian");
  const goblin = snapshot.resolution?.saveResults.find((entry) => entry.targetId === "combatant.goblin-a");

  assert.equal((guardian?.total ?? 0) - (guardian?.d20 ?? 0),3);
  assert.equal((goblin?.total ?? 0) - (goblin?.d20 ?? 0),0);
});

test("saving throw explicitly rejects a Combatant instance without runtime ability stats", async () => {
  const adapter = new MockAdapter();
  await adapter.previewCombatantImport(JSON.stringify({
    id:"combatant.local-bandit",
    name:"로컬 산적",
    ac:14,
    maxHp:18,
    actions:["단검"],
  }));
  await adapter.activateCombatantImport();
  await adapter.instantiateCombatant("combatant.local-bandit");
  await adapter.setCurrentActor("char.mira");
  await adapter.resolveAction("action.thunderwave",["combatant.local-bandit.instance-1"]);
  const snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.match(snapshot.resolution?.finalOutcome ?? "",/missing runtime combatant stat definition/);
  assert.deepEqual(snapshot.resolution?.stateChanges,[]);
  assert.ok(snapshot.resolution?.provenance.some((entry) => entry.includes("explicit reject")));
});

test("imported Combatant runtime stats feed saving throws, speed, and typed defenses", async () => {
  const adapter=new MockAdapter();
  await adapter.previewCombatantImport(JSON.stringify({
    id:"combatant.local-scout",
    name:"로컬 정찰병",
    ac:14,
    maxHp:20,
    speed:35,
    proficiencyBonus:2,
    abilities:{ str:8, dex:16, con:12, int:10, wis:14, cha:10 },
    savingThrowProficiencies:["wis"],
    resistances:["냉기"],
    immunities:[],
    vulnerabilities:["화염"],
    actions:["단검"],
  }));
  let snapshot=await adapter.getSnapshot();
  assert.ok(snapshot.combatantImport?.definition?.runtimeStats);
  assert.ok(snapshot.combatantImport?.validation.some((entry)=>entry.message.includes("runtime ability/save/speed/defense stats")));
  await adapter.activateCombatantImport();
  await adapter.startInitiative();
  await adapter.instantiateCombatant("combatant.local-scout");
  snapshot=await adapter.getSnapshot();
  const scout=snapshot.scene.entities.find((entity)=>entity.id==="combatant.local-scout.instance-1")!;
  assert.deepEqual(snapshot.scene.economyByActor[scout.id],{
    action:true,bonusAction:true,reaction:true,movement:35,movementMax:35,
  });
  assert.deepEqual(scout.resistances,["냉기"]);
  assert.deepEqual(scout.vulnerabilities,["화염"]);

  await adapter.setCurrentActor("char.mira");
  await adapter.resolveAction("action.thunderwave",[scout.id]);
  snapshot=await adapter.getSnapshot();
  const save=snapshot.resolution?.saveResults[0];
  assert.equal((save?.total ?? 0)-(save?.d20 ?? 0),1,"CON 12 produces +1 without CON save proficiency");
  assert.ok(snapshot.resolution?.provenance.some((entry)=>entry.includes("runtime:combatant-definition:combatant.local-scout:ability:con")));

  const wis=resolveRuntimeSaveModifier(scout,snapshot.activeCharacter,"지혜",snapshot.combatantDefinitions);
  assert.equal(wis.modifier,4,"WIS 14 (+2) plus proficiency +2");
  assert.match(wis.source,/combatant\.local-scout:ability:wis:save-proficient/);
});
