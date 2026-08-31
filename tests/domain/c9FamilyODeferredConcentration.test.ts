import assert from "node:assert/strict";
import test from "node:test";
import {
  compileCommonPlayArtifactActivation,
  resolveCommonPlayArtifactActivation,
  type CommonPlayArtifactActivationDefinition,
} from "../../src/domain/commonPlayArtifactRuntime";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function deferredSpellDefinition(prefix:string):CommonPlayArtifactActivationDefinition {
  return {
    schemaVersion:"0.2-draft",
    id:`${prefix}.capture`,
    entryPoints:[{
      id:"prepare",
      invocation:"manual",
      operations:[{kind:"artifact.spawn",template:"deferred-spell"}],
    }],
    artifactTemplates:[{
      id:"deferred-spell",
      artifactKind:"stored-invocation",
      duration:{kind:"durable"},
      lifetime:{kind:"until-trigger"},
      initialState:{
        ownerActorId:"actor",
        definitionId:`${prefix}.payload`,
        entryPointId:"release",
        definitionRevision:"1",
        binding:"live",
        trigger:true,
        concentrationGroupId:`${prefix}.held-concentration`,
        onTriggerConcentration:"end",
      },
    }],
  };
}

function run(prefix:string) {
  const state=runtimeState();
  const definition=deferredSpellDefinition(prefix);
  const input={resolutionId:`${prefix}.prepare-resolution`,actorId:"hero",entryPointId:"prepare"};
  const pending=compileCommonPlayArtifactActivation(state,definition,input);
  assert.deepEqual(
    pending.operations.map((operation)=>operation.kind),
    ["start-concentration","spawn-artifact"],
    "deferred spell capture must start held concentration in the same Resolver transaction",
  );

  const result=resolveCommonPlayArtifactActivation(TEST_PROFILE,state,definition,input);
  assert.equal(result.status,"committed");
  if(result.status!=="committed") return undefined;
  const stored=result.state.artifacts?.find((artifact)=>artifact.artifactKind==="stored-invocation");
  assert.ok(stored?.storedInvocation);
  assert.equal(stored.storedInvocation.concentrationGroupId,`${prefix}.held-concentration`);
  assert.equal(result.state.concentration.hero?.groupId,`${prefix}.held-concentration`);
  assert.equal(result.state.concentration.hero?.sourceId,`${prefix}.payload`);
  return {
    operationKinds:pending.operations.map((operation)=>operation.kind),
    concentrationActive:Boolean(result.state.concentration.hero),
    storedInvocationActive:Boolean(stored),
  };
}

test("portable deferred spell capture starts held concentration without spell identity dispatch",()=>{
  assert.deepEqual(run("external.unknown.deferred-spell"),{
    operationKinds:["start-concentration","spawn-artifact"],
    concentrationActive:true,
    storedInvocationActive:true,
  });
});

test("deferred spell concentration setup is invariant under complete external identity rename",()=>{
  assert.deepEqual(run("external.unknown.deferred-spell"),run("completely-renamed.deferred-cast"));
});
