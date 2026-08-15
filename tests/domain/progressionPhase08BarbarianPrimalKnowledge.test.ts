import assert from "node:assert/strict";
import test from "node:test";
import type { ProgressionCharacterState, ProgressionRequest } from "../../src/domain/progression";
import { classById } from "../../src/domain/progressionCatalog";
import {
  buildProgressionPlanPhase08BarbarianPrimalKnowledge,
  resolveProgressionPhase08BarbarianPrimalKnowledge,
} from "../../src/domain/progressionPhase08BarbarianPrimalKnowledge";
import {
  BARBARIAN_PRIMAL_KNOWLEDGE_CLASS_ID,
  barbarianPrimalKnowledgeChoiceId,
} from "../../src/domain/barbarianPrimalKnowledgeProgression";

function barbarian2():ProgressionCharacterState {
  return {
    revision:4,
    id:"barbarian",
    name:"Barbarian",
    totalLevel:2,
    abilities:{ str:16, dex:14, con:16, int:8, wis:12, cha:10 },
    hpCurrent:28,
    hpMaximum:28,
    proficiencyBonus:2,
    classTracks:[{ classId:BARBARIAN_PRIMAL_KNOWLEDGE_CLASS_ID, className:"바바리안", level:2 }],
    hitDiceByDie:{ d12:2 },
    features:["격노","비무장 방어","위험 감지","무모한 공격"],
    proficientSkills:["운동","생존"],
  };
}

function request(state:ProgressionCharacterState,selections:ProgressionRequest["selections"]):ProgressionRequest {
  return {
    expectedRevision:state.revision,
    targetClassId:BARBARIAN_PRIMAL_KNOWLEDGE_CLASS_ID,
    hpMethod:"fixed",
    selections,
    featOptions:[],
    originFeatOptions:[],
    fightingStyleOptions:[],
    languageOptions:[],
    spellOptions:[],
  };
}

test("Barbarian 2 to 3 materializes Primal Knowledge from the canonical Barbarian skill pool", () => {
  const state = barbarian2();
  const choiceId = barbarianPrimalKnowledgeChoiceId(3);
  const plan = buildProgressionPlanPhase08BarbarianPrimalKnowledge(state,request(state,{}));
  const choice = plan.choices.find((entry) => entry.id === choiceId);
  assert.ok(choice);
  assert.equal(choice?.status,"ready");
  assert.deepEqual(choice?.options.map((option) => option.label),["동물 조련","운동","위협","자연","지각","생존"]);
  assert.equal(choice?.options.find((option) => option.label === "운동")?.disabledReason,"이미 숙련된 기술입니다.");
  assert.equal(choice?.options.find((option) => option.label === "생존")?.disabledReason,"이미 숙련된 기술입니다.");
  assert.ok(plan.blocking.some((message) => /원초적 지식 기술 선택/.test(message)));
  assert.ok(!plan.blocking.some((message) => /catalog/.test(message)));
});

test("Primal Knowledge commits one new skill proficiency and the class feature atomically", () => {
  const state = barbarian2();
  const choiceId = barbarianPrimalKnowledgeChoiceId(3);
  const subclassName = classById(BARBARIAN_PRIMAL_KNOWLEDGE_CLASS_ID)!.srdSubclassName;
  const selections = {
    [`progression.${BARBARIAN_PRIMAL_KNOWLEDGE_CLASS_ID}.3.subclass`]:{ kind:"options" as const, optionIds:[`subclass:${subclassName}`] },
    [choiceId]:{ kind:"options" as const, optionIds:["skill:perception"] },
  };
  const plan = buildProgressionPlanPhase08BarbarianPrimalKnowledge(state,request(state,selections));
  assert.deepEqual(plan.blocking,[]);
  assert.ok(plan.diffs.some((diff) => diff.label === "원초적 지식 · 기술 숙련" && diff.after === "지각"));

  const result = resolveProgressionPhase08BarbarianPrimalKnowledge(state,request(state,selections));
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.totalLevel,3);
  assert.ok(result.state.proficientSkills?.includes("지각"));
  assert.ok(result.state.features.includes("원초적 지식"));
  assert.equal(result.state.revision,5);
});

test("Primal Knowledge rejects a skill outside the Barbarian pool or one already proficient", () => {
  const state = barbarian2();
  const choiceId = barbarianPrimalKnowledgeChoiceId(3);
  const outside = buildProgressionPlanPhase08BarbarianPrimalKnowledge(state,request(state,{
    [choiceId]:{ kind:"options", optionIds:["skill:arcana"] },
  }));
  assert.ok(outside.blocking.some((message) => /알 수 없는 선택값/.test(message)));
  const duplicate = buildProgressionPlanPhase08BarbarianPrimalKnowledge(state,request(state,{
    [choiceId]:{ kind:"options", optionIds:["skill:athletics"] },
  }));
  assert.ok(duplicate.blocking.some((message) => /이미 숙련된 기술/.test(message)));
});
