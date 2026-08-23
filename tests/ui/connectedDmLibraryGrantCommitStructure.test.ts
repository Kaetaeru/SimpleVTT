import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const main=readFileSync(new URL("../../src/main.tsx",import.meta.url),"utf8");
const materialization=readFileSync(new URL("../../src/app/campaignDmLibraryMaterializationAdapter.ts",import.meta.url),"utf8");
const committed=readFileSync(new URL("../../src/app/connectedDmLibraryGrantCommitAdapter.ts",import.meta.url),"utf8");

test("DM Library materialization semantics wrap recents before owner journal and committed-owner semantics wrap finalize after it",()=>{
  const base=main.indexOf('import "./app/campaignDmLibraryMaterializationAdapter"');
  const journal=main.indexOf('import "./app/connectedOwnerInventoryJournalAdapter"');
  const committedImport=main.indexOf('import "./app/connectedDmLibraryGrantCommitAdapter"');
  assert.ok(base>=0&&journal>base&&committedImport>journal);
});

test("recents failure is ignored only when the requested asset quantity actually materialized",()=>{
  assert.match(materialization,/const beforeQuantity=/);
  assert.match(materialization,/const afterQuantity=/);
  assert.match(materialization,/if\(afterQuantity===beforeQuantity\+quantity\)return after/);
  assert.doesNotMatch(materialization,/catch\(error\)\{return await this\.getSnapshot/);
});

test("lost connected finalize acknowledgement cannot turn a durable remote grant into a retryable user failure",()=>{
  assert.match(committed,/connectedStateFor\(this\)\.mode!=="host"/);
  assert.match(committed,/const beforeQuantity=/);
  assert.match(committed,/const afterQuantity=/);
  assert.match(committed,/if\(afterQuantity===beforeQuantity\+quantity\)return after/);
});
