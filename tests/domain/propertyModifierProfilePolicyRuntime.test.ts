import assert from "node:assert/strict";
import test from "node:test";

import { compileCommonPlayEntryPointOperations, parseCommonPlayOperationDefinition } from "../../src/domain/commonPlayOperationRuntime";
import { resolvePendingResolution } from "../../src/domain/resolution";
import type { RulesRuntimeState } from "../../src/domain/combatState";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const PROFILE={...TEST_PROFILE,propertyModifierPolicy:{defaultInstancePolicy:"unique-by-source" as const}};

function definition(id:string) {
  return parseCommonPlayOperationDefinition({schemaVersion:"0.2-draft",id,entryPoints:[{id:"activate",invocation:"manual",operations:[{kind:"property.modify",property:"movement.walk",operation:"add",value:{value:5},target:"actor",owner:"effect",source:"definition",duration:{kind:"elapsed",amount:{value:1},unit:"minutes"},lifetime:{kind:"until-duration",onEnd:"destroy"},instancePolicy:"profile-policy"}]}]});
}

function apply(state:RulesRuntimeState,id:string,resolutionId:string) {
  const parsed=definition(id);
  const pending=compileCommonPlayEntryPointOperations(PROFILE,state,parsed,{resolutionId,actorId:"hero",entryPointId:"activate"});
  return resolvePendingResolution(PROFILE,state,pending);
}

function committed(result:ReturnType<typeof apply>) {
  assert.equal(result.status,"committed",result.status==="rejected"?result.error:undefined);
  if(result.status!=="committed") throw new Error("expected committed resolution");
  return result;
}

function effects(state:RulesRuntimeState) {
  return state.effects.filter((effect)=>effect.propertyModifier?.property==="movement.walk");
}

test("profile-policy resolves through the RulesProfile structural stacking policy",()=>{
  const first=committed(apply(runtimeState(),"external.profile.same","profile-policy-1"));
  const firstEffect=effects(first.state)[0]!;
  const second=committed(apply(first.state,"external.profile.same","profile-policy-2"));
  assert.equal(effects(second.state).length,1);
  const changes=second.events.flatMap((event)=>event.stateChanges).filter((change)=>change.kind==="effect");
  assert.ok(changes.some((change)=>change.kind==="effect"&&change.effectId===firstEffect.id&&change.operation==="removed"));
  const third=committed(apply(second.state,"external.profile.other","profile-policy-3"));
  assert.equal(effects(third.state).length,2);
});
