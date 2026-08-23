import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pane=readFileSync(new URL("../../src/SessionInventoryPane.tsx",import.meta.url),"utf8");
const runtime=readFileSync(new URL("../../src/app/connectedPartyStashApprovalRuntimeAdapter.ts",import.meta.url),"utf8");
const main=readFileSync(new URL("../../src/main.tsx",import.meta.url),"utf8");

test("dm-approval withdrawal stays clickable but reports an approval request instead of a transfer",()=>{
  assert.match(pane,/canWithdraw=Boolean\(stash&&canTransfer&&stash\.policy!=="dm-managed"\)/);
  assert.match(pane,/approvalWithdrawal=Boolean\(stash&&canTransfer&&stash\.policy==="dm-approval"\)/);
  assert.match(pane,/DM에게 Party Stash 출고 승인 요청을 보냈습니다/);
  assert.match(pane,/승인 요청 →/);
});

test("DM inventory UX exposes pending approval, rejection, cancellation, and approved retry",()=>{
  assert.match(pane,/listPartyStashApprovalRequests\(\)/);
  assert.match(pane,/approvePartyStashApproval/);
  assert.match(pane,/rejectPartyStashApproval/);
  assert.match(pane,/cancelPartyStashApproval/);
  assert.match(pane,/전송 재시도/);
});

test("connected approval runtime queues before mutation and commits only after the existing transfer succeeds",()=>{
  assert.match(main,/connectedPartyStashApprovalRuntimeAdapter/);
  assert.match(runtime,/campaign-stash-approval-request/);
  assert.match(runtime,/partyStashApprovalQueueFor\(host\)\.submit/);
  const approve=runtime.indexOf("queue.approve(requestId)");
  const transfer=runtime.indexOf("await this.transferPartyStash(record.command)");
  const commit=runtime.indexOf('queue.settle(requestId,"committed")');
  assert.ok(approve>=0&&transfer>approve&&commit>transfer);
});

test("failed approved transfers remain recoverable and Session stop clears transient approvals",()=>{
  assert.match(runtime,/queue\.recordApprovedFailure\(requestId,error\.message\)/);
  assert.match(runtime,/partyStashApprovalQueueFor\(this\)\.clear\(\)/);
  assert.match(runtime,/Party Stash 정책이 변경되어 요청을 다시 검토해야 합니다/);
});
