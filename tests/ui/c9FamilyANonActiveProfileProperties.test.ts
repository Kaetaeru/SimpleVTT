import assert from "node:assert/strict";
import test from "node:test";
import { commonPlayActorProfileProperties } from "../../src/app/installedCommonPlayRuntimeAdapter";
import { resolveCommonPlayArtifactActivation } from "../../src/domain/commonPlayArtifactRuntime";
import type { EffectInstance } from "../../src/domain/effects";
import { runtimeState, TEST_PROFILE } from "../domain/rulesTestState";

test("non-active runtime actors preserve portable profile properties and resolve derived refs through active Effects",()=>{
  const committed=resolveCommonPlayArtifactActivation(TEST_PROFILE,runtimeState(),{
    schemaVersion:"0.2-draft",id:"external.unknown.actor-profile",
    entryPoints:[{id:"spawn",invocation:"manual",operations:[{kind:"artifact.spawn",template:"companion"}]}],
    artifactTemplates:[{id:"companion",artifactKind:"actor",duration:{kind:"durable"},lifetime:{kind:"durable"},initialState:{
      combatantId:"external.companion",statDefinitionId:"external.unknown.stat",ownerId:"hero",controllerId:"hero",side:"ally",initiative:"shared",
      properties:{"hp.maximum":12,"hp.current":9,"hp.temporary":0,"movement.walk":25,"defense.ac":13,"ability.str.score":14,"proficiency.bonus":2},
      actionDefinitionIds:[],resources:[],
    }}],
  },{resolutionId:"external-actor-profile-spawn",actorId:"hero",entryPointId:"spawn"});
  assert.equal(committed.status,"committed",committed.status==="rejected"?committed.error:undefined);
  if(committed.status!=="committed") throw new Error("expected committed actor artifact spawn");
  const actor=committed.state.combatants["external.companion"]!;
  assert.equal(actor.baseProperties?.["ability.str.score"],14);
  const modifier:EffectInstance={
    id:"effect.external.companion.str",sourceId:"external.unknown.buff",targetId:"external.companion",kind:"modifier",tags:[],expiry:{kind:"permanent"},
    propertyModifier:{property:"ability.str.score",operation:"add",value:{value:2},source:"definition",instancePolicy:"stack"},
  };
  committed.state.effects.push(modifier);
  const properties=commonPlayActorProfileProperties({
    activeCharacter:{id:"hero"} as never,
    scene:{entities:[{id:"external.companion",ac:13,initiative:11}]} as never,
  },committed.state,"external.companion")!;
  assert.equal(properties["movement.walk"],25);
  assert.equal(properties["hp.current"],9);
  assert.equal(properties["defense.ac"],13);
  assert.equal(properties.initiative,11);
  assert.equal(properties["ability.str.score"],16);
  assert.equal(properties["ability.str.modifier"],3);
});
