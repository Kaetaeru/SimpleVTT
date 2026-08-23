import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runtime=readFileSync(new URL("../../src/app/connectedLongRestRuntimePort.ts",import.meta.url),"utf8");
const session=readFileSync(new URL("../../src/app/connectedLongRestSessionAdapter.ts",import.meta.url),"utf8");
const ownerRecovery=readFileSync(new URL("../../src/app/connectedLongRestOwnerRestartRecovery.ts",import.meta.url),"utf8");
const tauriLib=readFileSync(new URL("../../src-tauri/src/lib.rs",import.meta.url),"utf8");
const writeBarrier=readFileSync(new URL("../../src-tauri/src/connected_long_rest_character_guard.rs",import.meta.url),"utf8");

test("durable Host abort keeps the real owner preparation identity and never restores the placeholder",()=>{
  assert.match(runtime,/durable abort is missing owner preparation identity/);
  assert.match(runtime,/preparationId:state\.preparationId/);
  assert.doesNotMatch(runtime,/aborted-before-or-after-prepare/);
  assert.match(runtime,/type:"long-rest-abort"[\s\S]*ownerParticipantId:record\.transaction\.preflight\.ownerParticipantId[\s\S]*preparationId:record\.transaction\.preparationId/);
});

test("restarted owner consumes enriched precommit abort idempotently without materializing Character state",()=>{
  assert.match(session,/recoverRestartedConnectedLongRestOwnerAbort/);
  assert.match(session,/!handled&&wire\.ownerParticipantId&&wire\.character&&wire\.preparationId/);
  assert.match(ownerRecovery,/recoverRestartedConnectedLongRestOwnerAbort/);
  assert.match(ownerRecovery,/preparationStore\.abort\(\{transactionId:abort\.transactionId,preparationId:identity\.preparationId\}\)/);
  assert.doesNotMatch(ownerRecovery,/recoverRestartedConnectedLongRestOwnerAbort[\s\S]*preparationStore\.materialize/);
  assert.match(ownerRecovery,/const beforeRuntimeRevision=before\.activeCharacter\.runtimeRevision\?\?0/);
  assert.match(ownerRecovery,/runtimeRevision\?\?0\)!==beforeRuntimeRevision/);
  assert.doesNotMatch(ownerRecovery,/abort recovery Character runtime revision changed before cleanup/);
});

test("owner abort acknowledgement closes Host durable replay only after exact cleanup identity",()=>{
  assert.match(session,/type:"long-rest-owner-aborted"/);
  assert.match(session,/completeConnectedLongRestHostOwnerAbort/);
  assert.match(runtime,/completeConnectedLongRestHostOwnerAbort/);
  assert.match(runtime,/abort acknowledgement preparation mismatch/);
  assert.match(runtime,/hostCoordinatorStore\(adapter\)\.delete\(aborted\.transactionId\)/);
  assert.match(runtime,/hostMap\(adapter\)\.delete\(aborted\.transactionId\)/);
});

test("prepared connected Rest owns the next Character generation until materialize or abort",()=>{
  assert.match(tauriLib,/mod connected_long_rest_character_guard;/);
  const characterWrite=tauriLib.indexOf("character_library::write_generation_at");
  const compoundWrite=tauriLib.indexOf("character_campaign_compound::write_at");
  assert.ok(characterWrite>0&&compoundWrite>0);
  assert.ok(tauriLib.lastIndexOf("connected_long_rest_character_guard::assert_no_prepared_at",characterWrite)>0);
  assert.ok(tauriLib.lastIndexOf("connected_long_rest_character_guard::assert_no_prepared_at",compoundWrite)>0);
  assert.match(writeBarrier,/phase_path\(&path,"materialized"\)\?\.exists\(\)\|\|phase_path\(&path,"aborted"\)\?\.exists\(\)/);
  assert.match(writeBarrier,/write is locked by prepared connected Long Rest transaction/);
});
