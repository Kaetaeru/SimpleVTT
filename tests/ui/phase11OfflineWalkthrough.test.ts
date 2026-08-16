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

// Freeform / initiative resolution, authoritative runtime, spellcasting and Undo.
import "./phase09RealResolutionService.test";
import "./phase09RealSavingThrowAdapter.test";
import "./phase09AuthoritativeSpellcastingAdapter.test";
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
  assert.equal(snapshot.connectionState, "disconnected");
  assert.ok(snapshot.activeCharacter.id);
  assert.ok(snapshot.catalog.length >= 495, "canonical builtin catalog must be available offline");
  assert.ok((snapshot.scene.actionsByActor[snapshot.activeCharacter.id] ?? []).length > 0);
  assert.ok(snapshot.scene.entities.some((entity) => entity.kind === "combatant"));
});
