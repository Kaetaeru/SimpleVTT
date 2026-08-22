import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const store=readFileSync(new URL("../../src/app/tauriCampaignLibraryStore.ts",import.meta.url),"utf8");
const lib=readFileSync(new URL("../../src-tauri/src/lib.rs",import.meta.url),"utf8");
const rust=readFileSync(new URL("../../src-tauri/src/campaign_library.rs",import.meta.url),"utf8");
const compound=readFileSync(new URL("../../src-tauri/src/character_campaign_compound.rs",import.meta.url),"utf8");
const compoundWriter=readFileSync(new URL("../../src/app/tauriCharacterCampaignCompoundWriter.ts",import.meta.url),"utf8");

test("Campaign platform store uses dedicated Tauri commands with memory fallback",()=>{
  assert.match(store,/read_campaign_library_generations/);
  assert.match(store,/write_campaign_library_generation/);
  assert.match(store,/isTauriCharacterLibraryRuntime/);
  assert.match(store,/new MemoryCampaignLibraryStore/);
});

test("Tauri Campaign commands use shared immutable generations behind compound recovery",()=>{
  assert.match(lib,/mod campaign_library;/);
  assert.match(lib,/mod character_campaign_compound;/);
  assert.match(lib,/root\.join\("campaign-library"\)/);
  assert.match(lib,/character_campaign_compound::recover_at\(&root\)/);
  assert.match(lib,/write_character_campaign_compound/);
  assert.match(rust,/generation_store::read_generations_at/);
  assert.match(rust,/generation_store::write_generation_at/);
  assert.match(rust,/campaign_library_uses_the_shared_atomic_generation_contract/);
  assert.match(compound,/BeforeCommitMarker/);
  assert.match(compound,/AfterCharacterMaterialized/);
  assert.match(compound,/recover_at/);
  assert.match(compoundWriter,/write_character_campaign_compound/);
});
