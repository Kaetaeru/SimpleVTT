import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/progressionPhase08BarbarianPrimalKnowledgeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { Phase07AdapterCommands } from "../../src/app/progressionRuntimeAdapter";
import {
  BARBARIAN_PRIMAL_KNOWLEDGE_CLASS_ID,
  barbarianPrimalKnowledgeChoiceId,
} from "../../src/domain/barbarianPrimalKnowledgeProgression";

test("Barbarian 2 to 3 runtime exposes Primal Knowledge skill options and persists the chosen proficiency", async () => {
  const adapter = new MockAdapter();
  const baseline = (await adapter.getSnapshot()).activeCharacter;
  const internal = adapter as unknown as { activeCharacter:typeof baseline };
  internal.activeCharacter = {
    ...baseline,
    className:"바바리안",
    level:2,
    hp:28,
    maxHp:28,
    proficiencyBonus:2,
    abilities:{ str:16, dex:14, con:16, int:8, wis:12, cha:10 },
    features:["격노","비무장 방어","위험 감지","무모한 공격"],
    skills:["운동","생존"],
    classLevels:[{ classId:BARBARIAN_PRIMAL_KNOWLEDGE_CLASS_ID, className:"바바리안", level:2 }],
    hitDiceByDie:{ d12:2 },
    progressionRevision:9,
  };

  await adapter.startLevelUp(internal.activeCharacter.id);
  let snapshot = await adapter.getSnapshot();
  const choiceId = barbarianPrimalKnowledgeChoiceId(3);
  const choice = snapshot.progressionPlan?.choices.find((entry) => entry.id === choiceId);
  assert.ok(choice);
  assert.equal(choice?.status,"ready");
  assert.equal(choice?.options.find((option) => option.label === "운동")?.disabledReason,"이미 숙련된 기술입니다.");
  assert.equal(choice?.options.find((option) => option.label === "지각")?.disabledReason,undefined);
  assert.ok(!snapshot.progressionPlan?.blocking.some((message) => /catalog/.test(message)));

  const commands = adapter as unknown as Phase07AdapterCommands;
  await commands.setProgressionChoice(choiceId,{ kind:"options", optionIds:["skill:perception"] });
  snapshot = await adapter.getSnapshot();
  assert.deepEqual(snapshot.progressionPlan?.blocking,[]);
  assert.ok(snapshot.progressionPlan?.diffs.some((diff) => diff.label === "원초적 지식 · 기술 숙련" && diff.after === "지각"));

  await adapter.commitLevelUp();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.level,3);
  assert.ok(snapshot.activeCharacter.skills.includes("운동"));
  assert.ok(snapshot.activeCharacter.skills.includes("생존"));
  assert.ok(snapshot.activeCharacter.skills.includes("지각"));
  assert.ok(snapshot.activeCharacter.features.includes("원초적 지식"));
  assert.equal(snapshot.activeCharacter.progressionRevision,10);
});
