import assert from "node:assert/strict";
import test from "node:test";
import { resolveCommonPlayArtifactActivation } from "../../src/domain/commonPlayArtifactRuntime";
import { runtimeState, TEST_PROFILE } from "../domain/rulesTestState";

test("unknown actor artifact preserves portable numeric profile properties on its runtime combatant",()=>{
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
  assert.equal(actor.baseSpeed,25);
  assert.equal(actor.life.hp.current,9);
  assert.equal(actor.baseProperties?.["defense.ac"],13);
  assert.equal(actor.baseProperties?.["ability.str.score"],14);
  assert.equal(actor.baseProperties?.["proficiency.bonus"],2);
});
