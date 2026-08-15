import assert from "node:assert/strict";
import test from "node:test";
import {
  auraOfCourageSuppressesFrightened,
  auraOfProtectionContribution,
  auraOfProtectionOptions,
  chooseAuraOfProtection,
  paladinAuraRadiusFeet,
} from "../../src/domain/paladinAura";
import {
  DEVOTION_HOLY_NIMBUS_RESOURCE_ID,
  DEVOTION_HOLY_NIMBUS_TAG,
  DEVOTION_SMITE_OF_PROTECTION_TAG,
  auraOfDevotionSuppressesCharmed,
  holyNimbusSavingThrowAdvantage,
  paladinDevotionRuntimeResourceDefinitions,
  resolveDevotionHolyNimbusActivation,
  resolveDevotionHolyNimbusRecovery,
  resolveDevotionHolyNimbusTurnStart,
  resolveDevotionSmiteOfProtection,
  smiteOfProtectionGrantsHalfCover,
} from "../../src/domain/paladinDevotion";
import { PALADIN_ID } from "../../src/domain/classFeatureSpellResources";
import { PALADIN_DEVOTION_SUBCLASS_ID } from "../../src/domain/srdSubclassCatalog";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const fact = (overrides: Partial<Parameters<typeof auraOfProtectionContribution>[0]> = {}) => ({
  paladinId:"paladin-a",
  paladinLevel:6,
  charismaModifier:3,
  incapacitated:false,
  distanceFeet:10,
  relation:"ally" as const,
  ...overrides,
});

test("Aura of Protection starts at 10 feet on level 6 and expands to 30 feet on level 18", () => {
  assert.equal(paladinAuraRadiusFeet(5), 0);
  assert.equal(paladinAuraRadiusFeet(6), 10);
  assert.equal(paladinAuraRadiusFeet(17), 10);
  assert.equal(paladinAuraRadiusFeet(18), 30);
  assert.equal(paladinAuraRadiusFeet(20), 30);
});

test("Aura of Protection grants Charisma modifier with minimum +1 only to self/allies inside the active radius", () => {
  assert.equal(auraOfProtectionContribution(fact())?.bonus, 3);
  assert.equal(auraOfProtectionContribution(fact({ charismaModifier:0 }))?.bonus, 1);
  assert.equal(auraOfProtectionContribution(fact({ charismaModifier:-2 }))?.bonus, 1);
  assert.equal(auraOfProtectionContribution(fact({ relation:"self", distanceFeet:0 }))?.bonus, 3);
  assert.equal(auraOfProtectionContribution(fact({ relation:"enemy" })), undefined);
  assert.equal(auraOfProtectionContribution(fact({ relation:"neutral" })), undefined);
  assert.equal(auraOfProtectionContribution(fact({ distanceFeet:10.1 })), undefined);
  assert.equal(auraOfProtectionContribution(fact({ paladinLevel:5 })), undefined);
  assert.equal(auraOfProtectionContribution(fact({ incapacitated:true })), undefined);
});

test("Aura Expansion permits a 30-foot ally while preserving the same saving-throw bonus", () => {
  const contribution = auraOfProtectionContribution(fact({
    paladinLevel:18,
    charismaModifier:5,
    distanceFeet:30,
  }));
  assert.deepEqual({ bonus:contribution?.bonus, radiusFeet:contribution?.radiusFeet }, { bonus:5, radiusFeet:30 });
});

test("multiple Paladin auras are exposed as alternatives and exactly one chosen aura contributes", () => {
  const facts = [
    fact({ paladinId:"paladin-a", charismaModifier:2 }),
    fact({ paladinId:"paladin-b", charismaModifier:5 }),
    fact({ paladinId:"paladin-c", charismaModifier:4, incapacitated:true }),
  ];
  const options = auraOfProtectionOptions(facts);
  assert.deepEqual(options.map((entry) => [entry.paladinId,entry.bonus]), [["paladin-a",2],["paladin-b",5]]);
  assert.equal(chooseAuraOfProtection(facts, "paladin-b").bonus, 5);
  assert.throws(() => chooseAuraOfProtection(facts, "paladin-c"), /not available/);
});

test("Aura of Courage suppresses Frightened only for self/allies in an active level-10+ Aura of Protection", () => {
  assert.equal(auraOfCourageSuppressesFrightened(fact({ paladinLevel:9 })), false);
  assert.equal(auraOfCourageSuppressesFrightened(fact({ paladinLevel:10 })), true);
  assert.equal(auraOfCourageSuppressesFrightened(fact({ paladinLevel:10, distanceFeet:11 })), false);
  assert.equal(auraOfCourageSuppressesFrightened(fact({ paladinLevel:18, distanceFeet:30 })), true);
  assert.equal(auraOfCourageSuppressesFrightened(fact({ paladinLevel:18, distanceFeet:31 })), false);
  assert.equal(auraOfCourageSuppressesFrightened(fact({ paladinLevel:18, relation:"enemy" })), false);
  assert.equal(auraOfCourageSuppressesFrightened(fact({ paladinLevel:18, incapacitated:true })), false);
});

test("Oath of Devotion level 7 suppresses Charmed through the same active Aura of Protection geometry", () => {
  assert.equal(auraOfDevotionSuppressesCharmed(fact({ paladinLevel:7 }),PALADIN_DEVOTION_SUBCLASS_ID),true);
  assert.equal(auraOfDevotionSuppressesCharmed(fact({ paladinLevel:7, distanceFeet:11 }),PALADIN_DEVOTION_SUBCLASS_ID),false);
  assert.equal(auraOfDevotionSuppressesCharmed(fact({ paladinLevel:18, distanceFeet:30 }),PALADIN_DEVOTION_SUBCLASS_ID),true);
  assert.equal(auraOfDevotionSuppressesCharmed(fact({ paladinLevel:18, relation:"enemy" }),PALADIN_DEVOTION_SUBCLASS_ID),false);
  assert.equal(auraOfDevotionSuppressesCharmed(fact({ paladinLevel:18, incapacitated:true }),PALADIN_DEVOTION_SUBCLASS_ID),false);
});

test("Smite of Protection creates a next-turn-boundary marker and grants Half Cover only inside the active Protection aura", () => {
  const state = runtimeState();
  const result = resolveDevotionSmiteOfProtection(TEST_PROFILE,state,{
    id:"devotion.smite-protection",
    actorId:"hero",
    expectedRevision:state.revision,
    paladinLevel:15,
    subclassId:PALADIN_DEVOTION_SUBCLASS_ID,
    divineSmiteCast:true,
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  const marker = result.state.effects.find((effect) => effect.tags.includes(DEVOTION_SMITE_OF_PROTECTION_TAG));
  assert.ok(marker);
  assert.deepEqual(marker?.expiry,{ kind:"turn-boundary", actorId:"hero", round:state.clock.round + 1, boundary:"start" });
  assert.equal(smiteOfProtectionGrantsHalfCover({
    state:result.state,
    paladinId:"hero",
    paladinLevel:15,
    subclassId:PALADIN_DEVOTION_SUBCLASS_ID,
    paladinIncapacitated:false,
    relation:"ally",
    distanceFeet:10,
  }),true);
  assert.equal(smiteOfProtectionGrantsHalfCover({
    state:result.state,
    paladinId:"hero",
    paladinLevel:15,
    subclassId:PALADIN_DEVOTION_SUBCLASS_ID,
    paladinIncapacitated:false,
    relation:"ally",
    distanceFeet:11,
  }),false);
});

test("Holy Nimbus projects one Long-Rest use, activates for ten minutes, grants Fiend/Undead save advantage, damages enemies on turn start, and recovers from a level-5 slot", () => {
  const definitions = paladinDevotionRuntimeResourceDefinitions(
    [{ classId:PALADIN_ID, className:"팔라딘", level:20, subclassName:"헌신의 맹세" }],
    { [PALADIN_ID]:PALADIN_DEVOTION_SUBCLASS_ID },
  );
  assert.deepEqual(definitions.map((entry) => [entry.resourceId,entry.maximum,entry.recovery.longRest]),[
    [DEVOTION_HOLY_NIMBUS_RESOURCE_ID,1,"all"],
  ]);

  const state = runtimeState();
  state.combatants.hero.resources.push(
    { id:DEVOTION_HOLY_NIMBUS_RESOURCE_ID, label:"성스러운 후광", current:1, maximum:1, recovery:{ longRest:"all" } },
    { id:"spell-slot-5", label:"5레벨 주문 슬롯", current:1, maximum:1, recovery:{ longRest:"all" } },
  );
  const activated = resolveDevotionHolyNimbusActivation(TEST_PROFILE,state,{
    id:"devotion.holy-nimbus",
    actorId:"hero",
    expectedRevision:state.revision,
    paladinLevel:20,
    subclassId:PALADIN_DEVOTION_SUBCLASS_ID,
    charismaModifier:5,
    proficiencyBonus:6,
  });
  assert.equal(activated.status,"committed");
  if (activated.status !== "committed") return;
  assert.equal(activated.state.combatants.hero.economy.bonusAction,false);
  assert.equal(activated.state.combatants.hero.resources.find((entry) => entry.id === DEVOTION_HOLY_NIMBUS_RESOURCE_ID)?.current,0);
  const nimbus = activated.state.effects.find((effect) => effect.tags.includes(DEVOTION_HOLY_NIMBUS_TAG));
  assert.ok(nimbus);
  assert.deepEqual(nimbus?.expiry,{ kind:"time", elapsedSeconds:state.clock.elapsedSeconds + 600 });
  assert.equal(nimbus?.metadata?.sunlight,true);
  assert.equal(holyNimbusSavingThrowAdvantage({
    state:activated.state,
    paladinId:"hero",
    paladinLevel:20,
    subclassId:PALADIN_DEVOTION_SUBCLASS_ID,
    paladinIncapacitated:false,
    relation:"ally",
    distanceFeet:30,
    sourceCreatureType:"undead",
  })?.state,"advantage");
  assert.equal(holyNimbusSavingThrowAdvantage({
    state:activated.state,
    paladinId:"hero",
    paladinLevel:20,
    subclassId:PALADIN_DEVOTION_SUBCLASS_ID,
    paladinIncapacitated:false,
    relation:"ally",
    distanceFeet:30,
    sourceCreatureType:"dragon",
  }),undefined);

  const hpBefore = activated.state.combatants.goblin.life.hp.current;
  const turnStart = resolveDevotionHolyNimbusTurnStart(TEST_PROFILE,activated.state,{
    id:"devotion.holy-nimbus.enemy-turn",
    paladinId:"hero",
    targetId:"goblin",
    expectedRevision:activated.state.revision,
    paladinLevel:20,
    subclassId:PALADIN_DEVOTION_SUBCLASS_ID,
    paladinIncapacitated:false,
    relationToPaladin:"enemy",
    distanceFeet:30,
    round:activated.state.clock.round,
    creatureKind:"monster",
  });
  assert.equal(turnStart.status,"committed");
  if (turnStart.status !== "committed") return;
  assert.equal(turnStart.state.combatants.goblin.life.hp.current,hpBefore - 11);

  const recovered = resolveDevotionHolyNimbusRecovery(TEST_PROFILE,turnStart.state,{
    id:"devotion.holy-nimbus.recover",
    actorId:"hero",
    expectedRevision:turnStart.state.revision,
    paladinLevel:20,
    subclassId:PALADIN_DEVOTION_SUBCLASS_ID,
    spellSlotLevel:5,
    spellSlotResourceId:"spell-slot-5",
  });
  assert.equal(recovered.status,"committed");
  if (recovered.status !== "committed") return;
  assert.equal(recovered.state.combatants.hero.resources.find((entry) => entry.id === "spell-slot-5")?.current,0);
  assert.equal(recovered.state.combatants.hero.resources.find((entry) => entry.id === DEVOTION_HOLY_NIMBUS_RESOURCE_ID)?.current,1);
});
