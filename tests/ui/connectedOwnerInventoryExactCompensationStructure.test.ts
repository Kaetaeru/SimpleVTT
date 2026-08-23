import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runtime=readFileSync(new URL("../../src/app/connectedOwnerInventoryExactCompensationAdapter.ts",import.meta.url),"utf8");
const main=readFileSync(new URL("../../src/main.tsx",import.meta.url),"utf8");

test("connected Host Party Stash binds undoLast to the active exact requestId",()=>{
  assert.match(runtime,/activeHostStashRequest\.set\(this,command\.requestId\)/);
  assert.match(runtime,/return this\.undoDmInventoryAdjustment\(requestId\)/);
  assert.match(runtime,/another connected Party Stash transaction is already compensating owner inventory/);
});

test("exact compensation adapter installs after the owner journal adapter",()=>{
  const journal=main.indexOf('import "./app/connectedOwnerInventoryJournalAdapter"');
  const exact=main.indexOf('import "./app/connectedOwnerInventoryExactCompensationAdapter"');
  assert.ok(journal>=0);
  assert.ok(exact>journal);
});
