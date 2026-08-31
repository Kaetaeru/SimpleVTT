import assert from "node:assert/strict";
import test from "node:test";
import { appendCommonPlaySemanticOutcomeEvents } from "../../src/domain/commonPlaySemanticEventRuntime";
import type { PendingResolution, ResolutionCommit, ResolutionEvent } from "../../src/domain/resolutionTypes";

function rechargePending(face:number):PendingResolution {
  return {
    id:`resolution.recharge.${face}`,
    actorId:"actor.unknown",
    sourceId:"external.unknown.recharge",
    expectedRevision:1,
    operations:[{
      id:"recharge",
      kind:"recharge-resource",
      actorId:"actor.unknown",
      resourceId:"resource.unknown.recharge",
      timing:"turn-start",
      die:{sides:6,faces:[face]},
      succeedsOn:{minimum:5},
    }],
  };
}

function rechargeCommit(pending:PendingResolution,success:boolean,face:number):ResolutionCommit {
  const authoritativeEvent:ResolutionEvent={
    id:`${pending.id}:recharge`,
    resolutionId:pending.id,
    operationId:"recharge",
    kind:"recharge-resource",
    actorId:"actor.unknown",
    targetId:"actor.unknown",
    summary:success?"recharged":"recharge failed",
    provenance:[{source:"external.unknown.recharge",status:success?"applied":"suppressed",...(success?{}:{reason:`recharge roll ${face} failed`})}],
    stateChanges:[],
    result:{success,face,before:0,after:success?1:0},
  };
  return {
    status:"committed",
    state:{history:[]} as ResolutionCommit extends {state:infer State}?State:never,
    events:[authoritativeEvent],
    results:{recharge:{success,face,before:0,after:success?1:0}},
  } as ResolutionCommit;
}

for(const probe of [
  {face:6,success:true,kind:"resource.recharge.success"},
  {face:1,success:false,kind:"resource.recharge.failure"},
] as const) {
  test(`authoritative recharge ${probe.success?"success":"failure"} emits a canonical semantic event`,()=>{
    const pending=rechargePending(probe.face);
    const commit=rechargeCommit(pending,probe.success,probe.face);
    const resolved=appendCommonPlaySemanticOutcomeEvents(pending,commit);
    assert.equal(resolved.status,"committed");
    const semantic=resolved.events.find((event)=>event.kind===probe.kind);
    assert.ok(semantic,JSON.stringify(resolved.events));
    assert.equal(semantic.actorId,"actor.unknown");
    assert.equal(semantic.targetId,"actor.unknown");
    assert.deepEqual(semantic.result,{success:probe.success,face:probe.face,before:0,after:probe.success?1:0});
    assert.deepEqual(semantic.provenance,commit.events[0].provenance);
    assert.ok(resolved.state.history.some((entry)=>entry.kind===probe.kind));
  });
}
