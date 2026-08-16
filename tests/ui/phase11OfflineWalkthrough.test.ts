import assert from "node:assert/strict";
import test from "node:test";

// Install exactly the same prototype adapter composition as production before
// any representative vertical-slice regression module is evaluated.
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";

// Character lifecycle / durable source + runtime.
import "./characterLibraryRuntimeAdapter.test";
import "./characterLibraryFailureRecovery.test";
import "./resolutionCharacterWriteBack.test";

// Progression and representative subclass paths.
import "./progressionPhase08Runtime.test";
import "./progressionPhase08SubclassRuntime.test";
import "./progressionChoiceScheduleRegression.test";

// Outermost authoritative product paths. Intermediate adapter tests that assert
// pre-outer-layer preview/fallback details stay in their dedicated suites.
import "./phase09RealSavingThrowAdapter.test";
import "./phase09RealAtomicAttackAdapter.test";
import "./phase09RealHealingAdapter.test";
import "./phase09RealItemCostAdapter.test";
import "./phase09RealNoRollDamageAdapter.test";
import "./phase09RealTurnRuntimeAdapter.test";
import "./phase09RuntimeEffectApplication.test";
import "./phase09ConcentrationSaveWorkflow.test";
import "./phase09ManualMovementReactionAdapter.test";
import "./phase09CombatantRuntimeActions.test";
import "./visualDiceProjection.test";

test("production offline bootstrap starts a playable local shell without remote transport", async () => {
  const adapter = new MockAdapter();
  await adapter.setSessionMode("freeform");
  const snapshot = await adapter.getSnapshot();

  assert.equal(snapshot.session.role, "offline");
  assert.equal(snapshot.sessionMode, "freeform");
  assert.ok(snapshot.activeCharacter.id);
  assert.ok(snapshot.catalog.length >= 495, "canonical builtin catalog must be available offline");
  assert.ok((snapshot.scene.actionsByActor[snapshot.activeCharacter.id] ?? []).length > 0);
  assert.ok(snapshot.scene.entities.some((entity) => entity.kind === "combatant"));
});

test("production offline composition resolves a Freeform ability check through the final adapter chain", async () => {
  const adapter = new MockAdapter();
  await adapter.setSessionMode("freeform");
  await adapter.setQueuedD20(14);
  await adapter.resolveAction("action.athletics", []);

  let snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.sessionMode, "freeform");
  assert.equal(snapshot.queuedD20, null);
  assert.equal(snapshot.resolution?.rollKind, "check");
  assert.equal(snapshot.resolution?.stage, "roll-animation");
  assert.equal(snapshot.resolution?.rollTotal, 21);
  assert.equal(snapshot.resolution?.compact, "d20 14 + 7 = 21");
  assert.deepEqual(snapshot.resolution?.authoritativeDice, [14]);
  const resolutionId = snapshot.resolution?.id;

  await adapter.advanceResolution();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage, "complete");
  assert.equal(snapshot.activity[0]?.id, resolutionId);
  assert.equal(snapshot.activity[0]?.summary, "d20 14 + 7 = 21");
});

test("production offline composition uses an ItemInstance in Freeform without spending turn economy", async () => {
  const adapter = new MockAdapter();
  await adapter.setSessionMode("freeform");

  await adapter.resolveAction("action.healing-potion", ["char.aelar"]);
  let snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage, "roll-animation");
  await adapter.advanceResolution();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage, "effect-preview");
  await adapter.advanceResolution();
  snapshot = await adapter.getSnapshot();

  assert.equal(snapshot.sessionMode, "freeform");
  assert.equal(snapshot.resolution?.stage, "complete");
  assert.equal(snapshot.activeCharacter.hp, 40);
  assert.equal(snapshot.activeCharacter.items.find((item) => item.id === "item.potion.aelar")?.quantity, 1);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action, true, "Freeform item use must not consume Initiative Action economy");
  assert.ok(snapshot.activity[0]?.stateChanges.some((line) => line.includes("item.potion.aelar") && line.includes("2 → 1")));
});

test("production offline composition casts a slotted spell in Freeform without spending turn economy", async () => {
  const adapter = new MockAdapter();
  await adapter.setSessionMode("freeform");

  const before = await adapter.getSnapshot();
  const slotBefore = before.scene.spellcastingByActor?.["char.mira"]?.slots.find((slot) => slot.level === 1)?.current;
  const snapshot = await adapter.resolveAction("action.healing-word", ["char.aelar"]);

  assert.equal(snapshot.sessionMode, "freeform");
  assert.equal(snapshot.resolution?.stage, "complete");
  assert.match(snapshot.resolution?.compact ?? "", /치유의 단어/);
  assert.equal(snapshot.scene.entities.find((entity) => entity.id === "char.aelar")?.hp, 42);
  assert.equal(snapshot.scene.spellcastingByActor?.["char.mira"]?.slots.find((slot) => slot.level === 1)?.current, (slotBefore ?? 0) - 1);
  assert.equal(snapshot.scene.economyByActor["char.mira"]?.bonusAction, true, "Freeform spell must not consume Initiative Bonus Action economy");
  assert.match(snapshot.resolution?.provenance.join(" ") ?? "", /dnd\.srd521\.spell\.healing-word/);
});

test("production offline composition records a DM condition correction without turning it into Character source state", async () => {
  const adapter = new MockAdapter();
  await adapter.setSessionMode("freeform");
  await adapter.setQueuedD20(10);
  await adapter.resolveAction("action.athletics", []);

  let snapshot = await adapter.applyDmAdjudication({
    type: "condition-add",
    targetId: "combatant.goblin-a",
    value: "넘어짐",
    scope: "scene",
    reason: "테이블 판정",
  });
  const target = snapshot.scene.entities.find((entity) => entity.id === "combatant.goblin-a");
  assert.ok(target?.status.includes("넘어짐"));
  assert.equal(snapshot.resolution?.adjudicated, true);
  assert.equal(snapshot.resolution?.finalOutcome, "상태 추가 넘어짐");
  assert.ok(snapshot.activity.some((entry) => entry.correction && entry.ruling === "상태 추가 넘어짐"));

  snapshot = await adapter.applyDmAdjudication({
    type: "condition-remove",
    targetId: "combatant.goblin-a",
    value: "넘어짐",
    scope: "scene",
    reason: "테이블 판정 종료",
  });
  assert.equal(snapshot.scene.entities.find((entity) => entity.id === "combatant.goblin-a")?.status.includes("넘어짐"), false);
  assert.ok(snapshot.activity.some((entry) => entry.correction && entry.ruling === "상태 제거 넘어짐"));
});

test("production offline composition casts and undoes an initiative spell through authoritative runtime", async () => {
  const adapter = new MockAdapter();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.mira");

  let snapshot = await adapter.resolveAction("action.healing-word", ["char.aelar"]);
  assert.equal(snapshot.resolution?.stage, "complete");
  assert.match(snapshot.resolution?.compact ?? "", /치유의 단어/);
  assert.equal(snapshot.scene.entities.find((entity) => entity.id === "char.aelar")?.hp, 42);
  assert.equal(snapshot.scene.economyByActor["char.mira"]?.bonusAction, false);
  assert.equal(snapshot.scene.spellcastingByActor?.["char.mira"]?.slots.find((slot) => slot.level === 1)?.current, 3);
  const activityId = snapshot.resolution?.id;
  assert.ok(snapshot.activity.find((entry) => entry.id === activityId)?.stateChanges.some((label) => label.includes("spell-slot-1")));

  snapshot = await adapter.undoLastResolution();
  assert.equal(snapshot.scene.entities.find((entity) => entity.id === "char.aelar")?.hp, 31);
  assert.equal(snapshot.scene.economyByActor["char.mira"]?.bonusAction, true);
  assert.equal(snapshot.scene.spellcastingByActor?.["char.mira"]?.slots.find((slot) => slot.level === 1)?.current, 4);
  assert.equal(snapshot.activity.find((entry) => entry.id === activityId)?.reversed, true);
});
