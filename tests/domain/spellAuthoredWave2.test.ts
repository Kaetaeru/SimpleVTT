import assert from "node:assert/strict";
import test from "node:test";
import { authoredSpellMechanicById, SPELL_EXECUTION_COVERAGE, spellMechanicById } from "../../src/domain/spellMechanics";
import { normalizedSpellDefinitionById } from "../../src/domain/spellExecutionCatalog";
import { resolveSpellCast, type SpellCasterContext, type SpellCastTarget } from "../../src/domain/spellcasting";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

// V1.3 C1-03 wave 2: the combat-relevant SRD spells the existing mechanic kinds express.
const WAVE_2=[
  "dnd.srd521.spell.sorcerous-burst","dnd.srd521.spell.chromatic-orb","dnd.srd521.spell.acid-arrow","dnd.srd521.spell.spiritual-weapon",
  "dnd.srd521.spell.moonbeam","dnd.srd521.spell.spirit-guardians","dnd.srd521.spell.wind-wall","dnd.srd521.spell.cloudkill",
  "dnd.srd521.spell.insect-plague","dnd.srd521.spell.blade-barrier","dnd.srd521.spell.wall-of-fire","dnd.srd521.spell.wall-of-thorns",
  "dnd.srd521.spell.wall-of-ice","dnd.srd521.spell.disintegrate","dnd.srd521.spell.tsunami","dnd.srd521.spell.incendiary-cloud",
  "dnd.srd521.spell.black-tentacles",
  "dnd.srd521.spell.web","dnd.srd521.spell.entangle","dnd.srd521.spell.grease","dnd.srd521.spell.stinking-cloud",
  "dnd.srd521.spell.sleet-storm","dnd.srd521.spell.suggestion","dnd.srd521.spell.mass-suggestion",
  "dnd.srd521.spell.enhance-ability","dnd.srd521.spell.foresight","dnd.srd521.spell.protection-from-evil-and-good",
  "dnd.srd521.spell.protection-from-poison","dnd.srd521.spell.lesser-restoration","dnd.srd521.spell.greater-restoration",
  "dnd.srd521.spell.holy-aura","dnd.srd521.spell.goodberry",
];

const CASTER:SpellCasterContext={
  characterLevel:17,spellAttackModifier:9,spellSaveDc:17,spellcastingAbilityModifier:5,
  preparedSpellIds:WAVE_2,alwaysPreparedSpellIds:[],cantripSpellIds:["dnd.srd521.spell.sorcerous-burst"],
  slotResourceIds:Object.fromEntries([1,2,3,4,5,6,7,8,9].map((level)=>[level,`spell-slot-${level}`])),
};

function stateWithSlots() {
  const state=runtimeState();
  for(const level of [2,3,4,5,6,7,8,9])state.combatants.hero.resources.push({id:`spell-slot-${level}`,label:`${level}레벨 주문 슬롯`,current:1,maximum:1,recovery:{longRest:"all"}});
  state.combatants.goblin.life.hp={current:200,maximum:200,temporary:0};
  return state;
}

function target(id:string,relation:"self"|"ally"|"enemy",overrides:Partial<SpellCastTarget>={}):SpellCastTarget {
  return {id,kind:"creature",relation,distanceFeet:5,visible:true,cover:"none",ac:12,creatureKind:id==="hero"?"character":"monster",saveModifiers:{},targetCanSeeCaster:true,...overrides};
}

function cast(spellId:string,state=stateWithSlots(),targets:SpellCastTarget[]=[target("goblin","enemy")],saveFace=3,slotLevel?:number) {
  const definition=spellMechanicById(spellId)!;
  const dice={
    attack:{id:"attack",purpose:"spell attack",sides:20,faces:[15]},
    saves:Object.fromEntries(targets.map((entry)=>[entry.id,{id:`save-${entry.id}`,purpose:"save",sides:20,faces:[saveFace]}])),
    effectFaces:Array.from({length:40},()=>4),
    attackInstances:targets.map((entry)=>({targetId:entry.id,attack:{id:`attack-${entry.id}`,purpose:"spell attack",sides:20,faces:[15]},effectFaces:Array.from({length:12},()=>4)})),
  };
  const result=resolveSpellCast(TEST_PROFILE,definition,state,{
    id:`cast.${spellId}`,actorId:"hero",spellId,source:"prepared",expectedRevision:state.revision,
    caster:CASTER,targets,slotLevel:slotLevel??(definition.baseLevel>0?definition.baseLevel:undefined),
    componentsSatisfied:true,useActionEconomy:false,dice:dice as never,
  });
  assert.equal(result.status,"committed",`${spellId}: ${JSON.stringify("error" in result?result.error:result.status)}`);
  if(result.status!=="committed")throw new Error("unreachable");
  return result;
}

function condition(state:{effects:Array<{conditionId?:string;targetId:string;kind:string}>},targetId:string,conditionId:string) {
  return state.effects.some((effect)=>effect.kind==="condition"&&effect.conditionId===conditionId&&effect.targetId===targetId);
}

test("wave 2 is authored, outranks prose, and leaves the tracked tier",()=>{
  assert.equal(WAVE_2.length,32);
  assert.ok(SPELL_EXECUTION_COVERAGE.authored>=42,`authored tier counts both waves: ${SPELL_EXECUTION_COVERAGE.authored}`);
  assert.ok(SPELL_EXECUTION_COVERAGE.tracked<=184,`tracked tier shrank: ${SPELL_EXECUTION_COVERAGE.tracked}`);
  for(const spellId of WAVE_2){
    const authored=authoredSpellMechanicById(spellId);
    assert.ok(authored,`${spellId} is authored`);
    assert.equal(spellMechanicById(spellId)?.primary.kind,authored.primary.kind,`${spellId} resolves to the authored primary`);
    assert.equal(spellMechanicById(spellId)?.runtimeSupport,"combat-executable");
    assert.equal(normalizedSpellDefinitionById(spellId)?.executionScope,authored.executionScope,`${spellId} reaches the normalized catalog`);
    assert.ok(/Authored \(C1-03\)/.test(authored.executionScope??""),`${spellId} states what it enforces`);
  }
});

test("area save spells damage every chosen creature and halve on a success",()=>{
  const state=stateWithSlots();
  state.combatants.orc={...structuredClone(state.combatants.goblin),id:"orc",name:"Orc"} as never;
  state.combatants.orc.life.hp={current:200,maximum:200,temporary:0};
  const failed=cast("dnd.srd521.spell.wall-of-fire",state,[target("goblin","enemy"),target("orc","enemy")],3);
  assert.equal(failed.state.combatants.goblin.life.hp.current,180,"5d8 fire at faces 4 = 20");
  assert.equal(failed.state.combatants.orc.life.hp.current,180);
  const saved=cast("dnd.srd521.spell.wall-of-fire",stateWithSlots(),[target("goblin","enemy")],20);
  assert.equal(saved.state.combatants.goblin.life.hp.current,190,"half on a successful save");
  const upcast=cast("dnd.srd521.spell.cloudkill",stateWithSlots(),[target("goblin","enemy")],3,7);
  assert.equal(upcast.state.combatants.goblin.life.hp.current,172,"5d8 + 2d8 poison at faces 4");
  assert.equal(upcast.state.combatants.hero.resources.find((entry)=>entry.id==="spell-slot-7")?.current,0,"upcast spends the 7th-level slot");
});

test("Disintegrate deals nothing on a success and 10d6 + 40 on a failure",()=>{
  assert.equal(cast("dnd.srd521.spell.disintegrate",stateWithSlots(),[target("goblin","enemy")],20).state.combatants.goblin.life.hp.current,200);
  assert.equal(cast("dnd.srd521.spell.disintegrate",stateWithSlots(),[target("goblin","enemy")],3).state.combatants.goblin.life.hp.current,120);
});

test("Spiritual Weapon is a bonus-action spell attack adding the spellcasting modifier",()=>{
  const definition=spellMechanicById("dnd.srd521.spell.spiritual-weapon")!;
  assert.equal(definition.castingEconomy,"bonus-action");
  assert.equal(cast("dnd.srd521.spell.spiritual-weapon").state.combatants.goblin.life.hp.current,191,"1d8 (4) + 5 force");
});

test("control spells apply their condition only on a failed save",()=>{
  const cases:Array<[string,string]>=[
    ["dnd.srd521.spell.black-tentacles","restrained"],["dnd.srd521.spell.web","restrained"],["dnd.srd521.spell.entangle","restrained"],
    ["dnd.srd521.spell.grease","prone"],["dnd.srd521.spell.sleet-storm","prone"],["dnd.srd521.spell.stinking-cloud","poisoned"],
    ["dnd.srd521.spell.suggestion","charmed"],["dnd.srd521.spell.mass-suggestion","charmed"],
  ];
  for(const [spellId,conditionId] of cases){
    assert.ok(condition(cast(spellId,stateWithSlots(),[target("goblin","enemy")],3).state,"goblin",conditionId),`${spellId} applies ${conditionId} on a failure`);
    assert.equal(condition(cast(spellId,stateWithSlots(),[target("goblin","enemy")],20).state,"goblin",conditionId),false,`${spellId} applies nothing on a success`);
  }
  const tentacles=cast("dnd.srd521.spell.black-tentacles",stateWithSlots(),[target("goblin","enemy")],3);
  assert.equal(tentacles.state.combatants.goblin.life.hp.current,188,"3d6 bludgeoning at faces 4 alongside Restrained");
});

test("restoration spells end the listed conditions on the touched creature",()=>{
  const state=stateWithSlots();
  for(const conditionId of ["blinded","deafened","paralyzed","poisoned","charmed","petrified"])state.effects.push({id:`probe.${conditionId}`,sourceId:"probe",sourceActorId:"goblin",targetId:"hero",kind:"condition",conditionId,tags:[],duration:{kind:"permanent"}} as never);
  const lesser=cast("dnd.srd521.spell.lesser-restoration",state,[target("hero","self")]);
  for(const conditionId of ["blinded","deafened","paralyzed","poisoned"])assert.equal(condition(lesser.state,"hero",conditionId),false,`Lesser Restoration ends ${conditionId}`);
  assert.ok(condition(lesser.state,"hero","charmed"),"Lesser Restoration leaves Charmed");
  const greater=cast("dnd.srd521.spell.greater-restoration",lesser.state,[target("hero","self")]);
  assert.equal(condition(greater.state,"hero","charmed"),false);
  assert.equal(condition(greater.state,"hero","petrified"),false);
});

test("Foresight and Holy Aura record roll-state riders on the warded creature",()=>{
  const foresight=cast("dnd.srd521.spell.foresight",stateWithSlots(),[target("hero","self")]);
  const riders=foresight.state.effects.filter((effect)=>effect.targetId==="hero"&&effect.kind==="modifier").map((effect)=>effect.metadata as Record<string,string>);
  assert.deepEqual(riders.map((rider)=>[rider.d20Family,rider.d20RollState,rider.d20Scope]).sort(),[
    ["ability-check","advantage","actor"],["attack-roll","advantage","actor"],["attack-roll","disadvantage","target"],["saving-throw","advantage","actor"],
  ]);
  const aura=cast("dnd.srd521.spell.holy-aura",stateWithSlots(),[target("hero","self")]);
  assert.equal(aura.state.effects.filter((effect)=>effect.targetId==="hero"&&effect.kind==="modifier").length,2);
});

test("Goodberry heals one hit point and Protection from Poison cures before it wards",()=>{
  const state=stateWithSlots();
  state.combatants.hero.life.hp.current=state.combatants.hero.life.hp.maximum-5;
  assert.equal(cast("dnd.srd521.spell.goodberry",state,[target("hero","self")]).state.combatants.hero.life.hp.current,state.combatants.hero.life.hp.maximum-4);
  const poisoned=stateWithSlots();
  poisoned.effects.push({id:"probe.poisoned",sourceId:"probe",sourceActorId:"goblin",targetId:"hero",kind:"condition",conditionId:"poisoned",tags:[],duration:{kind:"permanent"}} as never);
  const cured=cast("dnd.srd521.spell.protection-from-poison",poisoned,[target("hero","self")]);
  assert.equal(condition(cured.state,"hero","poisoned"),false);
  assert.ok(cured.state.effects.some((effect)=>effect.targetId==="hero"&&effect.kind==="modifier"&&(effect.metadata as Record<string,string>).d20Family==="saving-throw"));
});
