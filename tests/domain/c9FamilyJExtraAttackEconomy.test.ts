import assert from "node:assert/strict";
import test from "node:test";
import { compileCommonPlayPayments, parseCommonPlayOperationDefinition } from "../../src/domain/commonPlayOperationRuntime";

const definition=(payment:Record<string,unknown>)=>parseCommonPlayOperationDefinition({
  schemaVersion:"0.2-draft",id:"external.unknown.family-j-extra-attack",payments:[payment],
  entryPoints:[{id:"replace-one-attack",invocation:"manual",operations:[]}],
});

test("portable economy payment lowers structural Attack action width into the shared Resolver",()=>{
  const parsed=definition({kind:"economy",bucket:"action",amount:{value:1},consumeAt:"commit",refundOnCancel:true,actionKind:"attack",attacksPerAction:2});
  assert.deepEqual(compileCommonPlayPayments(parsed.payments,{resolutionId:"resolution.family-j.extra-attack",actorId:"actor.external",entryPointId:"replace-one-attack",actionKind:"other"}),[{
    id:"resolution.family-j.extra-attack:payment:0",kind:"use-economy",actorId:"actor.external",slot:"action",bonusActionGranted:undefined,actionKind:"attack",attacksPerAction:2,
  }]);
});

test("portable replacement action can consume an existing Extra Attack without granting a new one",()=>{
  const parsed=definition({kind:"economy",bucket:"action",amount:{value:1},consumeAt:"commit",refundOnCancel:true,actionKind:"attack"});
  assert.deepEqual(compileCommonPlayPayments(parsed.payments,{resolutionId:"resolution.family-j.replace",actorId:"actor.external",entryPointId:"replace-one-attack",actionKind:"other"}),[{
    id:"resolution.family-j.replace:payment:0",kind:"use-economy",actorId:"actor.external",slot:"action",bonusActionGranted:undefined,actionKind:"attack",
  }]);
});

test("portable attack width rejects economy buckets and action kinds that cannot own Extra Attack",()=>{
  assert.throws(()=>definition({kind:"economy",bucket:"bonus-action",amount:{value:1},consumeAt:"commit",refundOnCancel:true,actionKind:"attack",attacksPerAction:2}),/attacksPerAction requires bucket=action and actionKind=attack/);
  assert.throws(()=>definition({kind:"economy",bucket:"action",amount:{value:1},consumeAt:"commit",refundOnCancel:true,actionKind:"other",attacksPerAction:2}),/attacksPerAction requires bucket=action and actionKind=attack/);
});
