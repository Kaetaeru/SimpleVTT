import assert from "node:assert/strict";
import test from "node:test";
import { compileCommonPlayArtifactActivation, resolveCommonPlayArtifactActivation, type CommonPlayArtifactActivationDefinition } from "../../src/domain/commonPlayArtifactRuntime";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function definition(prefix="external.unknown"):CommonPlayArtifactActivationDefinition {
  const duration={kind:"durable"};
  const lifetime={kind:"durable"};
  return {
    schemaVersion:"0.2-draft",id:`${prefix}.artifacts`,
    entryPoints:[{id:"create",invocation:"manual",operations:[
      {kind:"artifact.spawn",template:"summon"},
      {kind:"artifact.spawn",template:"wall"},
      {kind:"artifact.spawn",template:"form"},
      {kind:"artifact.spawn",template:"tether"},
    ]}],
    artifactTemplates:[
      {id:"summon",artifactKind:"actor",duration,lifetime,initialState:{combatantId:`${prefix}.summoned`,statDefinitionId:`${prefix}.stat`,ownerId:"actor",controllerId:"actor",initiative:"shared",properties:{"defense.ac":13},actionDefinitionIds:[`${prefix}.bite`],resources:[]}},
      {id:"wall",artifactKind:"object",duration,lifetime,initialState:{size:"large",armorClass:15,hp:{current:20,maximum:20},damageThreshold:5,repairable:true}},
      {id:"form",artifactKind:"form",duration,lifetime,initialState:{targetActorId:"actor",propertyOverlay:{"movement.fly":30},retainedProperties:[],replacementProperties:["movement.fly"],hpPolicy:"retain",actionPolicy:"grant",spellcasting:"retain",actionDefinitionIds:[`${prefix}.claw`],resources:[]}},
      {id:"tether",artifactKind:"link",duration,lifetime,initialState:{endpointIds:["actor","artifact:summon"],relation:"tether",maximumLengthFeet:30}},
    ],
  };
}

test("portable artifact templates compile object, actor, form, and link through one Resolver transaction",()=>{
  const state=runtimeState();
  const pending=compileCommonPlayArtifactActivation(state,definition(),{resolutionId:"artifact-activation",actorId:"hero",entryPointId:"create"});
  assert.equal(pending.operations.every((operation)=>operation.kind==="spawn-artifact"),true);
  const resolved=resolveCommonPlayArtifactActivation(TEST_PROFILE,state,definition(),{resolutionId:"artifact-activation",actorId:"hero",entryPointId:"create"});
  assert.equal(resolved.status,"committed");
  if(resolved.status!=="committed") return;
  assert.deepEqual(resolved.state.artifacts?.map((artifact)=>artifact.artifactKind),["actor","object","form","link"]);
  assert.equal(resolved.state.artifacts?.find((artifact)=>artifact.artifactKind==="actor")?.actor?.ownerId,"hero");
  assert.equal(resolved.state.artifacts?.find((artifact)=>artifact.artifactKind==="form")?.form?.targetActorId,"hero");
  assert.match(resolved.state.artifacts?.find((artifact)=>artifact.artifactKind==="link")?.link?.endpointIds[1]??"",/artifact:1:summon$/);
});

test("portable artifact activation is identity invariant and rejects missing template bindings",()=>{
  const first=resolveCommonPlayArtifactActivation(TEST_PROFILE,runtimeState(),definition("external.a"),{resolutionId:"first",actorId:"hero",entryPointId:"create"});
  const renamed=resolveCommonPlayArtifactActivation(TEST_PROFILE,runtimeState(),definition("renamed.b"),{resolutionId:"renamed",actorId:"hero",entryPointId:"create"});
  assert.equal(first.status,"committed");assert.equal(renamed.status,"committed");
  if(first.status==="committed"&&renamed.status==="committed") assert.deepEqual(first.state.artifacts?.map((artifact)=>artifact.artifactKind),renamed.state.artifacts?.map((artifact)=>artifact.artifactKind));
  const invalid=definition();invalid.entryPoints[0].operations[0].template="missing";
  assert.equal(resolveCommonPlayArtifactActivation(TEST_PROFILE,runtimeState(),invalid,{resolutionId:"invalid",actorId:"hero",entryPointId:"create"}).status,"rejected");
});
