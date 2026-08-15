import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/progressionPhase08RogueThiefAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { AppSnapshot } from "../../src/app/contracts";
import type { Phase07AdapterCommands } from "../../src/app/progressionRuntimeAdapter";
import { progressionRow } from "../../src/domain/progressionCatalog";
import { MONK_OPEN_HAND_CLASS_ID } from "../../src/domain/monkOpenHand";

const monkId = MONK_OPEN_HAND_CLASS_ID;
type FixtureState = { activeCharacter:AppSnapshot["activeCharacter"] };

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

test("canonical generated Monk rows keep subclass and ASI at their exact SRD unlock levels", () => {
  assert.deepEqual(progressionRow(monkId,2)?.features,["몽크의 기","비무장 이동","경이로운 신진대사"]);
  assert.deepEqual(progressionRow(monkId,3)?.features,["공격 흘리기","서브클래스"]);
  assert.deepEqual(progressionRow(monkId,4)?.features,["능력치 향상","낙하 완화"]);
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
