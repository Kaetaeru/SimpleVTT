import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealResolutionAdapter";
import "../../src/app/phase09RealTurnRuntimeAdapter";
import "../../src/app/abilityCheckResolutionEventAdapter";
import "../../src/app/runtimeResolutionUndoAdapter";
import "../../src/app/sessionStatusEffectEventRuntimeAdapter";
import "../../src/app/abilityCheckDcRuntimeAdapter";
import type { ActionVm, SceneVm } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import { runtimeResolutionEventHistory } from "../../src/app/runtimeResolutionEventHistory";
import { snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";

test("unknown ability-check status action commits economy and effect events",async()=>{
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  const scene=(adapter as unknown as {scene:SceneVm}).scene;
  const actorId=scene.currentActorId;
  const action:ActionVm={
    id:"external.unknown.check-status",actorId,name:"외부 판정 상태",category:"basic",target:"none",economy:"추가 행동",resolutionKind:"ability-check",
    summary:"외부 판정 상태",available:true,eligibleTargetIds:[],checkBonus:20,
    sessionStatusEffect:{status:"외부 은폐",target:"actor",minimumRoll:15,successOutcome:"외부 판정 성공",failureOutcome:"외부 판정 실패",durationKey:"external-until-attack",endsOnAttack:true},details:[],
  };
  scene.actionsByActor[actorId].push(action);
  await adapter.resolveAction(action.id,[]);
  const snapshot=await adapter.advanceResolution();
  const events=runtimeResolutionEventHistory(adapter)?.events??[];
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.scene.economyByActor[actorId]?.bonusAction,false);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===actorId)?.status.some((status)=>status.endsWith("외부 은폐")),true);
  assert.ok(events.some((event)=>event.stateChanges.some((change)=>change.kind==="effect"&&change.operation==="added")));
  assert.ok(events.some((event)=>event.stateChanges.some((change)=>change.kind==="economy"&&change.field==="bonusAction"&&change.after===false)));
});

test("unknown no-roll status action uses the same event path",async()=>{
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  const scene=(adapter as unknown as {scene:SceneVm}).scene;
  const actorId=scene.currentActorId;
  const action:ActionVm={
    id:"external.unknown.no-roll-status",actorId,name:"외부 이탈",category:"basic",target:"self",economy:"추가 행동",resolutionKind:"no-roll",
    summary:"외부 이탈",available:true,eligibleTargetIds:[actorId],
    sessionStatusEffect:{status:"외부 이탈",target:"actor",successOutcome:"외부 이탈 적용",expiresAtActorTurnBoundary:"end",runtimeTags:["no-opportunity-attacks"]},details:[],
  };
  scene.actionsByActor[actorId].push(action);
  await adapter.resolveAction(action.id,[actorId]);
  const snapshot=await adapter.advanceResolution();
  const events=runtimeResolutionEventHistory(adapter)?.events??[];
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.scene.economyByActor[actorId]?.bonusAction,false);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===actorId)?.status.some((status)=>status.endsWith("외부 이탈")),true);
  assert.ok(events.some((event)=>event.stateChanges.some((change)=>change.kind==="effect"&&change.operation==="added")));
});

test("unknown attack reveal removes an endsOnAttack Hidden effect through authoritative events and Undo restores it",async()=>{
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  const scene=(adapter as unknown as {scene:SceneVm}).scene;
  const actorId=scene.currentActorId;
  const hiddenAction:ActionVm={
    id:"external.unknown.hidden-status",actorId,name:"외부 숨음",category:"basic",target:"none",economy:"추가 행동",resolutionKind:"ability-check",
    summary:"외부 숨음",available:true,eligibleTargetIds:[],checkBonus:20,
    sessionStatusEffect:{status:"외부 숨음",target:"actor",minimumRoll:15,successOutcome:"외부 숨기 성공",failureOutcome:"외부 숨기 실패",durationKey:"external-hidden-until-attack",endsOnAttack:true},details:[],
  };
  scene.actionsByActor[actorId].push(hiddenAction);
  await adapter.resolveAction(hiddenAction.id,[]);
  let snapshot=await adapter.advanceResolution();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.ok(snapshotAdapterTurnRuntimeState(adapter,scene)?.effects.some((effect)=>effect.targetId===actorId&&effect.tags.includes("hidden")));

  const targetId="external.unknown.reveal-target";
  scene.entities.push({id:targetId,name:"Reveal Target",side:"enemy",kind:"combatant",hp:12,maxHp:12,tempHp:0,ac:10,initiative:1,status:[],resistances:[],immunities:[],vulnerabilities:[],reactions:[]});
  const attack:ActionVm={
    id:"external.unknown.reveal-attack",actorId,name:"외부 공격",category:"weapon",target:"enemy",economy:"행동",resolutionKind:"attack",
    summary:"외부 공격",available:true,eligibleTargetIds:[targetId],attackBonus:20,damage:[{type:"force",dice:"1d4",flat:0,average:2}],details:[],
  };
  scene.actionsByActor[actorId].push(attack);
  await adapter.setQueuedD20(20);
  snapshot=await adapter.resolveAction(attack.id,[targetId]);
  assert.equal(snapshotAdapterTurnRuntimeState(adapter,scene)?.effects.some((effect)=>effect.targetId===actorId&&effect.tags.includes("hidden")),false);
  for(let step=0;step<8&&snapshot.resolution?.stage!=="complete";step+=1)snapshot=await adapter.advanceResolution();
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===actorId)?.status.some((status)=>status.endsWith("외부 숨음")),false);
  const revealEvents=runtimeResolutionEventHistory(adapter)?.events??[];
  assert.ok(revealEvents.some((event)=>event.stateChanges.some((change)=>change.kind==="effect"&&change.operation==="removed")));

  snapshot=await adapter.undoLastResolution();
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===actorId)?.status.some((status)=>status.endsWith("외부 숨음")),true);
  assert.ok(snapshotAdapterTurnRuntimeState(adapter,scene)?.effects.some((effect)=>effect.targetId===actorId&&effect.tags.includes("hidden")));
});
