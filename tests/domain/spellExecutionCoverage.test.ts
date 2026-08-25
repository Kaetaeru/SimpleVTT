import assert from "node:assert/strict";
import test from "node:test";
import { SPELL_PRESENTATIONS } from "../../src/app/spellPresentation";
import { SPELL_EXECUTION_COVERAGE, spellMechanicById } from "../../src/domain/spellMechanics";
import { resolveSpellCast, spellMultiAttackCount, type SpellCasterContext, type SpellCastTarget } from "../../src/domain/spellcasting";
import { resolvePendingResolution } from "../../src/domain/resolution";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const ALARM="dnd.srd521.spell.alarm";
const CHARM_PERSON="dnd.srd521.spell.charm-person";

function caster(spellId:string):SpellCasterContext {
  return {
    characterLevel:5,spellAttackModifier:5,spellSaveDc:14,spellcastingAbilityModifier:3,
    preparedSpellIds:[spellId],alwaysPreparedSpellIds:[],cantripSpellIds:[],slotResourceIds:{1:"spell-slot-1"},
  };
}

function target(id:string,overrides:Partial<SpellCastTarget>={}):SpellCastTarget {
  return {id,kind:"creature",relation:"enemy",distanceFeet:30,visible:true,cover:"none",ac:12,creatureKind:"monster",saveModifiers:{wis:0},targetCanSeeCaster:true,...overrides};
}

test("all 339 catalog spells have an executable authoritative definition",()=>{
  assert.equal(SPELL_PRESENTATIONS.length,339);
  assert.equal(SPELL_EXECUTION_COVERAGE.total,339);
  assert.equal(SPELL_EXECUTION_COVERAGE.reviewed+SPELL_EXECUTION_COVERAGE.derivedCombat+SPELL_EXECUTION_COVERAGE.tracked,339);
  for (const spell of SPELL_PRESENTATIONS) {
    const mechanic=spellMechanicById(spell.id);
    assert.ok(mechanic,`${spell.nameEn} is missing a mechanic definition`);
    assert.ok(mechanic.runtimeSupport==="combat-executable"||mechanic.runtimeSupport==="tracked-executable",`${spell.nameEn} is not executable`);
    if (mechanic.primary.kind!=="tracked-effect") assert.ok(mechanic.targeting.maxTargets>0,`${spell.nameEn} would adjudicate without a target`);
  }
});

test("catalog-derived utility spells spend their slot and persist duration/concentration lifecycle",()=>{
  const state=runtimeState();
  const definition=spellMechanicById(ALARM)!;
  const result=resolveSpellCast(TEST_PROFILE,definition,state,{
    id:"cast.alarm",actorId:"hero",spellId:ALARM,source:"prepared",expectedRevision:0,caster:caster(ALARM),targets:[],slotLevel:1,
    componentsSatisfied:true,useActionEconomy:false,dice:{},
  });
  assert.equal(result.status,"committed");
  if (result.status!=="committed") return;
  assert.equal(result.state.combatants.hero.resources.find((entry)=>entry.id==="spell-slot-1")?.current,1);
  const effect=result.state.effects.find((entry)=>entry.sourceId===ALARM);
  assert.equal(effect?.targetId,"hero");
  assert.deepEqual(effect?.expiry,{kind:"time",elapsedSeconds:8*60*60});
});

test("catalog-derived save conditions roll and apply only on a failed save",()=>{
  const state=runtimeState();
  const definition=spellMechanicById(CHARM_PERSON)!;
  const result=resolveSpellCast(TEST_PROFILE,definition,state,{
    id:"cast.charm-person",actorId:"hero",spellId:CHARM_PERSON,source:"prepared",expectedRevision:0,caster:caster(CHARM_PERSON),targets:[target("goblin")],slotLevel:1,
    componentsSatisfied:true,useActionEconomy:false,dice:{saves:{goblin:{id:"charm-save",purpose:"Wisdom save",sides:20,faces:[5]}}},
  });
  assert.equal(result.status,"committed");
  if (result.status!=="committed") return;
  assert.equal((result.results["cast.charm-person:save:goblin"] as {outcome:string}).outcome,"failure");
  assert.ok(result.state.effects.some((entry)=>entry.targetId==="goblin"&&entry.conditionId==="charmed"));
});

test("derived healing and mapless area targeting retain exact catalog facts",()=>{
  const mass=spellMechanicById("dnd.srd521.spell.mass-healing-word")!;
  assert.equal(mass.primary.kind,"healing");
  assert.equal(mass.targeting.maxTargets,6);
  const colorSpray=spellMechanicById("dnd.srd521.spell.color-spray")!;
  assert.equal(colorSpray.primary.kind,"save-effect");
  assert.equal(colorSpray.targeting.maxTargets,64);
  assert.deepEqual(colorSpray.effects?.[0],{conditionId:"blinded",trigger:"failed-save",duration:{kind:"rounds",amount:1,anchorActorId:"$source",boundary:"end"}});
});

test("Vicious Mockery applies disadvantage to the next attack and consumes the rider",()=>{
  const spellId="dnd.srd521.spell.vicious-mockery";
  const state=runtimeState();
  const cast=resolveSpellCast(TEST_PROFILE,spellMechanicById(spellId)!,state,{
    id:"cast.vicious",actorId:"hero",spellId,source:"prepared",expectedRevision:0,
    caster:{...caster(spellId),preparedSpellIds:[],cantripSpellIds:[spellId]},targets:[target("goblin")],componentsSatisfied:true,useActionEconomy:false,
    dice:{effectFaces:[4,4],saves:{goblin:{id:"vicious-save",purpose:"Wisdom save",sides:20,faces:[5]}}},
  });
  assert.equal(cast.status,"committed");
  if (cast.status!=="committed") return;
  const rider=cast.state.effects.find((entry)=>entry.sourceId===spellId);
  assert.equal(rider?.kind,"modifier");
  const attack=resolvePendingResolution(TEST_PROFILE,cast.state,{
    id:"goblin.attack",actorId:"goblin",sourceId:"test.attack",expectedRevision:cast.state.revision,
    operations:[{id:"goblin.attack.roll",kind:"d20",actorId:"goblin",targetId:"hero",request:{family:"attack-roll",target:12,modifierContributions:[],dice:{id:"attack",purpose:"attack",sides:20,faces:[15,3]}}}],
  });
  assert.equal(attack.status,"committed");
  if (attack.status!=="committed") return;
  assert.equal((attack.results["goblin.attack.roll"] as {natural:number}).natural,3);
  assert.ok(!attack.state.effects.some((entry)=>entry.id===rider?.id));
});

test("Faerie Fire grants advantage to attacks against failed-save targets",()=>{
  const spellId="dnd.srd521.spell.faerie-fire";
  const state=runtimeState();
  const cast=resolveSpellCast(TEST_PROFILE,spellMechanicById(spellId)!,state,{
    id:"cast.faerie-fire",actorId:"hero",spellId,source:"prepared",expectedRevision:0,caster:caster(spellId),targets:[target("goblin")],slotLevel:1,
    componentsSatisfied:true,useActionEconomy:false,dice:{saves:{goblin:{id:"faerie-save",purpose:"Dexterity save",sides:20,faces:[5]}}},
  });
  assert.equal(cast.status,"committed");
  if (cast.status!=="committed") return;
  assert.ok(cast.state.effects.some((entry)=>entry.targetId==="goblin"&&entry.metadata?.d20Scope==="target"&&entry.metadata?.d20RollState==="advantage"));
  const attack=resolvePendingResolution(TEST_PROFILE,cast.state,{
    id:"hero.attack",actorId:"hero",sourceId:"test.attack",expectedRevision:cast.state.revision,
    operations:[{id:"hero.attack.roll",kind:"d20",actorId:"hero",targetId:"goblin",request:{family:"attack-roll",target:12,modifierContributions:[],dice:{id:"attack",purpose:"attack",sides:20,faces:[2,18]}}}],
  });
  assert.equal(attack.status,"committed");
  if (attack.status!=="committed") return;
  assert.equal((attack.results["hero.attack.roll"] as {natural:number}).natural,18);
});

test("Eldritch Blast and Scorching Ray resolve one attack per beam",()=>{
  const spellId="dnd.srd521.spell.eldritch-blast";
  const definition=spellMechanicById(spellId)!;
  assert.equal(definition.primary.kind,"multi-attack-damage");
  assert.equal(spellMultiAttackCount(definition,5),2);
  const scorching=spellMechanicById("dnd.srd521.spell.scorching-ray")!;
  assert.equal(spellMultiAttackCount(scorching,5,3),4);
  const state=runtimeState();
  state.combatants.ogre={...structuredClone(state.combatants.goblin),id:"ogre"};
  const result=resolveSpellCast(TEST_PROFILE,definition,state,{
    id:"cast.eldritch-blast",actorId:"hero",spellId,source:"prepared",expectedRevision:0,
    caster:{...caster(spellId),preparedSpellIds:[],cantripSpellIds:[spellId]},targets:[target("goblin"),target("ogre")],componentsSatisfied:true,useActionEconomy:false,
    dice:{attackInstances:[
      {targetId:"goblin",attack:{id:"beam-1",purpose:"beam 1",sides:20,faces:[15]},effectFaces:[6]},
      {targetId:"ogre",attack:{id:"beam-2",purpose:"beam 2",sides:20,faces:[16]},effectFaces:[7]},
    ]},
  });
  assert.equal(result.status,"committed");
  if (result.status!=="committed") return;
  assert.equal(result.state.combatants.goblin.life.hp.current,9);
  assert.equal(result.state.combatants.ogre.life.hp.current,8);
});

test("compound damage spells preserve damage types through one shared save",()=>{
  const spellId="dnd.srd521.spell.flame-strike";
  const definition=spellMechanicById(spellId)!;
  assert.equal(definition.primary.kind,"save-compound-damage");
  const state=runtimeState();
  state.combatants.hero.resources.push({id:"spell-slot-5",label:"5레벨 주문 슬롯",current:1,maximum:1,recovery:{longRest:"all"}});
  state.combatants.goblin.life.hp={current:100,maximum:100,temporary:0};
  const result=resolveSpellCast(TEST_PROFILE,definition,state,{
    id:"cast.flame-strike",actorId:"hero",spellId,source:"prepared",expectedRevision:0,
    caster:{...caster(spellId),slotResourceIds:{5:"spell-slot-5"}},targets:[target("goblin")],slotLevel:5,componentsSatisfied:true,useActionEconomy:false,
    dice:{componentFaces:[[6,6,6,6,6],[6,6,6,6,6]],saves:{goblin:{id:"flame-save",purpose:"Dexterity save",sides:20,faces:[5]}}},
  });
  assert.equal(result.status,"committed");
  if (result.status!=="committed") return;
  assert.equal(result.state.combatants.goblin.life.hp.current,40);
  assert.ok(result.events.some((event)=>event.kind==="compound-damage"));
});

test("False Life rolls and applies temporary HP rather than a tracked placeholder",()=>{
  const spellId="dnd.srd521.spell.false-life";
  const definition=spellMechanicById(spellId)!;
  assert.equal(definition.primary.kind,"temporary-hp");
  const state=runtimeState();
  const result=resolveSpellCast(TEST_PROFILE,definition,state,{
    id:"cast.false-life",actorId:"hero",spellId,source:"prepared",expectedRevision:0,caster:caster(spellId),
    targets:[target("hero",{relation:"self",distanceFeet:0,creatureKind:"character"})],slotLevel:1,componentsSatisfied:true,useActionEconomy:false,dice:{effectFaces:[4,4]},
  });
  assert.equal(result.status,"committed");
  if (result.status!=="committed") return;
  assert.equal(result.state.combatants.hero.life.hp.temporary,12);
});

test("Power Word Kill kills at 100 HP or less and otherwise deals its fallback damage",()=>{
  const spellId="dnd.srd521.spell.power-word-kill";
  const definition=spellMechanicById(spellId)!;
  assert.equal(definition.primary.kind,"power-word-kill");
  const low=runtimeState();
  low.combatants.hero.resources.push({id:"spell-slot-9",label:"9레벨 주문 슬롯",current:1,maximum:1,recovery:{longRest:"all"}});
  const cast=(state:ReturnType<typeof runtimeState>,id:string)=>resolveSpellCast(TEST_PROFILE,definition,state,{
    id,actorId:"hero",spellId,source:"prepared",expectedRevision:0,caster:{...caster(spellId),slotResourceIds:{9:"spell-slot-9"}},targets:[target("goblin")],slotLevel:9,
    componentsSatisfied:true,useActionEconomy:false,dice:{effectFaces:Array(12).fill(10)},
  });
  const killed=cast(low,"cast.power-word-kill.low");
  assert.equal(killed.status,"committed");
  if (killed.status!=="committed") return;
  assert.equal(killed.state.combatants.goblin.life.dead,true);

  const high=runtimeState();
  high.combatants.hero.resources.push({id:"spell-slot-9",label:"9레벨 주문 슬롯",current:1,maximum:1,recovery:{longRest:"all"}});
  high.combatants.goblin.life.hp={current:150,maximum:150,temporary:0};
  const damaged=cast(high,"cast.power-word-kill.high");
  assert.equal(damaged.status,"committed");
  if (damaged.status!=="committed") return;
  assert.equal(damaged.state.combatants.goblin.life.hp.current,30);
});
