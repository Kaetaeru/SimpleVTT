import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/progressionPhase08FighterStyleAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { Phase07AdapterCommands } from "../../src/app/progressionRuntimeAdapter";
import {
  fighterFightingStyleChoiceId,
  FIGHTER_FIGHTING_STYLE_CLASS_ID,
} from "../../src/domain/fighterFightingStyleProgression";
import { ROGUE_ID, weaponMasteryChoiceId } from "../../src/domain/weaponMasteryProgression";

const ARCHERY = "dnd.srd521.feat.fighting-style.archery";
const GREAT_SWORD = "dnd.srd521.item.weapon.greatsword";
const LONG_SWORD = "dnd.srd521.item.weapon.longsword";
const LONG_BOW = "dnd.srd521.item.weapon.longbow";

test("multiclassing into Fighter 1 materializes Fighting Style and three Weapon Masteries in one runtime level-up", async () => {
  const adapter = new MockAdapter();
  const baseline = (await adapter.getSnapshot()).activeCharacter;
  const internal = adapter as unknown as { activeCharacter:typeof baseline };
  internal.activeCharacter = {
    ...baseline,
    className:"로그",
    level:1,
    hp:10,
    maxHp:10,
    proficiencyBonus:2,
    abilities:{ str:10, dex:16, con:14, int:13, wis:10, cha:8 },
    features:["암습","교활한 행동"],
    classLevels:[{ classId:ROGUE_ID, className:"로그", level:1 }],
    hitDiceByDie:{ d8:1 },
    progressionRevision:2,
    weaponMasteryIds:[],
    weaponMasterySources:{},
    fightingStyleFeatIds:[],
    fightingStyleFeatSources:{},
  };

  await adapter.startLevelUp(internal.activeCharacter.id);
  const commands = adapter as unknown as Phase07AdapterCommands;
  await commands.setProgressionTargetClass(FIGHTER_FIGHTING_STYLE_CLASS_ID);
  let snapshot = await adapter.getSnapshot();
  const styleId = fighterFightingStyleChoiceId(1);
  const masteryId = weaponMasteryChoiceId(FIGHTER_FIGHTING_STYLE_CLASS_ID,1);
  const style = snapshot.progressionPlan?.choices.find((choice) => choice.id === styleId);
  const mastery = snapshot.progressionPlan?.choices.find((choice) => choice.id === masteryId);
  assert.ok(style);
  assert.equal(style?.status,"ready");
  assert.ok(style?.options.some((option) => option.id === ARCHERY && option.label === "궁술"));
  assert.ok(mastery);
  assert.equal(mastery?.status,"ready");
  assert.equal(mastery?.count,3);
  assert.ok(snapshot.progressionPlan?.blocking.some((message) => /전투 방식 선택/.test(message)));
  assert.ok(snapshot.progressionPlan?.blocking.some((message) => /무기 통달/.test(message)));
  assert.ok(!snapshot.progressionPlan?.blocking.some((message) => /catalog relationship/.test(message)));

  await commands.setProgressionChoice(styleId,{ kind:"options", optionIds:[ARCHERY] });
  await commands.setProgressionChoice(masteryId,{ kind:"options", optionIds:[GREAT_SWORD,LONG_SWORD,LONG_BOW] });
  snapshot = await adapter.getSnapshot();
  assert.deepEqual(snapshot.progressionPlan?.blocking,[]);

  await adapter.commitLevelUp();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.level,2);
  assert.ok(snapshot.activeCharacter.classLevels?.some((track) => track.classId === FIGHTER_FIGHTING_STYLE_CLASS_ID && track.level === 1));
  assert.deepEqual(snapshot.activeCharacter.fightingStyleFeatIds,[ARCHERY]);
  assert.match(snapshot.activeCharacter.fightingStyleFeatSources?.[ARCHERY] ?? "",/파이터 1레벨 · 전투 방식/);
  assert.deepEqual(snapshot.activeCharacter.weaponMasteryIds,[GREAT_SWORD,LONG_SWORD,LONG_BOW]);
  assert.equal(snapshot.activeCharacter.progressionRevision,3);
});
