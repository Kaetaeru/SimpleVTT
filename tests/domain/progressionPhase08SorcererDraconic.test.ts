import assert from "node:assert/strict";
import test from "node:test";
import type { ChoiceSelectionMap } from "../../src/domain/choiceDefinition";
import type { ProgressionPlan, ProgressionRequest } from "../../src/domain/progression";
import { classById } from "../../src/domain/progressionCatalog";
import {
  buildProgressionPlanPhase08SorcererDraconic,
  draconicAffinityChoiceId,
  resolveProgressionPhase08SorcererDraconic,
  type SorcererDraconicProgressionState,
} from "../../src/domain/progressionPhase08SorcererDraconic";
import {
  DRACONIC_RESILIENCE_FEATURE_ID,
  DRACONIC_SPELLS_FEATURE_ID,
  DRAGON_WINGS_FEATURE_ID,
  ELEMENTAL_AFFINITY_FEATURE_ID,
  SORCERER_DRACONIC_SUBCLASS_ID,
  SORCERER_ID,
  draconicElementalResistance,
  draconicElementalSpellDamageBonus,
  draconicResilienceArmorClass,
} from "../../src/domain/sorcererDraconic";
import { stableSpellId } from "../../src/domain/spellListCatalog";

const subclassName = classById(SORCERER_ID)!.srdSubclassName;

function sorcerer(level:number,overrides:Partial<SorcererDraconicProgressionState> = {}):SorcererDraconicProgressionState {
  return {
    revision:level,
    id:"sorcerer",
    name:"Ash",
    totalLevel:level,
    abilities:{ str:8,dex:14,con:14,int:10,wis:10,cha:18 },
    hpCurrent:8 + Math.max(0,level - 1) * 6,
    hpMaximum:8 + Math.max(0,level - 1) * 6 + (level >= 3 ? level : 0),
    proficiencyBonus:level >= 9 ? 4 : level >= 5 ? 3 : 2,
    classTracks:[{ classId:SORCERER_ID, className:"소서러", level, ...(level >= 3 ? { subclassName } : {}) }],
    hitDiceByDie:{ d6:level },
    features:["주문 시전","타고난 마법",...(level >= 3 ? [subclassName] : [])],
    cantripIds:[stableSpellId("Fire Bolt"),stableSpellId("Mage Hand"),stableSpellId("Minor Illusion"),stableSpellId("Prestidigitation")],
    preparedSpellIds:[stableSpellId("Burning Hands"),stableSpellId("Magic Missile"),stableSpellId("Shield")],
    preparedSpellSources:{},
    subclassIds:level >= 3 ? { [SORCERER_ID]:SORCERER_DRACONIC_SUBCLASS_ID } : {},
    subclassFeatureIds:[],
    subclassFeatureSources:{},
    ...overrides,
  };
}

function request(state:SorcererDraconicProgressionState,selections:ChoiceSelectionMap):ProgressionRequest {
  return {
    expectedRevision:state.revision,
    targetClassId:SORCERER_ID,
    hpMethod:"fixed",
    selections,
    featOptions:[],
    originFeatOptions:[],
    fightingStyleOptions:[],
    languageOptions:[],
    spellOptions:[],
  };
}

function fillRequired(plan:ProgressionPlan,selections:ChoiceSelectionMap):ChoiceSelectionMap {
  const next = { ...selections };
  for (const choice of plan.choices) {
    if (!choice.required || choice.status !== "ready" || next[choice.id]) continue;
    if (choice.kind === "asi-or-feat") {
      next[choice.id] = { kind:"asi", mode:"plus-two", primary:"cha" };
      continue;
    }
    const enabled = choice.options.filter((option) => !option.disabledReason).slice(0,choice.count);
    if (enabled.length === choice.count) next[choice.id] = { kind:"options", optionIds:enabled.map((option) => option.id) };
  }
  return next;
}

test("Draconic Sorcery acquisition at Sorcerer 3 adds +3 maximum HP and four always-prepared Draconic spells", () => {
  const state = sorcerer(2,{ subclassIds:{}, hpMaximum:14, hpCurrent:14 });
  let selections:ChoiceSelectionMap = {
    [`progression.${SORCERER_ID}.3.subclass`]:{ kind:"options", optionIds:[`subclass:${subclassName}`] },
  };
  let plan = buildProgressionPlanPhase08SorcererDraconic(state,request(state,selections));
  selections = fillRequired(plan,selections);
  plan = buildProgressionPlanPhase08SorcererDraconic(state,request(state,selections));
  assert.deepEqual(plan.blocking,[]);
  const baseFixedGain = 4 + 2;
  assert.equal(plan.hp.totalGain,baseFixedGain + 3);
  assert.equal(plan.diffs.find((diff) => diff.label === "최대 HP")?.after,String(state.hpMaximum + baseFixedGain + 3));

  const result = resolveProgressionPhase08SorcererDraconic(state,request(state,selections));
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  const next = result.state as SorcererDraconicProgressionState;
  assert.equal(next.subclassIds?.[SORCERER_ID],SORCERER_DRACONIC_SUBCLASS_ID);
  assert.equal(next.hpMaximum,state.hpMaximum + baseFixedGain + 3);
  for (const name of ["Alter Self","Chromatic Orb","Command","Dragon's Breath"]) {
    assert.ok(next.preparedSpellIds?.includes(`always:${stableSpellId(name)}`),name);
  }
  assert.ok(next.subclassFeatureIds?.includes(DRACONIC_RESILIENCE_FEATURE_ID));
  assert.ok(next.subclassFeatureIds?.includes(DRACONIC_SPELLS_FEATURE_ID));
});

test("Sorcerer 6 materializes Elemental Affinity as a five-type choice instead of generic subclass pending", () => {
  const state = sorcerer(5,{
    preparedSpellIds:[
      stableSpellId("Burning Hands"),stableSpellId("Magic Missile"),stableSpellId("Shield"),
      ...["Alter Self","Chromatic Orb","Command","Dragon's Breath","Fear","Fly"].map((name) => `always:${stableSpellId(name)}`),
    ],
    subclassFeatureIds:[DRACONIC_RESILIENCE_FEATURE_ID,DRACONIC_SPELLS_FEATURE_ID],
  });
  let selections:ChoiceSelectionMap = { [draconicAffinityChoiceId()]:{ kind:"options", optionIds:["damage:fire"] } };
  let plan = buildProgressionPlanPhase08SorcererDraconic(state,request(state,selections));
  selections = fillRequired(plan,selections);
  plan = buildProgressionPlanPhase08SorcererDraconic(state,request(state,selections));
  const affinity = plan.choices.find((choice) => choice.id === draconicAffinityChoiceId());
  assert.ok(affinity);
  assert.deepEqual(affinity?.options.map((option) => option.label),["산성","냉기","화염","번개","독"]);
  assert.equal(plan.choices.some((choice) => choice.id === draconicAffinityChoiceId() && choice.status === "catalog-pending"),false);
  assert.deepEqual(plan.blocking,[]);

  const result = resolveProgressionPhase08SorcererDraconic(state,request(state,selections));
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  const next = result.state as SorcererDraconicProgressionState;
  assert.equal(next.draconicAffinityDamageType,"fire");
  assert.ok(next.subclassFeatureIds?.includes(ELEMENTAL_AFFINITY_FEATURE_ID));
  assert.equal(next.hpMaximum,state.hpMaximum + plan.hp.totalGain);
});

test("Draconic spells unlock at Sorcerer 5/7/9 without consuming ordinary prepared-spell selections", () => {
  const state = sorcerer(4,{
    preparedSpellIds:[
      stableSpellId("Burning Hands"),stableSpellId("Magic Missile"),stableSpellId("Shield"),
      ...["Alter Self","Chromatic Orb","Command","Dragon's Breath"].map((name) => `always:${stableSpellId(name)}`),
    ],
  });
  let selections:ChoiceSelectionMap = {};
  let plan = buildProgressionPlanPhase08SorcererDraconic(state,request(state,selections));
  selections = fillRequired(plan,selections);
  plan = buildProgressionPlanPhase08SorcererDraconic(state,request(state,selections));
  const result = resolveProgressionPhase08SorcererDraconic(state,request(state,selections));
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.ok(result.state.preparedSpellIds?.includes(`always:${stableSpellId("Fear")}`));
  assert.ok(result.state.preparedSpellIds?.includes(`always:${stableSpellId("Fly")}`));
});

test("Draconic 14 automatic Dragon Wings no longer exposes a fake subclass choice", () => {
  const state = sorcerer(13,{ draconicAffinityDamageType:"fire" });
  let selections:ChoiceSelectionMap = {};
  let plan = buildProgressionPlanPhase08SorcererDraconic(state,request(state,selections));
  selections = fillRequired(plan,selections);
  plan = buildProgressionPlanPhase08SorcererDraconic(state,request(state,selections));
  assert.equal(plan.choices.some((choice) => choice.id === `progression.${SORCERER_ID}.14.subclass-feature`),false);
  assert.ok(plan.diffs.some((diff) => diff.after === "드래곤 날개"));
  assert.deepEqual(plan.blocking,[]);
  const result = resolveProgressionPhase08SorcererDraconic(state,request(state,selections));
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.ok((result.state as SorcererDraconicProgressionState).subclassFeatureIds?.includes(DRAGON_WINGS_FEATURE_ID));
});

test("Draconic Resilience and Elemental Affinity helpers expose exact reusable AC/resistance/damage modifiers", () => {
  assert.equal(draconicResilienceArmorClass({ sorcererLevel:3, dexterityModifier:2, charismaModifier:4, wearingArmor:false }),16);
  assert.equal(draconicResilienceArmorClass({ sorcererLevel:3, dexterityModifier:2, charismaModifier:4, wearingArmor:true }),undefined);
  assert.deepEqual(draconicElementalResistance({ sorcererLevel:6, subclassId:SORCERER_DRACONIC_SUBCLASS_ID, affinity:"fire" }),{
    source:ELEMENTAL_AFFINITY_FEATURE_ID,
    kind:"resistance",
    damageType:"fire",
  });
  assert.equal(draconicElementalSpellDamageBonus({ sorcererLevel:6, subclassId:SORCERER_DRACONIC_SUBCLASS_ID, affinity:"fire", spellDamageType:"fire", charismaModifier:4 }),4);
  assert.equal(draconicElementalSpellDamageBonus({ sorcererLevel:6, subclassId:SORCERER_DRACONIC_SUBCLASS_ID, affinity:"fire", spellDamageType:"cold", charismaModifier:4 }),0);
});
