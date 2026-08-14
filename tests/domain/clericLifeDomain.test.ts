import assert from "node:assert/strict";
import test from "node:test";
import {
  CLERIC_LIFE_DOMAIN_SUBCLASS_ID,
  resolveLifeDomainHealingSpell,
  resolvePreserveLife,
} from "../../src/domain/clericLifeDomain";
import { CLERIC_CHANNEL_DIVINITY_RESOURCE_ID } from "../../src/domain/coreClassResources";
import { SRD_521_SPELL_MECHANICS } from "../../src/domain/spellMechanics";
import type { SpellCasterContext, SpellCastRequest, SpellCastTarget } from "../../src/domain/spellcasting";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const CURE_WOUNDS = "dnd.srd521.spell.cure-wounds";
const HEALING_WORD = "dnd.srd521.spell.healing-word";

function caster():SpellCasterContext {
  return {
    characterLevel:17,
    spellAttackModifier:8,
    spellSaveDc:17,
    spellcastingAbilityModifier:4,
    preparedSpellIds:[CURE_WOUNDS,HEALING_WORD],
    alwaysPreparedSpellIds:[],
    cantripSpellIds:[],
    slotResourceIds:{ 1:"spell-slot-1" },
  };
}

function creature(id:string, relation:"self"|"ally" = id === "hero" ? "self" : "ally"):SpellCastTarget {
  return {
    id,
    kind:"creature",
    relation,
    distanceFeet:id === "hero" ? 0 : 30,
    visible:true,
    cover:"none",
    ac:12,
    creatureKind:id === "hero" ? "character" : "monster",
    saveModifiers:{},
    targetCanSeeCaster:true,
  };
}

function spellRequest(id:string, spellId:string, target:SpellCastTarget, faces:number[]):SpellCastRequest {
  return {
    id,
    actorId:"hero",
    spellId,
    source:"prepared",
    expectedRevision:0,
    caster:caster(),
    targets:[target],
    slotLevel:1,
    componentsSatisfied:true,
    useActionEconomy:false,
    dice:{ effectFaces:faces },
  };
}

test("Disciple of Life adds 2 + slot level to an executable slotted healing spell", () => {
  const state = runtimeState();
  state.combatants.hero.life.hp = { current:1, maximum:40, temporary:0 };
  const request = spellRequest("life.disciple",CURE_WOUNDS,creature("hero"),[1,2]);
  const result = resolveLifeDomainHealingSpell(
    TEST_PROFILE,
    SRD_521_SPELL_MECHANICS[CURE_WOUNDS],
    state,
    request,
    { clericLevel:3, subclassId:CLERIC_LIFE_DOMAIN_SUBCLASS_ID },
  );
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.hero.life.hp.current,11,"2d8 faces 1+2 + Wis 4 + Disciple 3 = 10 healing");
  assert.equal(result.state.combatants.hero.resources.find((resource) => resource.id === "spell-slot-1")?.current,1);
});

test("Blessed Healer restores the Cleric once when a slotted healing spell heals another creature", () => {
  const state = runtimeState();
  state.combatants.hero.life.hp = { current:5, maximum:30, temporary:0 };
  state.combatants.goblin.life.hp = { current:1, maximum:30, temporary:0 };
  const request = spellRequest("life.blessed-healer",HEALING_WORD,creature("goblin"),[1,1]);
  const result = resolveLifeDomainHealingSpell(
    TEST_PROFILE,
    SRD_521_SPELL_MECHANICS[HEALING_WORD],
    state,
    request,
    { clericLevel:6, subclassId:CLERIC_LIFE_DOMAIN_SUBCLASS_ID },
  );
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.goblin.life.hp.current,10,"Healing Word restores 6 plus Disciple 3");
  assert.equal(result.state.combatants.hero.life.hp.current,8,"Blessed Healer restores 2 + slot level once");
});

test("Supreme Healing replaces healing dice with maximum faces before Disciple of Life is added", () => {
  const state = runtimeState();
  state.combatants.hero.life.hp = { current:1, maximum:50, temporary:0 };
  const request = spellRequest("life.supreme",CURE_WOUNDS,creature("hero"),[1,1]);
  const result = resolveLifeDomainHealingSpell(
    TEST_PROFILE,
    SRD_521_SPELL_MECHANICS[CURE_WOUNDS],
    state,
    request,
    { clericLevel:17, subclassId:CLERIC_LIFE_DOMAIN_SUBCLASS_ID },
  );
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.hero.life.hp.current,24,"max 2d8 = 16 + Wis 4 + Disciple 3 = 23 healing");
  const roll = result.results["life.supreme:healing-roll"] as { dice:Array<{ selectedFaces:number[] }> };
  assert.deepEqual(roll.dice[0]?.selectedFaces,[8,8]);
});

test("Preserve Life atomically spends Channel Divinity and distributes at most 5 x Cleric level without healing above half maximum", () => {
  const state = runtimeState();
  state.combatants.hero.life.hp = { current:4, maximum:20, temporary:0 };
  state.combatants.goblin.life.hp = { current:2, maximum:15, temporary:0 };
  state.combatants.hero.resources.push({
    id:CLERIC_CHANNEL_DIVINITY_RESOURCE_ID,
    label:"Channel Divinity",
    current:2,
    maximum:2,
    recovery:{ shortRest:1, longRest:"all" },
  });
  const result = resolvePreserveLife(TEST_PROFILE,state,{
    id:"life.preserve",
    actorId:"hero",
    expectedRevision:0,
    clericLevel:3,
    subclassId:CLERIC_LIFE_DOMAIN_SUBCLASS_ID,
    useActionEconomy:true,
    allocations:[
      { target:creature("hero"), amount:6 },
      { target:creature("goblin"), amount:5 },
    ],
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.hero.life.hp.current,10);
  assert.equal(result.state.combatants.goblin.life.hp.current,7);
  assert.equal(result.state.combatants.hero.resources.find((resource) => resource.id === CLERIC_CHANNEL_DIVINITY_RESOURCE_ID)?.current,1);
  assert.equal(result.state.combatants.hero.economy.action,false);
});

test("Preserve Life rejects a non-Bloodied/over-half allocation before spending action or Channel Divinity", () => {
  const state = runtimeState();
  state.combatants.hero.life.hp = { current:4, maximum:20, temporary:0 };
  state.combatants.hero.resources.push({
    id:CLERIC_CHANNEL_DIVINITY_RESOURCE_ID,
    label:"Channel Divinity",
    current:2,
    maximum:2,
    recovery:{ shortRest:1, longRest:"all" },
  });
  const result = resolvePreserveLife(TEST_PROFILE,state,{
    id:"life.preserve.reject",
    actorId:"hero",
    expectedRevision:0,
    clericLevel:3,
    subclassId:CLERIC_LIFE_DOMAIN_SUBCLASS_ID,
    useActionEconomy:true,
    allocations:[{ target:creature("hero"), amount:7 }],
  });
  assert.equal(result.status,"rejected");
  assert.match(result.status === "rejected" ? result.error : "",/above half/);
  assert.equal(result.state.combatants.hero.life.hp.current,4);
  assert.equal(result.state.combatants.hero.resources.find((resource) => resource.id === CLERIC_CHANNEL_DIVINITY_RESOURCE_ID)?.current,2);
  assert.equal(result.state.combatants.hero.economy.action,true);
});
