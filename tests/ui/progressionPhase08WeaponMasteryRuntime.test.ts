import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/progressionPhase08WeaponMasteryAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { Phase07AdapterCommands } from "../../src/app/progressionRuntimeAdapter";
import { FIGHTER_ID, weaponMasteryChoiceId } from "../../src/domain/weaponMasteryProgression";

const GREAT_SWORD = "dnd.srd521.item.weapon.greatsword";
const LONG_SWORD = "dnd.srd521.item.weapon.longsword";
const LONG_BOW = "dnd.srd521.item.weapon.longbow";
const RAPIER = "dnd.srd521.item.weapon.rapier";

test("Fighter 3 to 4 runtime replaces Weapon Mastery catalog-pending with canonical weapon options and persists the new mastery", async () => {
  const adapter = new MockAdapter();
  const baseline = (await adapter.getSnapshot()).activeCharacter;
  const internal = adapter as unknown as { activeCharacter:typeof baseline };
  internal.activeCharacter = {
    ...baseline,
    className:"파이터",
    subclassName:"챔피언",
    level:3,
    hp:30,
    maxHp:30,
    proficiencyBonus:2,
    abilities:{ str:16, dex:12, con:14, int:10, wis:10, cha:8 },
    features:["전투 방식","재기의 바람","행동 폭증","챔피언"],
    classLevels:[{ classId:FIGHTER_ID, className:"파이터", level:3, subclassName:"챔피언" }],
    hitDiceByDie:{ d10:3 },
    progressionRevision:7,
    weaponMasteryIds:[GREAT_SWORD,LONG_SWORD,LONG_BOW],
    weaponMasterySources:{
      [GREAT_SWORD]:"파이터 1레벨",
      [LONG_SWORD]:"파이터 1레벨",
      [LONG_BOW]:"파이터 1레벨",
    },
  };

  await adapter.startLevelUp(internal.activeCharacter.id);
  let snapshot = await adapter.getSnapshot();
  const masteryId = weaponMasteryChoiceId(FIGHTER_ID,4);
  const mastery = snapshot.progressionPlan?.choices.find((choice) => choice.id === masteryId);
  assert.ok(mastery);
  assert.equal(mastery?.status,"ready");
  assert.equal(mastery?.count,1);
  assert.equal(mastery?.options.length,38);
  assert.equal(mastery?.options.find((option) => option.id === GREAT_SWORD)?.disabledReason,"이미 무기 통달 대상으로 선택한 무기입니다.");
  assert.equal(mastery?.options.find((option) => option.id === RAPIER)?.label,"레이피어");
  assert.ok(!snapshot.progressionPlan?.blocking.some((message) => /무기 통달.*catalog/.test(message)));

  const commands = adapter as unknown as Phase07AdapterCommands;
  await commands.setProgressionChoice(`progression.${FIGHTER_ID}.4.asi`,{ kind:"asi", mode:"plus-two", primary:"str" });
  await commands.setProgressionChoice(masteryId,{ kind:"options", optionIds:[RAPIER] });
  snapshot = await adapter.getSnapshot();
  assert.deepEqual(snapshot.progressionPlan?.blocking,[]);
  assert.ok(snapshot.progressionPlan?.diffs.some((diff) => diff.label === "무기 통달" && diff.after.includes("레이피어")));

  await adapter.commitLevelUp();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.level,4);
  assert.equal(snapshot.activeCharacter.abilities.str,18);
  assert.deepEqual(snapshot.activeCharacter.weaponMasteryIds,[GREAT_SWORD,LONG_SWORD,LONG_BOW,RAPIER]);
  assert.match(snapshot.activeCharacter.weaponMasterySources?.[RAPIER] ?? "",/파이터 4레벨 · 무기 통달/);
  assert.equal(snapshot.activeCharacter.progressionRevision,8);
});
