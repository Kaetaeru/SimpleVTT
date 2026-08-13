import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFighterCharacter,
  switchFighterToWizard,
  switchGuidedQuickWithoutLosingDraft,
} from "../../.ui-smoke-build/characterCreationV09Smoke.js";

test("guided fighter creation reaches a commit-ready review and creates a level-1 character", async () => {
  const { beforeCommit, afterCommit } = await buildFighterCharacter();
  const plan = beforeCommit.creationPlan;
  assert.ok(plan);
  assert.equal(plan.summary.blockingCount, 0);
  assert.equal(plan.sections.find((section) => section.id === "review")?.status, "complete");
  assert.equal(plan.sections.find((section) => section.id === "spells")?.status, "not-applicable");
  assert.equal(beforeCommit.createDraft?.subclassName, "");
  assert.equal(afterCommit.createDraft, null);
  assert.equal(afterCommit.activeCharacter.name, "Gate Fighter");
  assert.equal(afterCommit.activeCharacter.level, 1);
  assert.equal(afterCommit.activeCharacter.className, "전사");
  assert.equal(afterCommit.activeCharacter.subclassName, undefined);
  assert.ok(afterCommit.activeCharacter.features.includes("전투 방식: 방어"));
});

test("changing Fighter to Wizard removes Fighter-only choices and opens spell choices", async () => {
  const snapshot = await switchFighterToWizard();
  const draft = snapshot.createDraft;
  const plan = snapshot.creationPlan;
  assert.ok(draft);
  assert.ok(plan);
  assert.equal(draft.className, "마법사");
  assert.deepEqual(draft.selectedClassChoices, []);
  assert.deepEqual(draft.selectedSpells, []);
  assert.equal(draft.equipmentPreset, "wizard-focus");
  assert.equal(draft.subclassName, "");
  assert.equal(plan.sections.find((section) => section.id === "class-choices")?.status, "not-applicable");
  assert.equal(plan.sections.find((section) => section.id === "spells")?.status, "incomplete");
  assert.ok(plan.validation.some((message) => message.severity === "blocking" && message.message.includes("주문 선택")));
});

test("Guided and Quick use the same autosaved draft", async () => {
  const { guided, quick, guidedAgain } = await switchGuidedQuickWithoutLosingDraft();
  assert.equal(guided.createDraft?.id, quick.createDraft?.id);
  assert.equal(quick.createDraft?.id, guidedAgain.createDraft?.id);
  assert.equal(guided.createDraft?.name, "Persistent Draft");
  assert.equal(quick.createDraft?.name, "Persistent Draft");
  assert.equal(guidedAgain.createDraft?.name, "Persistent Draft");
  assert.equal(quick.createDraft?.mode, "quick");
  assert.equal(guidedAgain.createDraft?.mode, "guided");
});
