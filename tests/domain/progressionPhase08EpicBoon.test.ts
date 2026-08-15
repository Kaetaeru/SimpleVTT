import assert from "node:assert/strict";
import test from "node:test";
import type { ProgressionCharacterState, ProgressionRequest } from "../../src/domain/progression";
import {
  buildProgressionPlanPhase08EpicBoon,
  resolveProgressionPhase08EpicBoon,
} from "../../src/domain/progressionPhase08EpicBoon";
import { epicBoonAbilityChoiceId, epicBoonChoiceId } from "../../src/domain/epicBoonProgression";
import { WIZARD_ID } from "../../src/domain/wizardProgressionChoices";

const FIGHTER_ID = "dnd.srd521.class.fighter";
const COMBAT_PROWESS = "dnd.srd521.feat.epic.combat-prowess";
const IRRESISTIBLE_OFFENSE = "dnd.srd521.feat.epic.irresistible-offense";
const SPELL_RECALL = "dnd.srd521.feat.epic.spell-recall";

function fighterState():ProgressionCharacterState {
  return {
    revision:12,
    id:"fighter",
    name:"Fighter",
    totalLevel:18,
    abilities:{ str:20, dex:14, con:19, int:10, wis:12, cha:8 },
    hpCurrent:180,
    hpMaximum:180,
    proficiencyBonus:6,
    classTracks:[{ classId:FIGHTER_ID, className:"파이터", level:18, subclassName:"챔피언" }],
    hitDiceByDie:{ d10:18 },
    features:["추가 공격","불굴"],
  };
}

function request(state:ProgressionCharacterState,selections:ProgressionRequest["selections"]):ProgressionRequest {
  return {
    expectedRevision:state.revision,
    targetClassId:FIGHTER_ID,
    hpMethod:"fixed",
    selections,
    featOptions:[],
    originFeatOptions:[],
    fightingStyleOptions:[],
    languageOptions:[],
    spellOptions:[],
  };
}

test("Fighter 18 to 19 exposes seven canonical Epic Boons and disables Spell Recall without Spellcasting", () => {
  const state = fighterState();
  const plan = buildProgressionPlanPhase08EpicBoon(state,request(state,{}));
  const choice = plan.choices.find((entry) => entry.id === epicBoonChoiceId(FIGHTER_ID,19));
  assert.ok(choice);
  assert.equal(choice?.status,"ready");
  assert.equal(choice?.options.length,7);
  const spellRecall = choice?.options.find((option) => option.id === SPELL_RECALL);
  assert.match(spellRecall?.disabledReason ?? "",/Spellcasting feature/);
  assert.ok(plan.blocking.some((message) => /에픽 은총 선택이 필요/.test(message)));
  assert.ok(!plan.blocking.some((message) => /catalog relationship/.test(message)));
});

test("Epic Boon +1 Constitution participates in the same level-up HP transaction with the feat maximum 30 rule", () => {
  const state = fighterState();
  const selections = {
    [epicBoonChoiceId(FIGHTER_ID,19)]:{ kind:"options" as const, optionIds:[COMBAT_PROWESS] },
    [epicBoonAbilityChoiceId(FIGHTER_ID,19)]:{ kind:"options" as const, optionIds:["ability:con"] },
  };
  const plan = buildProgressionPlanPhase08EpicBoon(state,request(state,selections));
  assert.deepEqual(plan.blocking,[]);
  assert.equal(plan.hp.gainBeforeConRetroactive,10,"Fighter fixed 6 + old CON modifier +4");
  assert.equal(plan.hp.retroactiveConstitutionGain,19,"CON 19 to 20 changes the modifier by +1 across 19 levels");
  assert.equal(plan.hp.totalGain,29);
  assert.ok(plan.diffs.some((diff) => diff.label === "에픽 은총" && /전투 기량의 은총/.test(diff.after)));
  assert.ok(plan.diffs.some((diff) => diff.label.includes("건강") && diff.before === "19" && diff.after === "20"));
  assert.equal(plan.diffs.find((diff) => diff.label === "최대 HP")?.after,"209");

  const result = resolveProgressionPhase08EpicBoon(state,request(state,selections));
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.totalLevel,19);
  assert.equal(result.state.classTracks[0].level,19);
  assert.equal(result.state.abilities.con,20);
  assert.equal(result.state.hpMaximum,209);
  assert.equal(result.state.hpCurrent,180,"retroactive maximum HP follows the existing progression rule and does not heal current HP");
  assert.ok(result.state.features.includes(COMBAT_PROWESS));
  assert.equal(result.state.revision,13);
});

test("Epic Boon ability restrictions are domain-authoritative and reject an out-of-list ability", () => {
  const state = fighterState();
  const selections = {
    [epicBoonChoiceId(FIGHTER_ID,19)]:{ kind:"options" as const, optionIds:[IRRESISTIBLE_OFFENSE] },
    [epicBoonAbilityChoiceId(FIGHTER_ID,19)]:{ kind:"options" as const, optionIds:["ability:wis"] },
  };
  const plan = buildProgressionPlanPhase08EpicBoon(state,request(state,selections));
  assert.ok(plan.blocking.some((message) => /알 수 없는 선택값/.test(message)));
  const result = resolveProgressionPhase08EpicBoon(state,request(state,selections));
  assert.equal(result.status,"rejected");
  assert.equal(result.state,state);
});

test("Spell Recall is eligible for a character that actually has the Spellcasting feature, not merely any magic system", () => {
  const state:ProgressionCharacterState = {
    ...fighterState(),
    id:"wizard",
    name:"Wizard",
    classTracks:[{ classId:WIZARD_ID, className:"위저드", level:18 }],
    hitDiceByDie:{ d6:18 },
    features:["주문 시전"],
  };
  const wizardRequest:ProgressionRequest = {
    ...request(state,{}),
    targetClassId:WIZARD_ID,
  };
  const plan = buildProgressionPlanPhase08EpicBoon(state,wizardRequest);
  const choice = plan.choices.find((entry) => entry.id === epicBoonChoiceId(WIZARD_ID,19));
  assert.ok(choice);
  assert.equal(choice?.options.length,7);
  assert.equal(choice?.options.find((option) => option.id === SPELL_RECALL)?.disabledReason,undefined);
});
