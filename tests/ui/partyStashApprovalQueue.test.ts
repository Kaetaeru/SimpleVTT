import assert from "node:assert/strict";
import test from "node:test";
import { PartyStashApprovalQueue } from "../../src/app/partyStashApprovalQueue";
import type { PartyStashTransferCommand } from "../../src/app/contracts";

const command:PartyStashTransferCommand={requestId:"approval.one",campaignId:"campaign.approval",actorId:"char.player",direction:"stash-to-character",asset:"currency",amount:5};
const request={command,participantId:"participant.player",participantName:"Player",characterName:"Hero",requestedAt:"2026-08-23T01:00:00.000Z"};

test("Party Stash approval queue is idempotent for the same pending request",()=>{
  const queue=new PartyStashApprovalQueue();
  const first=queue.submit(request);
  const duplicate=queue.submit(structuredClone(request));
  assert.equal(first.state,"pending");
  assert.deepEqual(duplicate,first);
  assert.equal(queue.pending().length,1);
});

test("Party Stash approval queue rejects requestId payload drift",()=>{
  const queue=new PartyStashApprovalQueue();
  queue.submit(request);
  assert.throws(()=>queue.submit({...request,command:{...command,amount:6}}),/does not match/);
});

test("Party Stash approval queue records committed rejected and cancelled terminal outcomes",()=>{
  for(const outcome of ["committed","rejected","cancelled"] as const){
    const queue=new PartyStashApprovalQueue();
    queue.submit(request);
    const settled=queue.settle(command.requestId,outcome,outcome==="rejected"?"stale stash":undefined);
    assert.equal(settled.state,outcome);
    assert.equal(queue.pending().length,0);
    assert.deepEqual(queue.submit(structuredClone(request)),settled);
  }
});

test("Session cleanup clears pending and settled approval memory",()=>{
  const queue=new PartyStashApprovalQueue();
  queue.submit(request);
  queue.clear();
  assert.deepEqual(queue.pending(),[]);
  assert.equal(queue.lookup(command.requestId),undefined);
});
