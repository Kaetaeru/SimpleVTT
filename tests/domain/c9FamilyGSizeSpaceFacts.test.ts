import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMON_PLAY_STANDARD_FACTS,
  answerCommonPlayFactRequest,
  resolveCommonPlayFactQuery,
  type CommonPlayFactProvider,
  type CommonPlayFactQuery,
} from "../../src/domain/commonPlaySpatialFactRuntime";

const provider:CommonPlayFactProvider={
  id:"provider.c9-family-g-size-space",
  resolve(query){
    if(query.fact==="spatial.size-category") return {status:"answered",value:"large"};
    if(query.fact==="spatial.space-feet") return {status:"answered",value:10};
    return {status:"unknown"};
  },
};

test("Family G size and occupied-space facts are provider-authoritative and identity invariant",async()=>{
  const observed=[];
  for(const resolutionId of ["external.size-space.alpha","renamed.size-space.omega"]){
    const size=await resolveCommonPlayFactQuery({
      registry:COMMON_PLAY_STANDARD_FACTS,
      query:{id:"size",fact:"spatial.size-category",subject:"actor.external",authority:"host",visibility:"public",unknownPolicy:"block"},
      resolutionId,expectedRevision:4,provider,
    });
    const space=await resolveCommonPlayFactQuery({
      registry:COMMON_PLAY_STANDARD_FACTS,
      query:{id:"space",fact:"spatial.space-feet",subject:"actor.external",authority:"host",visibility:"public",unknownPolicy:"block"},
      resolutionId,expectedRevision:4,provider,
    });
    assert.equal(size.status,"resolved");
    assert.equal(space.status,"resolved");
    if(size.status!=="resolved"||space.status!=="resolved") continue;
    assert.equal(size.answer.value,"large");
    assert.equal(space.answer.value,10);
    assert.deepEqual(size.answer.provenance,{kind:"provider",providerId:provider.id});
    assert.deepEqual(space.answer.provenance,{kind:"provider",providerId:provider.id});
    observed.push([size.answer.value,space.answer.value]);
  }
  assert.deepEqual(observed[1],observed[0]);
});

test("Family G occupied-space fact supports explicit manual authority without geometry fabrication",async()=>{
  const query:CommonPlayFactQuery={
    id:"space-manual",fact:"spatial.space-feet",subject:"actor.external",authority:"dm",visibility:"public",unknownPolicy:"request-authority",
  };
  const awaiting=await resolveCommonPlayFactQuery({registry:COMMON_PLAY_STANDARD_FACTS,query,resolutionId:"external.space.manual",expectedRevision:9});
  assert.equal(awaiting.status,"awaiting-authority");
  if(awaiting.status!=="awaiting-authority") return;
  assert.equal(awaiting.request.inputType,"number");
  const answered=answerCommonPlayFactRequest(awaiting.request,{
    requestId:awaiting.request.id,idempotencyKey:awaiting.request.idempotencyKey,expectedRevision:9,responderId:"dm.host",value:15,
  },9);
  assert.equal(answered.status,"resolved");
  if(answered.status!=="resolved") return;
  assert.equal(answered.answer.value,15);
  assert.deepEqual(answered.answer.provenance,{kind:"authority",responderId:"dm.host"});
});
