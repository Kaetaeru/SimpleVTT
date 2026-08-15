import assert from "node:assert/strict";
import test from "node:test";
import type { ChoiceSelectionMap } from "../../src/domain/choiceDefinition";
import type { ProgressionPlan, ProgressionRequest } from "../../src/domain/progression";
import { classById } from "../../src/domain/progressionCatalog";
import {
  buildProgressionPlanPhase08WizardEvocation,
  resolveProgressionPhase08WizardEvocation,
} from "../../src/domain/progressionPhase08WizardEvocation";
import {
  EVOCATION_SAVANT_FEATURE_ID,
  POTENT_CANTRIP_FEATURE_ID,
  SCULPT_SPELLS_FEATURE_ID,
  evocationSavantChoiceId,
  WIZARD_EVOCATION_CLASS_ID,
  WIZARD_EVOCATION_SUBCLASS_ID,
  type WizardEvocationProgressionState,
} from "../../src/domain/wizardEvocationProgression";
import { stableSpellId } from "../../src/domain/spellListCatalog";

const subclassName = classById(WIZARD_EVOCATION_CLASS_ID)!.srdSubclassName;

const evocationNames = [
  "Burning Hands","Magic Missile","Thunderwave","Scorching Ray","Shatter",
  "Fireball","Lightning Bolt","Ice Storm","Cone of Cold","Chain Lightning",
];
const evocationSpellOptions = evocationNames.map((name) => ({
  id:stableSpellId(name),
  label:name,
  description:`${name} evocation`,
  school:"evocation",
}));

function wizard(level:number,overrides:Partial<WizardEvocationProgressionState> = {}):WizardEvocationProgressionState {
  return {
    revision:level,
    id:"wizard",
    name:"Iris",
    totalLevel:level,
    abilities:{ str:8,dex:14,con:14,int:18,wis:12,cha:10 },
    hpCurrent:8 + Math.max(0,level - 1) * 6,
    hpMaximum:8 + Math.max(0,level - 1) * 6,
    proficiencyBonus:level >= 9 ? 4 : level >= 5 ? 3 : 2,
    classTracks:[{ classId:WIZARD_EVOCATION_CLASS_ID, className:"위저드", level, ...(level >= 3 ? { subclassName } : {}) }],
    hitDiceByDie:{ d6:level },
    features:["주문 시전","의식 전문가","비전 회복",...(level >= 3 ? [subclassName] : [])],
    cantripIds:[stableSpellId("Fire Bolt"),stableSpellId("Mage Hand"),stableSpellId("Prestidigitation")],
    preparedSpellIds:[stableSpellId("Magic Missile"),stableSpellId("Shield"),stableSpellId("Sleep")],
    preparedSpellSources:{},
    spellbookSpellIds:[
      stableSpellId("Magic Missile"),stableSpellId("Shield"),stableSpellId("Sleep"),stableSpellId("Detect Magic"),
      stableSpellId("Misty Step"),stableSpellId("Web"),
    ],
    spellbookSpellSources:{},
    subclassIds:level >= 3 ? { [WIZARD_EVOCATION_CLASS_ID]:WIZARD_EVOCATION_SUBCLASS_ID } : {},
    subclassFeatureIds:[],
    subclassFeatureSources:{},
    ...overrides,
  };
}

function request(state:WizardEvocationProgressionState,selections:ChoiceSelectionMap):ProgressionRequest {
  return {
    expectedRevision:state.revision,
    targetClassId:WIZARD_EVOCATION_CLASS_ID,
    hpMethod:"fixed",
    selections,
    featOptions:[],
    originFeatOptions:[],
    fightingStyleOptions:[],
    languageOptions:[],
    spellOptions:evocationSpellOptions,
  };
}

function fillRequired(plan:ProgressionPlan,selections:ChoiceSelectionMap,skip = new Set<string>()):ChoiceSelectionMap {
  const next = { ...selections };
  for (const choice of plan.choices) {
    if (!choice.required || choice.status !== "ready" || next[choice.id] || skip.has(choice.id)) continue;
    if (choice.kind === "asi-or-feat") {
      next[choice.id] = { kind:"asi", mode:"plus-two", primary:"int" };
      continue;
    }
    const enabled = choice.options.filter((option) => !option.disabledReason).slice(0,choice.count);
    if (enabled.length === choice.count) next[choice.id] = { kind:"options", optionIds:enabled.map((option) => option.id) };
  }
  return next;
}

test("Evocation acquisition at Wizard 3 adds two extra level-1/2 Evocation spellbook choices plus Potent Cantrip", () => {
  const state = wizard(2,{ subclassIds:{} });
  let selections:ChoiceSelectionMap = {
    [`progression.${WIZARD_EVOCATION_CLASS_ID}.3.subclass`]:{ kind:"options", optionIds:[`subclass:${subclassName}`] },
  };
  let plan = buildProgressionPlanPhase08WizardEvocation(state,request(state,selections));
  const savantId = evocationSavantChoiceId(3);
  const savant = plan.choices.find((choice) => choice.id === savantId);
  assert.ok(savant);
  assert.equal(savant?.count,2);
  assert.ok(savant?.options.every((option) => evocationSpellOptions.some((spell) => spell.id === option.id)));
  const savantSpellIds = savant!.options.filter((option) => !option.disabledReason).slice(0,2).map((option) => option.id);
  selections[savantId] = { kind:"options", optionIds:savantSpellIds };

  plan = buildProgressionPlanPhase08WizardEvocation(state,request(state,selections));
  const ordinary = plan.choices.find((choice) => choice.id !== savantId && choice.id.includes("spellbook") && choice.required);
  assert.ok(ordinary);
  const ordinaryOptions = ordinary!.options
    .filter((option) => !option.disabledReason && !savantSpellIds.includes(option.id))
    .slice(0,ordinary!.count);
  assert.equal(ordinaryOptions.length,ordinary!.count,"ordinary Wizard spellbook additions must remain distinct from Evocation Savant additions");
  selections[ordinary!.id] = { kind:"options", optionIds:ordinaryOptions.map((option) => option.id) };

  plan = buildProgressionPlanPhase08WizardEvocation(state,request(state,selections));
  selections = fillRequired(plan,selections);
  plan = buildProgressionPlanPhase08WizardEvocation(state,request(state,selections));
  assert.deepEqual(plan.blocking,[]);

  const result = resolveProgressionPhase08WizardEvocation(state,request(state,selections));
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  const next = result.state as WizardEvocationProgressionState;
  assert.equal(next.subclassIds?.[WIZARD_EVOCATION_CLASS_ID],WIZARD_EVOCATION_SUBCLASS_ID);
  assert.ok(next.subclassFeatureIds?.includes(EVOCATION_SAVANT_FEATURE_ID));
  assert.ok(next.subclassFeatureIds?.includes(POTENT_CANTRIP_FEATURE_ID));
  for (const spellId of savantSpellIds) {
    assert.ok(next.spellbookSpellIds?.includes(spellId));
    assert.match(next.spellbookSpellSources?.[spellId] ?? "",/환기술 전문가/);
  }
});

test("Evocation Savant rejects selecting the same spell in the ordinary Wizard spellbook addition and subclass bonus", () => {
  const state = wizard(2,{ subclassIds:{} });
  const subclassId = `progression.${WIZARD_EVOCATION_CLASS_ID}.3.subclass`;
  let selections:ChoiceSelectionMap = { [subclassId]:{ kind:"options", optionIds:[`subclass:${subclassName}`] } };
  const preview = buildProgressionPlanPhase08WizardEvocation(state,request(state,selections));
  const savant = preview.choices.find((choice) => choice.id === evocationSavantChoiceId(3))!;
  const ordinary = preview.choices.find((choice) => choice.id !== savant.id && choice.id.includes("spellbook") && choice.required);
  assert.ok(ordinary);
  const duplicate = savant.options.find((option) => !option.disabledReason && ordinary!.options.some((entry) => entry.id === option.id && !entry.disabledReason))!.id;
  const ordinaryOther = ordinary!.options.find((option) => option.id !== duplicate && !option.disabledReason)!.id;
  const savantOther = savant.options.find((option) => option.id !== duplicate && !option.disabledReason)!.id;
  selections[ordinary!.id] = { kind:"options", optionIds:[duplicate,ordinaryOther] };
  selections[savant.id] = { kind:"options", optionIds:[duplicate,savantOther] };
  selections = fillRequired(preview,selections,new Set([ordinary!.id,savant.id]));
  const plan = buildProgressionPlanPhase08WizardEvocation(state,request(state,selections));
  assert.ok(plan.blocking.some((message) => message.includes("중복 선택") && message.includes(duplicate)));
});

test("when Wizard first unlocks 3rd-level slots, Evocation Savant adds exactly one 3rd-level Evocation spell", () => {
  const state = wizard(4,{
    spellbookSpellIds:[
      ...wizard(4).spellbookSpellIds!,
      stableSpellId("Burning Hands"),stableSpellId("Scorching Ray"),
    ],
    subclassFeatureIds:[EVOCATION_SAVANT_FEATURE_ID,POTENT_CANTRIP_FEATURE_ID],
  });
  let selections:ChoiceSelectionMap = {};
  let plan = buildProgressionPlanPhase08WizardEvocation(state,request(state,selections));
  const savant = plan.choices.find((choice) => choice.id === evocationSavantChoiceId(5));
  assert.ok(savant);
  assert.equal(savant?.count,1);
  assert.ok(savant?.options.some((option) => option.id === stableSpellId("Fireball")));
  assert.ok(savant?.options.some((option) => option.id === stableSpellId("Lightning Bolt")));
  selections[savant!.id] = { kind:"options", optionIds:[stableSpellId("Fireball")] };
  selections = fillRequired(plan,selections);
  plan = buildProgressionPlanPhase08WizardEvocation(state,request(state,selections));
  assert.deepEqual(plan.blocking,[]);
  const result = resolveProgressionPhase08WizardEvocation(state,request(state,selections));
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.ok(result.state.spellbookSpellIds?.includes(stableSpellId("Fireball")));
});

test("Evocation 6 automatic Sculpt Spells no longer exposes generic subclass pending", () => {
  const state = wizard(5,{ subclassFeatureIds:[EVOCATION_SAVANT_FEATURE_ID,POTENT_CANTRIP_FEATURE_ID] });
  let selections:ChoiceSelectionMap = {};
  let plan = buildProgressionPlanPhase08WizardEvocation(state,request(state,selections));
  selections = fillRequired(plan,selections);
  plan = buildProgressionPlanPhase08WizardEvocation(state,request(state,selections));
  assert.equal(plan.choices.some((choice) => choice.id === `progression.${WIZARD_EVOCATION_CLASS_ID}.6.subclass-feature`),false);
  assert.ok(plan.diffs.some((diff) => diff.after === "주문 조형"));
  assert.deepEqual(plan.blocking,[]);
  const result = resolveProgressionPhase08WizardEvocation(state,request(state,selections));
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.ok((result.state as WizardEvocationProgressionState).subclassFeatureIds?.includes(SCULPT_SPELLS_FEATURE_ID));
});
