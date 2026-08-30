import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMON_PLAY_STANDARD_FACTS,
  answerCommonPlayFactRequest,
  resolveCommonPlayFactPredicate,
  resolveCommonPlayFactQuery,
  type CommonPlayFactProvider,
  type CommonPlayFactQuery,
} from "../../src/domain/commonPlaySpatialFactRuntime";

function senseQuery(overrides:Partial<CommonPlayFactQuery>={}):CommonPlayFactQuery {
  return {
    id:"sense.visible",
    fact:"sense.can-see",
    subject:"target.external.alpha",
    authority:"actor-owner",
    visibility:"actor",
    unknownPolicy:"request-authority",
    ...overrides,
  };
}

test("Family H sensing facts resolve through an authoritative provider without content identity dispatch",async()=>{
  const provider:CommonPlayFactProvider={
    id:"provider.senses",
    resolve(query){
      if(query.fact==="sense.can-see")return {status:"answered",value:true};
      if(query.fact==="sense.detected")return {status:"answered",value:true};
      return {status:"unknown"};
    },
  };

  for(const subject of ["target.external.alpha","target.renamed-banana"]){
    const result=await resolveCommonPlayFactQuery({
      registry:COMMON_PLAY_STANDARD_FACTS,
      query:senseQuery({id:`sense.visible.${subject}`,subject}),
      resolutionId:`resolution.${subject}`,
      expectedRevision:3,
      provider,
    });
    assert.equal(result.status,"resolved");
    if(result.status!=="resolved")continue;
    assert.equal(result.answer.value,true);
    assert.equal(result.answer.subject,subject);
    assert.deepEqual(result.answer.provenance,{kind:"provider",providerId:"provider.senses"});
  }

  const predicate=await resolveCommonPlayFactPredicate({
    registry:COMMON_PLAY_STANDARD_FACTS,
    queries:[
      senseQuery({id:"visible",subject:"target.external.alpha"}),
      senseQuery({id:"detected",fact:"sense.detected",subject:"target.external.alpha"}),
    ],
    predicate:{op:"all",args:[
      {op:"eq",left:{ref:"visible"},right:{value:true}},
      {op:"eq",left:{ref:"detected"},right:{value:true}},
    ]},
    resolutionId:"resolution.sensing.predicate",
    expectedRevision:3,
    provider,
  });
  assert.equal(predicate.status,"eligible");
});

test("Family H hidden state can request owner authority and rejects stale sensing answers",async()=>{
  const awaiting=await resolveCommonPlayFactQuery({
    registry:COMMON_PLAY_STANDARD_FACTS,
    query:senseQuery({
      id:"sense.hidden",
      fact:"sense.hidden",
      authority:"target-owner",
      visibility:"authority-only",
    }),
    resolutionId:"resolution.sense.hidden",
    expectedRevision:8,
  });
  assert.equal(awaiting.status,"awaiting-authority");
  if(awaiting.status!=="awaiting-authority")return;
  assert.equal(awaiting.request.fact,"sense.hidden");
  assert.equal(awaiting.request.subject,"target.external.alpha");
  assert.equal(awaiting.request.authority,"target-owner");

  const response={
    requestId:awaiting.request.id,
    idempotencyKey:awaiting.request.idempotencyKey,
    expectedRevision:8,
    responderId:"owner.target.external.alpha",
    value:true,
  } as const;

  const resolved=answerCommonPlayFactRequest(awaiting.request,response,8);
  assert.equal(resolved.status,"resolved");
  if(resolved.status==="resolved"){
    assert.equal(resolved.answer.value,true);
    assert.deepEqual(resolved.answer.provenance,{kind:"authority",responderId:"owner.target.external.alpha"});
  }

  const stale=answerCommonPlayFactRequest(awaiting.request,response,9);
  assert.equal(stale.status,"stale");
});
