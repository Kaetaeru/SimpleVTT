import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const exact=readFileSync(new URL("../../src/app/connectedOwnerInventoryExactCompensationAdapter.ts",import.meta.url),"utf8");
const recovery=readFileSync(new URL("../../src/app/connectedPartyStashHostRecoveryAdapter.ts",import.meta.url),"utf8");
const store=readFileSync(new URL("../../src/app/connectedPartyStashHostCoordinatorStore.ts",import.meta.url),"utf8");
const rust=readFileSync(new URL("../../src-tauri/src/connected_party_stash_host.rs",import.meta.url),"utf8");
const tauri=readFileSync(new URL("../../src-tauri/src/lib.rs",import.meta.url),"utf8");

test("Host persists remote Party Stash intent before entering the transfer runtime",()=>{
  const write=exact.indexOf("connectedPartyStashHostCoordinatorStoreFor(this).write");
  const transfer=exact.indexOf("baseTransfer.call(this,command)");
  assert.ok(write>=0&&transfer>write);
  assert.match(exact,/ownerParticipantId=state\.peerParticipants\.get\(mounted\.peerId\)/);
  assert.match(exact,/requestId:command\.requestId[\s\S]*campaignId:command\.campaignId[\s\S]*actorId:command\.actorId/);
  assert.match(exact,/if\(coordinated\)await connectedPartyStashHostCoordinatorStoreFor\(this\)\.delete\(command\.requestId\)\.catch/);
});

test("Player self-service Stash is checkpointed before the Host Campaign handler sees it",()=>{
  const prepare=recovery.indexOf("await prepareClientStashCoordinator");
  const delegate=recovery.indexOf("handler(message);",prepare);
  assert.ok(prepare>=0&&delegate>prepare);
  assert.match(recovery,/campaign-stash-deposit/);
  assert.match(recovery,/request\.command\.requestId\.endsWith\("\.compensate"\)/);
  assert.match(recovery,/Host recovery checkpoint failed/);
});

test("Player completion acknowledgement deletes coordinator only after Campaign outcome matches",()=>{
  assert.match(recovery,/campaign-party-stash-owner-complete/);
  assert.match(recovery,/connectedPartyStashRecoveryOutcome\(record,campaign\)!==complete\.outcome/);
  assert.match(recovery,/await store\.delete\(record\.requestId\)/);
  const transfer=recovery.indexOf("transferPartyStashWithOwnerCompletion");
  const base=recovery.indexOf("baseTransferPartyStash.call(this,command)",transfer);
  const ack=recovery.indexOf('sendOwnerComplete(this,command,"applied")',base);
  assert.ok(transfer>=0&&base>transfer&&ack>base);
});

test("Host restart recovery uses Campaign idempotency including compensation identity",()=>{
  assert.match(recovery,/campaign\.recentRequestIds\.includes\(record\.requestId\)/);
  assert.match(recovery,/campaign\.recentRequestIds\.includes\(`\$\{record\.requestId\}\.compensate`\)/);
  assert.match(recovery,/committed&&!compensated\?"applied":"undone"/);
  assert.match(recovery,/campaign-party-stash-owner-recovery/);
  assert.match(recovery,/await requestOwnerRecovery\(host,peer,record,outcome\)/);
  assert.match(recovery,/await store\.delete\(record\.requestId\)/);
});

test("recovered owner settles durable journal before returning a fresh Character projection",()=>{
  const apply=recovery.indexOf('if(request.outcome==="applied")await adapter.adjustDmInventory');
  const finalize=recovery.indexOf("await finalizeRecoveredOwnerJournal");
  const projection=recovery.indexOf("buildCharacterSessionProjectionV1");
  assert.ok(apply>=0&&finalize>apply);
  assert.ok(projection>=0);
  assert.match(recovery,/refreshReconstructedCharacterSessionProjection\(host,peer,reconstructed\)/);
  assert.match(recovery,/refreshSessionCharacterInventoryProjection/);
  assert.match(recovery,/state\.peerManifests\.set\(peer/);
});

test("Tauri owns a create-once Host coordinator under the shared persistence mutex",()=>{
  assert.match(store,/read_connected_party_stash_host_records/);
  assert.match(store,/write_connected_party_stash_host_record/);
  assert.match(store,/delete_connected_party_stash_host_record/);
  assert.match(rust,/connected-party-stash-host/);
  assert.match(rust,/if path\.exists\(\).*existing!=dto/s);
  assert.match(tauri,/mod connected_party_stash_host;/);
  assert.match(tauri,/read_connected_party_stash_host_records/);
  assert.match(tauri,/write_connected_party_stash_host_record/);
  assert.match(tauri,/delete_connected_party_stash_host_record/);
});
