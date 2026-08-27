import assert from "node:assert/strict";
import test from "node:test";

import {
  answerCommonPlayFactRequest,
  resolveCommonPlayFactQuery,
  type CommonPlayFactQuery,
  type CommonPlayFactRegistry,
  type CommonPlayFactProvider,
} from "../../src/domain/commonPlaySpatialFactRuntime";

const registry:CommonPlayFactRegistry={
  "spatial.within-range":{valueType:"boolean"},
  "spatial.visible":{valueType:"boolean"},
  "spatial.affected-targets":{valueType:"targets"},
  "spatial.legal-destination":{valueType:"destination"},
};

const baseQuery=(overrides:Partial<CommonPlayFactQuery>={}):CommonPlayFactQuery=>({
  id:"fact.range",
  fact:"spatial.within-range",
  authority:"dm",
  visibility:"authority-only",
  unknownPolicy:"request-authority",
  ...overrides,
});

test("Gate E1 provider and manual authority normalize to the same typed range fact",async()=>{
  const provider:CommonPlayFactProvider={
    id:"provider.test-spatial",
    async resolve(query){
      return query.fact==="spatial.within-range"
        ? {status:"answered",value:true}
        : {status:"unknown"};
    },
  };

  const providerResult=await resolveCommonPlayFactQuery({
    registry,
    query:baseQuery(),
    resolutionId:"resolution.range.provider",
    expectedRevision:4,
    provider,
  });
  assert.equal(providerResult.status,"resolved");
  if(providerResult.status!=="resolved")return;
  assert.equal(providerResult.answer.value,true);
  assert.equal(providerResult.answer.provenance.kind,"provider");

  const awaiting=await resolveCommonPlayFactQuery({
    registry,
    query:baseQuery({id:"fact.range.manual"}),
    resolutionId:"resolution.range.manual",
    expectedRevision:4,
  });
  assert.equal(awaiting.status,"awaiting-authority");
  if(awaiting.status!=="awaiting-authority")return;

  const manual=answerCommonPlayFactRequest(awaiting.request,{
    requestId:awaiting.request.id,
    idempotencyKey:awaiting.request.idempotencyKey,
    expectedRevision:4,
    responderId:"dm.host",
    value:true,
  },4);
  assert.equal(manual.status,"resolved");
  if(manual.status!=="resolved")return;
  assert.equal(manual.answer.value,providerResult.answer.value);
  assert.equal(manual.answer.provenance.kind,"authority");
});

test("Gate E2 never invents visibility when provider and authority are unavailable",async()=>{
  const blocked=await resolveCommonPlayFactQuery({
    registry,
    query:baseQuery({id:"fact.visible",fact:"spatial.visible",unknownPolicy:"unsupported"}),
    resolutionId:"resolution.visible",
    expectedRevision:2,
  });
  assert.equal(blocked.status,"unsupported");

  const falseResult=await resolveCommonPlayFactQuery({
    registry,
    query:baseQuery({id:"fact.visible.false",fact:"spatial.visible",unknownPolicy:"treat-false"}),
    resolutionId:"resolution.visible.false",
    expectedRevision:2,
  });
  assert.equal(falseResult.status,"resolved");
  if(falseResult.status!=="resolved")return;
  assert.equal(falseResult.answer.value,false);
});

test("Gate E3 provider and manual area selection converge on deterministic targets without a Zone",async()=>{
  const query=baseQuery({
    id:"fact.area.targets",
    fact:"spatial.affected-targets",
    subject:"selector.area",
  });
  const provider:CommonPlayFactProvider={
    id:"provider.test-spatial",
    async resolve(){
      return {status:"answered",value:["actor.c","actor.a","actor.c","actor.b"]};
    },
  };
  const providerResult=await resolveCommonPlayFactQuery({
    registry,
    query,
    resolutionId:"resolution.area.provider",
    expectedRevision:7,
    provider,
  });
  assert.equal(providerResult.status,"resolved");
  if(providerResult.status!=="resolved")return;
  assert.deepEqual(providerResult.answer.value,["actor.a","actor.b","actor.c"]);

  const awaiting=await resolveCommonPlayFactQuery({
    registry,
    query:{...query,id:"fact.area.targets.manual"},
    resolutionId:"resolution.area.manual",
    expectedRevision:7,
  });
  assert.equal(awaiting.status,"awaiting-authority");
  if(awaiting.status!=="awaiting-authority")return;
  assert.equal(awaiting.request.inputType,"targets");

  const manual=answerCommonPlayFactRequest(awaiting.request,{
    requestId:awaiting.request.id,
    idempotencyKey:awaiting.request.idempotencyKey,
    expectedRevision:7,
    responderId:"dm.host",
    value:["actor.c","actor.b","actor.a","actor.b"],
  },7);
  assert.equal(manual.status,"resolved");
  if(manual.status!=="resolved")return;
  assert.deepEqual(manual.answer.value,providerResult.answer.value);
});

test("Gate E4 legal destination uses the same provider/manual semantic result",async()=>{
  const query=baseQuery({id:"fact.destination",fact:"spatial.legal-destination"});
  const provider:CommonPlayFactProvider={
    id:"provider.test-spatial",
    async resolve(){ return {status:"answered",value:"destination.marker.17"}; },
  };
  const providerResult=await resolveCommonPlayFactQuery({
    registry,
    query,
    resolutionId:"resolution.move.provider",
    expectedRevision:9,
    provider,
  });
  assert.equal(providerResult.status,"resolved");
  if(providerResult.status!=="resolved")return;

  const awaiting=await resolveCommonPlayFactQuery({
    registry,
    query:{...query,id:"fact.destination.manual"},
    resolutionId:"resolution.move.manual",
    expectedRevision:9,
  });
  assert.equal(awaiting.status,"awaiting-authority");
  if(awaiting.status!=="awaiting-authority")return;

  const manual=answerCommonPlayFactRequest(awaiting.request,{
    requestId:awaiting.request.id,
    idempotencyKey:awaiting.request.idempotencyKey,
    expectedRevision:9,
    responderId:"dm.host",
    value:"destination.marker.17",
  },9);
  assert.equal(manual.status,"resolved");
  if(manual.status!=="resolved")return;
  assert.equal(manual.answer.value,providerResult.answer.value);
});

test("Gate E stale and duplicate authority responses cannot create a second answer",async()=>{
  const awaiting=await resolveCommonPlayFactQuery({
    registry,
    query:baseQuery({id:"fact.stale"}),
    resolutionId:"resolution.stale",
    expectedRevision:11,
  });
  assert.equal(awaiting.status,"awaiting-authority");
  if(awaiting.status!=="awaiting-authority")return;

  const response={
    requestId:awaiting.request.id,
    idempotencyKey:awaiting.request.idempotencyKey,
    expectedRevision:11,
    responderId:"dm.host",
    value:true,
  } as const;
  const first=answerCommonPlayFactRequest(awaiting.request,response,11);
  assert.equal(first.status,"resolved");
  const stale=answerCommonPlayFactRequest(awaiting.request,response,12);
  assert.equal(stale.status,"stale");
});

test("Gate E unknown external content identity does not participate in fact semantics",async()=>{
  for(const resolutionId of ["resolution.external.alpha","resolution.external.renamed-banana"]){
    const result=await resolveCommonPlayFactQuery({
      registry,
      query:baseQuery({id:`fact.${resolutionId}`}),
      resolutionId,
      expectedRevision:1,
      provider:{id:"provider.test-spatial",async resolve(){return {status:"answered",value:true};}},
    });
    assert.equal(result.status,"resolved");
    if(result.status==="resolved")assert.equal(result.answer.value,true);
  }
});
