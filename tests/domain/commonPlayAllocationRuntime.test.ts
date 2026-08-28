import assert from "node:assert/strict";
import test from "node:test";
import { allocationEntriesFromTargetSequence, resolveCommonPlayAllocation } from "../../src/domain/commonPlayAllocationRuntime";

const request=(targetIds=["goblin","goblin","orc"])=>(
  {
    id:"allocation.magic-projectiles",idempotencyKey:"allocation.magic-projectiles:1",expectedRevision:7,
    authority:"actor-owner" as const,responderId:"player.one",
    plan:{units:{value:3},minimumPerTarget:1,maximumPerTarget:3,totalMustMatch:true},
    candidateTargetIds:["goblin","orc"],allocations:allocationEntriesFromTargetSequence(targetIds),
  }
);

test("generic allocation preserves authored projectile counts and exact pool invariant",()=>{
  assert.deepEqual(allocationEntriesFromTargetSequence(["goblin","goblin","orc"]),[
    {targetId:"goblin",units:2},{targetId:"orc",units:1},
  ]);
  const resolved=resolveCommonPlayAllocation(request(),7);
  assert.equal(resolved.status,"resolved");
  if(resolved.status==="resolved") assert.deepEqual(resolved.allocations,[{targetId:"goblin",units:2},{targetId:"orc",units:1}]);
});

test("generic allocation rejects adapter-invented gaps, duplicate entries, unknown targets, and stale retry",()=>{
  assert.equal(resolveCommonPlayAllocation(request(["goblin","orc"]),7).status,"rejected");
  assert.equal(resolveCommonPlayAllocation({...request(),allocations:[{targetId:"goblin",units:1},{targetId:"goblin",units:2}]},7).status,"rejected");
  assert.equal(resolveCommonPlayAllocation({...request(),allocations:[{targetId:"dragon",units:3}]},7).status,"rejected");
  assert.equal(resolveCommonPlayAllocation(request(),8).status,"stale");
});

test("allocation behavior is content-identity invariant and supports property-backed pools",()=>{
  const base=request();
  const first=resolveCommonPlayAllocation({...base,plan:{...base.plan,units:{ref:"runtime.projectiles"}},properties:{"runtime.projectiles":3}},7);
  const renamed=resolveCommonPlayAllocation({...base,id:"allocation.unseen.renamed",idempotencyKey:"renamed:1",plan:{...base.plan,units:{ref:"runtime.projectiles"}},properties:{"runtime.projectiles":3}},7);
  assert.equal(first.status,"resolved");
  assert.equal(renamed.status,"resolved");
  if(first.status==="resolved"&&renamed.status==="resolved") assert.deepEqual(first.allocations,renamed.allocations);
});
