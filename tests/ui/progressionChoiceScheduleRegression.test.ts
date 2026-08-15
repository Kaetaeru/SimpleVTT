import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import "../../src/app/progressionPhase08RogueThiefAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { AppSnapshot } from "../../src/app/contracts";
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
  };
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

test("production route preserves the legacy host required by LevelUpV10Bridge instead of substituting unconditional ASI UI", () => {
  const viteSource = readFileSync(new URL("../../vite.config.ts",import.meta.url),"utf8");
  const mainSource = readFileSync(new URL("../../src/main.tsx",import.meta.url),"utf8");
  assert.doesNotMatch(viteSource,/LevelUpFocused/);
  assert.match(viteSource,/Expected legacy LevelUpScreen route was not found/);
  assert.match(mainSource,/LevelUpV10Bridge/);
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
      assert.equal(row!.features.includes("서브클래스"),expectSubclass,`${definition.nameKo} ${targetLevel}: canonical row subclass mismatch`);

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

  const optionId = subclassChoices[0]?.options.find((option) => !option.disabledReason)?.id;
  assert.ok(optionId,"Monk 3 subclass choice must expose an eligible SRD option");
  const commands = adapter as unknown as Phase07AdapterCommands;
  await commands.setProgressionChoice(subclassChoices[0]!.id,{ kind:"options",optionIds:[optionId!] });
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.progressionPlan?.blocking.some((message) => /서브클래스 선택이 필요/.test(message)),false,JSON.stringify(snapshot.progressionPlan?.blocking));

  await adapter.commitLevelUp();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.level,3);
  assert.ok(snapshot.activeCharacter.subclassName,"Monk 3 commit must persist the selected subclass presentation");

  await adapter.startLevelUp(snapshot.activeCharacter.id);
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.progressionPlan?.targetClassLevel,4);
  const asiChoices = snapshot.progressionPlan?.choices.filter((choice) => choice.kind === "asi-or-feat") ?? [];
  assert.equal(asiChoices.length,1,JSON.stringify(choiceKinds(snapshot)));
  assert.equal(asiChoices[0]?.id,`progression.${monkId}.4.asi`);
  assert.equal(snapshot.progressionPlan?.choices.some((choice) => choice.kind === "subclass"),false,JSON.stringify(choiceKinds(snapshot)));
});
