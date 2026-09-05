import assert from "node:assert/strict";
import test from "node:test";
import rawAuthored from "../../src/generated/spellAuthoredMechanics.generated.json";
import { authoredSpellMechanicById, SPELL_EXECUTION_COVERAGE, spellMechanicById } from "../../src/domain/spellMechanics";
import { normalizedSpellDefinitionById } from "../../src/domain/spellExecutionCatalog";
import { resolveSpellCast, type SpellCasterContext, type SpellCastTarget, type SpellMechanicDefinition } from "../../src/domain/spellcasting";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

// X1-06 wave 1: every authored SRD spell resolves to its authored definition, is combat-executable, and casts.
const AUTHORED=(rawAuthored as {definitions:SpellMechanicDefinition[]}).definitions;
const WAVE_1=[
  "dnd.srd521.spell.chain-lightning","dnd.srd521.spell.produce-flame","dnd.srd521.spell.flame-blade","dnd.srd521.spell.call-lightning",
  "dnd.srd521.spell.invisibility","dnd.srd521.spell.greater-invisibility","dnd.srd521.spell.blur","dnd.srd521.spell.faerie-fire",
  "dnd.srd521.spell.slow","dnd.srd521.spell.mass-heal",
];

function casterFor(definition:SpellMechanicDefinition):SpellCasterContext {
  return {
    characterLevel:17,spellAttackModifier:9,spellSaveDc:17,spellcastingAbilityModifier:5,
    preparedSpellIds:definition.baseLevel>0?[definition.spellId]:[],alwaysPreparedSpellIds:[],cantripSpellIds:definition.baseLevel===0?[definition.spellId]:[],
    slotResourceIds:Object.fromEntries([1,2,3,4,5,6,7,8,9].map((level)=>[level,`spell-slot-${level}`])),
  };
}

function stateWithSlots() {
  const state=runtimeState();
  for(const level of [2,3,4,5,6,7,8,9])state.combatants.hero.resources.push({id:`spell-slot-${level}`,label:`${level}레벨 주문 슬롯`,current:1,maximum:1,recovery:{longRest:"all"}});
  state.combatants.goblin.life.hp={current:200,maximum:200,temporary:0};
  return state;
}

function targetsFor(definition:SpellMechanicDefinition):SpellCastTarget[] {
  const base=(id:string,relation:"self"|"ally"|"enemy"):SpellCastTarget=>({id,kind:"creature",relation,distanceFeet:definition.targeting.rangeFeet===0?0:5,visible:true,cover:"none",ac:12,creatureKind:id==="hero"?"character":"monster",saveModifiers:{},targetCanSeeCaster:true});
  const allowed=definition.targeting.allowedRelations;
  if(allowed&&allowed.every((relation)=>relation==="self"||relation==="ally"))return [base("hero","self")];
  return [base("goblin","enemy")];
}

test("the authored wave is present, outranks prose, and is combat-executable in both catalogs",()=>{
  assert.ok(SPELL_EXECUTION_COVERAGE.authored>=WAVE_1.length,`authored tier counts the wave: ${SPELL_EXECUTION_COVERAGE.authored}`);
  for(const spellId of WAVE_1){
    const authored=authoredSpellMechanicById(spellId);
    assert.ok(authored,`${spellId} is authored`);
    assert.equal(spellMechanicById(spellId)?.primary.kind,authored.primary.kind,`${spellId} resolves to the authored primary`);
    assert.equal(spellMechanicById(spellId)?.runtimeSupport,"combat-executable");
    assert.equal(normalizedSpellDefinitionById(spellId)?.executionScope,authored.executionScope,`${spellId} reaches the normalized catalog`);
    assert.ok(authored.executionScope&&/Authored/.test(authored.executionScope),`${spellId} states what it enforces`);
  }
});

test("every authored definition casts through the unchanged spell runtime with a generic target",()=>{
  for(const definition of AUTHORED){
    const state=stateWithSlots();
    // Only the condition-removal spell starts with a Poisoned caster (Poisoned would put every attack roll at disadvantage).
    if(definition.removesConditions?.includes("poisoned"))state.effects.push({id:"probe.poisoned",sourceId:"probe",sourceActorId:"goblin",targetId:"hero",kind:"condition",conditionId:"poisoned",tags:[],duration:{kind:"permanent"}} as never);
    const targets=targetsFor(definition);
    const dice:Record<string,unknown>={
      attack:{id:"attack",purpose:"spell attack",sides:20,faces:[15]},
      saves:Object.fromEntries(targets.map((target)=>[target.id,{id:`save-${target.id}`,purpose:"save",sides:20,faces:[3]}])),
      effectFaces:Array.from({length:40},()=>4),
      attackInstances:targets.map((target)=>({targetId:target.id,attack:{id:`attack-${target.id}`,purpose:"spell attack",sides:20,faces:[15]},effectFaces:Array.from({length:12},()=>4)})),
    };
    const result=resolveSpellCast(TEST_PROFILE,spellMechanicById(definition.spellId)!,state,{
      id:`cast.${definition.spellId}`,actorId:"hero",spellId:definition.spellId,source:definition.baseLevel>0?"prepared":"prepared",expectedRevision:0,
      caster:casterFor(definition),targets,slotLevel:definition.baseLevel>0?definition.baseLevel:undefined,
      componentsSatisfied:true,useActionEconomy:false,dice:dice as never,
    });
    assert.equal(result.status,"committed",`${definition.spellId}: ${JSON.stringify("error" in result?result.error:result.status)}`);
    if(result.status!=="committed")continue;
    if(definition.baseLevel>0){
      const slot=result.state.combatants.hero.resources.find((entry)=>entry.id===`spell-slot-${definition.baseLevel}`);
      assert.equal(slot?.current,slot?slot.maximum-1:undefined,`${definition.spellId} spends its slot`);
    }
    if(definition.effects?.some((effect)=>effect.conditionId==="invisible"))assert.ok(result.state.effects.some((effect)=>effect.conditionId==="invisible"&&effect.targetId==="hero"),`${definition.spellId} applies Invisible`);
    if(definition.removesConditions?.includes("poisoned"))assert.equal(result.state.effects.some((effect)=>effect.conditionId==="poisoned"&&effect.targetId==="hero"),false,`${definition.spellId} removes Poisoned`);
    if(definition.primary.kind==="temporary-hp")assert.ok(result.state.combatants.hero.life.hp.temporary>0,`${definition.spellId} grants temporary HP`);
    if(definition.primary.kind==="save-damage"||definition.primary.kind==="attack-damage")assert.ok(result.state.combatants.goblin.life.hp.current<200,`${definition.spellId} deals damage`);
  }
});
