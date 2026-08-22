import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { CONNECTED_CAPABILITIES, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";

test("connected runtime advertises the Ready Action lifecycle capability",()=>{
  const adapter=new MockAdapter();
  assert.ok(CONNECTED_CAPABILITIES.includes("ready-action-v1"));
  assert.ok(connectedManifest(adapter).capabilities.includes("ready-action-v1"));
});

test("production Host does not fake a connected session when desktop transport is unavailable", async () => {
  const adapter=new MockAdapter();
  const snapshot=await adapter.hostSession();
  assert.equal(snapshot.session.role,"offline");
  assert.equal(snapshot.connectionState,"disconnected");
  assert.equal(snapshot.session.compatibility,"incompatible");
  assert.match(snapshot.session.compatibilityMessage,/Tauri desktop runtime/);
});

test("production Join requires a real desktop transport instead of flipping mock connection flags", async () => {
  const adapter=new MockAdapter();
  const snapshot=await adapter.joinSession("127.0.0.1:3210");
  assert.equal(snapshot.session.role,"offline");
  assert.equal(snapshot.connectionState,"disconnected");
  assert.equal(snapshot.session.compatibility,"incompatible");
  assert.match(snapshot.session.compatibilityMessage,/Tauri desktop runtime/);
});

test("production Join rejects an empty host address before transport", async () => {
  const adapter=new MockAdapter();
  const snapshot=await adapter.joinSession("   ");
  assert.equal(snapshot.connectionState,"disconnected");
  assert.equal(snapshot.session.compatibility,"incompatible");
  assert.match(snapshot.session.compatibilityMessage,/Host address is required/);
});
