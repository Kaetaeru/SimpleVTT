import assert from "node:assert/strict";
import test from "node:test";
import { resolveCommonPlayFrequency } from "../../src/domain/commonPlayFrequencyRuntime";

const clock={round:3,elapsedSeconds:0,activeActorId:"hero",phase:"action" as const};

test("generic frequency tokens cover once, turn, round, resolution, and unlimited",()=>{
  for(const [frequency,expected] of [
    ["once","consumed"],
    ["once-per-turn","turn:3:hero"],
    ["once-per-round","round:3"],
    ["once-per-resolution","resolution-a"],
  ] as const) {
    const first=resolveCommonPlayFrequency({ruleId:"external.rule",subjectId:"target",frequency,resolutionId:"resolution-a",clock,markers:{}});
    assert.equal(first.eligible,true);
    assert.equal(first.token,expected);
    const replay=resolveCommonPlayFrequency({ruleId:"external.rule",subjectId:"target",frequency,resolutionId:"resolution-a",clock,markers:first.metadataPatch});
    assert.equal(replay.eligible,false);
  }
  assert.deepEqual(resolveCommonPlayFrequency({ruleId:"external.rule",frequency:"unlimited",resolutionId:"resolution-a",clock,markers:{}}),{eligible:true,metadataPatch:{}});
});

test("frequency behavior is identity invariant and turn frequency requires turn authority",()=>{
  const original=resolveCommonPlayFrequency({ruleId:"unknown.original",frequency:"once-per-round",resolutionId:"r",clock,markers:{}});
  const renamed=resolveCommonPlayFrequency({ruleId:"unknown.renamed",frequency:"once-per-round",resolutionId:"r",clock,markers:{}});
  assert.equal(original.token,renamed.token);
  assert.throws(()=>resolveCommonPlayFrequency({ruleId:"r",frequency:"once-per-turn",resolutionId:"x",clock:{round:1,elapsedSeconds:0},markers:{}}),/active actor/);
});
