import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealResolutionAdapter";
import "../../src/app/phase09RealTurnRuntimeAdapter";
import "../../src/app/abilityCheckResolutionEventAdapter";
import "../../src/app/sessionStatusEffectEventRuntimeAdapter";
import "../../src/app/abilityCheckDcRuntimeAdapter";
import type { ActionVm, SceneVm } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import { runtimeResolutionEventHistory } from "../../src/app/runtimeResolutionEventHistory";

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
