import assert from "node:assert/strict";
import test from "node:test";
import {
  clearEngagement,
  clearEngagementsOf,
  engagedWith,
  isEngaged,
  pruneEngagementsToPresent,
  pruneIdleEngagements,
  recordMeleeAttack,
} from "../../src/domain/engagement";

test("T1-03: a melee attack engages the pair regardless of direction and refreshes on later attacks", () => {
  let records=recordMeleeAttack([],"goblin-a","char.aelar",1);
  assert.equal(records.length,1);
  assert.ok(isEngaged(records,"char.aelar","goblin-a"));
  assert.deepEqual(engagedWith(records,"char.aelar"),["goblin-a"]);
  records=recordMeleeAttack(records,"char.aelar","goblin-a",3);
  assert.equal(records.length,1,"the reverse attack refreshes the same record");
  assert.equal(records[0].sinceRound,1);
  assert.equal(records[0].lastMeleeRound,3);
  assert.deepEqual(recordMeleeAttack(records,"x","x",1),records,"self is never engaged");
});

test("T1-03: withdrawing, dying or leaving clears every engagement of that creature", () => {
  let records=recordMeleeAttack([],"goblin-a","char.aelar",1);
  records=recordMeleeAttack(records,"goblin-b","char.aelar",1);
  records=recordMeleeAttack(records,"goblin-b","char.mira",1);
  assert.equal(records.length,3);
  const withdrawn=clearEngagementsOf(records,"char.aelar");
  assert.equal(withdrawn.length,1);
  assert.ok(isEngaged(withdrawn,"goblin-b","char.mira"));
  const single=clearEngagement(records,"goblin-b","char.aelar");
  assert.equal(single.length,2);
  const present=pruneEngagementsToPresent(records,new Set(["goblin-a","char.aelar","char.mira"]));
  assert.deepEqual(present.map((record)=>[record.a,record.b]),[["char.aelar","goblin-a"]]);
});

test("T1-03: a full round without melee between the pair ends the engagement", () => {
  let records=recordMeleeAttack([],"goblin-a","char.aelar",1);
  records=recordMeleeAttack(records,"goblin-b","char.mira",2);
  assert.equal(pruneIdleEngagements(records,2).length,2,"round 2 start: round-1 melee still counts");
  assert.equal(pruneIdleEngagements(records,3).length,1,"round 3 start: the round-1 pair idled through round 2");
  assert.equal(pruneIdleEngagements(records,4).length,0);
});
