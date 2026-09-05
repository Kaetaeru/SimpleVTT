import assert from "node:assert/strict";
import test from "node:test";
import { resolveAttack, type AttackRequest } from "../../src/domain/attack";
import { effectAttackDamageRiders } from "../../src/domain/effectAttackRiders";
import { deterministicFace } from "../../src/domain/seededFace";
import { authoredSpellMechanicById, SPELL_EXECUTION_COVERAGE, spellMechanicById } from "../../src/domain/spellMechanics";
import { resolveSpellCast, type SpellCasterContext, type SpellCastTarget } from "../../src/domain/spellcasting";
import type { RulesRuntimeState } from "../../src/domain/combatState";
import type { D20TestResult } from "../../src/domain/d20";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

// V1.3 C1-03 wave 2 (engine): spells that needed AC, defense, d20-bonus and attack-rider vocabulary.
const WAVE_2_ENGINE=[
  "dnd.srd521.spell.shield","dnd.srd521.spell.shield-of-faith","dnd.srd521.spell.barkskin","dnd.srd521.spell.warding-bond",
  "dnd.srd521.spell.stoneskin","dnd.srd521.spell.protection-from-energy","dnd.srd521.spell.bless","dnd.srd521.spell.bane",
  "dnd.srd521.spell.guidance","dnd.srd521.spell.resistance","dnd.srd521.spell.heroism","dnd.srd521.spell.hunter-s-mark",
  "dnd.srd521.spell.hex","dnd.srd521.spell.divine-favor","dnd.srd521.spell.magic-weapon","dnd.srd521.spell.heat-metal",
  "dnd.srd521.spell.haste",
];

const CASTER:SpellCasterContext={
  characterLevel:17,spellAttackModifier:9,spellSaveDc:17,spellcastingAbilityModifier:5,
  preparedSpellIds:[...WAVE_2_ENGINE,"dnd.srd521.spell.disintegrate"],alwaysPreparedSpellIds:[],cantripSpellIds:["dnd.srd521.spell.guidance","dnd.srd521.spell.resistance"],
  slotResourceIds:Object.fromEntries([1,2,3,4,5,6,7,8,9].map((level)=>[level,`spell-slot-${level}`])),
};

function stateWithSlots() {
  const state=runtimeState();
  for(const level of [2,3,4,5,6,7,8,9])state.combatants.hero.resources.push({id:`spell-slot-${level}`,label:`${level}레벨 주문 슬롯`,current:2,maximum:2,recovery:{longRest:"all"}});
  Object.assign(state.combatants.hero.resources.find((entry)=>entry.id==="spell-slot-1")!,{current:4,maximum:4});
  state.combatants.goblin.life.hp={current:200,maximum:200,temporary:0};
  return state;
}

function target(id:string,relation:"self"|"ally"|"enemy"):SpellCastTarget {
  return {id,kind:"creature",relation,distanceFeet:relation==="self"?0:5,visible:true,cover:"none",ac:12,creatureKind:id==="hero"?"character":"monster",saveModifiers:{},targetCanSeeCaster:true};
}

function cast(spellId:string,state:RulesRuntimeState,targets:SpellCastTarget[],saveFace=3,slotLevel?:number) {
  const definition=spellMechanicById(spellId)!;
  const dice={
    attack:{id:"attack",purpose:"spell attack",sides:20,faces:[15]},
    saves:Object.fromEntries(targets.map((entry)=>[entry.id,{id:`save-${entry.id}`,purpose:"save",sides:20,faces:[saveFace]}])),
    effectFaces:Array.from({length:40},()=>4),
    projectileFaces:Array.from({length:12},()=>4),
  };
  const result=resolveSpellCast(TEST_PROFILE,definition,state,{
    id:`cast.${spellId}.${state.revision}`,actorId:"hero",spellId,source:"prepared",expectedRevision:state.revision,
    caster:CASTER,targets,slotLevel:slotLevel??(definition.baseLevel>0?definition.baseLevel:undefined),
    componentsSatisfied:true,useActionEconomy:false,dice:dice as never,
  });
  assert.equal(result.status,"committed",`${spellId}: ${JSON.stringify("error" in result?result.error:result.status)}`);
  if(result.status!=="committed")throw new Error("unreachable");
  return result.state;
}

function attack(state:RulesRuntimeState,actorId:"hero"|"goblin",targetId:string,face:number,riders?:AttackRequest["riders"]) {
  const request:AttackRequest={
    id:`attack.${state.revision}`,actorId,expectedRevision:state.revision,sourceId:"weapon:longsword",sourceKind:"weapon",
    target:{id:targetId,kind:"creature",relation:"enemy",distanceFeet:5,visible:true,cover:"none",ac:12,creatureKind:targetId==="hero"?"character":"monster",targetCanSeeAttacker:true},
    rangeFeet:5,attackDice:{id:`d20-${state.revision}`,purpose:"weapon attack",sides:20,faces:[face]},
    attackModifierContributions:[{source:"weapon:attack-modifier",value:5}],
    baseDamage:{sourceId:"weapon:longsword",damageType:"slashing",dice:[{source:"weapon:longsword",count:1,sides:8,faces:[6,6]}],flat:[{source:"weapon:ability",value:3}]},
    riders,
    concentrationCheck:{dice:{id:`concentration-${state.revision}`,purpose:"concentration",sides:20,faces:[20]}},
  };
  const result=resolveAttack(TEST_PROFILE,state,request);
  assert.equal(result.status,"committed",`attack: ${JSON.stringify("error" in result?result.error:result.status)}`);
  if(result.status!=="committed")throw new Error("unreachable");
  return {state:result.state,roll:result.results[`${request.id}:attack`] as D20TestResult,damage:result.results[`${request.id}:damage`] as {finalDamage?:number;skipped?:boolean}};
}

test("the engine wave is authored and leaves the tracked tier",()=>{
  assert.ok(SPELL_EXECUTION_COVERAGE.authored>=59,`authored tier: ${SPELL_EXECUTION_COVERAGE.authored}`);
  assert.ok(SPELL_EXECUTION_COVERAGE.tracked<=169,`tracked tier: ${SPELL_EXECUTION_COVERAGE.tracked}`);
  for(const spellId of WAVE_2_ENGINE){
    const authored=authoredSpellMechanicById(spellId);
    assert.ok(authored&&/Authored \(C1-03\)/.test(authored.executionScope??""),`${spellId} is authored`);
    assert.equal(spellMechanicById(spellId)?.runtimeSupport,"combat-executable");
  }
});

test("deterministic faces stay within the die and repeat for the same seed",()=>{
  const faces=Array.from({length:200},(_,index)=>deterministicFace(`seed:${index}`,4));
  assert.ok(faces.every((face)=>face>=1&&face<=4));
  assert.equal(new Set(faces).size,4,"every face of a d4 appears");
  assert.equal(deterministicFace("same",6),deterministicFace("same",6));
});

test("Shield and Barkskin raise the AC an attack roll is judged against",()=>{
  const plain=attack(stateWithSlots(),"goblin","hero",12);
  assert.equal(plain.roll.outcome,"success","17 vs AC 12 hits");
  const shielded=attack(cast("dnd.srd521.spell.shield",stateWithSlots(),[target("hero","self")]),"goblin","hero",12);
  assert.equal(shielded.roll.target,17,"Shield lifts AC 12 to 17");
  assert.equal(shielded.roll.total,17,"12 + 5 meets 17");
  assert.equal(shielded.roll.outcome,"success","meeting the raised AC still hits");
  const shieldedMiss=attack(cast("dnd.srd521.spell.shield",stateWithSlots(),[target("hero","self")]),"goblin","hero",11);
  assert.equal(shieldedMiss.roll.outcome,"failure","16 vs AC 17 misses");
  assert.ok(shielded.roll.provenance.some((entry)=>entry.source==="dnd.srd521.spell.shield"));
  const bark=attack(cast("dnd.srd521.spell.barkskin",stateWithSlots(),[target("hero","self")]),"goblin","hero",11);
  assert.equal(bark.roll.target,17,"Barkskin floors AC at 17");
  assert.equal(bark.roll.outcome,"failure");
});

test("Bless adds a rolled d4 to attack rolls and Magic Weapon adds +1",()=>{
  const miss=attack(stateWithSlots(),"hero","goblin",6);
  assert.equal(miss.roll.outcome,"failure","11 vs AC 12 misses");
  const blessed=attack(cast("dnd.srd521.spell.bless",stateWithSlots(),[target("hero","self")]),"hero","goblin",6);
  assert.ok(blessed.roll.total>=12&&blessed.roll.total<=15,`Bless adds 1..4: ${blessed.roll.total}`);
  assert.equal(blessed.roll.outcome,"success");
  const magic=attack(cast("dnd.srd521.spell.magic-weapon",stateWithSlots(),[target("hero","self")]),"hero","goblin",6);
  assert.equal(magic.roll.total,12,"+1 to the attack roll");
  assert.equal(magic.roll.outcome,"success");
});

test("Bane subtracts a d4 from the cursed creature's saving throws",()=>{
  // Disintegrate is not a concentration spell, so casting it keeps Bane up.
  const saved=cast("dnd.srd521.spell.disintegrate",stateWithSlots(),[target("goblin","enemy")],17);
  assert.equal(saved.combatants.goblin.life.hp.current,200,"17 vs DC 17 saves for nothing");
  const baned=cast("dnd.srd521.spell.bane",stateWithSlots(),[target("goblin","enemy")],3);
  assert.ok(baned.effects.some((effect)=>effect.targetId==="goblin"&&effect.metadata?.d20Family==="saving-throw"&&effect.metadata?.d20BonusSign===-1));
  const burned=cast("dnd.srd521.spell.disintegrate",baned,[target("goblin","enemy")],17);
  assert.equal(burned.combatants.goblin.life.hp.current,120,"13..16 vs DC 17 fails for 10d6 + 40");
});

test("Stoneskin halves weapon damage against the warded creature",()=>{
  const plain=attack(stateWithSlots(),"goblin","hero",15);
  const before=stateWithSlots().combatants.hero.life.hp.current;
  assert.equal(plain.state.combatants.hero.life.hp.current,before-9,"1d8 (6) + 3 slashing");
  const stone=attack(cast("dnd.srd521.spell.stoneskin",stateWithSlots(),[target("hero","self")]),"goblin","hero",15);
  assert.equal(stone.state.combatants.hero.life.hp.current,before-4,"resistance halves 9 to 4");
});

test("Hunter's Mark rides only on the caster's hits against the marked creature",()=>{
  const marked=cast("dnd.srd521.spell.hunter-s-mark",stateWithSlots(),[target("goblin","enemy")]);
  const riders=effectAttackDamageRiders(marked,"hero","goblin","weapon","attack.seed");
  assert.equal(riders.length,1);
  assert.equal(riders[0].damageType,"force");
  assert.deepEqual(riders[0].dice.map((die)=>[die.count,die.sides,die.faces.length]),[[1,6,2]]);
  assert.equal(effectAttackDamageRiders(marked,"hero","orc","weapon","attack.seed").length,0,"another creature is not marked");
  assert.equal(effectAttackDamageRiders(marked,"goblin","hero","weapon","attack.seed").length,0,"the marked creature gains nothing");
  const hit=attack(marked,"hero","goblin",15,riders);
  assert.ok((hit.damage.finalDamage??0)>=10&&(hit.damage.finalDamage??0)<=15,`9 slashing + 1d6 force: ${hit.damage.finalDamage}`);
  const favored=cast("dnd.srd521.spell.divine-favor",stateWithSlots(),[target("hero","self")]);
  assert.equal(effectAttackDamageRiders(favored,"hero","goblin","weapon","attack.seed")[0]?.damageType,"radiant");
  assert.equal(effectAttackDamageRiders(favored,"hero","goblin","unarmed","attack.seed").length,0,"Divine Favor is weapon-only");
});

test("Heroism grants modifier-only temporary HP and ends Frightened",()=>{
  const state=stateWithSlots();
  state.effects.push({id:"probe.frightened",sourceId:"probe",sourceActorId:"goblin",targetId:"hero",kind:"condition",conditionId:"frightened",tags:[],duration:{kind:"permanent"}} as never);
  const heroic=cast("dnd.srd521.spell.heroism",state,[target("hero","self")]);
  assert.equal(heroic.combatants.hero.life.hp.temporary,5);
  assert.equal(heroic.effects.some((effect)=>effect.conditionId==="frightened"),false);
});

test("Heat Metal deals 2d8 fire with no roll and scales one die per slot",()=>{
  assert.equal(cast("dnd.srd521.spell.heat-metal",stateWithSlots(),[target("goblin","enemy")]).combatants.goblin.life.hp.current,192);
  assert.equal(cast("dnd.srd521.spell.heat-metal",stateWithSlots(),[target("goblin","enemy")],3,4).combatants.goblin.life.hp.current,184,"4th-level slot: 4d8");
});

test("Haste, Guidance and Protection from Energy carry their vocabulary in effect metadata and tags",()=>{
  const hasted=cast("dnd.srd521.spell.haste",stateWithSlots(),[target("hero","self")]);
  const heroEffects=hasted.effects.filter((effect)=>effect.targetId==="hero"&&effect.kind==="modifier");
  assert.ok(heroEffects.some((effect)=>effect.metadata?.acBonus===2));
  assert.ok(heroEffects.some((effect)=>effect.metadata?.d20Family==="saving-throw"&&effect.metadata?.d20Ability==="dex"&&effect.metadata?.d20RollState==="advantage"));
  const guided=cast("dnd.srd521.spell.guidance",stateWithSlots(),[target("hero","self")]);
  assert.ok(guided.effects.some((effect)=>effect.metadata?.d20Family==="ability-check"&&effect.metadata?.consumeOnUse===true&&effect.metadata?.d20BonusDiceSides===4));
  const warded=cast("dnd.srd521.spell.protection-from-energy",stateWithSlots(),[target("hero","self")]);
  assert.ok(warded.effects.some((effect)=>effect.targetId==="hero"&&effect.tags.includes("damage-resistance:fire")));
});
