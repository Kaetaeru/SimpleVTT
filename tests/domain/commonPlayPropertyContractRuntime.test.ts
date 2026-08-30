import assert from "node:assert/strict";
import test from "node:test";
import { compileCommonPlayEntryPointOperations, parseCommonPlayOperationDefinition } from "../../src/domain/commonPlayOperationRuntime";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function definition(id="external.unseen.property-owner") { return {schemaVersion:"0.2-draft",id,entryPoints:[{id:"activate",invocation:"manual",operations:[{kind:"property.modify",property:"movement.walk",operation:"add",value:{op:"add",args:[{ref:"movement.walk"},{value:10}]},target:"actor",owner:"effect",source:"definition",duration:{kind:"elapsed",amount:{value:1},unit:"minutes"},lifetime:{kind:"until-duration",onEnd:"destroy"},instancePolicy:"unique-by-source"}]}]}; }

test("property.modify preserves explicit effect ownership without content identity dispatch",()=>{
  const parsed=parseCommonPlayOperationDefinition(definition());
  const operation=parsed.entryPoints[0]?.operations[0];
  assert.equal(operation?.kind,"property.modify");
  assert.deepEqual(operation,parseCommonPlayOperationDefinition(definition("external.renamed.property-owner")).entryPoints[0]?.operations[0]);
  assert.deepEqual(operation&&"value" in operation?operation.value:undefined,{op:"add",args:[{ref:"movement.walk"},{value:10}]});
});

test("property.modify rejects ambiguous ownership and has no production fallback",()=>{
  const missing=definition() as any; delete missing.entryPoints[0].operations[0].owner;
  assert.throws(()=>parseCommonPlayOperationDefinition(missing),/owner must be effect/);
  const durable=definition() as any; durable.entryPoints[0].operations[0].duration={kind:"durable"};
  assert.throws(()=>parseCommonPlayOperationDefinition(durable),/duration.kind must be elapsed/);
  const parsed=parseCommonPlayOperationDefinition(definition());
  assert.throws(()=>compileCommonPlayEntryPointOperations(TEST_PROFILE,runtimeState(),parsed,{resolutionId:"property-contract",actorId:"hero",entryPointId:"activate"}),/property.modify production lowering is not implemented/);
});
