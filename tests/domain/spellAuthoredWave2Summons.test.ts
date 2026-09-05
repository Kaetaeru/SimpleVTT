import assert from "node:assert/strict";
import test from "node:test";
import { effectAttackDamageRiders } from "../../src/domain/effectAttackRiders";
import { authoredSpellMechanicById, spellMechanicById } from "../../src/domain/spellMechanics";
import { resolveSpellCast, type SpellCasterContext, type SpellCastTarget } from "../../src/domain/spellcasting";
import type { RulesRuntimeState } from "../../src/domain/combatState";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

// V1.3 C1-03 wave 2 (summons): the summoned form is narrated, the damage it deals is executable.
const WAVE_2_SUMMONS=[
  "dnd.srd521.spell.guardian-of-faith","dnd.srd521.spell.arcane-sword","dnd.srd521.spell.conjure-animals","dnd.srd521.spell.conjure-celestial",
  "dnd.srd521.spell.conjure-minor-elementals","dnd.srd521.spell.conjure-elemental","dnd.srd521.spell.fire-shield",
];

const CASTER:SpellCasterContext={
  characterLevel:17,spellAttackModifier:9,spellSaveDc:17,spellcastingAbilityModifier:5,
  preparedSpellIds:WAVE_2_SUMMONS,alwaysPreparedSpellIds:[],cantripSpellIds:[],
  slotResourceIds:Object.fromEntries([1,2,3,4,5,6,7,8,9].map((level)=>[level,`spell-slot-${level}`])),
};

function stateWithSlots() {
  const state=runtimeState();
  for(const level of [2,3,4,5,6,7,8,9])state.combatants.hero.resources.push({id:`spell-slot-${level}`,label:`${level}레벨 주문 슬롯`,current:1,maximum:1,recovery:{longRest:"all"}});
  state.combatants.goblin.life.hp={current:200,maximum:200,temporary:0};
  return state;
}

function target(id:string,relation:"self"|"enemy"):SpellCastTarget {
  return {id,kind:"creature",relation,distanceFeet:relation==="self"?0:5,visible:true,cover:"none",ac:12,creatureKind:id==="hero"?"character":"monster",saveModifiers:{},targetCanSeeCaster:true};
}

function cast(spellId:string,state:RulesRuntimeState,targets:SpellCastTarget[],saveFace=3) {
  const definition=spellMechanicById(spellId)!;
  const dice={
    attack:{id:"attack",purpose:"spell attack",sides:20,faces:[15]},
    saves:Object.fromEntries(targets.map((entry)=>[entry.id,{id:`save-${entry.id}`,purpose:"save",sides:20,faces:[saveFace]}])),
    effectFaces:Array.from({length:40},()=>4),
  };
  const result=resolveSpellCast(TEST_PROFILE,definition,state,{
    id:`cast.${spellId}`,actorId:"hero",spellId,source:"prepared",expectedRevision:state.revision,
    caster:CASTER,targets,slotLevel:definition.baseLevel,componentsSatisfied:true,useActionEconomy:false,dice:dice as never,
  });
  assert.equal(result.status,"committed",`${spellId}: ${JSON.stringify("error" in result?result.error:result.status)}`);
  if(result.status!=="committed")throw new Error("unreachable");
  return result.state;
}

test("the summons wave is authored and combat-executable",()=>{
  for(const spellId of WAVE_2_SUMMONS){
    const authored=authoredSpellMechanicById(spellId);
    assert.ok(authored&&/Authored \(C1-03\)/.test(authored.executionScope??""),`${spellId} is authored`);
    assert.equal(spellMechanicById(spellId)?.runtimeSupport,"combat-executable");
  }
});

test("Guardian of Faith deals a flat 20 radiant, half on a save",()=>{
  assert.equal(cast("dnd.srd521.spell.guardian-of-faith",stateWithSlots(),[target("goblin","enemy")],3).combatants.goblin.life.hp.current,180);
  assert.equal(cast("dnd.srd521.spell.guardian-of-faith",stateWithSlots(),[target("goblin","enemy")],20).combatants.goblin.life.hp.current,190);
});

test("Arcane Sword is a 4d12 force spell attack",()=>{
  assert.equal(cast("dnd.srd521.spell.arcane-sword",stateWithSlots(),[target("goblin","enemy")]).combatants.goblin.life.hp.current,184);
});

test("Conjure Elemental restrains on a failed save and Conjure Minor Elementals rides on the caster's hits",()=>{
  const elemental=cast("dnd.srd521.spell.conjure-elemental",stateWithSlots(),[target("goblin","enemy")],3);
  assert.equal(elemental.combatants.goblin.life.hp.current,168,"8d8 at faces 4");
  assert.ok(elemental.effects.some((effect)=>effect.kind==="condition"&&effect.conditionId==="restrained"&&effect.targetId==="goblin"));
  const minor=cast("dnd.srd521.spell.conjure-minor-elementals",stateWithSlots(),[target("hero","self")]);
  const riders=effectAttackDamageRiders(minor,"hero","goblin","weapon","seed");
  assert.deepEqual(riders.map((rider)=>[rider.damageType,rider.dice[0].count,rider.dice[0].sides]),[["fire",2,8]]);
  const shielded=cast("dnd.srd521.spell.fire-shield",stateWithSlots(),[target("hero","self")]);
  assert.ok(shielded.effects.some((effect)=>effect.targetId==="hero"&&effect.tags.includes("damage-resistance:cold")));
});
