import assert from "node:assert/strict";
import test from "node:test";
import type { CharacterCreateDraft, LevelUpDraft } from "../../src/app/contracts";
import {
  AuthoringDraftCorruptError,
  AuthoringDraftMigrationRequiredError,
  AuthoringDraftRepository,
  decodeAuthoringDrafts,
  encodeAuthoringDraftsV1,
  projectCreationDraftIntentV1,
  projectProgressionDraftIntentV1,
} from "../../src/app/authoringDraftPersistence";
import { MemoryAuthoringDraftStore } from "../../src/app/memoryAuthoringDraftStore";

function creationDraft():CharacterCreateDraft {
  return {
    id:"draft.new",step:3,activeSectionId:"abilities",mode:"guided",rulesProfileId:"dnd.srd-5.2.1",
    name:"Draft Hero",className:"파이터",subclassName:"",species:"드워프",background:"범죄자",level:1,
    abilityMethod:"standard",abilities:{str:15,dex:14,con:13,int:10,wis:12,cha:8},
    rolledPool:[{id:"roll.0",total:14,dice:[6,5,3,1],dropped:1}],rolledAssignments:{},
    selectedSkills:["운동"],selectedSpells:[],selectedClassChoices:["style.defense"],equipmentPreset:"fighter.a",
    backgroundEquipmentPreset:"criminal.a",notes:"remember me",overrides:{hp:12},
    choiceSelections:{"class.style":["style.defense"]},
    finalAbilities:{str:16,dex:14,con:14,int:10,wis:12,cha:8},goldGp:15,
    derived:{proficiencyBonus:2,ac:18,hp:13,speed:30},validation:[{severity:"warning",message:"computed warning"}],
  };
}

function progressionDraft():LevelUpDraft {
  return {
    characterId:"char.aelar",fromLevel:5,toLevel:6,step:4,hpMethod:"roll",hpRoll:8,hpGain:11,
    asiMode:"plus-two",asiPrimary:"str",asiSecondary:"dex",targetClassId:"dnd.srd521.class.fighter",
    progressionSelections:{"progression.dnd.srd521.class.fighter.6.asi":{kind:"asi",mode:"plus-two",primary:"str"}},
    preview:{maxHpBefore:42,maxHpAfter:53,abilityBefore:{str:18,dex:14,con:16,int:10,wis:12,cha:8},abilityAfter:{str:20,dex:14,con:16,int:10,wis:12,cha:8},proficiencyBefore:3,proficiencyAfter:3,hitDiceBefore:"5d10",hitDiceAfter:"6d10",grantedFeatures:[],resourceChanges:[],actionChanges:[],spellChanges:[],diffs:[]},
    validation:[{severity:"info",message:"computed preview"}],
  };
}

test("creation autosave projection contains source intent but excludes derived/validation caches", () => {
  const intent = projectCreationDraftIntentV1(creationDraft(),{});
  const text = JSON.stringify(intent);
  assert.equal(intent.name,"Draft Hero");
  assert.deepEqual(intent.choiceSelections,{"class.style":["style.defense"]});
  for (const forbidden of ["derived","validation","finalAbilities","goldGp","importStatus","importMessage","creationPlan"]) {
    assert.equal(text.includes(`\"${forbidden}\"`),false,forbidden);
  }
});

test("progression autosave projection keeps canonical inputs/base source revision but excludes preview and legacy mirror fields", () => {
  const intent = projectProgressionDraftIntentV1(progressionDraft(),7);
  const text = JSON.stringify(intent);
  assert.equal(intent.baseSourceRevision,7);
  assert.equal(intent.hpRoll,8);
  assert.ok(intent.progressionSelections["progression.dnd.srd521.class.fighter.6.asi"]);
  for (const forbidden of ["preview","validation","hpGain","fromLevel","toLevel","asiMode","asiPrimary","asiSecondary","featId","progressionPlan"]) {
    assert.equal(text.includes(`\"${forbidden}\"`),false,forbidden);
  }
});

test("authoring draft repository persists creation/progression independently and skips no-op generations", async () => {
  const store = new MemoryAuthoringDraftStore();
  const repository = new AuthoringDraftRepository(store);
  await repository.hydrate();
  const creation = projectCreationDraftIntentV1(creationDraft(),{});
  const first = await repository.commit({creation});
  assert.equal(first.document.storageRevision,1);
  const noOp = await repository.commit({creation});
  assert.equal(noOp.document.storageRevision,1);
  assert.equal((await store.readGenerations()).length,1);
  const progression = projectProgressionDraftIntentV1(progressionDraft(),7);
  const second = await repository.commit({progression});
  assert.equal(second.document.storageRevision,2);
  assert.equal(second.document.creation?.draftId,"draft.new");
  assert.equal(second.document.progression?.baseSourceRevision,7);
});

test("stale authoring draft writers cannot overwrite a newer generation", async () => {
  const store = new MemoryAuthoringDraftStore();
  const first = new AuthoringDraftRepository(store);
  const stale = new AuthoringDraftRepository(store);
  await first.hydrate();
  await stale.hydrate();
  await first.commit({creation:projectCreationDraftIntentV1(creationDraft(),{})});
  await assert.rejects(
    () => stale.commit({progression:projectProgressionDraftIntentV1(progressionDraft(),7)}),
    /stale authoring draft generation/,
  );
});

test("corrupt newest authoring draft generation recovers from previous valid generation", async () => {
  const store = new MemoryAuthoringDraftStore();
  const writer = new AuthoringDraftRepository(store);
  await writer.hydrate();
  const creation = projectCreationDraftIntentV1(creationDraft(),{});
  await writer.commit({creation});
  store.seed(2,"{broken");
  const reader = new AuthoringDraftRepository(store);
  const recovered = await reader.hydrate();
  assert.equal(recovered.physicalGeneration,2);
  assert.equal(recovered.loadedGeneration,1);
  assert.equal(recovered.recoveredFromOlderGeneration,true);
  assert.equal(recovered.document.creation?.draftId,"draft.new");
});

test("all-corrupt authoring draft generations are an explicit blocker", async () => {
  const store = new MemoryAuthoringDraftStore();
  store.seed(1,"{broken");
  const repository = new AuthoringDraftRepository(store);
  await assert.rejects(() => repository.hydrate(),AuthoringDraftCorruptError);
});

test("newer authoring draft schema is a migration blocker instead of older-generation fallback", async () => {
  const store = new MemoryAuthoringDraftStore();
  const initial = {
    schemaId:"simplevtt.authoring-drafts" as const,schemaVersion:1 as const,storageRevision:1,creation:null,progression:null,
  };
  store.seed(1,encodeAuthoringDraftsV1(initial));
  store.seed(2,JSON.stringify({...initial,schemaVersion:2,storageRevision:2}));
  const repository = new AuthoringDraftRepository(store);
  await assert.rejects(
    () => repository.hydrate(),
    (error:unknown) => error instanceof AuthoringDraftMigrationRequiredError && error.schemaVersion === 2,
  );
  assert.throws(() => decodeAuthoringDrafts(JSON.stringify({...initial,schemaVersion:2})),AuthoringDraftMigrationRequiredError);
});
