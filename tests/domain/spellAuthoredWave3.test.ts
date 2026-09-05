import assert from "node:assert/strict";
import test from "node:test";
import { resolveAttack, type AttackRequest } from "../../src/domain/attack";
import { effectAttackDamageRiders, effectRetaliations } from "../../src/domain/effectAttackRiders";
import { authoredSpellMechanicById, SPELL_EXECUTION_COVERAGE, spellMechanicById } from "../../src/domain/spellMechanics";
import { resolveSpellCast, type SpellCasterContext, type SpellCastTarget } from "../../src/domain/spellcasting";
import type { RulesRuntimeState } from "../../src/domain/combatState";
import type { D20TestResult } from "../../src/domain/d20";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

// V1.3 C1-06 wave 3: revive, HP maximum, dispel, Death Ward, Mage Armor, spent-on-hit smites, retaliation, summons.
const WAVE_3=[
  "dnd.srd521.spell.revivify","dnd.srd521.spell.raise-dead","dnd.srd521.spell.resurrection","dnd.srd521.spell.true-resurrection","dnd.srd521.spell.reincarnate",
  "dnd.srd521.spell.aid","dnd.srd521.spell.death-ward","dnd.srd521.spell.dispel-magic","dnd.srd521.spell.mage-armor","dnd.srd521.spell.freedom-of-movement",
  "dnd.srd521.spell.aura-of-life","dnd.srd521.spell.earthquake","dnd.srd521.spell.divine-smite","dnd.srd521.spell.shining-smite",
  "dnd.srd521.spell.animate-dead","dnd.srd521.spell.create-undead",
];

const CASTER:SpellCasterContext={
  characterLevel:17,spellAttackModifier:9,spellSaveDc:17,spellcastingAbilityModifier:5,
  preparedSpellIds:[...WAVE_3,"dnd.srd521.spell.bless","dnd.srd521.spell.fire-shield"],alwaysPreparedSpellIds:[],cantripSpellIds:[],
  slotResourceIds:Object.fromEntries([1,2,3,4,5,6,7,8,9].map((level)=>[level,`spell-slot-${level}`])),
};

function stateWithSlots() {
  const state=runtimeState();
  for(const level of [2,3,4,5,6,7,8,9])state.combatants.hero.resources.push({id:`spell-slot-${level}`,label:`${level}레벨 주문 슬롯`,current:2,maximum:2,recovery:{longRest:"all"}});
  Object.assign(state.combatants.hero.resources.find((entry)=>entry.id==="spell-slot-1")!,{current:4,maximum:4});
  state.combatants.goblin.life.hp={current:200,maximum:200,temporary:0};
  return state;
}

function target(id:string,relation:"self"|"ally"|"enemy",saveModifiers:Partial<Record<"dex",number>>={}):SpellCastTarget {
  return {id,kind:"creature",relation,distanceFeet:relation==="self"?0:5,visible:true,cover:"none",ac:12,creatureKind:id==="hero"?"character":"monster",saveModifiers,targetCanSeeCaster:true};
}

function cast(spellId:string,state:RulesRuntimeState,targets:SpellCastTarget[],slotLevel?:number,saveFace=3) {
  const definition=spellMechanicById(spellId)!;
  const dice={
    attack:{id:"attack",purpose:"spell attack",sides:20,faces:[15]},
    saves:Object.fromEntries(targets.map((entry)=>[entry.id,{id:`save-${entry.id}`,purpose:"save",sides:20,faces:[saveFace]}])),
    effectFaces:Array.from({length:40},()=>4),
  };
  const result=resolveSpellCast(TEST_PROFILE,definition,state,{
    id:`cast.${spellId}.${state.revision}`,actorId:"hero",spellId,source:"prepared",expectedRevision:state.revision,
    caster:CASTER,targets,slotLevel:slotLevel??(definition.baseLevel>0?definition.baseLevel:undefined),componentsSatisfied:true,useActionEconomy:false,dice:dice as never,
  });
  assert.equal(result.status,"committed",`${spellId}: ${JSON.stringify("error" in result?result.error:result.status)}`);
  if(result.status!=="committed")throw new Error("unreachable");
  return result.state;
}

function attack(state:RulesRuntimeState,actorId:"hero"|"goblin",targetId:string,face:number,extra:Partial<AttackRequest>={}) {
  const request:AttackRequest={
    id:`attack.${state.revision}`,actorId,expectedRevision:state.revision,sourceId:"weapon:longsword",sourceKind:"weapon",
    target:{id:targetId,kind:"creature",relation:"enemy",distanceFeet:5,visible:true,cover:"none",ac:12,creatureKind:targetId==="hero"?"character":"monster",targetCanSeeAttacker:true},
    rangeFeet:5,attackDice:{id:`d20-${state.revision}`,purpose:"weapon attack",sides:20,faces:[face]},
    attackModifierContributions:[{source:"weapon:attack-modifier",value:5}],
    baseDamage:{sourceId:"weapon:longsword",damageType:"slashing",dice:[{source:"weapon:longsword",count:1,sides:8,faces:[6,6]}],flat:[{source:"weapon:ability",value:3}]},
    concentrationCheck:{dice:{id:`concentration-${state.revision}`,purpose:"concentration",sides:20,faces:[20]}},
    ...extra,
  };
  const result=resolveAttack(TEST_PROFILE,state,request);
  assert.equal(result.status,"committed",`attack: ${JSON.stringify("error" in result?result.error:result.status)}`);
  if(result.status!=="committed")throw new Error("unreachable");
  return {state:result.state,roll:result.results[`${request.id}:attack`] as D20TestResult,damage:result.results[`${request.id}:damage`] as {finalDamage?:number}};
}

test("wave 3 is authored and shrinks the tracked tier again",()=>{
  assert.ok(SPELL_EXECUTION_COVERAGE.authored>=82,`authored: ${SPELL_EXECUTION_COVERAGE.authored}`);
  assert.ok(SPELL_EXECUTION_COVERAGE.tracked<=146,`tracked: ${SPELL_EXECUTION_COVERAGE.tracked}`);
  for(const spellId of WAVE_3){
    const authored=authoredSpellMechanicById(spellId);
    assert.ok(authored&&/Authored \(C1-06\)/.test(authored.executionScope??""),`${spellId} is authored`);
  }
});

test("Revivify returns a dead ally with 1 HP and Resurrection with full HP",()=>{
  const state=stateWithSlots();
  state.combatants.goblin.life={...state.combatants.goblin.life,hp:{current:0,maximum:200,temporary:0},dead:true,unconscious:true,deathSaves:{successes:0,failures:3}};
  const revived=cast("dnd.srd521.spell.revivify",state,[target("goblin","ally")]);
  assert.deepEqual([revived.combatants.goblin.life.dead,revived.combatants.goblin.life.unconscious,revived.combatants.goblin.life.hp.current,revived.combatants.goblin.life.deathSaves],[false,false,1,{successes:0,failures:0}]);
  const dead=stateWithSlots();
  dead.combatants.goblin.life={...dead.combatants.goblin.life,hp:{current:0,maximum:200,temporary:0},dead:true,unconscious:true};
  assert.equal(cast("dnd.srd521.spell.resurrection",dead,[target("goblin","ally")]).combatants.goblin.life.hp.current,200);
});

test("Aid raises HP maximum and current HP by 5, +5 per slot above 2nd",()=>{
  const state=stateWithSlots();
  const before=state.combatants.hero.life.hp;
  const aided=cast("dnd.srd521.spell.aid",state,[target("hero","self")]);
  assert.deepEqual([aided.combatants.hero.life.hp.maximum,aided.combatants.hero.life.hp.current],[before.maximum+5,before.current+5]);
  const upcast=cast("dnd.srd521.spell.aid",stateWithSlots(),[target("hero","self")],4);
  assert.equal(upcast.combatants.hero.life.hp.maximum,before.maximum+15);
});

test("Dispel Magic ends every spell effect on the creature",()=>{
  const blessed=cast("dnd.srd521.spell.bless",stateWithSlots(),[target("hero","self")]);
  assert.ok(blessed.effects.some((effect)=>effect.targetId==="hero"&&effect.tags.includes("spell")));
  const dispelled=cast("dnd.srd521.spell.dispel-magic",blessed,[target("hero","self")]);
  assert.equal(dispelled.effects.filter((effect)=>effect.targetId==="hero"&&effect.sourceId==="dnd.srd521.spell.bless").length,0);
});

test("Mage Armor floors AC at 13 + the target's DEX save modifier",()=>{
  const armored=cast("dnd.srd521.spell.mage-armor",stateWithSlots(),[target("hero","self",{dex:3})]);
  assert.ok(armored.effects.some((effect)=>effect.targetId==="hero"&&effect.metadata?.acFloor===16));
  const hit=attack(armored,"goblin","hero",10);
  assert.equal(hit.roll.target,16,"AC 12 judged as 16");
  assert.equal(hit.roll.outcome,"failure","15 vs 16 misses");
});

test("Death Ward leaves the creature at 1 HP instead of 0 and ends",()=>{
  const warded=cast("dnd.srd521.spell.death-ward",stateWithSlots(),[target("hero","self")]);
  warded.combatants.hero.life.hp.current=5;
  const struck=attack(warded,"goblin","hero",15);
  assert.equal(struck.state.combatants.hero.life.hp.current,1,"9 damage against 5 HP leaves 1");
  assert.equal(struck.state.combatants.hero.life.unconscious,false);
  assert.equal(struck.state.effects.some((effect)=>effect.metadata?.deathWard===true),false,"the ward is spent");
  const again=attack(struck.state,"goblin","hero",15);
  assert.equal(again.state.combatants.hero.life.hp.current,0,"the second blow drops the creature");
});

test("Divine Smite rides once on the next weapon hit and is spent; the slot scales its dice",()=>{
  const smiting=cast("dnd.srd521.spell.divine-smite",stateWithSlots(),[target("hero","self")],3);
  const riders=effectAttackDamageRiders(smiting,"hero","goblin","weapon","seed");
  assert.equal(riders.length,1);
  assert.deepEqual([riders[0].damageType,riders[0].dice[0].count,riders[0].dice[0].sides,Boolean(riders[0].consumeEffectId)],["radiant",4,8,true],"2d8 + 2d8 for a 3rd-level slot");
  const hit=attack(smiting,"hero","goblin",15,{riders});
  assert.ok((hit.damage.finalDamage??0)>=13,"9 slashing + at least 4 radiant");
  assert.equal(effectAttackDamageRiders(hit.state,"hero","goblin","weapon","seed").length,0,"the rider is consumed by the hit");
  const miss=attack(smiting,"hero","goblin",2,{riders});
  assert.equal(effectAttackDamageRiders(miss.state,"hero","goblin","weapon","seed").length,1,"a miss keeps the rider");
});

test("Fire Shield burns a melee attacker that hits the warded creature",()=>{
  const shielded=cast("dnd.srd521.spell.fire-shield",stateWithSlots(),[target("hero","self")]);
  const retaliations=effectRetaliations(shielded,"hero",5,"seed");
  assert.deepEqual(retaliations.map((entry)=>[entry.damageType,entry.dice[0].count,entry.dice[0].sides]),[["fire",2,8]]);
  assert.equal(effectRetaliations(shielded,"hero",60,"seed").length,0,"a ranged attack is not burned");
  const struck=attack(shielded,"goblin","hero",15,{retaliations,actorCreatureKind:"monster"});
  assert.ok(struck.state.combatants.goblin.life.hp.current<=198,`the goblin takes at least 2 fire: ${struck.state.combatants.goblin.life.hp.current}`);
  const missed=attack(shielded,"goblin","hero",2,{retaliations,actorCreatureKind:"monster"});
  assert.equal(missed.state.combatants.goblin.life.hp.current,200,"a miss is not burned");
});

test("Animate Dead and Create Undead declare their summons",()=>{
  assert.deepEqual(spellMechanicById("dnd.srd521.spell.animate-dead")?.summons,{monsterId:"dnd.srd521.monster.skeleton",count:1,countPerSlotAboveBase:2});
  assert.deepEqual(spellMechanicById("dnd.srd521.spell.create-undead")?.summons,{monsterId:"dnd.srd521.monster.ghoul",count:3});
});
