import assert from "node:assert/strict";
import test from "node:test";
import { buildProgressionPlan, resolveProgression, type ProgressionCharacterState } from "../../src/domain/progression";
import { classCantripListEntries, classSpellListAllEntries, classSpellListEntries, stableSpellId } from "../../src/domain/spellListCatalog";
import { WARLOCK_ID } from "../../src/domain/warlockProgressionChoices";
import {
  FIEND_DARK_ONES_OWN_LUCK_FEATURE_ID,
  FIEND_DARK_ONES_OWN_LUCK_RESOURCE_ID,
  FIEND_FIENDISH_RESILIENCE_FEATURE_ID,
  FIEND_HURL_THROUGH_HELL_FEATURE_ID,
  FIEND_HURL_THROUGH_HELL_RESOURCE_ID,
  fiendishResilienceDefense,
  resolveFiendHurlThroughHell,
  resolveFiendHurlThroughHellRecovery,
  resolveFiendishResilienceSelection,
  warlockFiendRuntimeResourceDefinitions,
} from "../../src/domain/warlockFiend";
import { WARLOCK_FIEND_SUBCLASS_ID } from "../../src/domain/srdSubclassCatalog";
import { srdSubclassRelationship } from "../../src/domain/srdSubclassProgression";
import { resolvePendingResolution } from "../../src/domain/resolution";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const cantripChoice = (level: number) => `progression.${WARLOCK_ID}.${level}.column.소마법`;
const preparedChoice = (level: number) => `progression.${WARLOCK_ID}.${level}.column.준비 주문`;
const invocationChoice = (level: number, slot: number) => `progression.${WARLOCK_ID}.${level}.invocation-slot.${slot}`;
const arcanumChoice = (level: number, spellLevel: number) => `progression.${WARLOCK_ID}.${level}.mystic-arcanum.${spellLevel}`;

function fighterFive(): ProgressionCharacterState {
  return {
    revision:0,
    id:"fighter-warlock",
    name:"Aelar",
    totalLevel:5,
    abilities:{ str:16,dex:12,con:14,int:10,wis:10,cha:16 },
    hpCurrent:38,
    hpMaximum:44,
    proficiencyBonus:3,
    classTracks:[{ classId:"dnd.srd521.class.fighter", className:"파이터", level:5, subclassName:"챔피언" }],
    hitDiceByDie:{ d10:5 },
    features:["추가 공격"],
    cantripIds:[],
    preparedSpellIds:[],
    eldritchInvocationIds:[],
  };
}

function warlockOne(): ProgressionCharacterState {
  return {
    revision:0,
    id:"warlock",
    name:"Vex",
    totalLevel:1,
    abilities:{ str:8,dex:14,con:14,int:10,wis:12,cha:18 },
    hpCurrent:10,
    hpMaximum:10,
    proficiencyBonus:2,
    classTracks:[{ classId:WARLOCK_ID, className:"워락", level:1 }],
    hitDiceByDie:{ d8:1 },
    features:["계약 마법"],
    cantripIds:[stableSpellId("Eldritch Blast"),stableSpellId("Prestidigitation")],
    preparedSpellIds:[stableSpellId("Hex"),stableSpellId("Hellish Rebuke")],
    eldritchInvocationIds:["invocation:pact-of-the-blade"],
    eldritchInvocationSources:{ "invocation:pact-of-the-blade":"워락 1레벨 · 섬뜩한 기원술 · SRD 5.2.1" },
    pactMagicSlotLevel:1,
    pactMagicSlotMaximum:1,
  };
}

test("canonical Warlock spell list contains 7 cantrips and 65 leveled SRD 5.2.1 spells", () => {
  assert.equal(classCantripListEntries(WARLOCK_ID).length, 7);
  assert.equal(classSpellListEntries(WARLOCK_ID).length, 65);
  assert.equal(classSpellListAllEntries(WARLOCK_ID).length, 72);
  assert.ok(classCantripListEntries(WARLOCK_ID).some((entry) => entry.id === stableSpellId("Eldritch Blast")));
  assert.ok(classSpellListEntries(WARLOCK_ID).some((entry) => entry.id === stableSpellId("Hex") && entry.level === 1));
  assert.ok(classSpellListEntries(WARLOCK_ID).some((entry) => entry.id === stableSpellId("Forcecage") && entry.level === 7));
  assert.ok(classSpellListEntries(WARLOCK_ID).some((entry) => entry.id === stableSpellId("Weird") && entry.level === 9));
});

test("multiclass Fighter 5 -> Warlock 1 keeps Pact Magic separate while committing cantrips, prepared spells, and one invocation", () => {
  const state = fighterFive();
  const cantrips = [stableSpellId("Eldritch Blast"),stableSpellId("Prestidigitation")];
  const prepared = [stableSpellId("Hex"),stableSpellId("Hellish Rebuke")];
  const request = {
    expectedRevision:0,
    targetClassId:WARLOCK_ID,
    hpMethod:"fixed" as const,
    selections:{
      [cantripChoice(1)]:{ kind:"options" as const, optionIds:cantrips },
      [preparedChoice(1)]:{ kind:"options" as const, optionIds:prepared },
      [invocationChoice(1,1)]:{ kind:"options" as const, optionIds:["invocation:pact-of-the-blade"] },
    },
  };
  const plan = buildProgressionPlan(state, request);
  assert.equal(plan.choices.find((choice) => choice.id === cantripChoice(1))?.count, 2);
  assert.equal(plan.choices.find((choice) => choice.id === preparedChoice(1))?.count, 2);
  assert.equal(plan.choices.find((choice) => choice.id === invocationChoice(1,1))?.status, "ready");
  const tome = plan.choices.find((choice) => choice.id === invocationChoice(1,1))?.options.find((option) => option.id === "invocation:pact-of-the-tome");
  assert.ok(tome);
  assert.equal(tome?.disabledReason, undefined, "Pact of the Tome is executable now that Book of Shadows configuration has canonical Ritual metadata");
  assert.equal(plan.blocking.length, 0);
  assert.equal(plan.spellcastingAfter.casterLevel, 0, "Warlock Pact Magic must stay out of multiclass Spellcasting caster level");
  assert.deepEqual(plan.pactMagicAfter, { slotLevel:1, slotMaximum:1 });

  const result = resolveProgression(state, request);
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.deepEqual(new Set(result.state.cantripIds), new Set(cantrips));
  assert.deepEqual(new Set(result.state.preparedSpellIds), new Set(prepared));
  assert.deepEqual(result.state.eldritchInvocationIds, ["invocation:pact-of-the-blade"]);
  assert.equal(result.state.pactMagicSlotLevel, 1);
  assert.equal(result.state.pactMagicSlotMaximum, 1);
  assert.equal(Object.values(result.state.spellSlotMaximums ?? {}).some((count) => count > 0), false);
});

test("Warlock 1 -> 2 adds one prepared spell and two invocations while Pact Magic grows to two level-1 slots", () => {
  const state = warlockOne();
  const charmPerson = stableSpellId("Charm Person");
  const request = {
    expectedRevision:0,
    targetClassId:WARLOCK_ID,
    hpMethod:"fixed" as const,
    selections:{
      [preparedChoice(2)]:{ kind:"options" as const, optionIds:[charmPerson] },
      [invocationChoice(2,1)]:{ kind:"options" as const, optionIds:["invocation:devils-sight"] },
      [invocationChoice(2,2)]:{ kind:"options" as const, optionIds:["invocation:fiendish-vigor"] },
    },
  };
  const plan = buildProgressionPlan(state, request);
  assert.equal(plan.choices.find((choice) => choice.id === preparedChoice(2))?.count, 1);
  assert.equal(plan.choices.filter((choice) => choice.id.includes(".invocation-slot.")).length, 2);
  assert.equal(plan.choices.find((choice) => choice.id === invocationChoice(2,1))?.options.find((option) => option.id === "invocation:pact-of-the-blade")?.disabledReason, "이미 알고 있는 기원술입니다.");
  assert.equal(plan.blocking.length, 0);
  assert.deepEqual(plan.pactMagicAfter, { slotLevel:1, slotMaximum:2 });

  const result = resolveProgression(state, request);
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.ok(result.state.preparedSpellIds?.includes(charmPerson));
  assert.deepEqual(new Set(result.state.eldritchInvocationIds), new Set(["invocation:pact-of-the-blade","invocation:devils-sight","invocation:fiendish-vigor"]));
  assert.equal(result.state.eldritchInvocationSources?.["invocation:devils-sight"], "워락 2레벨 · 섬뜩한 기원술 · SRD 5.2.1");
  assert.equal(result.state.pactMagicSlotMaximum, 2);
});

test("Repeatable invocation acquisition allows the same base on different cantrip targets but rejects the same concrete target twice", () => {
  const state = warlockOne();
  state.cantripIds = [stableSpellId("Eldritch Blast"),stableSpellId("Chill Touch")];
  const eldritch = `invocation:agonizing-blast|target=${stableSpellId("Eldritch Blast")}`;
  const chill = `invocation:agonizing-blast|target=${stableSpellId("Chill Touch")}`;
  const prepared = stableSpellId("Charm Person");
  const valid = resolveProgression(state, {
    expectedRevision:0,targetClassId:WARLOCK_ID,hpMethod:"fixed",
    selections:{
      [preparedChoice(2)]:{ kind:"options", optionIds:[prepared] },
      [invocationChoice(2,1)]:{ kind:"options", optionIds:[eldritch] },
      [invocationChoice(2,2)]:{ kind:"options", optionIds:[chill] },
    },
  });
  assert.equal(valid.status, "committed");
  if (valid.status === "committed") assert.ok(valid.state.eldritchInvocationIds?.includes(eldritch) && valid.state.eldritchInvocationIds?.includes(chill));

  const duplicate = resolveProgression(state, {
    expectedRevision:0,targetClassId:WARLOCK_ID,hpMethod:"fixed",
    selections:{
      [preparedChoice(2)]:{ kind:"options", optionIds:[prepared] },
      [invocationChoice(2,1)]:{ kind:"options", optionIds:[eldritch] },
      [invocationChoice(2,2)]:{ kind:"options", optionIds:[eldritch] },
    },
  });
  assert.equal(duplicate.status, "rejected");
  if (duplicate.status === "rejected") assert.match(duplicate.error, /중복/);
});

test("Warlock 10 -> 11 grants a separate level-6 Mystic Arcanum and increases Pact Magic slots without mixing either into ordinary slots", () => {
  const state = warlockOne();
  state.totalLevel = 10;
  state.classTracks[0] = { classId:WARLOCK_ID, className:"워락", level:10, subclassName:"마족 후원자" };
  state.hitDiceByDie.d8 = 10;
  state.hpCurrent = 70;
  state.hpMaximum = 70;
  state.proficiencyBonus = 4;
  state.cantripIds = ["Eldritch Blast","Prestidigitation","Chill Touch","Mage Hand"].map(stableSpellId);
  state.preparedSpellIds = [
    "Hex","Hellish Rebuke","Charm Person","Hold Person","Misty Step","Counterspell","Fly","Banishment","Blight","Hold Monster",
  ].map(stableSpellId);
  state.eldritchInvocationIds = [
    "invocation:pact-of-the-blade","invocation:devils-sight","invocation:fiendish-vigor","invocation:mask-of-many-faces",
    "invocation:misty-visions","invocation:thirsting-blade","invocation:lifedrinker",
  ];
  state.pactMagicSlotLevel = 5;
  state.pactMagicSlotMaximum = 2;

  const prepared = stableSpellId("Scrying");
  const arcanum = stableSpellId("Circle of Death");
  const request = {
    expectedRevision:0,targetClassId:WARLOCK_ID,hpMethod:"fixed" as const,
    selections:{
      [preparedChoice(11)]:{ kind:"options" as const, optionIds:[prepared] },
      [arcanumChoice(11,6)]:{ kind:"options" as const, optionIds:[arcanum] },
    },
  };
  const plan = buildProgressionPlan(state, request);
  assert.equal(plan.choices.find((choice) => choice.id === arcanumChoice(11,6))?.status, "ready");
  assert.equal(plan.blocking.length, 0);
  assert.deepEqual(plan.pactMagicAfter, { slotLevel:5, slotMaximum:3 });
  assert.equal(plan.spellcastingAfter.casterLevel, 0);

  const result = resolveProgression(state, request);
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.mysticArcanumSpellIds?.[6], arcanum);
  assert.equal(result.state.mysticArcanumSources?.[6], "워락 11레벨 · 신비한 비전 · SRD 5.2.1");
  assert.equal(result.state.preparedSpellIds?.includes(arcanum), false, "Mystic Arcanum must remain separate from ordinary Pact Magic prepared spells");
  assert.equal(result.state.pactMagicSlotMaximum, 3);
  assert.equal(Object.values(result.state.spellSlotMaximums ?? {}).some((count) => count > 0), false);
});

test("Fiend 6/10/14 progression relationships are stable and runtime resources follow Charisma plus Long-Rest usage", () => {
  assert.deepEqual(
    [6,10,14].map((level) => srdSubclassRelationship(WARLOCK_ID,WARLOCK_FIEND_SUBCLASS_ID,level)?.features[0]?.id),
    [FIEND_DARK_ONES_OWN_LUCK_FEATURE_ID,FIEND_FIENDISH_RESILIENCE_FEATURE_ID,FIEND_HURL_THROUGH_HELL_FEATURE_ID],
  );
  const definitions = warlockFiendRuntimeResourceDefinitions(
    [{ classId:WARLOCK_ID, className:"워락", level:14, subclassName:"악마 후원자" }],
    { [WARLOCK_ID]:WARLOCK_FIEND_SUBCLASS_ID },
    18,
  );
  assert.deepEqual(definitions.map((entry) => [entry.resourceId,entry.maximum]),[
    [FIEND_DARK_ONES_OWN_LUCK_RESOURCE_ID,4],
    [FIEND_HURL_THROUGH_HELL_RESOURCE_ID,1],
  ]);
  assert.ok(definitions.every((entry) => entry.recovery.longRest === "all"));
});

test("Fiendish Resilience rest selection replaces the prior type and its effect tag participates in the normal damage pipeline", () => {
  const state = runtimeState();
  const selected = resolveFiendishResilienceSelection(TEST_PROFILE,state,{
    id:"fiend.resilience.fire",
    actorId:"hero",
    expectedRevision:state.revision,
    warlockLevel:10,
    subclassId:WARLOCK_FIEND_SUBCLASS_ID,
    rest:"short",
    damageType:"fire",
  });
  assert.equal(selected.status,"committed");
  if (selected.status !== "committed") return;
  assert.deepEqual(fiendishResilienceDefense(selected.state,"hero","fire"),{
    source:FIEND_FIENDISH_RESILIENCE_FEATURE_ID,
    kind:"resistance",
    damageType:"fire",
  });
  const damaged = resolvePendingResolution(TEST_PROFILE,selected.state,{
    id:"fiend.resilience.damage",
    actorId:"goblin",
    sourceId:"test:fire",
    expectedRevision:selected.state.revision,
    operations:[{ id:"damage", kind:"damage", targetId:"hero", damageType:"fire", amount:9, creatureKind:"character" }],
  });
  assert.equal(damaged.status,"committed");
  if (damaged.status !== "committed") return;
  assert.equal(damaged.state.combatants.hero.life.hp.current,16,"9 fire damage is resisted to 4");

  const replaced = resolveFiendishResilienceSelection(TEST_PROFILE,damaged.state,{
    id:"fiend.resilience.cold",
    actorId:"hero",
    expectedRevision:damaged.state.revision,
    warlockLevel:10,
    subclassId:WARLOCK_FIEND_SUBCLASS_ID,
    rest:"long",
    damageType:"cold",
  });
  assert.equal(replaced.status,"committed");
  if (replaced.status !== "committed") return;
  assert.equal(fiendishResilienceDefense(replaced.state,"hero","fire"),undefined);
  assert.equal(fiendishResilienceDefense(replaced.state,"hero","cold")?.kind,"resistance");
  const force = resolveFiendishResilienceSelection(TEST_PROFILE,replaced.state,{
    id:"fiend.resilience.force",
    actorId:"hero",
    expectedRevision:replaced.state.revision,
    warlockLevel:10,
    subclassId:WARLOCK_FIEND_SUBCLASS_ID,
    rest:"short",
    damageType:"force",
  });
  assert.equal(force.status,"rejected");
});

test("Hurl Through Hell consumes its use on the save, removes the failed target from scene targeting, deals 8d10 psychic to non-Fiends, and Pact Magic can recharge it", () => {
  const state = runtimeState();
  state.clock.activeActorId = "hero";
  state.turnFeatureUsage = { actorId:"hero", featureIds:[] };
  state.combatants.goblin.life.hp = { current:100, maximum:100, temporary:0 };
  state.combatants.hero.resources.push(
    { id:FIEND_HURL_THROUGH_HELL_RESOURCE_ID, label:"지옥으로 내던지기", current:1, maximum:1, recovery:{ longRest:"all" } },
    { id:"pact-slot", label:"계약 마법 슬롯", current:1, maximum:1, recovery:{ shortRest:"all", longRest:"all" } },
  );
  const hurled = resolveFiendHurlThroughHell(TEST_PROFILE,state,{
    id:"fiend.hurl",
    actorId:"hero",
    expectedRevision:state.revision,
    warlockLevel:14,
    subclassId:WARLOCK_FIEND_SUBCLASS_ID,
    attackHit:true,
    targetId:"goblin",
    targetCreatureKind:"monster",
    targetCreatureType:"humanoid",
    targetCharismaSaveModifier:1,
    spellSaveDc:16,
    saveDice:{ id:"fiend-hurl-save", purpose:"Charisma save", sides:20, faces:[4] },
    psychicDamageFaces:[5,5,5,5,5,5,5,5],
  });
  assert.equal(hurled.status,"committed");
  if (hurled.status !== "committed") return;
  assert.equal(hurled.state.combatants.hero.resources.find((entry) => entry.id === FIEND_HURL_THROUGH_HELL_RESOURCE_ID)?.current,0);
  assert.equal(hurled.state.combatants.goblin.life.hp.current,60);
  assert.ok(hurled.state.effects.some((effect) => effect.targetId === "goblin" && effect.conditionId === "incapacitated"));

  const targetAttempt = resolvePendingResolution(TEST_PROFILE,hurled.state,{
    id:"fiend.hurl.target-attempt",
    actorId:"hero",
    sourceId:"test:attack",
    expectedRevision:hurled.state.revision,
    operations:[{
      id:"target",
      kind:"targeting",
      sourceId:"hero",
      rule:{ kind:"creature", rangeFeet:30, minTargets:1, maxTargets:1, allowedRelations:["enemy"], requiresSight:true, directTarget:true },
      targets:[{ id:"goblin", kind:"creature", relation:"enemy", distanceFeet:5, visible:true, cover:"none" }],
      harmful:true,
    }],
  });
  assert.equal(targetAttempt.status,"rejected");
  if (targetAttempt.status === "rejected") assert.match(targetAttempt.error,/temporarily unavailable/);

  const recovered = resolveFiendHurlThroughHellRecovery(TEST_PROFILE,hurled.state,{
    id:"fiend.hurl.recover",
    actorId:"hero",
    expectedRevision:hurled.state.revision,
    warlockLevel:14,
    subclassId:WARLOCK_FIEND_SUBCLASS_ID,
    pactMagicSlotResourceId:"pact-slot",
  });
  assert.equal(recovered.status,"committed");
  if (recovered.status !== "committed") return;
  assert.equal(recovered.state.combatants.hero.resources.find((entry) => entry.id === "pact-slot")?.current,0);
  assert.equal(recovered.state.combatants.hero.resources.find((entry) => entry.id === FIEND_HURL_THROUGH_HELL_RESOURCE_ID)?.current,1);

  const sameTurn = resolveFiendHurlThroughHell(TEST_PROFILE,recovered.state,{
    id:"fiend.hurl.same-turn",
    actorId:"hero",
    expectedRevision:recovered.state.revision,
    warlockLevel:14,
    subclassId:WARLOCK_FIEND_SUBCLASS_ID,
    attackHit:true,
    targetId:"goblin",
    targetCreatureKind:"monster",
    targetCreatureType:"humanoid",
    targetCharismaSaveModifier:1,
    spellSaveDc:16,
    saveDice:{ id:"fiend-hurl-save-2", purpose:"Charisma save", sides:20, faces:[4] },
    psychicDamageFaces:[1,1,1,1,1,1,1,1],
  });
  assert.equal(sameTurn.status,"rejected");
  if (sameTurn.status === "rejected") assert.match(sameTurn.error,/already been used this turn/);
});
