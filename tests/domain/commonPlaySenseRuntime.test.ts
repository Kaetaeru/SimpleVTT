import assert from "node:assert/strict";
import test from "node:test";
import { resolveCommonPlaySenses, type CommonPlaySenseFacts } from "../../src/domain/commonPlaySenseRuntime";
import { COMMON_PLAY_STANDARD_FACTS, resolveCommonPlayFactQuery } from "../../src/domain/commonPlaySpatialFactRuntime";

const facts=(overrides:Partial<CommonPlaySenseFacts>={}):CommonPlaySenseFacts=>({
  distanceFeet:20,light:"bright",obscurement:"none",lineOfSight:true,lineOfEffect:true,
  targetInvisible:false,targetHidden:false,targetAudible:false,observerCanHear:true,sharedGroundContact:true,
  ...overrides,
});

test("generic senses distinguish sight, hearing, and tremor detection",()=>{
  assert.deepEqual(resolveCommonPlaySenses([{kind:"normal-sight"}],facts()).canSee,true);
  const hidden=resolveCommonPlaySenses([{kind:"normal-sight"},{kind:"tremorsense",rangeFeet:30}],facts({targetHidden:true}));
  assert.equal(hidden.canSee,false);
  assert.equal(hidden.detected,true);
  assert.deepEqual(hidden.detectionSources,["tremorsense"]);
  const heard=resolveCommonPlaySenses([{kind:"normal-sight"}],facts({lineOfSight:false,targetAudible:true}));
  assert.equal(heard.canSee,false);
  assert.equal(heard.canHear,true);
});

test("darkvision, blindsight, and truesight use typed facts without bypassing cover authority",()=>{
  assert.equal(resolveCommonPlaySenses([{kind:"darkvision",rangeFeet:60}],facts({light:"dark"})).canSee,true);
  assert.equal(resolveCommonPlaySenses([{kind:"blindsight",rangeFeet:10}],facts({distanceFeet:5,targetInvisible:true,obscurement:"heavy"})).canSee,true);
  assert.equal(resolveCommonPlaySenses([{kind:"truesight",rangeFeet:120}],facts({targetInvisible:true,light:"dark"})).canSee,true);
  assert.equal(resolveCommonPlaySenses([{kind:"truesight",rangeFeet:120}],facts({lineOfSight:false,lineOfEffect:false,targetInvisible:true})).canSee,false);
});

test("missing sensing provider is unsupported rather than fabricated",async()=>{
  const unresolved=await resolveCommonPlayFactQuery({
    registry:COMMON_PLAY_STANDARD_FACTS,
    query:{id:"can-see",fact:"sense.can-see",subject:"goblin",authority:"dm",visibility:"authority-only",unknownPolicy:"unsupported"},
    resolutionId:"sense-test",expectedRevision:0,
  });
  assert.equal(unresolved.status,"unsupported");
});
