import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  lowerAllCommonPlayEntryPoints,
  parseCommonPlayDefinition,
  validateCommonPlayCapabilities,
} from "../../src/domain/commonPlayDefinitionRuntime";
import { compileCommonPlaySaveDamageEntryPoint } from "../../src/domain/commonPlayEntryPointRuntime";
import { compileCommonPlayEffectActivation } from "../../src/domain/commonPlayEffectRuntime";
import { compileCommonPlayZoneActivation } from "../../src/domain/commonPlayZoneRuntime";
import { compileCommonPlayEntryPointOperations } from "../../src/domain/commonPlayOperationRuntime";
import { compileCommonPlayArtifactActivation } from "../../src/domain/commonPlayArtifactRuntime";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const fixture=(name:string)=>JSON.parse(readFileSync(
  new URL(`../fixtures/play-contract/${name}.json`,import.meta.url),"utf8",
)) as Record<string,unknown>;

function combinedDefinition() {
  const operation=fixture("generic-d20-action");
  const save=fixture("multi-target-save-damage");
  const effect=fixture("persistent-effect-trigger");
  const zone=fixture("persistent-zone-trigger");
  return {
    schemaVersion:"0.2-draft",
    id:"external.combined.semantic-proof",
    requiresCapabilities:["rules.d20","rules.effects"],
    entryPoints:[
      ...(operation.entryPoints as unknown[]),
      ...(save.entryPoints as unknown[]),
      ...(effect.entryPoints as unknown[]),
      ...(zone.entryPoints as unknown[]),
    ],
    artifactTemplates:[
      ...(effect.artifactTemplates as unknown[]),
      ...(zone.artifactTemplates as unknown[]),
    ],
  };
}

test("one canonical Common Play definition preserves mixed families and lowers by structure",()=>{
  const definition=parseCommonPlayDefinition(combinedDefinition());
  validateCommonPlayCapabilities(definition,["rules.d20","rules.effects"]);
  const lowerings=lowerAllCommonPlayEntryPoints(definition);
  assert.deepEqual(lowerings.map((lowering)=>lowering.kind),["operations","save-damage","effect","zone"]);

  const state=runtimeState();
  const operation=lowerings[0];
  assert.equal(operation.kind,"operations");
  if(operation.kind==="operations") compileCommonPlayEntryPointOperations(TEST_PROFILE,state,operation.definition,{
    resolutionId:"combined-operation",actorId:"hero",entryPointId:operation.entryPointId,d20:{faces:[10]},
  });

  const save=lowerings[1];
  assert.equal(save.kind,"save-damage");
  if(save.kind==="save-damage") compileCommonPlaySaveDamageEntryPoint(TEST_PROFILE,state,save.definition,{
    resolutionId:"combined-save",actorId:"hero",entryPointId:save.entryPointId,damageFaces:[1,1,1,1],
    targets:[{facts:{id:"goblin",kind:"creature",relation:"enemy"},creatureKind:"monster",save:{faces:[10]}}],
  });

  const effect=lowerings[2];
  assert.equal(effect.kind,"effect");
  if(effect.kind==="effect") compileCommonPlayEffectActivation(state,effect.definition,{
    resolutionId:"combined-effect",actorId:"hero",entryPointId:effect.entryPointId,
  });

  const zone=lowerings[3];
  assert.equal(zone.kind,"zone");
  if(zone.kind==="zone") compileCommonPlayZoneActivation(state,zone.definition,{
    resolutionId:"combined-zone",actorId:"hero",entryPointId:zone.entryPointId,membershipAuthority:"manual",
  });
});

test("canonical capability validation and lowering do not depend on content identity",()=>{
  const definition=parseCommonPlayDefinition(combinedDefinition());
  assert.throws(()=>validateCommonPlayCapabilities(definition,["rules.d20"]),/rules.effects/);
  const renamed=parseCommonPlayDefinition({...combinedDefinition(),id:"external.unseen.renamed"});
  assert.deepEqual(
    lowerAllCommonPlayEntryPoints(renamed).map((lowering)=>lowering.kind),
    lowerAllCommonPlayEntryPoints(definition).map((lowering)=>lowering.kind),
  );
});

test("canonical structural boundary rejects duplicate identities and unknown root semantics",()=>{
  const duplicate=combinedDefinition();
  duplicate.entryPoints.push(structuredClone(duplicate.entryPoints[0]));
  assert.throws(()=>parseCommonPlayDefinition(duplicate),/duplicate id/);
  assert.throws(()=>parseCommonPlayDefinition({...combinedDefinition(),executeAs:"fireball"}),/unsupported fields/);
});

test("all manual lowerers preserve and atomically prepend the shared PaymentContract",()=>{
  const payment={kind:"economy",bucket:"action",amount:{value:1},consumeAt:"commit",refundOnCancel:true};
  const definition=parseCommonPlayDefinition({...combinedDefinition(),payments:[payment]});
  const state=runtimeState();
  const pending=lowerAllCommonPlayEntryPoints(definition).map((lowering,index)=>{
    if(lowering.kind==="operations") return compileCommonPlayEntryPointOperations(TEST_PROFILE,state,lowering.definition,{
      resolutionId:`paid-${index}`,actorId:"hero",entryPointId:lowering.entryPointId,d20:{faces:[10]},actionKind:"other",
    });
    if(lowering.kind==="save-damage") return compileCommonPlaySaveDamageEntryPoint(TEST_PROFILE,state,lowering.definition,{
      resolutionId:`paid-${index}`,actorId:"hero",entryPointId:lowering.entryPointId,damageFaces:[1,1,1,1],actionKind:"magic",
      targets:[{facts:{id:"goblin",kind:"creature",relation:"enemy"},creatureKind:"monster",save:{faces:[10]}}],
    });
    if(lowering.kind==="effect") return compileCommonPlayEffectActivation(state,lowering.definition,{
      resolutionId:`paid-${index}`,actorId:"hero",entryPointId:lowering.entryPointId,actionKind:"other",
    });
    return compileCommonPlayZoneActivation(state,lowering.definition,{
      resolutionId:`paid-${index}`,actorId:"hero",entryPointId:lowering.entryPointId,membershipAuthority:"manual",actionKind:"other",
    });
  });
  const artifact=lowerAllCommonPlayEntryPoints(parseCommonPlayDefinition({
    schemaVersion:"0.2-draft",id:"external.unseen.paid-artifact",payments:[payment],
    entryPoints:[{id:"create",invocation:"manual",operations:[{kind:"artifact.spawn",template:"object"}]}],
    artifactTemplates:[{id:"object",artifactKind:"object",duration:{kind:"durable"},lifetime:{kind:"durable"},initialState:{size:"small",armorClass:10,hp:{current:1,maximum:1},repairable:false}}],
  }))[0];
  assert.equal(artifact.kind,"artifacts");
  if(artifact.kind==="artifacts") pending.push(compileCommonPlayArtifactActivation(state,artifact.definition,{
    resolutionId:"paid-artifact",actorId:"hero",entryPointId:artifact.entryPointId,actionKind:"other",
  }));
  assert.equal(pending.length,5);
  for(const resolution of pending) assert.equal(resolution.operations[0]?.kind,"use-economy");
});
