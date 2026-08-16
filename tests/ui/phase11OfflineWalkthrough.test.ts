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
  const snapshot = await adapter.getSnapshot();

  assert.equal(snapshot.session.role, "offline");
  assert.ok(snapshot.activeCharacter.id);
  assert.ok(snapshot.catalog.length >= 495, "canonical builtin catalog must be available offline");
  assert.ok((snapshot.scene.actionsByActor[snapshot.activeCharacter.id] ?? []).length > 0);
  assert.ok(snapshot.scene.entities.some((entity) => entity.kind === "combatant"));
});

test("production offline composition resolves a Freeform ability check through the final adapter chain", async () => {
  const adapter = new MockAdapter();
  await adapter.queueNextD20(14);
  const snapshot = await adapter.resolveAction("action.athletics", ["char.aelar"]);

  assert.equal(snapshot.session.mode, "freeform");
  assert.equal(snapshot.resolution?.stage, "complete");
  assert.match(snapshot.resolution?.compact ?? "", /운동|Athletics/i);
  assert.ok(snapshot.resolution?.dice.some((die) => die.kind === "d20" && die.value === 14));
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
