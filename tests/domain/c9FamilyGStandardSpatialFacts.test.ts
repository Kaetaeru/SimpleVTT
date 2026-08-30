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
      case "spatial.adjacent": return {status:"answered",value:true};
      case "spatial.within-reach": return {status:"answered",value:true};
      case "spatial.line-of-effect": return {status:"answered",value:true};
      case "spatial.total-cover": return {status:"answered",value:false};
      case "spatial.area-members": return {status:"answered",value:["combatant.goblin-b","combatant.goblin-a","combatant.goblin-b"]};
      case "spatial.legal-destination": return {status:"answered",value:"grid:12,7"};
      case "spatial.placement": return {status:"answered",value:"template:cone:origin=char.aelar:facing=east"};
      default: return {status:"unknown"};
    }
  },
};

const spatialPredicateQueries:CommonPlayFactQuery[]=[
  {id:"distance",fact:"spatial.distance-feet",subject:"combatant.goblin-a",authority:"host",visibility:"public",unknownPolicy:"block"},
  {id:"adjacent",fact:"spatial.adjacent",subject:"combatant.goblin-a",authority:"host",visibility:"public",unknownPolicy:"block"},
  {id:"reach",fact:"spatial.within-reach",subject:"combatant.goblin-a",authority:"host",visibility:"public",unknownPolicy:"block"},
  {id:"line",fact:"spatial.line-of-effect",subject:"combatant.goblin-a",authority:"host",visibility:"public",unknownPolicy:"block"},
  {id:"cover",fact:"spatial.total-cover",subject:"combatant.goblin-a",authority:"host",visibility:"public",unknownPolicy:"block"},
];

const spatialPredicate={op:"all" as const,args:[
  {op:"lte" as const,left:{ref:"distance"},right:{value:60}},
  {op:"eq" as const,left:{ref:"adjacent"},right:{value:true}},
  {op:"eq" as const,left:{ref:"reach"},right:{value:true}},
  {op:"eq" as const,left:{ref:"line"},right:{value:true}},
  {op:"eq" as const,left:{ref:"cover"},right:{value:false}},
]};

test("Family G standard distance, adjacency, reach, line-of-effect, and cover facts are provider-authoritative and identity invariant",async()=>{
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
      ["spatial.adjacent",true],
      ["spatial.within-reach",true],
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

test("Family G legal destination and placement facts preserve provider and manual authority without content dispatch",async()=>{
  const destination=await resolveCommonPlayFactQuery({
    registry:COMMON_PLAY_STANDARD_FACTS,
    query:{
      id:"destination",
      fact:"spatial.legal-destination",
      subject:"char.aelar",
      authority:"host",
      visibility:"public",
      unknownPolicy:"block",
    },
    resolutionId:"external.destination.provider",
    expectedRevision:23,
    provider,
  });
  assert.equal(destination.status,"resolved");
  if(destination.status!=="resolved") return;
  assert.equal(destination.answer.value,"grid:12,7");
  assert.deepEqual(destination.answer.provenance,{kind:"provider",providerId:provider.id});

  const placement=await resolveCommonPlayFactQuery({
    registry:COMMON_PLAY_STANDARD_FACTS,
    query:{
      id:"placement",
      fact:"spatial.placement",
      subject:"template.external.unknown",
      authority:"dm",
      visibility:"public",
      unknownPolicy:"request-authority",
    },
    resolutionId:"external.placement.manual",
    expectedRevision:23,
  });
  assert.equal(placement.status,"awaiting-authority");
  if(placement.status!=="awaiting-authority") return;
  assert.equal(placement.request.inputType,"text");
  const resolvedPlacement=answerCommonPlayFactRequest(placement.request,{
    requestId:placement.request.id,
    idempotencyKey:placement.request.idempotencyKey,
    expectedRevision:23,
    responderId:"dm.host",
    value:"template:cone:origin=char.aelar:facing=east",
  },23);
  assert.equal(resolvedPlacement.status,"resolved");
  if(resolvedPlacement.status!=="resolved") return;
  assert.equal(resolvedPlacement.answer.value,"template:cone:origin=char.aelar:facing=east");
  assert.deepEqual(resolvedPlacement.answer.provenance,{kind:"authority",responderId:"dm.host"});
});
