import assert from "node:assert/strict";
import test from "node:test";
import { openCommonPlayOrderingDecision, resolveCommonPlayOrderingDecision, type CommonPlayOrderingDecision } from "../../src/domain/commonPlayOrderingRuntime";

const decision:CommonPlayOrderingDecision={
  id:"window:turn-start:hero:3",timingWindow:"turn.start",eligibleIds:["effect.a","effect.b"],authority:"actor-owner",
  expectedRevision:4,idempotencyKey:"window:turn-start:hero:3:order",stalePolicy:"cancel",
};

test("simultaneous effects require an explicit authoritative exact order",()=>{
  assert.equal(openCommonPlayOrderingDecision(decision).status,"awaiting-input");
  const resolved=resolveCommonPlayOrderingDecision(4,decision,{decisionId:decision.id,idempotencyKey:decision.idempotencyKey,orderedIds:["effect.b","effect.a"]});
  assert.deepEqual(resolved,{status:"resolved",decisionId:decision.id,idempotencyKey:decision.idempotencyKey,orderedIds:["effect.b","effect.a"]});
  assert.deepEqual(resolveCommonPlayOrderingDecision(4,decision,{decisionId:decision.id,idempotencyKey:decision.idempotencyKey,orderedIds:["effect.b","effect.a"]}),resolved,"replay is deterministic");
});

test("ordering rejects invented, missing, duplicate, mismatched, and stale answers",()=>{
  for(const orderedIds of [["effect.a"],["effect.a","effect.a"],["effect.a","effect.c"]]) {
    assert.equal(resolveCommonPlayOrderingDecision(4,decision,{decisionId:decision.id,idempotencyKey:decision.idempotencyKey,orderedIds}).status,"rejected");
  }
  assert.equal(resolveCommonPlayOrderingDecision(4,decision,{decisionId:"wrong",idempotencyKey:decision.idempotencyKey,orderedIds:decision.eligibleIds}).status,"rejected");
  assert.equal(resolveCommonPlayOrderingDecision(5,decision,{decisionId:decision.id,idempotencyKey:decision.idempotencyKey,orderedIds:decision.eligibleIds}).status,"invalidated");
  const restart={...decision,stalePolicy:"restart" as const};
  const restarted=resolveCommonPlayOrderingDecision(5,restart,{decisionId:restart.id,idempotencyKey:restart.idempotencyKey,orderedIds:restart.eligibleIds});
  assert.equal(restarted.status,"awaiting-input");
  if(restarted.status==="awaiting-input") assert.equal(restarted.decision.expectedRevision,5);
});

test("ordering mechanics do not depend on content identity",()=>{
  const renamed={...decision,id:"window.renamed",eligibleIds:["unknown.x","unknown.y"],idempotencyKey:"renamed-key"};
  const result=resolveCommonPlayOrderingDecision(4,renamed,{decisionId:renamed.id,idempotencyKey:renamed.idempotencyKey,orderedIds:["unknown.y","unknown.x"]});
  assert.equal(result.status,"resolved");
});
