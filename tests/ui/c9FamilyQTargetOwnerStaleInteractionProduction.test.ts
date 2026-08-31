import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { HostSessionLedger } from "../../src/app/connectedSessionProtocol";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";
import { routeConnectedInterruptResponse } from "../../src/app/connectedInterruptResponsePort";

const MODULE_ID = "homebrew.target-owner-stale-consent";
const CONTENT_ID = "option.target-owner-stale-consent";
const MECHANIC_ID = "external.unknown.target-owner-stale-consent";
const ENTRY_POINT_ID = "ask-target-owner";

function payload() {
  return JSON.stringify({
    schemaVersion: "0.1-draft",
    moduleId: MODULE_ID,
    moduleVersion: "1",
    rulesProfile: { id: "dnd.srd-5.2.1", version: "0.1-draft" },
    defaultLocale: "en",
    source: { document: "Target Owner Stale Consent Probe", version: "1", license: "CC0", srdDerived: false },
    dependencies: [], conflicts: [], capabilities: [],
    content: [{ id: CONTENT_ID, category: "option", presentation: { defaultLocale: "en", originalName: "Target Owner Stale Consent", locales: { en: { name: "Target Owner Stale Consent", description: "Portable stale selected-target owner consent probe" } } }, mechanics: [{ kind: "common-play", config: { schemaVersion: "0.2-draft", id: MECHANIC_ID, payments: [{ kind: "economy", bucket: "reaction", amount: { value: 1 }, consumeAt: "commit", refundOnCancel: true }], entryPoints: [{ id: ENTRY_POINT_ID, invocation: "manual", interaction: { id: "target-owner-stale-consent", kind: "consent", responder: "target-owner", mode: "blocking", input: { type: "boolean" }, revalidate: "if-revision-changed", stalePolicy: "reject" }, targeting: { from: "targets", min: 1, max: 1 }, operations: [{ kind: "damage.apply", amount: { value: 1 }, damageType: "force", target: "target" }] }] } }] }],
  });
}

async function install(adapter: MockAdapter) {
  setInstalledContentStoreForTests(adapter, new MemoryInstalledContentStore());
  const preview = await adapter.previewContentImport(payload());
  assert.ok(!preview.contentImport?.validation.some((entry) => entry.severity === "blocking"), JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  return installedCommonPlayActionId({ catalogId: catalogQualifiedId(CONTENT_ID, MODULE_ID, "1"), mechanicId: MECHANIC_ID, entryPointId: ENTRY_POINT_ID });
}

test("target-owner late approval is rejected when Reaction is no longer available", async () => {
  const sessionId = "session.target-owner-stale";
  const host = new MockAdapter();
  const actionId = await install(host);
  const internal = host as unknown as { activeCharacter: { id: string }; scene: { entities: Array<{ id: string; hp: number }>; economyByActor: Record<string, { reaction: boolean }> } };
  const actorId = internal.activeCharacter.id;
  const target = internal.scene.entities.find((entity) => entity.id !== actorId && entity.hp > 0);
  assert.ok(target);
  const targetId = target.id, targetHpBefore = target.hp;
  await host.startInitiative();
  await host.setCurrentActor(actorId);

  const state = connectedStateFor(host);
  state.mode = "host";
  state.sessionId = sessionId;
  state.ledger = new HostSessionLedger(sessionId, connectedManifest(host));
  const actorManifest = structuredClone(connectedManifest(host));
  const targetManifest = structuredClone(actorManifest);
  assert.ok(targetManifest.character);
  targetManifest.character = { ...targetManifest.character, characterId: targetId };
  state.peerManifests.set("peer.actor", actorManifest);
  state.peerManifests.set("peer.target", targetManifest);

  const broadcasts: string[] = [];
  const oldSend = tauriSessionTransport.send, oldSendTo = tauriSessionTransport.sendTo;
  tauriSessionTransport.send = async (message) => { broadcasts.push(message); return 1; };
  tauriSessionTransport.sendTo = async () => 1;
  try {
    await host.resolveAction(actionId, [targetId]);
    let snapshot = await host.getSnapshot();
    assert.equal(snapshot.resolution?.stage, "interrupt", JSON.stringify(snapshot.resolution));
    const resolutionId = snapshot.resolution!.id, promptId = snapshot.resolution!.interrupt!.id;
    internal.scene.economyByActor[actorId]!.reaction = false;
    assert.equal(await routeConnectedInterruptResponse(host, { peer: "peer.target", message: "" }, { sessionId, resolutionId, promptId, accept: true }), true);
    snapshot = await host.getSnapshot();
    assert.equal(snapshot.resolution?.stage, "complete", JSON.stringify(snapshot.resolution));
    assert.match(snapshot.resolution?.finalOutcome ?? "", /Common Play 상호작용 (현재 권한 재검증 실패|적용 거부:)/);
    assert.equal(snapshot.scene.entities.find((entity) => entity.id === targetId)?.hp, targetHpBefore);
    assert.equal(snapshot.scene.economyByActor[actorId]?.reaction, false);
    assert.ok(!broadcasts.map((wire) => JSON.parse(wire)).some((wire) => wire.type === "event-batch"), JSON.stringify(broadcasts));
  } finally {
    tauriSessionTransport.send = oldSend;
    tauriSessionTransport.sendTo = oldSendTo;
  }
});
