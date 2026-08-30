import assert from "node:assert/strict";
import test from "node:test";
import { compileCommonPlayEntryPointOperations, parseCommonPlayOperationDefinition } from "../../src/domain/commonPlayOperationRuntime";
import { resolvePendingResolution } from "../../src/domain/resolution";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function definition(id="external.unseen.property-owner") { return {schemaVersion:"0.2-draft",id,entryPoints:[{id:"activate",invocation:"manual",operations:[{kind:"property.modify",property:"movement.walk",operation:"add",value:{op:"add",args:[{ref:"movement.walk"},{value:10}]},target:"actor",owner:"effect",source:"definition",duration:{kind:"elapsed",amount:{value:1},unit:"minutes"},lifetime:{kind:"until-duration",onEnd:"destroy"},instancePolicy:"unique-by-source"}]}]}; }

function instancePolicyDefinition(id:string,instancePolicy:"stack"|"replace"|"unique-by-source"|"profile-policy",value=5) {
  return parseCommonPlayOperationDefinition({
    schemaVersion:"0.2-draft",
    id,
    entryPoints:[{
      id:"activate",
      invocation:"manual",
      operations:[{
        kind:"property.modify",
        property:"movement.walk",
        operation:"set",
        value:{value},
        target:"actor",
        owner:"effect",
        source:"definition",
        duration:{kind:"elapsed",amount:{value:1},unit:"minutes"},
        lifetime:{kind:"until-duration",onEnd:"destroy"},
        instancePolicy,
      }],
    }],
  });
}

function commitProperty(state:ReturnType<typeof runtimeState>,rule:ReturnType<typeof instancePolicyDefinition>,resolutionId:string) {
  const pending=compileCommonPlayEntryPointOperations(TEST_PROFILE,state,rule,{resolutionId,actorId:"hero",entryPointId:"activate"});
  const committed=resolvePendingResolution(TEST_PROFILE,state,pending);
  assert.equal(committed.status,"committed");
  if(committed.status!=="committed") throw new Error(committed.error);
  return committed;
}

test("property.modify preserves explicit effect ownership without content identity dispatch",()=>{
  const parsed=parseCommonPlayOperationDefinition(definition());
  const operation=parsed.entryPoints[0]?.operations[0];
  assert.equal(operation?.kind,"property.modify");
  assert.deepEqual(operation,parseCommonPlayOperationDefinition(definition("external.renamed.property-owner")).entryPoints[0]?.operations[0]);
  assert.deepEqual(operation&&"value" in operation?operation.value:undefined,{op:"add",args:[{ref:"movement.walk"},{value:10}]});
});

test("property.modify lowers to the authoritative Effect owner and commits through Resolver",()=>{
  const parsed=parseCommonPlayOperationDefinition(definition());
  const state=runtimeState();
  const pending=compileCommonPlayEntryPointOperations(TEST_PROFILE,state,parsed,{resolutionId:"property-contract",actorId:"hero",entryPointId:"activate"});
  assert.equal(pending.operations.length,1);
  const operation=pending.operations[0];
  assert.equal(operation?.kind,"apply-effect");
  if(!operation||operation.kind!=="apply-effect") throw new Error("expected apply-effect");
  assert.equal(operation.effect.targetId,"hero");
  assert.equal(operation.effect.kind,"modifier");
  assert.deepEqual(operation.effect.propertyModifier,{property:"movement.walk",operation:"add",value:{op:"add",args:[{ref:"movement.walk"},{value:10}]},source:"definition",instancePolicy:"unique-by-source"});
  const committed=resolvePendingResolution(TEST_PROFILE,state,pending);
  assert.equal(committed.status,"committed");
  if(committed.status!=="committed") return;
  assert.deepEqual(committed.state.effects[0]?.propertyModifier,operation.effect.propertyModifier);
  assert.equal(committed.events[0]?.stateChanges[0]?.kind,"effect");
});

test("property.modify rejects ambiguous ownership instead of falling through",()=>{
  const missing=definition() as any; delete missing.entryPoints[0].operations[0].owner;
  assert.throws(()=>parseCommonPlayOperationDefinition(missing),/owner must be effect/);
  const durable=definition() as any; durable.entryPoints[0].operations[0].duration={kind:"durable"};
  assert.throws(()=>parseCommonPlayOperationDefinition(durable),/duration.kind must be elapsed/);
});

test("property.modify unique-by-source replaces the prior instance from the same source",()=>{
  const rule=instancePolicyDefinition("external.unknown.property.unique","unique-by-source");
  const first=commitProperty(runtimeState(),rule,"property-unique-first");
  const second=commitProperty(first.state,rule,"property-unique-second");
  assert.equal(second.state.effects.length,1);
  assert.equal(second.state.effects[0]?.sourceId,"common-play:external.unknown.property.unique:activate:operation:0");
  assert.equal(second.state.effects[0]?.id,"property-unique-second:operation:0:effect");
  const changes=second.events.flatMap((event)=>event.stateChanges).filter((change)=>change.kind==="effect");
  assert.deepEqual(changes.map((change)=>change.operation),["removed","added"]);
});

test("property.modify replace supersedes other sources for the same target property",()=>{
  const first=commitProperty(runtimeState(),instancePolicyDefinition("external.unknown.property.base","stack"),"property-replace-first");
  const second=commitProperty(first.state,instancePolicyDefinition("external.unknown.property.replacer","replace",7),"property-replace-second");
  assert.equal(second.state.effects.length,1);
  assert.equal(second.state.effects[0]?.sourceId,"common-play:external.unknown.property.replacer:activate:operation:0");
  const changes=second.events.flatMap((event)=>event.stateChanges).filter((change)=>change.kind==="effect");
  assert.deepEqual(changes.map((change)=>change.operation),["removed","added"]);
});

test("property.modify stack preserves independent providers",()=>{
  const first=commitProperty(runtimeState(),instancePolicyDefinition("external.unknown.property.stack-a","stack"),"property-stack-first");
  const second=commitProperty(first.state,instancePolicyDefinition("external.unknown.property.stack-b","stack",7),"property-stack-second");
  assert.equal(second.state.effects.length,2);
});

test("property.modify profile-policy rejects until RulesProfile defines an explicit stacking policy",()=>{
  const first=commitProperty(runtimeState(),instancePolicyDefinition("external.unknown.property.profile-base","stack"),"property-profile-first");
  const pending=compileCommonPlayEntryPointOperations(TEST_PROFILE,first.state,instancePolicyDefinition("external.unknown.property.profile-policy","profile-policy",7),{
    resolutionId:"property-profile-second",actorId:"hero",entryPointId:"activate",
  });
  const second=resolvePendingResolution(TEST_PROFILE,first.state,pending);
  assert.equal(second.status,"rejected");
  if(second.status!=="rejected") return;
  assert.match(second.error,/profile-policy requires an explicit RulesProfile stacking policy/);
});
