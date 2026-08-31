import assert from "node:assert/strict";
import test from "node:test";
import { appendCommonPlaySemanticOutcomeEvents } from "../../src/domain/commonPlaySemanticEventRuntime";
import { resolvePendingResolution } from "../../src/domain/resolution";
import type { PendingResolution } from "../../src/domain/resolutionTypes";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const RESOURCE_ID="resource.external.recharge-semantic";

function execute(sourceId:string,face:number) {
  const state=runtimeState();
  state.clock.activeActorId="hero";
  state.clock.phase="start";
  state.combatants.hero.resources.push({
    id:RESOURCE_ID,
    label:"External Recharge Semantic",
    current:0,
    maximum:1,
  });
  const pending:PendingResolution={
    id:`recharge-semantic-${sourceId}-${face}`,
    actorId:"hero",
    sourceId,
    expectedRevision:state.revision,
    operations:[{
      id:"recharge",
      kind:"recharge-resource",
      actorId:"hero",
      resourceId:RESOURCE_ID,
      timing:"turn-start",
      die:{sides:6,faces:[face]},
      succeedsOn:{minimum:5},
    }],
  };
  const committed=resolvePendingResolution(TEST_PROFILE,state,pending);
  assert.equal(committed.status,"committed",committed.status==="rejected"?committed.error:undefined);
  return appendCommonPlaySemanticOutcomeEvents(pending,committed);
}

function summarize(sourceId:string,face:number) {
  const committed=execute(sourceId,face);
  assert.equal(committed.status,"committed");
  if(committed.status!=="committed") return undefined;
  const event=committed.events.find((candidate)=>candidate.kind.startsWith("resource.recharge."));
  assert.ok(event,JSON.stringify(committed.events));
  return {
    kind:event.kind,
    actorId:event.actorId,
    targetId:event.targetId,
    result:event.result,
  };
}

test("recharge resolution emits authoritative success and failure semantic events",()=>{
  assert.equal(summarize("external.unknown.recharge-success",6)?.kind,"resource.recharge.success");
  assert.equal(summarize("external.unknown.recharge-failure",1)?.kind,"resource.recharge.failure");
});

test("recharge semantic vocabulary is invariant under external source identity",()=>{
  const first=summarize("external.first.recharge-source",6);
  const renamed=summarize("renamed.completely.unseen.recharge-source",6);
  assert.deepEqual(
    {kind:first?.kind,actorId:first?.actorId,targetId:first?.targetId},
    {kind:renamed?.kind,actorId:renamed?.actorId,targetId:renamed?.targetId},
  );
});
