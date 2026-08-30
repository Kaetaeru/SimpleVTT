import assert from "node:assert/strict";
import test from "node:test";
import {
  beginCommonPlaySimultaneousOrdering,
  orderCommonPlaySimultaneousCandidates,
  respondToCommonPlaySimultaneousOrdering,
} from "../../src/domain/commonPlaySimultaneousOrderingRuntime";

const request=(ids=["effect.alpha","effect.beta","effect.gamma"])=>({
  id:"decision.turn-start.7",
  revision:12,
  timing:"turn.start",
  authority:{kind:"actor-controller" as const,responderId:"char.controller"},
  candidates:ids.map((id)=>({id})),
});

test("zero and one simultaneous candidate resolve deterministically without a decision",()=>{
  const empty=beginCommonPlaySimultaneousOrdering(request([]));
  assert.equal(empty.status,"resolved");
  if(empty.status!=="resolved") return;
  assert.deepEqual(empty.orderedCandidateIds,[]);
  assert.equal(empty.resolvedBy,"automatic");

  const single=beginCommonPlaySimultaneousOrdering(request(["effect.only"]));
  assert.equal(single.status,"resolved");
  if(single.status!=="resolved") return;
  assert.deepEqual(single.orderedCandidateIds,["effect.only"]);
  assert.equal(single.resolvedBy,"automatic");
});

test("multiple simultaneous candidates stay pending until the declared authority orders them",()=>{
  const pending=beginCommonPlaySimultaneousOrdering(request());
  assert.equal(pending.status,"pending");

  const unauthorized=respondToCommonPlaySimultaneousOrdering(pending,{
    decisionId:"decision.turn-start.7",revision:12,responderId:"char.other",
    orderedCandidateIds:["effect.gamma","effect.alpha","effect.beta"],
  });
  assert.deepEqual(unauthorized,{status:"rejected",state:pending,reason:"responder-not-authorized"});

  const stale=respondToCommonPlaySimultaneousOrdering(pending,{
    decisionId:"decision.turn-start.7",revision:11,responderId:"char.controller",
    orderedCandidateIds:["effect.gamma","effect.alpha","effect.beta"],
  });
  assert.deepEqual(stale,{status:"rejected",state:pending,reason:"stale-revision"});
});

test("ordering response must be an exact permutation of the eligible simultaneous candidates",()=>{
  const pending=beginCommonPlaySimultaneousOrdering(request());
  for(const orderedCandidateIds of [
    ["effect.alpha","effect.beta"],
    ["effect.alpha","effect.beta","effect.beta"],
    ["effect.alpha","effect.beta","effect.unknown"],
  ]) {
    const result=respondToCommonPlaySimultaneousOrdering(pending,{
      decisionId:"decision.turn-start.7",revision:12,responderId:"char.controller",orderedCandidateIds,
    });
    assert.equal(result.status,"rejected");
    if(result.status==="rejected") assert.equal(result.reason,"invalid-ordering");
  }
});

test("authorized ordering determines deterministic execution order and exact retries are idempotent",()=>{
  const pending=beginCommonPlaySimultaneousOrdering(request());
  const response={
    decisionId:"decision.turn-start.7",revision:12,responderId:"char.controller",
    orderedCandidateIds:["effect.gamma","effect.alpha","effect.beta"],
  };
  const first=respondToCommonPlaySimultaneousOrdering(pending,response);
  assert.equal(first.status,"resolved");
  if(first.status!=="resolved") return;
  assert.equal(first.replay,false);

  const candidates=[
    {id:"effect.alpha",operation:"alpha"},
    {id:"effect.beta",operation:"beta"},
    {id:"effect.gamma",operation:"gamma"},
  ];
  assert.deepEqual(
    orderCommonPlaySimultaneousCandidates(first.state,candidates).map((candidate)=>candidate.operation),
    ["gamma","alpha","beta"],
  );

  const retry=respondToCommonPlaySimultaneousOrdering(first.state,response);
  assert.equal(retry.status,"resolved");
  if(retry.status==="resolved") assert.equal(retry.replay,true);

  const conflicting=respondToCommonPlaySimultaneousOrdering(first.state,{
    ...response,orderedCandidateIds:["effect.alpha","effect.beta","effect.gamma"],
  });
  assert.equal(conflicting.status,"rejected");
  if(conflicting.status==="rejected") assert.equal(conflicting.reason,"decision-already-resolved");
});

test("mechanical ordering is invariant when unrelated external candidate identities are renamed",()=>{
  const resolve=(ids:string[],order:number[])=>{
    const pending=beginCommonPlaySimultaneousOrdering(request(ids));
    const orderedCandidateIds=order.map((index)=>ids[index]);
    const result=respondToCommonPlaySimultaneousOrdering(pending,{
      decisionId:"decision.turn-start.7",revision:12,responderId:"char.controller",orderedCandidateIds,
    });
    assert.equal(result.status,"resolved");
    if(result.status!=="resolved") return [];
    return orderCommonPlaySimultaneousCandidates(result.state,ids.map((id,index)=>({id,slot:index}))).map((entry)=>entry.slot);
  };

  assert.deepEqual(resolve(["module-a.x","module-a.y","module-a.z"],[2,0,1]),[2,0,1]);
  assert.deepEqual(resolve(["renamed.red","renamed.green","renamed.blue"],[2,0,1]),[2,0,1]);
});

test("invalid decision definitions fail before they can enter session authority",()=>{
  assert.throws(()=>beginCommonPlaySimultaneousOrdering(request(["same","same"])),/candidate ids must be unique/);
  assert.throws(()=>beginCommonPlaySimultaneousOrdering({...request(),revision:-1}),/revision must be a non-negative integer/);
  assert.throws(()=>beginCommonPlaySimultaneousOrdering({...request(),authority:{kind:"dm" as const,responderId:""}}),/responderId must be a non-empty string/);
});
