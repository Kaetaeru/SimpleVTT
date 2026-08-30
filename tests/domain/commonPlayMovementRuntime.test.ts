import assert from "node:assert/strict";
import test from "node:test";
import { resolvePendingResolution } from "../../src/domain/resolution";
import {
  answerCommonPlayFactRequest,
  resolveCommonPlayFactQuery,
  type CommonPlayFactRegistry,
} from "../../src/domain/commonPlaySpatialFactRuntime";
import { compileCommonPlayMovement } from "../../src/domain/commonPlayMovementRuntime";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const registry:CommonPlayFactRegistry={
  "spatial.legal-destination":{valueType:"destination"},
};

const movement={
  kind:"movement.relocate" as const,
  mode:"move" as const,
  target:"hero",
  distance:{value:15},
  destinationFact:{
    id:"legal-destination",
    fact:"spatial.legal-destination",
    subject:"hero",
    authority:"dm" as const,
    visibility:"authority-only" as const,
    unknownPolicy:"request-authority" as const,
  },
};

const authorityAnswer={
  queryId:"legal-destination",
  fact:"spatial.legal-destination",
  subject:"hero",
  value:"point:b4",
  resolutionId:"move",
  provenance:{kind:"authority" as const,responderId:"dm"},
};

test("Gate E4 provider and manual destination answers compile to the same resolver movement operation", async()=>{
  const provider=await resolveCommonPlayFactQuery({
    registry,
    query:movement.destinationFact,
    resolutionId:"move-provider",
    expectedRevision:0,
    provider:{id:"grid-provider",resolve:()=>({status:"answered",value:"point:b4"})},
  });
  assert.equal(provider.status,"resolved");
  if(provider.status!=="resolved")return;

  const manualRequest=await resolveCommonPlayFactQuery({
    registry,
    query:movement.destinationFact,
    resolutionId:"move-manual",
    expectedRevision:0,
  });
  assert.equal(manualRequest.status,"awaiting-authority");
  if(manualRequest.status!=="awaiting-authority")return;
  const manual=answerCommonPlayFactRequest(manualRequest.request,{
    requestId:manualRequest.request.id,
    idempotencyKey:manualRequest.request.idempotencyKey,
    expectedRevision:0,
    responderId:"dm",
    value:"point:b4",
  },0);
  assert.equal(manual.status,"resolved");
  if(manual.status!=="resolved")return;

  const providerCompiled=compileCommonPlayMovement({id:"move",definition:movement,answer:provider.answer});
  const manualCompiled=compileCommonPlayMovement({id:"move",definition:movement,answer:manual.answer});
  assert.equal(providerCompiled.status,"compiled");
  assert.equal(manualCompiled.status,"compiled");
  if(providerCompiled.status!=="compiled"||manualCompiled.status!=="compiled")return;
  assert.equal(providerCompiled.destination,"point:b4");
  assert.equal(manualCompiled.destination,"point:b4");
  assert.deepEqual(providerCompiled.operation,manualCompiled.operation);
  assert.deepEqual(providerCompiled.operation,{id:"move",kind:"move",actorId:"hero",movementMode:"walk",distanceFeet:15,distanceTraveledFeet:15,destinationRef:"point:b4",doesNotProvokeOpportunityAttacks:false});

  const committed=resolvePendingResolution(TEST_PROFILE,runtimeState(),{
    id:"common-play-move",
    actorId:"hero",
    sourceId:"external.unknown.movement",
    expectedRevision:0,
    operations:[providerCompiled.operation],
  });
  assert.equal(committed.status,"committed");
  if(committed.status!=="committed")return;
  assert.equal(committed.state.combatants.hero.economy.movement,15);
});

test("generic movement lowers push, pull, and teleport to authoritative free movement",()=>{
  for(const mode of ["push","pull","teleport"] as const){
    const compiled=compileCommonPlayMovement({
      id:`move-${mode}`,
      definition:{...movement,mode},
      answer:{...authorityAnswer,resolutionId:`move-${mode}`},
    });
    assert.equal(compiled.status,"compiled");
    if(compiled.status==="compiled") {
      assert.equal(compiled.operation.kind,"free-move");
      assert.equal(compiled.operation.movementMode,mode);
      assert.equal(compiled.operation.doesNotProvokeOpportunityAttacks,mode==="teleport");
    }
  }
});

test("Gate E4 rejects a destination answer that does not belong to the movement query",()=>{
  const compiled=compileCommonPlayMovement({
    id:"move",
    definition:movement,
    answer:{...authorityAnswer,queryId:"other-query"},
  });
  assert.equal(compiled.status,"rejected");
  if(compiled.status==="rejected")assert.match(compiled.reason,/query/i);
});

test("generic movement reuses profile expressions for speed costs",()=>{
  const compiled=compileCommonPlayMovement({
    id:"move",
    definition:{...movement,movementType:"crawl",distance:{ref:"runtime.speed"},costMultiplier:{value:2}},
    properties:{"runtime.speed":10},
    answer:authorityAnswer,
  });
  assert.equal(compiled.status,"compiled");
  if(compiled.status==="compiled")assert.deepEqual(compiled.operation,{id:"move",kind:"move",actorId:"hero",movementMode:"crawl",distanceFeet:20,distanceTraveledFeet:10,destinationRef:"point:b4",doesNotProvokeOpportunityAttacks:false});
});

test("rules-derived movement cost applies without content-specific dispatch",()=>{
  const compiled=compileCommonPlayMovement({
    id:"move-difficult",
    definition:{...movement,distance:{value:5}},
    properties:{"movement.walk":30,"movement.cost.multiplier":2},
    answer:authorityAnswer,
  });
  assert.equal(compiled.status,"compiled");
  if(compiled.status!=="compiled")return;
  assert.equal(compiled.operation.kind,"move");
  assert.equal(compiled.operation.distanceFeet,10);
  assert.equal(compiled.operation.distanceTraveledFeet,5);
});

test("rules-derived alternate speed caps regular movement structurally",()=>{
  const compiled=compileCommonPlayMovement({
    id:"move-climb",
    definition:{...movement,movementType:"climb",distance:{value:20}},
    properties:{"movement.climb":15},
    answer:authorityAnswer,
  });
  assert.equal(compiled.status,"rejected");
  if(compiled.status==="rejected")assert.match(compiled.reason,/exceeds climb speed/);
});

test("generic movement preserves the explicit no-provoke flag",()=>{
  const compiled=compileCommonPlayMovement({
    id:"move-no-provoke",
    definition:{...movement,distance:{value:5},doesNotProvokeOpportunityAttacks:true},
    answer:authorityAnswer,
  });
  assert.equal(compiled.status,"compiled");
  if(compiled.status!=="compiled")return;
  assert.equal(compiled.operation.kind,"move");
  assert.equal(compiled.operation.doesNotProvokeOpportunityAttacks,true);
});
