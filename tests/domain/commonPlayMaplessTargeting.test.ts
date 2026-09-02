import assert from "node:assert/strict";
import test from "node:test";

import { resolveTargeting, type TargetFacts } from "../../src/domain/targeting";

const actorOnlyFacts=(overrides:Partial<TargetFacts>={}):TargetFacts=>({
  id:"target.goblin",
  kind:"creature",
  relation:"enemy",
  ...overrides,
});

test("Gate E mapless area target set does not require fake distance visibility or cover",()=>{
  const result=resolveTargeting("actor.hero",{
    kind:"creature",
    minTargets:1,
    maxTargets:4,
    allowedRelations:["enemy"],
    directTarget:false,
  },[
    actorOnlyFacts({id:"target.b"}),
    actorOnlyFacts({id:"target.a"}),
  ]);

  assert.equal(result.valid,true);
  assert.deepEqual(result.targets.map((entry)=>entry.targetId),["target.b","target.a"]);
  assert.equal(result.rejected.length,0);
});

test("Gate G mapless ranged targeting disables distance mechanics when no spatial fact exists",()=>{
  const missingRange=resolveTargeting("actor.hero",{
    kind:"creature",
    rangeFeet:60,
    minTargets:1,
    maxTargets:1,
    allowedRelations:["enemy"],
    directTarget:false,
  },[actorOnlyFacts()]);
  assert.equal(missingRange.valid,true);
  assert.equal(missingRange.rejected.length,0);

  const missingSight=resolveTargeting("actor.hero",{
    kind:"creature",
    minTargets:1,
    maxTargets:1,
    allowedRelations:["enemy"],
    requiresSight:true,
    directTarget:false,
  },[actorOnlyFacts()]);
  assert.equal(missingSight.valid,false);
  assert.match(missingSight.rejected[0].reasons.join(" "),/visibility|visible|sight/i);

  const missingCover=resolveTargeting("actor.hero",{
    kind:"creature",
    minTargets:1,
    maxTargets:1,
    allowedRelations:["enemy"],
    directTarget:true,
  },[actorOnlyFacts()]);
  assert.equal(missingCover.valid,false);
  assert.match(missingCover.rejected[0].reasons.join(" "),/cover/i);
});

test("Gate G authoritative spatial facts still enforce existing range sight and cover behavior",()=>{
  const result=resolveTargeting("actor.hero",{
    kind:"creature",
    rangeFeet:60,
    minTargets:1,
    maxTargets:1,
    allowedRelations:["enemy"],
    requiresSight:true,
    directTarget:true,
  },[actorOnlyFacts({distanceFeet:30,visible:true,cover:"half"})]);

  assert.equal(result.valid,true);
  assert.equal(result.targets[0].cover,"half");
  assert.equal(result.targets[0].acBonus,2);

  const outOfRange=resolveTargeting("actor.hero",{
    kind:"creature",
    rangeFeet:60,
    minTargets:1,
    maxTargets:1,
    allowedRelations:["enemy"],
    directTarget:false,
  },[actorOnlyFacts({distanceFeet:90})]);

  assert.equal(outOfRange.valid,false);
  assert.match(outOfRange.rejected[0].reasons.join(" "),/beyond range 60 ft/i);
});
