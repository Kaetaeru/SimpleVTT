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
  assert.deepEqual(providerCompiled.operation,{id:"move",kind:"move",actorId:"hero",distanceFeet:15});

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

test("Gate E4 refuses movement modes that existing Core primitives cannot represent exactly",()=>{
  for(const mode of ["push","pull","teleport"] as const){
    const compiled=compileCommonPlayMovement({
      id:`move-${mode}`,
      definition:{...movement,mode},
      answer:{
        queryId:"legal-destination",
        fact:"spatial.legal-destination",
        subject:"hero",
        value:"point:b4",
        resolutionId:`move-${mode}`,
        provenance:{kind:"authority",responderId:"dm"},
      },
    });
    assert.equal(compiled.status,"unsupported");
    if(compiled.status==="unsupported")assert.match(compiled.reason,new RegExp(mode,"i"));
  }
});

test("Gate E4 rejects a destination answer that does not belong to the movement query",()=>{
  const compiled=compileCommonPlayMovement({
    id:"move",
    definition:movement,
    answer:{
      queryId:"other-query",
      fact:"spatial.legal-destination",
      subject:"hero",
      value:"point:b4",
      resolutionId:"move",
      provenance:{kind:"authority",responderId:"dm"},
    },
  });
  assert.equal(compiled.status,"rejected");
  if(compiled.status==="rejected")assert.match(compiled.reason,/query/i);
});

test("Gate E4 rejects non-literal movement distance instead of inventing an evaluator",()=>{
  const compiled=compileCommonPlayMovement({
    id:"move",
    definition:{...movement,distance:{ref:"runtime.speed"}},
    answer:{
      queryId:"legal-destination",
      fact:"spatial.legal-destination",
      subject:"hero",
      value:"point:b4",
      resolutionId:"move",
      provenance:{kind:"authority",responderId:"dm"},
    },
  });
  assert.equal(compiled.status,"unsupported");
  if(compiled.status==="unsupported")assert.match(compiled.reason,/distance|expression/i);
});
