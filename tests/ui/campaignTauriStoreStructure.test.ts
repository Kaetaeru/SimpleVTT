import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const store=readFileSync(new URL("../../src/app/tauriCampaignLibraryStore.ts",import.meta.url),"utf8");
const lib=readFileSync(new URL("../../src-tauri/src/lib.rs",import.meta.url),"utf8");
const rust=readFileSync(new URL("../../src-tauri/src/campaign_library.rs",import.meta.url),"utf8");

test("Campaign platform store uses dedicated Tauri commands with memory fallback",()=>{
  assert.match(store,/read_campaign_library_generations/);
  assert.match(store,/write_campaign_library_generation/);
  assert.match(store,/isTauriCharacterLibraryRuntime/);
  assert.match(store,/new MemoryCampaignLibraryStore/);
});

test("Tauri Campaign commands use the shared immutable generation store",()=>{
  assert.match(lib,/mod campaign_library;/);
  assert.match(lib,/local_data_child\(&app, "campaign-library"\)/);
  assert.match(lib,/read_campaign_library_generations/);
  assert.match(lib,/write_campaign_library_generation/);
  assert.match(rust,/generation_store::read_generations_at/);
  assert.match(rust,/generation_store::write_generation_at/);
  assert.match(rust,/campaign_library_uses_the_shared_atomic_generation_contract/);
});
