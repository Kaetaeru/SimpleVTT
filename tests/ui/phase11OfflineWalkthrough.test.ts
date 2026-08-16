import assert from "node:assert/strict";
import test from "node:test";

// Install the same outer production adapter composition used by the desktop app.
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { setCharacterLibraryStoreForTests } from "../../src/app/characterLibraryRuntimeAdapter";
import { classIdFromName, classMeta } from "../../src/app/characterCreationV10Data";
import type { CharacterCreationSection } from "../../src/app/contracts";

// Character/persistence/progression subsystem regressions remain here because they
// are compatible with the production composition. Phase09 fixture-oriented tests
// intentionally stay in the dedicated UI workflow, where their own adapter layer
// is the subject under test; importing them after productionPlayRuntimeAdapter
// would incorrectly make Aelar/Mira fixture assumptions part of Phase11 acceptance.
import "./characterLibraryRuntimeAdapter.test";
import "./characterLibraryFailureRecovery.test";
import "./resolutionCharacterWriteBack.test";
import "./progressionPhase08Runtime.test";
import "./progressionPhase08SubclassRuntime.test";
import "./progressionChoiceScheduleRegression.test";

async function fillCurrentCreationDraft(adapter:MockAdapter) {
  for (let pass = 0; pass < 40; pass += 1) {
    const snapshot = await adapter.getSnapshot();
    const draft = snapshot.createDraft;
    const plan = snapshot.creationPlan;
    assert.ok(draft && plan,"creation draft/plan must exist");
    let changed = false;

    const skills = plan.sections.find((section) => section.id === "proficiencies");
    if (skills?.status === "incomplete") {
      const count = classMeta(classIdFromName(draft.className)).semantics.skills.count;
      for (const option of skills.options.filter((item) => !item.selected).slice(0,Math.max(0,count-draft.selectedSkills.length))) {
        await adapter.updateCharacterDraft({type:"toggle-skill",value:option.name});
        changed = true;
      }
    }

    const equipment = plan.sections.find((section) => section.id === "class-equipment");
    if (equipment?.status === "incomplete") {
      const rangedFighterLoadout=equipment.options.find((option)=>option.id.endsWith("#B"));
      const selected=rangedFighterLoadout ?? equipment.options[0];
      if (selected) {
        await adapter.updateCharacterDraft({type:"set-equipment",value:selected.id});
        changed = true;
      }
    }

    const current = await adapter.getSnapshot();
    const dynamic = (current.creationPlan?.sections ?? []).filter(
      (section) => section.kind === "dynamic-choice" && section.status === "incomplete" && section.selection,
    ) as Array<CharacterCreationSection & {selection:{choiceId:string;count:number}}>;
    for (const section of dynamic) {
      const targetIds = section.options
        .filter((option) => !option.selected)
        .slice(0,section.selection.count-section.options.filter((option) => option.selected).length)
        .map((option) => option.id);
      for (const id of targetIds) {
        const latest = await adapter.getSnapshot();
        const target = latest.creationPlan?.sections.find((item) => item.selection?.choiceId === section.selection.choiceId);
        if (!target || target.status === "complete" || target.status === "blocked") break;
        if (!target.options.some((option) => option.id === id && !option.selected)) continue;
        await adapter.updateCharacterDraft({type:"toggle-class-choice",choiceId:section.selection.choiceId,value:id});
        changed = true;
      }
    }

    const after = await adapter.getSnapshot();
    if ((after.creationPlan?.summary.blockingCount ?? 1) === 0) return after;
    if (!changed) {
      const unresolved = after.creationPlan?.sections
        .filter((section) => section.status === "incomplete" || section.status === "blocked")
        .map((section) => `${section.id}:${section.status}`)
        .join(", ");
      assert.fail(`unable to complete production creation draft: ${unresolved}`);
    }
  }
  assert.fail("production creation completion exceeded 40 passes");
}

async function createPersistedProductionFighter(name:string) {
  const store = new MemoryCharacterLibraryStore();
  const adapter = new MockAdapter();
  setCharacterLibraryStoreForTests(adapter,store);
  await adapter.getSnapshot();
  await adapter.createCharacterDraft("guided");
  await adapter.updateCharacterDraft({type:"set-name",value:name});
  await adapter.updateCharacterDraft({type:"set-species",value:"드워프"});
  await adapter.updateCharacterDraft({type:"set-background",value:"범죄자"});
  await adapter.updateCharacterDraft({type:"set-class",value:"파이터"});
  await adapter.updateCharacterDraft({type:"apply-recommended-array"});
  const ready = await fillCurrentCreationDraft(adapter);
  assert.equal(ready.creationPlan?.summary.blockingCount,0);

  const committed = await adapter.finalizeCharacterDraft();
  const characterId = committed.activeCharacter.id;
  assert.equal(committed.activeCharacter.name,name);
  assert.equal(committed.activeCharacter.saveState,"saved");
  assert.notEqual(characterId,"char.aelar");
  assert.notEqual(characterId,"char.mira");
  assert.ok(committed.activeCharacter.attacks.some((attack)=>/longbow|장궁/i.test(attack.name)),"production Fighter loadout B must materialize its Longbow attack");
  assert.ok((committed.persistence?.storageRevision ?? 0) >= 1,"production Character must be durably committed");
  return {adapter,store,characterId};
}

function liveAction(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>,characterId:string,kind:"ability-check"|"attack") {
  const action = (snapshot.scene.actionsByActor[characterId] ?? []).find((entry) => entry.resolutionKind === kind);
  assert.ok(action,`fresh Character must expose a ${kind} production action`);
  assert.equal(action.actorId,characterId);
  return action;
}

function legalLiveAttack(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>,characterId:string) {
  const actions=(snapshot.scene.actionsByActor[characterId] ?? []).filter((entry)=>entry.resolutionKind==="attack" && entry.runtimeAttack);
  const targets=snapshot.scene.entities.filter((entity)=>entity.kind==="combatant" && entity.side==="enemy" && entity.reactions.length===0);
  for (const action of actions) {
    for (const target of targets) {
      const distance=Number(target.distance.match(/(\d+(?:\.\d+)?)/)?.[1]);
      if (Number.isFinite(distance) && distance <= action.runtimeAttack!.rangeFeet) return {action,target,distance};
    }
  }
  assert.fail("fresh Character must have a derived attack with a legal live combatant target");
}

test("production offline create/save/restart materializes a fresh non-fixture Character as the local play actor", async () => {
  const {adapter,store,characterId} = await createPersistedProductionFighter("Phase11 Production Fighter");
  let snapshot = await adapter.startProductionLocalPlay("player");

  assert.equal(snapshot.session.role,"offline");
  assert.equal(snapshot.session.address,"local");
  assert.equal(snapshot.activeCharacter.id,characterId);
  assert.ok(snapshot.scene.entities.some((entity) => entity.id === characterId && entity.kind === "character"));
  assert.ok((snapshot.scene.actionsByActor[characterId] ?? []).length > 0);
  assert.equal(snapshot.scene.entities.some((entity) => entity.id === "char.aelar" || entity.id === "char.mira"),false,"reference Characters must not remain in the production local Scene");
  assert.ok(snapshot.catalog.length >= 495,"canonical builtin catalog must be available offline");

  const restarted = new MockAdapter();
  setCharacterLibraryStoreForTests(restarted,store);
  snapshot = await restarted.startProductionLocalPlay("player");
  assert.equal(snapshot.activeCharacter.id,characterId);
  assert.equal(snapshot.activeCharacter.name,"Phase11 Production Fighter");
  assert.ok(snapshot.scene.entities.some((entity) => entity.id === characterId));
  assert.ok((snapshot.scene.actionsByActor[characterId] ?? []).length > 0,"restarted persisted Character must re-derive live actions");
});

test("production offline fresh Character resolves a derived skill through authoritative dice and Activity", async () => {
  const {adapter,characterId} = await createPersistedProductionFighter("Phase11 Skill Fighter");
  await adapter.startProductionLocalPlay("player");
  await adapter.setSessionMode("freeform");
  let snapshot = await adapter.getSnapshot();
  const action = liveAction(snapshot,characterId,"ability-check");

  snapshot = await adapter.resolveAction(action.id,[]);
  assert.equal(snapshot.resolution?.actorId,characterId);
  assert.equal(snapshot.resolution?.actionId,action.id);
  assert.equal(snapshot.resolution?.rollKind,"check");
  assert.equal(snapshot.resolution?.stage,"roll-animation");
  const face = snapshot.resolution?.authoritativeDice[0];
  assert.ok(face !== undefined && Number.isInteger(face) && face >= 1 && face <= 20,"production dice source must provide the authoritative d20 face");
  assert.equal(snapshot.resolution?.rollTotal,face + (action.checkBonus ?? 0));
  const resolutionId = snapshot.resolution?.id;

  snapshot = await adapter.advanceResolution();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.activity[0]?.id,resolutionId);
  assert.ok(snapshot.activity[0]?.detail.some((line) => line.includes(String(face))));
});

test("production offline fresh Character spends Initiative Action on its derived attack and Undo restores authority state", async () => {
  const {adapter,characterId} = await createPersistedProductionFighter("Phase11 Initiative Fighter");
  await adapter.startProductionLocalPlay("player");
  await adapter.startInitiative();
  await adapter.setCurrentActor(characterId);
  let snapshot = await adapter.getSnapshot();
  const {action,target,distance}=legalLiveAttack(snapshot,characterId);
  const hpBefore = target.hp;
  assert.ok(action.runtimeAttack && distance <= action.runtimeAttack.rangeFeet);

  snapshot = await adapter.resolveAction(action.id,[target.id]);
  const resolutionId = snapshot.resolution?.id;
  assert.equal(snapshot.resolution?.actorId,characterId);
  for (let step = 0; step < 6 && snapshot.resolution?.stage !== "complete"; step += 1) {
    snapshot = snapshot.resolution?.stage === "interrupt"
      ? await adapter.respondToInterrupt(false)
      : await adapter.advanceResolution();
  }

  assert.equal(snapshot.resolution?.stage,"complete");
  assert.doesNotMatch(snapshot.resolution?.finalOutcome ?? "",/적용 거부|missing pairwise spatial runtime fact/i);
  assert.ok(snapshot.resolution?.provenance.some((line)=>line.includes(`runtime:spatial:${characterId}->${target.id}:distance:${distance}ft`)),"targeting provenance must use the live Character id");
  assert.equal(snapshot.scene.economyByActor[characterId]?.action,false,"committed Initiative attack must spend the live actor Action");
  assert.ok(snapshot.activity.some((entry) => entry.id === resolutionId));

  snapshot = await adapter.undoLastResolution();
  assert.equal(snapshot.scene.economyByActor[characterId]?.action,true,"event-native Undo must restore the spent Action");
  assert.equal(snapshot.scene.entities.find((entity) => entity.id === target.id)?.hp,hpBefore,"Undo must restore target HP whether the authoritative attack hit or missed");
  assert.equal(snapshot.activity.find((entry) => entry.id === resolutionId)?.reversed,true);
});

test("production offline DM correction targets a live combatant without fixed fixture ids", async () => {
  const {adapter,characterId} = await createPersistedProductionFighter("Phase11 DM Fighter");
  await adapter.startProductionLocalPlay("dm");
  await adapter.setSessionMode("freeform");
  let snapshot = await adapter.getSnapshot();
  const skill = liveAction(snapshot,characterId,"ability-check");
  const target = snapshot.scene.entities.find((entity) => entity.kind === "combatant" && entity.side === "enemy");
  assert.ok(target);

  await adapter.resolveAction(skill.id,[]);
  snapshot = await adapter.applyDmAdjudication({
    type:"condition-add",
    targetId:target.id,
    value:"넘어짐",
    scope:"scene",
    reason:"Phase11 production walkthrough",
  });
  assert.equal(snapshot.scene.entities.find((entity) => entity.id === target.id)?.status.includes("넘어짐"),true);
  assert.equal(snapshot.resolution?.adjudicated,true);
  assert.ok(snapshot.activity.some((entry) => entry.correction && entry.ruling === "상태 추가 넘어짐"));

  snapshot = await adapter.applyDmAdjudication({
    type:"condition-remove",
    targetId:target.id,
    value:"넘어짐",
    scope:"scene",
    reason:"Phase11 production walkthrough complete",
  });
  assert.equal(snapshot.scene.entities.find((entity) => entity.id === target.id)?.status.includes("넘어짐"),false);
  assert.ok(snapshot.activity.some((entry) => entry.correction && entry.ruling === "상태 제거 넘어짐"));
});
