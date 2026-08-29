import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealResolutionAdapter";
import type { ActionVm, SceneVm } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";

type MutableAdapter={scene:SceneVm};

test("session status execution is invariant to unknown action ids",async()=>{
  const adapter=new MockAdapter();
  await adapter.setSessionMode("freeform");
  const scene=(adapter as unknown as MutableAdapter).scene;
  const actorId="char.aelar";
  const effect:ActionVm={
    id:"external.unknown.session-effect",actorId,name:"외부 상태 행동",category:"basic",target:"self",economy:"없음",resolutionKind:"no-roll",
    summary:"외부 상태 적용",available:true,eligibleTargetIds:[actorId],sessionStatusEffect:{status:"외부 상태",target:"actor",successOutcome:"외부 상태 적용"},details:[],
  };
  const check:ActionVm={
    id:"external.unknown.status-check",actorId,name:"외부 상태 판정",category:"basic",target:"none",economy:"없음",resolutionKind:"ability-check",
    summary:"외부 상태 판정",available:true,eligibleTargetIds:[],checkBonus:0,sessionStatusEffect:{status:"외부 판정 상태",target:"actor",minimumRoll:10,successOutcome:"외부 판정 성공",failureOutcome:"외부 판정 실패"},details:[],
  };
  scene.actionsByActor[actorId].push(effect,check);

  await adapter.resolveAction(effect.id,[actorId]);
  let snapshot=await adapter.advanceResolution();
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===actorId)?.status.includes("외부 상태"),true);

  await adapter.setQueuedD20(20);
  await adapter.resolveAction(check.id,[]);
  snapshot=await adapter.advanceResolution();
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===actorId)?.status.includes("외부 판정 상태"),true);
  assert.match(snapshot.resolution?.finalOutcome??"",/외부 판정 성공/);
});
