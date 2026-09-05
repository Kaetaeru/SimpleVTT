import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const contractsSource=readFileSync(new URL("../../src/app/campaignDmLibraryOrganizationContracts.ts",import.meta.url),"utf8").replace(/\r\n/g,"\n");
const runtimeSource=readFileSync(new URL("../../src/app/campaignDmLibraryOrganizationRuntimeAdapter.ts",import.meta.url),"utf8").replace(/\r\n/g,"\n");

test("PC presets retain rich action snapshots for rendered DM materialization",()=>{
  assert.match(contractsSource,/actionSnapshots\?:ActionVm\[\]/,"PC preset persistence must retain rich ActionVm metadata");
  assert.match(runtimeSource,/preset\.actionSnapshots(\?\.|\.)map\(\(action,index\)=>\(\{/,"materialization must clone persisted rich actions");
  assert.match(runtimeSource,/actorId:spawned\.id/,"cloned actions must belong to the spawned preset Actor");
  assert.match(runtimeSource,/id:`\$\{action\.id\}\.pc-preset\.\$\{spawned\.id\}\.\$\{index\}`/,"cloned action ids must be unique per spawned Actor");
});

test("PC preset materialization preserves MP-B04 DM ownership semantics",()=>{
  assert.match(runtimeSource,/spawned\.side="ally"/,"DM-owned PC preset must materialize on the allied side");
  assert.match(runtimeSource,/runtimeScene\.selectedActorId=spawned\.id/,"the Host must control the spawned preset instead of the projected Player Character");
  assert.doesNotMatch(runtimeSource,/selectedActorId=.*activeCharacter\.id/,"materialization must not grant Host control of the durable Player Character");
});