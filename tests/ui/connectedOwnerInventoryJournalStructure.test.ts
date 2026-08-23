import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runtime=readFileSync(new URL("../../src/app/connectedOwnerInventoryJournalAdapter.ts",import.meta.url),"utf8");
const store=readFileSync(new URL("../../src/app/connectedOwnerInventoryJournalStore.ts",import.meta.url),"utf8");
const rust=readFileSync(new URL("../../src-tauri/src/connected_owner_inventory.rs",import.meta.url),"utf8");
const lib=readFileSync(new URL("../../src-tauri/src/lib.rs",import.meta.url),"utf8");
const main=readFileSync(new URL("../../src/main.tsx",import.meta.url),"utf8");

test("production installs owner inventory journal after connected Campaign routing",()=>{
  const campaign=main.indexOf('import "./app/connectedCampaignSystemsRuntimeAdapter"');
  const journal=main.indexOf('import "./app/connectedOwnerInventoryJournalAdapter"');
  assert.ok(campaign>=0);
  assert.ok(journal>campaign);
});

test("owner journal records before apply and an exact undoing target before compensation",()=>{
  assert.match(runtime,/store\.prepare\(\{requestId:command\.requestId,actorId:command\.actorId,command:cp\(command\),before:current\}\)/);
  assert.match(runtime,/store\.markApplied\(command\.requestId,current\)/);
  assert.match(runtime,/store\.beginUndo\(requestId,current,target\)/);
  assert.match(runtime,/sameInventory\(current,record\.afterUndo\)/);
  assert.match(runtime,/sameInventory\(current,record\.beforeUndo\)/);
  assert.match(runtime,/writeUndoTarget\(adapter,record\.afterUndo\)/);
});

test("duplicate apply undo and finalize resolve from durable journal phase",()=>{
  assert.match(runtime,/record\.phase==="applied"\)return snapshot/);
  assert.match(runtime,/record\.phase==="undone"\)return snapshot/);
  assert.match(runtime,/record\.phase==="finalized"/);
  assert.match(store,/finalOutcome/);
  assert.match(store,/MemoryConnectedOwnerInventoryJournalStore/);
  assert.match(store,/TauriConnectedOwnerInventoryJournalStore/);
});

test("Host defers finalization until the compound Stash or DM Library operation settles",()=>{
  assert.match(runtime,/defer\(this,1\).*baseTransfer/s);
  assert.match(runtime,/mutation\?\.outcome\)await sendFinalize/);
  assert.match(runtime,/grantCampaignDmLibraryItemWithOwnerJournal/);
  assert.match(runtime,/this\.undoDmInventoryAdjustment\(requestId\)/);
  assert.match(runtime,/campaign-owner-inventory-finalize/);
  assert.match(runtime,/campaign-owner-inventory-finalize-result/);
});

test("Tauri owner inventory journal uses immutable phase sidecars and registered commands",()=>{
  assert.match(rust,/MARKER_PREFIX: &str = "connected-owner-inventory\."/);
  for(const phase of ["applied","undoing","undone","finalized"])assert.match(rust,new RegExp(`phase_path\\(&path, "${phase}"\\)`));
  assert.match(rust,/write_new_file/);
  assert.match(rust,/file\.sync_all\(\)/);
  assert.match(lib,/mod connected_owner_inventory;/);
  for(const command of ["read_connected_owner_inventory_journal","prepare_connected_owner_inventory_journal","mark_connected_owner_inventory_applied","begin_connected_owner_inventory_undo","mark_connected_owner_inventory_undone","finalize_connected_owner_inventory_journal"])assert.match(lib,new RegExp(command));
});
