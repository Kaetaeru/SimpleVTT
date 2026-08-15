import assert from "node:assert/strict";
import test from "node:test";
import type { ProgressionRequest } from "../../src/domain/progression";
import {
  buildProgressionPlanPhase08WeaponMastery,
  resolveProgressionPhase08WeaponMastery,
} from "../../src/domain/progressionPhase08WeaponMastery";
import {
  BARBARIAN_ID,
  FIGHTER_ID,
  PALADIN_WEAPON_MASTERY_ID,
  RANGER_WEAPON_MASTERY_ID,
  ROGUE_ID,
  weaponMasteryChoiceDefinition,
  weaponMasteryChoiceId,
  weaponMasteryEligibleWeapons,
  weaponMasteryMaximum,
  type WeaponMasteryProgressionState,
} from "../../src/domain/weaponMasteryProgression";
import { WEAPON_RULE_CATALOG, weaponRuleById } from "../../src/domain/weaponRuleCatalog";

const GREAT_SWORD = "dnd.srd521.item.weapon.greatsword";
const LONG_SWORD = "dnd.srd521.item.weapon.longsword";
const LONG_BOW = "dnd.srd521.item.weapon.longbow";
const RAPIER = "dnd.srd521.item.weapon.rapier";

function fighter3():WeaponMasteryProgressionState {
  return {
    revision:3,
    id:"fighter",
    name:"Fighter",
    totalLevel:3,
    abilities:{ str:16, dex:12, con:14, int:10, wis:10, cha:8 },
    hpCurrent:30,
    hpMaximum:30,
    proficiencyBonus:2,
    classTracks:[{ classId:FIGHTER_ID, className:"파이터", level:3, subclassName:"챔피언" }],
    hitDiceByDie:{ d10:3 },
    features:["전투 방식","재기의 바람","행동 폭증","챔피언"],
    weaponMasteryIds:[GREAT_SWORD,LONG_SWORD,LONG_BOW],
    weaponMasterySources:{
      [GREAT_SWORD]:"파이터 1레벨",
      [LONG_SWORD]:"파이터 1레벨",
      [LONG_BOW]:"파이터 1레벨",
    },
  };
}

function request(state:WeaponMasteryProgressionState,selections:ProgressionRequest["selections"]):ProgressionRequest {
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

test("generated weapon catalog exposes all 38 SRD weapons with structured mastery metadata", () => {
  assert.equal(WEAPON_RULE_CATALOG.count,38);
  assert.equal(WEAPON_RULE_CATALOG.weapons.length,38);
  assert.equal(weaponRuleById(GREAT_SWORD)?.mastery,"graze");
  assert.equal(weaponRuleById(RAPIER)?.mastery,"vex");
  assert.equal(weaponRuleById("dnd.srd521.item.weapon.battleaxe")?.mastery,"topple");
});

test("class weapon-mastery relationships enforce Fighter/Barbarian/Rogue eligibility rather than one global weapon list", () => {
  assert.equal(weaponMasteryMaximum(FIGHTER_ID,1),3);
  assert.equal(weaponMasteryMaximum(FIGHTER_ID,4),4);
  assert.equal(weaponMasteryMaximum(BARBARIAN_ID,1),2);
  assert.equal(weaponMasteryMaximum(PALADIN_WEAPON_MASTERY_ID,1),2);
  assert.equal(weaponMasteryMaximum(RANGER_WEAPON_MASTERY_ID,1),2);
  assert.equal(weaponMasteryMaximum(ROGUE_ID,1),2);

  assert.equal(weaponMasteryEligibleWeapons(FIGHTER_ID).length,38);
  assert.ok(weaponMasteryEligibleWeapons(BARBARIAN_ID).every((weapon) => weapon.mode === "melee"));
  assert.ok(!weaponMasteryEligibleWeapons(BARBARIAN_ID).some((weapon) => weapon.id === LONG_BOW));
  const rogue = weaponMasteryEligibleWeapons(ROGUE_ID);
  assert.ok(rogue.some((weapon) => weapon.id === RAPIER));
  assert.ok(rogue.some((weapon) => weapon.id === "dnd.srd521.item.weapon.hand-crossbow"));
  assert.ok(!rogue.some((weapon) => weapon.id === GREAT_SWORD));
});

test("Fighter 3 to 4 replaces the core catalog-pending mastery delta with a ready canonical weapon choice and commits it atomically", () => {
  const state = fighter3();
  const masteryId = weaponMasteryChoiceId(FIGHTER_ID,4);
  const selections = {
    [`progression.${FIGHTER_ID}.4.asi`]:{ kind:"asi" as const, mode:"plus-two" as const, primary:"str" as const },
    [masteryId]:{ kind:"options" as const, optionIds:[RAPIER] },
  };
  const plan = buildProgressionPlanPhase08WeaponMastery(state,request(state,selections));
  const choice = plan.choices.find((entry) => entry.id === masteryId);
  assert.ok(choice);
  assert.equal(choice?.status,"ready");
  assert.equal(choice?.count,1);
  assert.equal(choice?.options.length,38);
  assert.equal(choice?.options.find((option) => option.id === GREAT_SWORD)?.disabledReason,"이미 무기 통달 대상으로 선택한 무기입니다.");
  assert.equal(choice?.options.find((option) => option.id === RAPIER)?.disabledReason,undefined);
  assert.deepEqual(plan.blocking,[]);
  assert.ok(!plan.blocking.some((message) => /catalog relationship/.test(message)));

  const result = resolveProgressionPhase08WeaponMastery(state,request(state,selections));
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  const next = result.state as WeaponMasteryProgressionState;
  assert.equal(next.totalLevel,4);
  assert.equal(next.classTracks[0].level,4);
  assert.equal(next.abilities.str,18);
  assert.deepEqual(next.weaponMasteryIds,[GREAT_SWORD,LONG_SWORD,LONG_BOW,RAPIER]);
  assert.match(next.weaponMasterySources?.[RAPIER] ?? "",/파이터 4레벨 · 무기 통달/);
});

test("fixed-count classes receive their initial mastery choice even when the class table has no numeric mastery column", () => {
  const empty = {
    ...fighter3(),
    totalLevel:0,
    classTracks:[],
    weaponMasteryIds:[],
    weaponMasterySources:{},
  };
  for (const classId of [PALADIN_WEAPON_MASTERY_ID,RANGER_WEAPON_MASTERY_ID,ROGUE_ID]) {
    const choice = weaponMasteryChoiceDefinition({ state:empty, targetClassId:classId, targetClassLevel:1 });
    assert.ok(choice,`${classId} should materialize two initial Weapon Masteries`);
    assert.equal(choice?.count,2);
    assert.equal(choice?.status,"ready");
  }
});
