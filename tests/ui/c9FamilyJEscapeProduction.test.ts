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
  const contentId = `${prefix}.control`;
  const mechanicId = `${prefix}.mechanic`;
  const bestSave = {
    kind: "saving-throw",
    roller: "target",
    property: {
      choose: "highest",
      from: ["save.str.modifier", "save.dex.modifier"],
    },
    dc: { value: 12 },
    perTarget: false,
  };
  const config = {
    schemaVersion: "0.2-draft",
    id: mechanicId,
    entryPoints: [
      {
        id: "grapple-best-save-probe",
        invocation: "manual",
        targeting: { from: "targets", min: 1, max: 1 },
        test: bestSave,
        operations: [
          {
            kind: "condition.apply",
            condition: "grappled",
            target: "target",
            when: {
              op: "eq",
              left: { ref: "test.outcome" },
              right: { value: "failure" },
            },
          },
        ],
      },
      {
        id: "escape-best-save-probe",
        invocation: "manual",
        targeting: { from: "targets", min: 1, max: 1 },
        test: bestSave,
        operations: [
          {
            kind: "condition.remove",
            condition: "grappled",
            target: "target",
            when: {
              op: "eq",
              left: { ref: "test.outcome" },
              right: { value: "success" },
            },
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
      source: {
        document: "Family J portable escape probe",
        version: "1",
        license: "CC0",
        srdDerived: false,
      },
      dependencies: [],
      conflicts: [],
      capabilities: [],
      content: [
        {
          id: contentId,
          category: "option",
          presentation: {
            defaultLocale: "en",
            originalName: "Portable Escape Probe",
            locales: { en: { name: "Portable Escape Probe" } },
          },
          mechanics: [{ kind: "common-play", config }],
        },
      ],
    }),
  };
}

function hasGrappled(adapter: MockAdapter, snapshot: Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  return snapshotAdapterTurnRuntimeState(adapter, snapshot.scene)?.effects.some(
    (effect) => effect.targetId === TARGET_ID && effect.conditionId === "grappled",
  );
}

async function exercise(prefix: string) {
  const adapter = new MockAdapter();
  const pack = packagePayload(prefix);
  setInstalledContentStoreForTests(adapter, new MemoryInstalledContentStore());

  let snapshot = await adapter.previewContentImport(pack.json);
  assert.ok(
    !snapshot.contentImport?.validation.some((entry) => entry.severity === "blocking"),
    JSON.stringify(snapshot.contentImport?.validation),
  );
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");

  const actionId = (entryPointId: string) =>
    installedCommonPlayActionId({
      catalogId: catalogQualifiedId(pack.contentId, pack.moduleId, "1"),
      mechanicId: pack.mechanicId,
      entryPointId,
    });

  await adapter.setQueuedD20(1);
  snapshot = await adapter.resolveAction(actionId("grapple-best-save-probe"), [TARGET_ID]);
  assert.equal(snapshot.resolution?.stage, "complete", JSON.stringify(snapshot.resolution));
  assert.equal(snapshot.resolution?.rollTotal, 3);
  assert.equal(hasGrappled(adapter, snapshot), true);

  await adapter.setQueuedD20(20);
  snapshot = await adapter.resolveAction(actionId("escape-best-save-probe"), [TARGET_ID]);
  assert.equal(snapshot.resolution?.stage, "complete", JSON.stringify(snapshot.resolution));
  assert.equal(snapshot.resolution?.rollTotal, 22);
  assert.equal(hasGrappled(adapter, snapshot), false);

  await adapter.undoLastResolution();
  snapshot = await adapter.getSnapshot();
  assert.equal(hasGrappled(adapter, snapshot), true);
}

test("unknown installed Common Play removes portable grapple on best-of STR/DEX escape and Undo restores it under identity rename", async () => {
  await exercise("unknown-family-j-escape");
  await exercise("renamed-family-j-escape");
});
