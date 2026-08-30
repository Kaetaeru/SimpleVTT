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

const provider:CommonPlayFactProvider={
  id:"provider.c9-family-g",
  resolve(query){
    switch(query.fact){
      case "spatial.distance-feet": return {status:"answered",value:30};
      case "spatial.line-of-effect": return {status:"answered",value:true};
      case "spatial.total-cover": return {status:"answered",value:false};
      case "spatial.area-members": return {status:"answered",value:["combatant.goblin-b","combatant.goblin-a","combatant.goblin-b"]};
      default: return {status:"unknown"};
    }
  },
};

const spatialPredicateQueries:CommonPlayFactQuery[]=[
  {id:"distance",fact:"spatial.distance-feet",subject:"combatant.goblin-a",authority:"host",visibility:"public",unknownPolicy:"block"},
  {id:"line",fact:"spatial.line-of-effect",subject:"combatant.goblin-a",authority:"host",visibility:"public",unknownPolicy:"block"},
  {id:"cover",fact:"spatial.total-cover",subject:"combatant.goblin-a",authority:"host",visibility:"public",unknownPolicy:"block"},
];

const spatialPredicate={op:"all" as const,args:[
  {op:"lte" as const,left:{ref:"distance"},right:{value:60}},
  {op:"eq" as const,left:{ref:"line"},right:{value:true}},
  {op:"eq" as const,left:{ref:"cover"},right:{value:false}},
]};

test("Family G standard distance, line-of-effect, and cover facts are provider-authoritative and identity invariant",async()=>{
  const outcomes=[];
  for(const resolutionId of ["external.module.alpha.spatial","external.completely-renamed.spatial"]){
    const resolved=await resolveCommonPlayFactPredicate({
      registry:COMMON_PLAY_STANDARD_FACTS,
      queries:spatialPredicateQueries,
      predicate:spatialPredicate,
      resolutionId,
      expectedRevision:12,
      provider,
    });
    assert.equal(resolved.status,"eligible");
    if(resolved.status!=="eligible") continue;
    assert.deepEqual(resolved.answers.map((answer)=>[answer.fact,answer.value]),[
      ["spatial.distance-feet",30],
      ["spatial.line-of-effect",true],
      ["spatial.total-cover",false],
    ]);
    assert.ok(resolved.answers.every((answer)=>answer.provenance.kind==="provider"));
    outcomes.push(resolved.answers.map((answer)=>[answer.fact,answer.value]));
  }
  assert.deepEqual(outcomes[1],outcomes[0]);
});

test("Family G standard area membership normalizes provider and manual authority to the same target set",async()=>{
  const query:CommonPlayFactQuery={
    id:"area-members",
    fact:"spatial.area-members",
    subject:"area.external.unknown",
    authority:"dm",
    visibility:"public",
    unknownPolicy:"request-authority",
  };
  const providerResult=await resolveCommonPlayFactQuery({
    registry:COMMON_PLAY_STANDARD_FACTS,
    query,
    resolutionId:"external.area.provider",
    expectedRevision:19,
    provider,
  });
  assert.equal(providerResult.status,"resolved");
  if(providerResult.status!=="resolved") return;
  assert.deepEqual(providerResult.answer.value,["combatant.goblin-a","combatant.goblin-b"]);

  const awaiting=await resolveCommonPlayFactQuery({
    registry:COMMON_PLAY_STANDARD_FACTS,
    query:{...query,id:"area-members-manual"},
    resolutionId:"external.area.manual",
    expectedRevision:19,
  });
  assert.equal(awaiting.status,"awaiting-authority");
  if(awaiting.status!=="awaiting-authority") return;
  const manual=answerCommonPlayFactRequest(awaiting.request,{
    requestId:awaiting.request.id,
    idempotencyKey:awaiting.request.idempotencyKey,
    expectedRevision:19,
    responderId:"dm.host",
    value:["combatant.goblin-b","combatant.goblin-a","combatant.goblin-b"],
  },19);
  assert.equal(manual.status,"resolved");
  if(manual.status!=="resolved") return;
  assert.deepEqual(manual.answer.value,providerResult.answer.value);
});
