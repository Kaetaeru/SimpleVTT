import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import type { SceneVm } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import { resolveSavingThrowResolution } from "../../src/app/realSavingThrowService";
import type { ActionVm } from "../../src/app/contracts";
import { READY_MOVEMENT_ACTION_ID, readyActionConfigurationFor, setReadyActionConfiguration } from "../../src/app/standardActionReadyState";

type MutableAdapter={scene:SceneVm};

function mutableScene(adapter:MockAdapter) {
  return (adapter as unknown as MutableAdapter).scene;
}

function entity(adapter:MockAdapter,id:string) {
  const found=mutableScene(adapter).entities.find((entry)=>entry.id===id);
  assert.ok(found,`missing entity ${id}`);
  return found;
}

test("Help is consumed by the next ability check and resolves as authoritative advantage",async()=>{
  const adapter=new MockAdapter();
  const before=await adapter.getSnapshot();
  const actorId=before.activeCharacter.id;
  const actor=entity(adapter,actorId);
  actor.status.push("도움 받음");
  const action=before.scene.actionsByActor[actorId]?.find((entry)=>entry.resolutionKind==="ability-check");
  assert.ok(action,"active production character requires an ability check action");

  await adapter.setQueuedD20(5);
  const preview=await adapter.resolveAction(action.id,[]);
  assert.deepEqual(preview.resolution?.authoritativeDice,[5,12]);
  assert.equal(preview.resolution?.rollTotal,12+(action.checkBonus??0));
  assert.ok(preview.resolution?.provenance.some((entry)=>entry.startsWith("action:standard.help · applied")));
  assert.ok(preview.resolution?.stateChanges.some((entry)=>entry.includes("도움 받음")&&entry.includes("유리점")));
  assert.equal(preview.scene.entities.find((entry)=>entry.id===actorId)?.status.includes("도움 받음"),false);

  const completed=await adapter.advanceResolution();
  assert.equal(completed.resolution?.stage,"complete");
  assert.ok(completed.activity[0]?.stateChanges.some((entry)=>entry.includes("도움 받음")));
});

test("Hide records success and failure and attacking reveals the actor",async()=>{
  const adapter=new MockAdapter();
  await adapter.setSessionMode("freeform");
  let snapshot=await adapter.getSnapshot();
  const actorId=snapshot.activeCharacter.id;

  await adapter.setQueuedD20(20);
  await adapter.resolveAction("action.standard.hide.stealth",[]);
  snapshot=await adapter.advanceResolution();
  assert.match(snapshot.resolution?.finalOutcome??"",/숨기 성공/);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===actorId)?.status.includes("숨음"),true);

  const attack=snapshot.scene.actionsByActor[actorId]?.find((entry)=>entry.resolutionKind==="attack");
  assert.ok(attack,"active production character requires an attack action");
  const targetId=attack.eligibleTargetIds?.[0];
  assert.ok(targetId,"attack requires an eligible enemy target");
  await adapter.resolveAction(attack.id,[targetId]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===actorId)?.status.includes("숨음"),false);
  assert.ok(snapshot.resolution?.stateChanges.some((entry)=>entry.includes("숨음")&&entry.includes("공격 선언")));

  const failed=new MockAdapter();
  await failed.setSessionMode("freeform");
  entity(failed,actorId).status.push("숨음");
  await failed.setQueuedD20(1);
  await failed.resolveAction("action.standard.hide.stealth",[]);
  snapshot=await failed.advanceResolution();
  assert.match(snapshot.resolution?.finalOutcome??"",/숨기 실패/);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===actorId)?.status.includes("숨음"),false);
});

test("turn boundaries expire Disengage at turn end and Dodge or Ready at next turn start",async()=>{
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const actor=entity(adapter,"char.aelar");
  actor.status.push("이탈","회피","준비 행동");
  setReadyActionConfiguration(adapter,{actorId:"char.aelar",actionId:"action.test.ready",trigger:"다음 자기 턴 전"});

  let snapshot=await adapter.endTurn();
  let projected=snapshot.scene.entities.find((entry)=>entry.id==="char.aelar")!;
  assert.equal(projected.status.includes("이탈"),false);
  assert.equal(projected.status.includes("회피"),true);
  assert.equal(projected.status.includes("준비 행동"),true);
  assert.equal(readyActionConfigurationFor(adapter)?.actorId,"char.aelar");
  assert.ok(snapshot.activity[0]?.stateChanges.some((entry)=>entry.includes("이탈")));

  for (let guard=0;snapshot.scene.currentActorId!=="char.aelar"&&guard<20;guard+=1) {
    snapshot=await adapter.endTurn();
  }
  assert.equal(snapshot.scene.currentActorId,"char.aelar");
  projected=snapshot.scene.entities.find((entry)=>entry.id==="char.aelar")!;
  assert.equal(projected.status.includes("회피"),false);
  assert.equal(projected.status.includes("준비 행동"),false);
  assert.equal(readyActionConfigurationFor(adapter),undefined);
  assert.ok(snapshot.activity[0]?.stateChanges.some((entry)=>entry.includes("회피")));
  assert.ok(snapshot.activity[0]?.stateChanges.some((entry)=>entry.includes("준비 행동")));
});

test("ending initiative clears every remaining turn-bound standard-action status",async()=>{
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  entity(adapter,"char.aelar").status.push("이탈","회피","준비 행동");
  setReadyActionConfiguration(adapter,{actorId:"char.aelar",actionId:"action.test.ready",trigger:"이니셔티브 종료 전"});
  const snapshot=await adapter.endInitiative();
  const actor=snapshot.scene.entities.find((entry)=>entry.id==="char.aelar")!;
  assert.equal(snapshot.sessionMode,"freeform");
  assert.equal(actor.status.includes("이탈"),false);
  assert.equal(actor.status.includes("회피"),false);
  assert.equal(actor.status.includes("준비 행동"),false);
  assert.equal(readyActionConfigurationFor(adapter),undefined);
  assert.ok(snapshot.activity[0]?.stateChanges.some((entry)=>entry.includes("준비 행동")));
});

test("Dodge imposes attack disadvantage and grants Dexterity save advantage",async()=>{
  const adapter=new MockAdapter();
  await adapter.setSessionMode("freeform");
  const before=await adapter.getSnapshot();
  const actorId=before.activeCharacter.id;
  const attack=before.scene.actionsByActor[actorId]?.find((entry)=>entry.resolutionKind==="attack");
  assert.ok(attack,"active production character requires an attack action");
  const targetId=attack.eligibleTargetIds?.[0];
  assert.ok(targetId,"attack requires an eligible target");
  entity(adapter,targetId).status.push("회피");

  await adapter.setQueuedD20(18);
  const preview=await adapter.resolveAction(attack.id,[targetId]);
  assert.deepEqual(preview.resolution?.authoritativeDice,[12,18]);
  assert.equal(preview.resolution?.attackTotal,12+(attack.attackBonus??0));
  assert.ok(preview.resolution?.provenance.some((entry)=>entry.includes("condition:회피:target")));

  const dexteritySave:ActionVm={
    id:"action.test.dex-save",
    actorId:"caster",
    name:"민첩 내성 테스트",
    category:"magic",
    target:"enemy",
    economy:"없음",
    resolutionKind:"saving-throw",
    summary:"민첩 내성 DC 15",
    available:true,
    eligibleTargetIds:["target"],
    saveAbility:"민첩",
    saveDc:15,
    details:[],
  };
  const save=resolveSavingThrowResolution({
    resolutionId:"save.dodge",
    action:dexteritySave,
    targets:[{
      id:"target",
      name:"회피 중인 대상",
      modifier:2,
      modifierSource:"test:dexterity",
      rollStateContributions:[{ source:"condition:회피:dexterity-save",state:"advantage" }],
    }],
    diceFaces:[5],
    diceFacesByTarget:{target:[5,17]},
  });
  assert.equal(save.saveResults[0]?.d20,17);
  assert.equal(save.saveResults[0]?.total,19);
  assert.equal(save.saveResults[0]?.outcome,"성공");
  assert.ok(save.provenance.some((entry)=>entry.includes("condition:회피:dexterity-save")));
});

test("Ready exposes an off-turn trigger that spends Reaction and clears the prepared state",async()=>{
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const initial=await adapter.getSnapshot();
  const prepared=initial.scene.actionsByActor["char.aelar"]?.find((entry)=>entry.resolutionKind==="ability-check");
  assert.ok(prepared,"ready test requires an ability-check action");

  await adapter.configureReadyAction({actorId:"char.aelar",actionId:prepared.id,trigger:"고블린이 문을 통과하면"});
  let snapshot=await adapter.advanceResolution();
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id==="char.aelar")?.status.includes("준비 행동"),true);
  assert.ok(snapshot.scene.actionsByActor["char.aelar"]?.some((entry)=>entry.id==="action.standard.ready.trigger"));

  snapshot=await adapter.endTurn();
  assert.notEqual(snapshot.scene.currentActorId,"char.aelar");
  const trigger=snapshot.scene.actionsByActor["char.aelar"]?.find((entry)=>entry.id==="action.standard.ready.trigger");
  assert.equal(trigger?.available,true,"prepared reaction must remain executable off turn");

  assert.match(trigger?.summary??"",/고블린이 문을 통과하면/);
  await adapter.resolveAction("action.standard.ready.trigger",[]);
  snapshot=await adapter.advanceResolution();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id==="char.aelar")?.status.includes("준비 행동"),false);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.reaction,false);
  assert.equal(readyActionConfigurationFor(adapter),undefined);
  assert.ok(snapshot.activity[0]?.stateChanges.some((entry)=>entry.includes("반응 사용")));
  assert.equal(snapshot.scene.actionsByActor["char.aelar"]?.some((entry)=>entry.id==="action.standard.ready.trigger"),false);
});

test("Ready movement spends Reaction but leaves coordinates to an installed map module",async()=>{
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const spatialBefore=structuredClone((await adapter.getSnapshot()).scene.spatialByPair);

  await adapter.configureReadyAction({
    actorId:"char.aelar",
    actionId:READY_MOVEMENT_ACTION_ID,
    trigger:"용이 착지하면",
  });
  let snapshot=await adapter.advanceResolution();
  assert.ok(snapshot.scene.actionsByActor["char.aelar"]?.find((entry)=>entry.id==="action.standard.ready.trigger")?.summary.includes("→ 이동"));
  await adapter.endTurn();
  await adapter.resolveAction("action.standard.ready.trigger",["char.aelar"]);
  snapshot=await adapter.advanceResolution();

  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.reaction,false);
  assert.deepEqual(snapshot.scene.spatialByPair,spatialBefore,"core must not invent map coordinates");
  assert.ok(snapshot.activity[0]?.stateChanges.some((entry)=>entry.includes("이동 실행 선언")));
  assert.match(snapshot.resolution?.finalOutcome??"",/준비한 이동/);
});
