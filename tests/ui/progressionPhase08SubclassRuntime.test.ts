import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/progressionPhase08SubclassAdapter";
import "../../src/app/progressionPhase08MonkOpenHandAdapter";
import "../../src/app/progressionPhase08RogueThiefAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { AppSnapshot } from "../../src/app/contracts";
import type { Phase07AdapterCommands } from "../../src/app/progressionRuntimeAdapter";
import { FIGHTER_CHAMPION_SUBCLASS_ID } from "../../src/domain/fighterChampion";
import { FIGHTER_FIGHTING_STYLE_CLASS_ID, fighterFightingStyleReplacementChoiceId } from "../../src/domain/fighterFightingStyleProgression";
import {
  MONK_OPEN_HAND_CLASS_ID,
  OPEN_HAND_WHOLENESS_OF_BODY_FEATURE_ID,
} from "../../src/domain/monkOpenHand";
import {
  ROGUE_THIEF_CLASS_ID,
  THIEF_SUPREME_SNEAK_FEATURE_ID,
} from "../../src/domain/rogueThief";
import { MONK_OPEN_HAND_SUBCLASS_ID, ROGUE_THIEF_SUBCLASS_ID } from "../../src/domain/srdSubclassCatalog";
import { subclassFeatureChoiceId } from "../../src/domain/srdSubclassProgression";

const ARCHERY = "dnd.srd521.feat.fighting-style.archery";
const DEFENSE = "dnd.srd521.feat.fighting-style.defense";
type FixtureState = { activeCharacter:AppSnapshot["activeCharacter"]; scene:AppSnapshot["scene"] };

function syncSceneHp(internal:FixtureState) {
  const entity = internal.scene.entities.find((entry) => entry.id === internal.activeCharacter.id);
  if (!entity) return;
  entity.hp = internal.activeCharacter.hp;
  entity.maxHp = internal.activeCharacter.maxHp;
  entity.tempHp = internal.activeCharacter.tempHp;
}

async function champion6Adapter() {
  const adapter = new MockAdapter();
  const baseline = (await adapter.getSnapshot()).activeCharacter;
  const internal = adapter as unknown as FixtureState;
  internal.activeCharacter = {
    ...baseline,
    className:"파이터",
    subclassName:"챔피언",
    level:6,
    hp:64,
    maxHp:64,
    proficiencyBonus:3,
    abilities:{ str:18, dex:14, con:16, int:10, wis:10, cha:8 },
    features:["전투 방식","재기의 바람","행동 폭증","챔피언","향상된 치명타","비범한 운동선수"],
    classLevels:[{ classId:FIGHTER_FIGHTING_STYLE_CLASS_ID, className:"파이터", level:6, subclassName:"챔피언" }],
    hitDiceByDie:{ d10:6 },
    progressionRevision:15,
    weaponMasteryIds:[
      "dnd.srd521.item.weapon.greatsword",
      "dnd.srd521.item.weapon.longsword",
      "dnd.srd521.item.weapon.longbow",
      "dnd.srd521.item.weapon.rapier",
    ],
    weaponMasterySources:{},
    fightingStyleFeatIds:[ARCHERY],
    fightingStyleFeatSources:{ [ARCHERY]:"파이터 1레벨 · 전투 방식" },
    subclassIds:{ [FIGHTER_FIGHTING_STYLE_CLASS_ID]:FIGHTER_CHAMPION_SUBCLASS_ID },
    subclassSources:{ [FIGHTER_FIGHTING_STYLE_CLASS_ID]:"SRD 5.2.1 · 파이터 · 챔피언" },
    subclassFeatureIds:[
      "dnd.srd521.feature.fighter.champion.improved-critical",
      "dnd.srd521.feature.fighter.champion.remarkable-athlete",
    ],
    subclassFeatureSources:{},
  };
  syncSceneHp(internal);
  return { adapter, internal };
}

async function openHand5Adapter() {
  const adapter = new MockAdapter();
  const baseline = (await adapter.getSnapshot()).activeCharacter;
  const internal = adapter as unknown as FixtureState;
  internal.activeCharacter = {
    ...baseline,
    className:"수도승",
    subclassName:"열린 손의 전사",
    level:5,
    hp:38,
    maxHp:38,
    proficiencyBonus:3,
    abilities:{ str:10, dex:18, con:14, int:10, wis:16, cha:8 },
    features:["무술","기","열린 손의 전사"],
    classLevels:[{ classId:MONK_OPEN_HAND_CLASS_ID, className:"수도승", level:5, subclassName:"열린 손의 전사" }],
    hitDiceByDie:{ d8:5 },
    progressionRevision:30,
    subclassIds:{ [MONK_OPEN_HAND_CLASS_ID]:MONK_OPEN_HAND_SUBCLASS_ID },
    subclassSources:{ [MONK_OPEN_HAND_CLASS_ID]:"SRD 5.2.1 · 수도승 · 열린 손의 전사" },
    subclassFeatureIds:[],
    subclassFeatureSources:{},
  };
  syncSceneHp(internal);
  return { adapter, internal };
}

async function thief8Adapter() {
  const adapter = new MockAdapter();
  const baseline = (await adapter.getSnapshot()).activeCharacter;
  const internal = adapter as unknown as FixtureState;
  internal.activeCharacter = {
    ...baseline,
    className:"로그",
    subclassName:"도둑",
    level:8,
    hp:51,
    maxHp:51,
    proficiencyBonus:3,
    abilities:{ str:10, dex:18, con:14, int:14, wis:12, cha:10 },
    features:["암습","교활한 행동","도둑"],
    classLevels:[{ classId:ROGUE_THIEF_CLASS_ID, className:"로그", level:8, subclassName:"도둑" }],
    hitDiceByDie:{ d8:8 },
    progressionRevision:40,
    subclassIds:{ [ROGUE_THIEF_CLASS_ID]:ROGUE_THIEF_SUBCLASS_ID },
    subclassSources:{ [ROGUE_THIEF_CLASS_ID]:"SRD 5.2.1 · 로그 · 도둑" },
    subclassFeatureIds:[],
    subclassFeatureSources:{},
  };
  syncSceneHp(internal);
  return { adapter, internal };
}

test("Champion 6 to 7 exposes Additional Fighting Style as a real required subclass choice and commits it without replacing the existing style", async () => {
  const { adapter, internal } = await champion6Adapter();
  await adapter.startLevelUp(internal.activeCharacter.id);
  let snapshot = await adapter.getSnapshot();
  const subclassChoiceId = subclassFeatureChoiceId(FIGHTER_FIGHTING_STYLE_CLASS_ID,7);
  const subclassChoice = snapshot.progressionPlan?.choices.find((choice) => choice.id === subclassChoiceId);
  assert.ok(subclassChoice);
  assert.equal(subclassChoice?.label,"추가 전투 방식");
  assert.equal(subclassChoice?.status,"ready");
  assert.equal(subclassChoice?.options.find((option) => option.id === ARCHERY)?.disabledReason,"이미 보유한 전투 방식 재주입니다.");
  assert.equal(subclassChoice?.options.find((option) => option.id === DEFENSE)?.disabledReason,undefined);
  assert.ok(snapshot.progressionPlan?.blocking.some((message) => /추가 전투 방식 선택이 필요/.test(message)));
  assert.ok(!snapshot.progressionPlan?.blocking.some((message) => /서브클래스별 고레벨 mechanics relationship/.test(message)));

  const replacement = snapshot.progressionPlan?.choices.find((choice) => choice.id === fighterFightingStyleReplacementChoiceId(7));
  assert.ok(replacement,"ordinary Fighter level-up still offers the separate optional Fighting Style replacement");
  assert.equal(replacement?.required,false);

  const commands = adapter as unknown as Phase07AdapterCommands;
  await commands.setProgressionChoice(subclassChoiceId,{ kind:"options", optionIds:[DEFENSE] });
  snapshot = await adapter.getSnapshot();
  assert.deepEqual(snapshot.progressionPlan?.blocking,[]);
  assert.ok(snapshot.progressionPlan?.diffs.some((diff) => diff.label === "서브클래스 특성 · 추가 전투 방식" && diff.after === "방어"));

  await adapter.commitLevelUp();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.level,7);
  assert.deepEqual(snapshot.activeCharacter.fightingStyleFeatIds,[ARCHERY,DEFENSE]);
  assert.ok(snapshot.activeCharacter.features.includes("방어"));
  assert.ok(snapshot.activeCharacter.features.includes("추가 전투 방식"));
  assert.ok(snapshot.activeCharacter.subclassFeatureIds?.includes("dnd.srd521.feature.fighter.champion.additional-fighting-style"));
  assert.equal(snapshot.activeCharacter.progressionRevision,16);
});

test("Champion automatic subclass features no longer surface a fake catalog choice", async () => {
  const { adapter, internal } = await champion6Adapter();
  internal.activeCharacter.level = 9;
  internal.activeCharacter.classLevels = [{ classId:FIGHTER_FIGHTING_STYLE_CLASS_ID, className:"파이터", level:9, subclassName:"챔피언" }];
  internal.activeCharacter.hitDiceByDie = { d10:9 };
  internal.activeCharacter.proficiencyBonus = 4;
  internal.activeCharacter.progressionRevision = 20;
  await adapter.startLevelUp(internal.activeCharacter.id);
  let snapshot = await adapter.getSnapshot();
  const mastery = snapshot.progressionPlan?.choices.find((choice) => choice.id.endsWith(".column.무기 통달"));
  assert.ok(mastery,"Fighter 10 still gets the real Weapon Mastery increase");
  const commands = adapter as unknown as Phase07AdapterCommands;
  await commands.setProgressionChoice(mastery!.id,{ kind:"options", optionIds:["dnd.srd521.item.weapon.shortbow"] });
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.progressionPlan?.choices.some((choice) => choice.id === subclassFeatureChoiceId(FIGHTER_FIGHTING_STYLE_CLASS_ID,10)),false);
  assert.ok(snapshot.progressionPlan?.diffs.some((diff) => diff.label === "서브클래스 특성" && diff.after === "영웅적 전사"));
  assert.deepEqual(snapshot.progressionPlan?.blocking,[]);

  await adapter.commitLevelUp();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.level,10);
  assert.ok(snapshot.activeCharacter.subclassFeatureIds?.includes("dnd.srd521.feature.fighter.champion.heroic-warrior"));
  assert.ok(snapshot.activeCharacter.features.includes("영웅적 전사"));
});

test("Open Hand Monk 5 to 6 removes the generic subclass blocker and persists Wholeness of Body through the outermost runtime adapter", async () => {
  const { adapter, internal } = await openHand5Adapter();
  await adapter.startLevelUp(internal.activeCharacter.id);
  let snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.progressionPlan?.choices.some((choice) => choice.status === "catalog-pending"),false);
  assert.equal(snapshot.progressionPlan?.choices.some((choice) => choice.id === subclassFeatureChoiceId(MONK_OPEN_HAND_CLASS_ID,6)),false);
  assert.ok(snapshot.progressionPlan?.diffs.some((diff) => diff.label === "서브클래스 특성" && diff.after === "신체 완성"));
  assert.deepEqual(snapshot.progressionPlan?.blocking,[]);

  await adapter.commitLevelUp();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.level,6);
  assert.ok(snapshot.activeCharacter.subclassFeatureIds?.includes(OPEN_HAND_WHOLENESS_OF_BODY_FEATURE_ID));
  assert.ok(snapshot.activeCharacter.features.includes("신체 완성"));
  assert.equal(snapshot.activeCharacter.progressionRevision,31);
});

test("Thief Rogue 8 to 9 removes the final generic subclass blocker and persists Supreme Sneak through the outermost runtime adapter", async () => {
  const { adapter, internal } = await thief8Adapter();
  await adapter.startLevelUp(internal.activeCharacter.id);
  let snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.progressionPlan?.choices.some((choice) => choice.status === "catalog-pending"),false);
  assert.equal(snapshot.progressionPlan?.choices.some((choice) => choice.id === subclassFeatureChoiceId(ROGUE_THIEF_CLASS_ID,9)),false);
  assert.ok(snapshot.progressionPlan?.diffs.some((diff) => diff.label === "서브클래스 특성" && diff.after === "최고의 은신"));
  assert.deepEqual(snapshot.progressionPlan?.blocking,[]);

  await adapter.commitLevelUp();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.level,9);
  assert.ok(snapshot.activeCharacter.subclassFeatureIds?.includes(THIEF_SUPREME_SNEAK_FEATURE_ID));
  assert.ok(snapshot.activeCharacter.features.includes("최고의 은신"));
  assert.equal(snapshot.activeCharacter.progressionRevision,41);
});
