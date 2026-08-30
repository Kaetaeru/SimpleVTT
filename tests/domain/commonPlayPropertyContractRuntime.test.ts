import assert from "node:assert/strict";
import test from "node:test";
import { compileCommonPlayEntryPointOperations, parseCommonPlayOperationDefinition } from "../../src/domain/commonPlayOperationRuntime";
import { resolvePendingResolution } from "../../src/domain/resolution";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function definition(id="external.unseen.property-owner") { return {schemaVersion:"0.2-draft",id,entryPoints:[{id:"activate",invocation:"manual",operations:[{kind:"property.modify",property:"movement.walk",operation:"add",value:{op:"add",args:[{ref:"movement.walk"},{value:10}]},target:"actor",owner:"effect",source:"definition",duration:{kind:"elapsed",amount:{value:1},unit:"minutes"},lifetime:{kind:"until-duration",onEnd:"destroy"},instancePolicy:"unique-by-source"}]}]}; }

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
