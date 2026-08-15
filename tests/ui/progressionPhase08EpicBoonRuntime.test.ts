import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/progressionPhase08EpicBoonAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { Phase07AdapterCommands } from "../../src/app/progressionRuntimeAdapter";
import { epicBoonAbilityChoiceId, epicBoonChoiceId } from "../../src/domain/epicBoonProgression";

const FIGHTER_ID = "dnd.srd521.class.fighter";
const COMBAT_PROWESS = "dnd.srd521.feat.epic.combat-prowess";
const SPELL_RECALL = "dnd.srd521.feat.epic.spell-recall";

test("Fighter 18 to 19 runtime materializes Epic Boon choices and commits stable feat id plus Constitution HP growth", async () => {
  const adapter = new MockAdapter();
  const baseline = (await adapter.getSnapshot()).activeCharacter;
  const internal = adapter as unknown as { activeCharacter:typeof baseline };
  internal.activeCharacter = {
    ...baseline,
    className:"파이터",
    subclassName:"챔피언",
    level:18,
    hp:180,
    maxHp:180,
    proficiencyBonus:6,
    abilities:{ str:20, dex:14, con:19, int:10, wis:12, cha:8 },
    features:["추가 공격","불굴","챔피언"],
    classLevels:[{ classId:FIGHTER_ID, className:"파이터", level:18, subclassName:"챔피언" }],
    hitDiceByDie:{ d10:18 },
    progressionRevision:4,
    epicBoonFeatIds:[],
    epicBoonFeatSources:{},
  };

  await adapter.startLevelUp(internal.activeCharacter.id);
  let snapshot = await adapter.getSnapshot();
  const parentId = epicBoonChoiceId(FIGHTER_ID,19);
  const parent = snapshot.progressionPlan?.choices.find((choice) => choice.id === parentId);
  assert.ok(parent);
  assert.equal(parent?.status,"ready");
  assert.equal(parent?.options.length,7);
  assert.match(parent?.options.find((option) => option.id === SPELL_RECALL)?.disabledReason ?? "",/Spellcasting feature/);
  assert.ok(!snapshot.progressionPlan?.blocking.some((message) => /catalog relationship/.test(message)));

  const commands = adapter as unknown as Phase07AdapterCommands;
  await commands.setProgressionChoice(parentId,{ kind:"options", optionIds:[COMBAT_PROWESS] });
  snapshot = await adapter.getSnapshot();
  const abilityId = epicBoonAbilityChoiceId(FIGHTER_ID,19);
  const abilityChoice = snapshot.progressionPlan?.choices.find((choice) => choice.id === abilityId);
  assert.ok(abilityChoice);
  assert.ok(abilityChoice?.options.some((option) => option.id === "ability:con"));
  await commands.setProgressionChoice(abilityId,{ kind:"options", optionIds:["ability:con"] });
  snapshot = await adapter.getSnapshot();
  assert.deepEqual(snapshot.progressionPlan?.blocking,[]);
  assert.equal(snapshot.progressionPlan?.diffs.find((diff) => diff.label === "최대 HP")?.after,"209");

  await adapter.commitLevelUp();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.level,19);
  assert.equal(snapshot.activeCharacter.abilities.con,20);
  assert.equal(snapshot.activeCharacter.maxHp,209);
  assert.equal(snapshot.activeCharacter.hp,180);
  assert.deepEqual(snapshot.activeCharacter.epicBoonFeatIds,[COMBAT_PROWESS]);
  assert.match(snapshot.activeCharacter.epicBoonFeatSources?.[COMBAT_PROWESS] ?? "",/에픽 은총/);
  assert.ok(snapshot.activeCharacter.features.includes("전투 기량의 은총"));
  const sceneEntity = snapshot.scene.entities.find((entity) => entity.id === snapshot.activeCharacter.id);
  assert.equal(sceneEntity?.maxHp,209);
  assert.equal(snapshot.activeCharacter.progressionRevision,5);
});
