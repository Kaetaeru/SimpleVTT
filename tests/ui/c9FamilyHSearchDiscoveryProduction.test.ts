import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/installedContentRuntimeAdapter";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";

const TARGET_ID = "combatant.goblin-a";

function packagePayload(prefix: string) {
  const moduleId = `${prefix}.module`;
  const contentId = `${prefix}.search-discovery`;
  const mechanicId = `${prefix}.mechanic`;
  const config = {
    schemaVersion: "0.2-draft",
    id: mechanicId,
    entryPoints: [
      {
        id: "hide-probe",
        invocation: "manual",
        targeting: { from: "targets", min: 1, max: 1 },
        operations: [{ kind: "condition.apply", condition: "invisible", target: "target" }],
      },
      {
        id: "search-probe",
        invocation: "manual",
        targeting: { from: "targets", min: 1, max: 1 },
        test: {
          kind: "ability-check",
          roller: "actor",
          property: "ability.wis.modifier",
          dc: { value: 10 },
          perTarget: false,
        },
        operations: [
          {
            kind: "effect.remove",
  selector: {
    from: "effects",
    where: {
      op: "all",
      args: [
        { op: "eq", left: { ref: "conditionId" }, right: { value: "invisible" } },
        { op: "eq", left: { ref: "target.selected" }, right: { value: true } },
      ],
    },
    min: 1,
    max: 1,
    selection: "automatic",
  },
            when: { op: "eq", left: { ref: "test.outcome" }, right: { value: "success" } },
          },
        ],
      },
    ],
  };
  return {
    moduleId,
    contentId,
    mechanicId,
    json: JSON.stringify({
      schemaVersion: "0.1-draft",
      moduleId,
      moduleVersion: "1",
      rulesProfile: { id: "dnd.srd-5.2.1", version: "0.1-draft" },
      defaultLocale: "en",
      source: { document: "Family H Search discovery probe", version: "1", license: "CC0", srdDerived: false },
      dependencies: [],
      conflicts: [],
      capabilities: [],
      content: [
        {
          id: contentId,
          category: "option",
          presentation: {
            defaultLocale: "en",
            originalName: "Portable Search Discovery Probe",
            locales: { en: { name: "Portable Search Discovery Probe" } },
          },
          mechanics: [{ kind: "common-play", config }],
        },
      ],
    }),
  };
}

function hasInvisible(adapter: MockAdapter, snapshot: Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  return snapshotAdapterTurnRuntimeState(adapter, snapshot.scene)?.effects.some(
    (effect) => effect.targetId === TARGET_ID && effect.conditionId === "invisible",
  ) ?? false;
}

async function exercise(prefix: string) {
  const adapter = new MockAdapter();
  const pack = packagePayload(prefix);
  setInstalledContentStoreForTests(adapter, new MemoryInstalledContentStore());

  let snapshot = await adapter.previewContentImport(pack.json);
  assert.ok(!snapshot.contentImport?.validation.some((entry) => entry.severity === "blocking"), JSON.stringify(snapshot.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");

  const catalogId = catalogQualifiedId(pack.contentId, pack.moduleId, "1");
  const hideActionId = installedCommonPlayActionId({ catalogId, mechanicId: pack.mechanicId, entryPointId: "hide-probe" });
  const searchActionId = installedCommonPlayActionId({ catalogId, mechanicId: pack.mechanicId, entryPointId: "search-probe" });

  snapshot = await adapter.resolveAction(hideActionId, [TARGET_ID]);
  assert.equal(snapshot.resolution?.stage, "complete", JSON.stringify(snapshot.resolution));
  assert.equal(hasInvisible(adapter, snapshot), true);

  await adapter.setQueuedD20(20);
  snapshot = await adapter.resolveAction(searchActionId, [TARGET_ID]);
  assert.equal(snapshot.resolution?.stage, "complete", JSON.stringify(snapshot.resolution));
  assert.equal(snapshot.resolution?.rollKind, "check");
  assert.equal(hasInvisible(adapter, snapshot), false);

  await adapter.undoLastResolution();
  snapshot = await adapter.getSnapshot();
  assert.equal(hasInvisible(adapter, snapshot), true);

  await adapter.setQueuedD20(1);
  snapshot = await adapter.resolveAction(searchActionId, [TARGET_ID]);
  assert.equal(snapshot.resolution?.stage, "complete", JSON.stringify(snapshot.resolution));
  assert.equal(snapshot.resolution?.rollKind, "check");
  assert.equal(hasInvisible(adapter, snapshot), true);
}

test("unknown installed Common Play Search reveals Resolver-owned Invisible on success and survives identity rename", async () => {
  await exercise("unknown-family-h-search");
  await exercise("renamed-family-h-search");
});
