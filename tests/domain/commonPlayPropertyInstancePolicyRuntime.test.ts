import assert from "node:assert/strict";
import test from "node:test";
import { compileCommonPlayEntryPointOperations, parseCommonPlayOperationDefinition } from "../../src/domain/commonPlayOperationRuntime";
import { resolvePendingResolution } from "../../src/domain/resolution";
import type { ResolutionCommit } from "../../src/domain/resolutionTypes";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

type InstancePolicy="stack"|"replace"|"unique-by-source"|"profile-policy";

function definition(id:string,instancePolicy:InstancePolicy,value=5) {
  return parseCommonPlayOperationDefinition({schemaVersion:"0.2-draft",id,entryPoints:[{
    id:"activate",invocation:"manual",operations:[{
      kind:"property.modify",property:"movement.walk",operation:"set",value:{value},target:"actor",
      owner:"effect",source:"definition",duration:{kind:"elapsed",amount:{value:1},unit:"minutes"},
      lifetime:{kind:"until-duration",onEnd:"destroy"},instancePolicy,
    }],
  }]});
}

function apply(state:ReturnType<typeof runtimeState>,rule:ReturnType<typeof definition>,resolutionId:string):ResolutionCommit {
  return resolvePendingResolution(TEST_PROFILE,state,compileCommonPlayEntryPointOperations(TEST_PROFILE,state,rule,{
    resolutionId,actorId:"hero",entryPointId:"activate",
  }));
}

function committed(value:ResolutionCommit) {
  assert.equal(value.status,"committed");
  if(value.status!=="committed") throw new Error(value.error);
  return value;
}

test("property.modify unique-by-source replaces the prior instance and records inverse-ready state changes",()=>{
  const rule=definition("external.unknown.property.unique","unique-by-source");
  const first=committed(apply(runtimeState(),rule,"property-unique-first"));
  const second=committed(apply(first.state,rule,"property-unique-second"));
  assert.equal(second.state.effects.length,1);
  assert.equal(second.state.effects[0]?.id,"property-unique-second:operation:0:effect");
  const changes=second.events.flatMap((event)=>event.stateChanges).filter((change)=>change.kind==="effect");
  assert.deepEqual(changes.map((change)=>change.operation),["removed","added"]);
  assert.equal(changes[0]?.before?.id,"property-unique-first:operation:0:effect");
});

test("property.modify replace supersedes another source on the same target property",()=>{
  const first=committed(apply(runtimeState(),definition("external.unknown.property.base","stack"),"property-replace-first"));
  const second=committed(apply(first.state,definition("external.unknown.property.replacer","replace",7),"property-replace-second"));
  assert.equal(second.state.effects.length,1);
  assert.equal(second.state.effects[0]?.sourceId,"common-play:external.unknown.property.replacer:activate:operation:0");
  const changes=second.events.flatMap((event)=>event.stateChanges).filter((change)=>change.kind==="effect");
  assert.deepEqual(changes.map((change)=>change.operation),["removed","added"]);
});

test("property.modify stack preserves independent providers",()=>{
  const first=committed(apply(runtimeState(),definition("external.unknown.property.stack-a","stack"),"property-stack-first"));
  const second=committed(apply(first.state,definition("external.unknown.property.stack-b","stack",7),"property-stack-second"));
  assert.equal(second.state.effects.length,2);
});

test("property.modify profile-policy rejects until RulesProfile provides an explicit stacking policy",()=>{
  const result=apply(runtimeState(),definition("external.unknown.property.profile-policy","profile-policy",7),"property-profile");
  assert.equal(result.status,"rejected");
  if(result.status!=="rejected") return;
  assert.match(result.error,/profile-policy requires an explicit RulesProfile stacking policy/);
});
