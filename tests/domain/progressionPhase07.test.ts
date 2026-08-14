import assert from "node:assert/strict";
import test from "node:test";
import { buildProgressionPlan, resolveProgression, type ProgressionCharacterState } from "../../src/domain/progression";
import { multiclassSpellSlots } from "../../src/domain/progressionCatalog";
import { stableSpellId } from "../../src/domain/spellListCatalog";

const fighter = (): ProgressionCharacterState => ({
  revision:0, id:"fighter", name:"Aelar", totalLevel:5,
  abilities:{ str:16,dex:14,con:14,int:10,wis:12,cha:10 }, hpCurrent:38,hpMaximum:44,proficiencyBonus:3,
  classTracks:[{ classId:"dnd.srd521.class.fighter", className:"파이터", level:5, subclassName:"챔피언" }],
  hitDiceByDie:{ d10:5 }, features:["추가 공격"],
});

const rogue = (): ProgressionCharacterState => ({
  revision:0, id:"rogue", name:"Nim", totalLevel:5,
  abilities:{ str:8,dex:18,con:14,int:12,wis:12,cha:14 }, hpCurrent:31,hpMaximum:38,proficiencyBonus:3,
  classTracks:[{ classId:"dnd.srd521.class.rogue", className:"로그", level:5, subclassName:"시프" }],
  hitDiceByDie:{ d8:5 }, features:["은밀 공격","교활한 행동"],
  proficientSkills:["곡예","기만","지각","손재주","은신","조사"], expertiseSkills:["곡예","은신"],
});

test("Phase 07 snapshot is complete for 12 classes x 20 levels with SRD subclasses", async () => {
  const { PROGRESSION_CATALOG } = await import("../../src/domain/progressionCatalog");
  assert.equal(PROGRESSION_CATALOG.classes.length, 12);
  assert.equal(PROGRESSION_CATALOG.classes.reduce((sum, entry) => sum + entry.progression.length, 0), 240);
  assert.ok(PROGRESSION_CATALOG.classes.every((entry) => entry.srdSubclassName));
});

test("Fighter 5 -> 6 exposes only the real ASI choice and commits fixed HP / Hit Die / class track atomically", () => {
  const state = fighter();
  const choiceId = "progression.dnd.srd521.class.fighter.6.asi";
  const request = {
    expectedRevision:0,
    targetClassId:"dnd.srd521.class.fighter",
    hpMethod:"fixed" as const,
    selections:{ [choiceId]:{ kind:"asi" as const, mode:"plus-two" as const, primary:"str" as const } },
  };
  const plan = buildProgressionPlan(state, request);
  assert.equal(plan.targetClassLevel, 6);
  assert.equal(plan.choices.length, 1);
  assert.equal(plan.choices[0].kind, "asi-or-feat");
  assert.equal(plan.blocking.length, 0);
  const result = resolveProgression(state, request);
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.totalLevel, 6);
  assert.equal(result.state.classTracks[0].level, 6);
  assert.equal(result.state.abilities.str, 18);
  assert.equal(result.state.hpMaximum, 52);
  assert.equal(result.state.hitDiceByDie.d10, 6);
  assert.equal(result.state.proficiencyBonus, 3);
  assert.equal(state.totalLevel, 5);
});

test("CON increase applies the SRD retroactive max-HP adjustment to every new total level", () => {
  const state = fighter();
  const choiceId = "progression.dnd.srd521.class.fighter.6.asi";
  const result = resolveProgression(state, {
    expectedRevision:0,
    targetClassId:"dnd.srd521.class.fighter",
    hpMethod:"fixed",
    selections:{ [choiceId]:{ kind:"asi", mode:"plus-two", primary:"con" } },
  });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.abilities.con, 16);
  assert.equal(result.state.hpMaximum, 58, "fixed 6 + old CON 2, then +1 CON modifier across all 6 total levels");
});

test("new multiclass validates current and target class prerequisites and a qualifying Monk level creates a second track", () => {
  const state = fighter();
  state.abilities.dex = 13;
  state.abilities.wis = 13;
  const plan = buildProgressionPlan(state, { expectedRevision:0,targetClassId:"dnd.srd521.class.monk",hpMethod:"fixed",selections:{} });
  assert.equal(plan.isMulticlass, true);
  assert.equal(plan.eligible, true);
  const result = resolveProgression(state, { expectedRevision:0,targetClassId:"dnd.srd521.class.monk",hpMethod:"fixed",selections:{} });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.totalLevel, 6);
  assert.deepEqual(result.state.classTracks.map((track) => [track.className,track.level]), [["파이터",5],["몽크",1]]);
  assert.equal(result.state.hitDiceByDie.d8, 1);
});

test("multiclass spellcaster level uses full levels plus ceil of each half-caster class and keeps Pact Magic separate", () => {
  const rangerSorcerer = multiclassSpellSlots([
    { classId:"dnd.srd521.class.ranger", level:4 },
    { classId:"dnd.srd521.class.sorcerer", level:3 },
  ]);
  assert.equal(rangerSorcerer.casterLevel, 5);
  assert.deepEqual(Object.fromEntries(Object.entries(rangerSorcerer.slots).filter(([,count]) => count > 0)), { 1:4, 2:3, 3:2 });
  const withWarlock = multiclassSpellSlots([
    { classId:"dnd.srd521.class.ranger", level:4 },
    { classId:"dnd.srd521.class.sorcerer", level:3 },
    { classId:"dnd.srd521.class.warlock", level:5 },
  ]);
  assert.equal(withWarlock.casterLevel, 5, "Warlock Pact Magic levels are not merged into multiclass Spellcasting slots");
});

test("a level that needs a not-yet-materialized spell choice rejects atomically instead of approximating", () => {
  const wizardId = "dnd.srd521.class.wizard";
  const state: ProgressionCharacterState = {
    revision:3, id:"wizard-17", name:"Wizard", totalLevel:17,
    abilities:{ str:8,dex:14,con:14,int:20,wis:12,cha:10 }, hpCurrent:80,hpMaximum:96,proficiencyBonus:6,
    classTracks:[{ classId:wizardId, className:"위저드", level:17, subclassName:"환영술사" }], hitDiceByDie:{ d6:17 }, features:["주문 시전","주문책"],
    spellbookSpellIds:[stableSpellId("Magic Missile"),stableSpellId("Shield")],
    preparedSpellIds:[stableSpellId("Magic Missile"),stableSpellId("Shield")],
  };
  const spellbookChoice = `progression.${wizardId}.18.spellbook`;
  const request = {
    expectedRevision:3,
    targetClassId:wizardId,
    hpMethod:"fixed" as const,
    selections:{ [spellbookChoice]:{ kind:"options" as const, optionIds:[stableSpellId("Wish"),stableSpellId("Time Stop")] } },
  };
  const plan = buildProgressionPlan(state, request);
  assert.ok(plan.choices.some((choice) => choice.kind === "spell" && choice.status === "catalog-pending" && choice.label === "주문 숙련"));
  const result = resolveProgression(state, request);
  assert.equal(result.status, "rejected");
  assert.equal(result.state, state);
  assert.equal(state.revision, 3);
});

test("Rogue 5 -> 6 materializes Expertise from proficient skills and commits the selected skills with provenance", () => {
  const state = rogue();
  const choiceId = "progression.dnd.srd521.class.rogue.6.expertise";
  const request = {
    expectedRevision:0,
    targetClassId:"dnd.srd521.class.rogue",
    hpMethod:"fixed" as const,
    selections:{ [choiceId]:{ kind:"options" as const, optionIds:["skill:지각","skill:조사"] } },
  };
  const plan = buildProgressionPlan(state, request);
  assert.equal(plan.choices.find((choice) => choice.id === choiceId)?.status, "ready");
  assert.equal(plan.blocking.length, 0);
  const result = resolveProgression(state, request);
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.deepEqual(new Set(result.state.expertiseSkills), new Set(["곡예","은신","지각","조사"]));
  assert.equal(result.state.expertiseSources?.["지각"], "로그 6레벨 · SRD 5.2.1");
});

test("Expertise rejects an already-expert skill even if a client submits the disabled option", () => {
  const state = rogue();
  const choiceId = "progression.dnd.srd521.class.rogue.6.expertise";
  const result = resolveProgression(state, {
    expectedRevision:0,
    targetClassId:"dnd.srd521.class.rogue",
    hpMethod:"fixed",
    selections:{ [choiceId]:{ kind:"options", optionIds:["skill:곡예","skill:지각"] } },
  });
  assert.equal(result.status, "rejected");
  if (result.status !== "rejected") return;
  assert.match(result.error, /이미 전문화를 보유/);
});

test("Ranger 1 -> 2 materializes Deft Explorer as Expertise 1 + languages 2 while leaving Fighting Style explicitly pending", () => {
  const state: ProgressionCharacterState = {
    revision:0,id:"ranger",name:"Ranger",totalLevel:1,
    abilities:{ str:10,dex:16,con:14,int:10,wis:16,cha:8 },hpCurrent:12,hpMaximum:12,proficiencyBonus:2,
    classTracks:[{ classId:"dnd.srd521.class.ranger",className:"레인저",level:1 }],hitDiceByDie:{ d10:1 },features:["주적","무기 통달"],
    proficientSkills:["지각","은신","생존"], languages:["공용어","엘프어"],
  };
  const request = {
    expectedRevision:0,targetClassId:"dnd.srd521.class.ranger",hpMethod:"fixed" as const,
    languageOptions:[{id:"language.dwarvish",label:"드워프어"},{id:"language.giant",label:"거인어"},{id:"language.elvish",label:"엘프어"}],
    selections:{
      "progression.dnd.srd521.class.ranger.2.seasoned-explorer.expertise":{kind:"options" as const,optionIds:["skill:은신"]},
      "progression.dnd.srd521.class.ranger.2.seasoned-explorer.languages":{kind:"options" as const,optionIds:["language.dwarvish","language.giant"]},
    },
  };
  const plan = buildProgressionPlan(state, request);
  assert.equal(plan.choices.find((choice) => choice.id.endsWith("seasoned-explorer.expertise"))?.status, "ready");
  assert.equal(plan.choices.find((choice) => choice.id.endsWith("seasoned-explorer.languages"))?.status, "ready");
  assert.ok(plan.choices.some((choice) => choice.label === "전투 방식" && choice.status === "catalog-pending"));
});

test("a no-choice Fighter 8 -> 9 level commits automatic grants without manufacturing a decision", () => {
  const state = fighter();
  state.totalLevel = 8;
  state.classTracks[0].level = 8;
  state.hitDiceByDie.d10 = 8;
  state.proficiencyBonus = 3;
  const plan = buildProgressionPlan(state, { expectedRevision:0,targetClassId:"dnd.srd521.class.fighter",hpMethod:"fixed",selections:{} });
  assert.equal(plan.choices.length, 0);
  assert.ok(plan.automaticGrants.length > 0);
  const result = resolveProgression(state, { expectedRevision:0,targetClassId:"dnd.srd521.class.fighter",hpMethod:"fixed",selections:{} });
  assert.equal(result.status, "committed");
});

test("total level 20 rejects without mutating the source state", () => {
  const state = fighter();
  state.totalLevel = 20;
  state.classTracks[0].level = 20;
  const result = resolveProgression(state, { expectedRevision:0,targetClassId:"dnd.srd521.class.fighter",hpMethod:"fixed",selections:{} });
  assert.equal(result.status, "rejected");
  assert.equal(result.state, state);
});
