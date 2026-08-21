import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import "../../src/app/characterCreationV10Adapter";
import "../../src/app/progressionPhase08RogueThiefAdapter";
import { classIdFromName, classMeta } from "../../src/app/characterCreationV10Data";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { AppSnapshot, CharacterCreationSection } from "../../src/app/contracts";
import type { Phase07AdapterCommands } from "../../src/app/progressionRuntimeAdapter";
import type { ProgressionCharacterState, ProgressionRequest } from "../../src/domain/progression";
import { buildProgressionPlanPhase08RogueThief } from "../../src/domain/progressionPhase08RogueThief";
import { PROGRESSION_CATALOG, progressionRow, proficiencyBonusForTotalLevel } from "../../src/domain/progressionCatalog";
import { MONK_OPEN_HAND_CLASS_ID } from "../../src/domain/monkOpenHand";
import { srdSubclassIdForClass } from "../../src/domain/srdSubclassCatalog";

const monkId = MONK_OPEN_HAND_CLASS_ID;
type FixtureState = { activeCharacter:AppSnapshot["activeCharacter"] };
type MatrixState = ProgressionCharacterState & { subclassIds?:Record<string,string> };

async function monkAdapter(level:number) {
  const adapter = new MockAdapter();
  const baseline = (await adapter.getSnapshot()).activeCharacter;
  const internal = adapter as unknown as FixtureState;
  internal.activeCharacter = {
    ...baseline,
    className:"몽크",
    subclassName:undefined,
    level,
    hp:8 + Math.max(0,level - 1) * 7,
    maxHp:8 + Math.max(0,level - 1) * 7,
    proficiencyBonus:level >= 5 ? 3 : 2,
    abilities:{ str:10,dex:16,con:14,int:10,wis:16,cha:8 },
    skills:["곡예","통찰"],
    features:level >= 2
      ? ["무예","비무장 방어","몽크의 기","비무장 이동","경이로운 신진대사"]
      : ["무예","비무장 방어"],
    classLevels:[{ classId:monkId,className:"몽크",level }],
    hitDiceByDie:{ d8:level },
    progressionRevision:level - 1,
    subclassIds:{},
    subclassSources:{},
    subclassFeatureIds:[],
    subclassFeatureSources:{},
  };
  return { adapter, internal };
}

async function completeCreatedMonk(adapter:MockAdapter) {
  await adapter.createCharacterDraft("guided");
  await adapter.updateCharacterDraft({ type:"set-name", value:"Progression Monk" });
  await adapter.updateCharacterDraft({ type:"set-species", value:"드워프" });
  await adapter.updateCharacterDraft({ type:"set-background", value:"범죄자" });
  await adapter.updateCharacterDraft({ type:"set-class", value:"몽크" });
  await adapter.updateCharacterDraft({ type:"apply-recommended-array" });

  for (let pass = 0; pass < 40; pass += 1) {
    const snapshot = await adapter.getSnapshot();
    const draft = snapshot.createDraft;
    const plan = snapshot.creationPlan;
    assert.ok(draft && plan,"creation draft/plan must exist");
    let changed = false;

    const skills = plan.sections.find((section) => section.id === "proficiencies");
    if (skills?.status === "incomplete") {
      const count = classMeta(classIdFromName(draft.className)).semantics.skills.count;
      for (const option of skills.options.filter((item) => !item.selected).slice(0,Math.max(0,count - draft.selectedSkills.length))) {
        await adapter.updateCharacterDraft({ type:"toggle-skill", value:option.name });
        changed = true;
      }
    }

    const equipment = plan.sections.find((section) => section.id === "class-equipment");
    if (equipment?.status === "incomplete" && equipment.options[0]) {
      await adapter.updateCharacterDraft({ type:"set-equipment", value:equipment.options[0].id });
      changed = true;
    }

    const current = await adapter.getSnapshot();
    const dynamic = (current.creationPlan?.sections ?? []).filter(
      (section) => section.kind === "dynamic-choice" && section.status === "incomplete" && section.selection,
    ) as Array<CharacterCreationSection & { selection:{ choiceId:string; count:number } }>;
    for (const section of dynamic) {
      const selectedCount = section.options.filter((option) => option.selected).length;
      const ids = section.options.filter((option) => !option.selected).slice(0,Math.max(0,section.selection.count - selectedCount)).map((option) => option.id);
      for (const id of ids) {
        await adapter.updateCharacterDraft({ type:"toggle-class-choice", choiceId:section.selection.choiceId, value:id });
        changed = true;
      }
    }

    const after = await adapter.getSnapshot();
    if ((after.creationPlan?.summary.blockingCount ?? 1) === 0) {
      await adapter.finalizeCharacterDraft();
      return adapter.getSnapshot();
    }
    if (!changed) assert.fail(`unable to complete Monk creation: ${after.creationPlan?.validation.map((item) => item.message).join(" | ")}`);
  }
  assert.fail("Monk creation completion exceeded 40 passes");
}

function choiceKinds(snapshot:AppSnapshot) {
  return (snapshot.progressionPlan?.choices ?? []).map((choice) => [choice.id,choice.kind,choice.required] as const);
}

function matrixState(classId:string,targetLevel:number):MatrixState {
  const definition = PROGRESSION_CATALOG.classes.find((entry) => entry.id === classId)!;
  const currentLevel = targetLevel - 1;
  const subclassId = currentLevel >= 3 ? srdSubclassIdForClass(classId) : undefined;
  return {
    revision:7000 + targetLevel,
    id:`choice-schedule:${definition.slug}:${currentLevel}`,
    name:`Choice Schedule ${definition.nameEn}`,
    totalLevel:currentLevel,
    abilities:{ str:18,dex:18,con:18,int:18,wis:18,cha:18 },
    hpCurrent:20 + currentLevel * 6,
    hpMaximum:20 + currentLevel * 6,
    proficiencyBonus:proficiencyBonusForTotalLevel(currentLevel),
    classTracks:[{
      classId,
      className:definition.nameKo,
      level:currentLevel,
      ...(currentLevel >= 3 ? { subclassName:definition.srdSubclassName } : {}),
    }],
    hitDiceByDie:{ [`d${definition.hitDie}`]:currentLevel },
    features:[...(currentLevel >= 3 ? [definition.srdSubclassName] : [])],
    proficientSkills:["운동","곡예","비전","역사","통찰","지각","은신","설득"],
    expertiseSkills:[],
    expertiseSources:{},
    languages:["공용어"],
    languageSources:{},
    cantripIds:[],
    cantripSources:{},
    preparedSpellIds:[],
    preparedSpellSources:{},
    spellbookSpellIds:[],
    spellbookSpellSources:{},
    spellMasterySpellIds:{},
    spellMasterySources:{},
    signatureSpellIds:[],
    signatureSpellSources:{},
    metamagicIds:[],
    metamagicSources:{},
    eldritchInvocationIds:[],
    eldritchInvocationSources:{},
    mysticArcanumSpellIds:{},
    mysticArcanumSources:{},
    pactMagicSlotLevel:0,
    pactMagicSlotMaximum:0,
    spellSlotMaximums:{},
    weaponMasteryIds:[],
    weaponMasterySources:{},
    fightingStyleFeatIds:[],
    fightingStyleFeatSources:{},
    subclassIds:subclassId ? { [classId]:subclassId } : {},
    subclassFeatureIds:[],
    subclassFeatureSources:{},
  } as MatrixState;
}

function matrixRequest(state:MatrixState,classId:string):ProgressionRequest {
  return {
    expectedRevision:state.revision,
    targetClassId:classId,
    hpMethod:"fixed",
    selections:{},
    featOptions:[],
    originFeatOptions:[],
    fightingStyleOptions:[],
    druidCantripOptions:[],
    clericCantripOptions:[],
    languageOptions:[],
    spellOptions:[],
  };
}

const STANDARD_ASI_LEVELS = new Set([4,8,12,16]);
const FIGHTER_ASI_LEVELS = new Set([4,6,8,12,14,16]);
const ROGUE_ASI_LEVELS = new Set([4,8,10,12,16]);
function expectedAsi(classId:string,level:number) {
  if (classId === "dnd.srd521.class.fighter") return FIGHTER_ASI_LEVELS.has(level);
  if (classId === "dnd.srd521.class.rogue") return ROGUE_ASI_LEVELS.has(level);
  return STANDARD_ASI_LEVELS.has(level);
}

function isSubclassUnlockFeature(feature:string) {
  return feature.includes("서브클래스") && !feature.includes("특성");
}

test("production source preserves the LevelUpV10Bridge host without hidden Vite route rewriting", () => {
  const appSource = readFileSync(new URL("../../src/App.tsx",import.meta.url),"utf8");
  const viteSource = readFileSync(new URL("../../vite.config.ts",import.meta.url),"utf8");
  const mainSource = readFileSync(new URL("../../src/main.tsx",import.meta.url),"utf8");
  assert.match(appSource,/route === "levelup" && <LevelUpScreen/);
  assert.match(mainSource,/LevelUpV10Bridge/);
  assert.doesNotMatch(viteSource,/simplevtt-character-progression-routes|Expected legacy LevelUpScreen route was not found|LevelUpFocused/);
});

test("canonical generated Monk rows keep subclass and ASI at their exact SRD unlock levels", () => {
  assert.deepEqual(progressionRow(monkId,2)?.features,["몽크의 기","비무장 이동","경이로운 신진대사"]);
  assert.deepEqual(progressionRow(monkId,3)?.features,["공격 흘리기","서브클래스"]);
  assert.deepEqual(progressionRow(monkId,4)?.features,["능력치 향상","낙하 완화"]);
});

test("all 12 SRD classes expose ASI and subclass choices only at their canonical unlock levels", () => {
  for (const definition of PROGRESSION_CATALOG.classes) {
    for (let targetLevel = 2; targetLevel <= 20; targetLevel += 1) {
      const expectAsi = expectedAsi(definition.id,targetLevel);
      const expectSubclass = targetLevel === 3;
      const row = progressionRow(definition.id,targetLevel);
      assert.ok(row,`${definition.nameKo} ${targetLevel}: progression row missing`);
      assert.equal(row!.features.includes("능력치 향상"),expectAsi,`${definition.nameKo} ${targetLevel}: canonical row ASI mismatch`);
      assert.equal(row!.features.some(isSubclassUnlockFeature),expectSubclass,`${definition.nameKo} ${targetLevel}: canonical row subclass mismatch`);

      const state = matrixState(definition.id,targetLevel);
      const plan = buildProgressionPlanPhase08RogueThief(state,matrixRequest(state,definition.id));
      const asi = plan.choices.filter((choice) => choice.kind === "asi-or-feat");
      const subclass = plan.choices.filter((choice) => choice.kind === "subclass");
      assert.equal(asi.length,expectAsi ? 1 : 0,`${definition.nameKo} ${targetLevel}: phantom/missing ASI choices ${JSON.stringify(asi.map((choice) => choice.id))}`);
      assert.equal(subclass.length,expectSubclass ? 1 : 0,`${definition.nameKo} ${targetLevel}: phantom/missing subclass choices ${JSON.stringify(subclass.map((choice) => choice.id))}`);
      if (expectAsi) assert.equal(asi[0]?.id,`progression.${definition.id}.${targetLevel}.asi`);
      if (expectSubclass) assert.equal(subclass[0]?.id,`progression.${definition.id}.3.subclass`);
    }
  }
});

test("a newly created Monk hands off to progression metadata without a level-2 phantom ASI", async () => {
  const adapter = new MockAdapter();
  let snapshot = await completeCreatedMonk(adapter);
  assert.equal(snapshot.activeCharacter.className,"몽크");
  assert.equal(snapshot.activeCharacter.level,1);
  assert.equal(snapshot.activeCharacter.classLevels?.[0]?.classId,monkId);
  await adapter.startLevelUp(snapshot.activeCharacter.id);
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.progressionPlan?.targetClassLevel,2);
  assert.equal(snapshot.progressionPlan?.choices.some((choice) => choice.kind === "asi-or-feat"),false,JSON.stringify(choiceKinds(snapshot)));
  assert.equal(snapshot.progressionPlan?.choices.some((choice) => choice.kind === "subclass"),false,JSON.stringify(choiceKinds(snapshot)));
});

test("final app adapter plan has no phantom ASI at Monk 2 and requires subclass exactly at Monk 3", async () => {
  const { adapter, internal } = await monkAdapter(1);
  await adapter.startLevelUp(internal.activeCharacter.id);
  let snapshot = await adapter.getSnapshot();

  assert.equal(snapshot.progressionPlan?.targetClassLevel,2);
  assert.equal(snapshot.progressionPlan?.choices.some((choice) => choice.kind === "asi-or-feat"),false,JSON.stringify(choiceKinds(snapshot)));
  assert.equal(snapshot.progressionPlan?.choices.some((choice) => choice.kind === "subclass"),false,JSON.stringify(choiceKinds(snapshot)));
  assert.deepEqual(snapshot.progressionPlan?.blocking,[]);

  await adapter.commitLevelUp();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.level,2);

  await adapter.startLevelUp(snapshot.activeCharacter.id);
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.progressionPlan?.targetClassLevel,3);
  assert.equal(snapshot.progressionPlan?.choices.some((choice) => choice.kind === "asi-or-feat"),false,JSON.stringify(choiceKinds(snapshot)));
  const subclassChoices = snapshot.progressionPlan?.choices.filter((choice) => choice.kind === "subclass") ?? [];
  assert.equal(subclassChoices.length,1,JSON.stringify(choiceKinds(snapshot)));
  assert.equal(subclassChoices[0]?.id,`progression.${monkId}.3.subclass`);
  assert.equal(subclassChoices[0]?.required,true);
  assert.ok(snapshot.progressionPlan?.blocking.some((message) => /서브클래스 선택이 필요/.test(message)),JSON.stringify(snapshot.progressionPlan?.blocking));

  const subclassId = subclassChoices[0].options[0]?.id;
  assert.ok(subclassId);
  await (adapter as unknown as Phase07AdapterCommands).setProgressionChoice(subclassChoices[0].id,{ kind:"options", optionIds:[subclassId] });
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.progressionPlan?.blocking.some((message) => /서브클래스 선택이 필요/.test(message)),false);
});
