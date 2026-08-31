import assert from "node:assert/strict";
import test from "node:test";
import { compileCommonPlayEntryPointOperations, parseCommonPlayOperationDefinition } from "../../src/domain/commonPlayOperationRuntime";
import { resolvePendingResolution } from "../../src/domain/resolution";
import type { RuntimeState } from "../../src/domain/combatState";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

type Policy="stack"|"replace"|"unique-by-source"|"profile-policy";
function definition(id:string,policy:Policy) { return {schemaVersion:"0.2-draft",id,entryPoints:[{id:"activate",invocation:"manual",operations:[{kind:"property.modify",property:"movement.walk",operation:"add",value:{value:5},target:"actor",owner:"effect",source:"definition",duration:{kind:"elapsed",amount:{value:1},unit:"minutes"},lifetime:{kind:"until-duration",onEnd:"destroy"},instancePolicy:policy}]}]}; }
function apply(state:RuntimeState,id:string,policy:Policy,resolutionId:string) {
  const parsed=parseCommonPlayOperationDefinition(definition(id,policy));
  const pending=compileCommonPlayEntryPointOperations(TEST_PROFILE,state,parsed,{resolutionId,actorId:"hero",entryPointId:"activate"});
  return resolvePendingResolution(TEST_PROFILE,state,pending);
}
function committed(result:ReturnType<typeof apply>) {
  assert.equal(result.status,"committed");
  if(result.status!=="committed") throw new Error("expected committed resolution");
  return result;
}
function propertyEffects(state:RuntimeState) { return state.effects.filter((effect)=>effect.propertyModifier?.property==="movement.walk"); }

test("stack retains independent generic property modifier effects",()=>{
  const first=committed(apply(runtimeState(),"external.stack.one","stack","stack-1"));
  const second=committed(apply(first.state,"external.stack.two","stack","stack-2"));
  assert.equal(propertyEffects(second.state).length,2);
});

test("replace displaces prior effects for the same target and property with reversible state changes",()=>{
  const first=committed(apply(runtimeState(),"external.replace.old","stack","replace-1"));
  const before=propertyEffects(first.state)[0]!;
  const second=committed(apply(first.state,"external.replace.new","replace","replace-2"));
  assert.equal(propertyEffects(second.state).length,1);
  const changes=second.events.flatMap((event)=>event.stateChanges).filter((change)=>change.kind==="effect");
  assert.ok(changes.some((change)=>change.effectId===before.id&&change.operation==="removed"));
  assert.ok(changes.some((change)=>change.effectId!==before.id&&change.operation==="added"));
});

test("unique-by-source replaces only the same structural source",()=>{
  const first=committed(apply(runtimeState(),"external.unique.same","unique-by-source","unique-1"));
  const second=committed(apply(first.state,"external.unique.same","unique-by-source","unique-2"));
  assert.equal(propertyEffects(second.state).length,1);
  const third=committed(apply(second.state,"external.unique.other","unique-by-source","unique-3"));
  assert.equal(propertyEffects(third.state).length,2);
});

test("profile-policy fails explicitly until RulesProfile owns a stacking policy",()=>{
  const result=apply(runtimeState(),"external.profile.policy","profile-policy","profile-policy");
  assert.equal(result.status,"rejected");
});
