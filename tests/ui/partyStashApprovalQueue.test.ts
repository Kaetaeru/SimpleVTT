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
  assert.equal(queue.active().length,1);
});

test("Party Stash approval queue rejects requestId payload drift",()=>{
  const queue=new PartyStashApprovalQueue();
  queue.submit(request);
  assert.throws(()=>queue.submit({...request,command:{...command,amount:6}}),/does not match/);
});

test("Party Stash approval queue requires approval before authoritative commit",()=>{
  const queue=new PartyStashApprovalQueue();
  queue.submit(request);
  assert.throws(()=>queue.settle(command.requestId,"committed"),/must be approved before commit/);
  assert.equal(queue.lookup(command.requestId)?.state,"pending");

  const approved=queue.approve(command.requestId);
  assert.equal(approved.state,"approved");
  assert.deepEqual(queue.approve(command.requestId),approved);
  assert.equal(queue.active().length,1);

  const committed=queue.settle(command.requestId,"committed");
  assert.equal(committed.state,"committed");
  assert.equal(queue.pending().length,0);
  assert.equal(queue.active().length,0);
  assert.deepEqual(queue.submit(structuredClone(request)),committed);
});

test("approved transfer failure remains recoverable until commit or cancel",()=>{
  const queue=new PartyStashApprovalQueue();
  queue.submit(request);
  queue.approve(command.requestId);
  const failed=queue.recordApprovedFailure(command.requestId,"owner unavailable");
  assert.equal(failed.state,"approved");
  assert.equal(failed.error,"owner unavailable");
  assert.equal(queue.active().length,1);
  assert.deepEqual(queue.approve(command.requestId),failed);

  const committed=queue.settle(command.requestId,"committed");
  assert.equal(committed.state,"committed");
  assert.equal(committed.error,undefined);
  assert.equal(queue.active().length,0);
});

test("Party Stash approval queue permits rejection while pending and cancellation before commit",()=>{
  const rejectedQueue=new PartyStashApprovalQueue();
  rejectedQueue.submit(request);
  const rejected=rejectedQueue.settle(command.requestId,"rejected","stale stash");
  assert.equal(rejected.state,"rejected");
  assert.equal(rejected.error,"stale stash");

  const pendingCancelQueue=new PartyStashApprovalQueue();
  pendingCancelQueue.submit(request);
  assert.equal(pendingCancelQueue.settle(command.requestId,"cancelled").state,"cancelled");

  const approvedCancelQueue=new PartyStashApprovalQueue();
  approvedCancelQueue.submit(request);
  approvedCancelQueue.approve(command.requestId);
  approvedCancelQueue.recordApprovedFailure(command.requestId,"retry later");
  const cancelled=approvedCancelQueue.settle(command.requestId,"cancelled");
  assert.equal(cancelled.state,"cancelled");
  assert.equal(cancelled.error,undefined);
});

test("Party Stash approval queue rejects invalid terminal transitions",()=>{
  const queue=new PartyStashApprovalQueue();
  queue.submit(request);
  queue.approve(command.requestId);
  assert.throws(()=>queue.settle(command.requestId,"rejected"),/cannot be rejected from approved/);
  queue.settle(command.requestId,"committed");
  assert.throws(()=>queue.settle(command.requestId,"cancelled"),/already settled differently|cannot be cancelled/);
});

test("Session cleanup clears pending and approved approval memory",()=>{
  const queue=new PartyStashApprovalQueue();
  queue.submit(request);
  queue.approve(command.requestId);
  queue.clear();
  assert.deepEqual(queue.pending(),[]);
  assert.deepEqual(queue.active(),[]);
  assert.equal(queue.lookup(command.requestId),undefined);
});
