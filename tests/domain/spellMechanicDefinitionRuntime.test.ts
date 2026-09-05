import assert from "node:assert/strict";
import test from "node:test";
import { parseSpellMechanicDefinition, parseSpellMechanicFile } from "../../src/domain/spellMechanicDefinitionRuntime";
import { authoredSpellMechanicById, SPELL_EXECUTION_COVERAGE, spellMechanicById } from "../../src/domain/spellMechanics";
import { normalizedSpellDefinitionById } from "../../src/domain/spellExecutionCatalog";
import { resolveSpellCast, type SpellCasterContext, type SpellCastTarget } from "../../src/domain/spellcasting";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

// X1-04: SpellMechanicDefinition as JSON — parsed structurally, authored files outrank prose derivation.
const CHAIN_LIGHTNING="dnd.srd521.spell.chain-lightning";

const FROST_LASH={
  spellId:"homebrew.spell.frost-lash",baseLevel:0,runtimeSupport:"combat-executable",castingEconomy:"action",
  targeting:{kind:"creature",rangeFeet:60,minTargets:1,maxTargets:1,requiresSight:true},
  primary:{kind:"attack-damage",damageType:"cold",dice:{count:1,sides:8,cantripScaling:true}},
  effects:[{conditionId:"prone",trigger:"hit",duration:{kind:"instant"}}],
  components:{verbal:true,somatic:true},
};

test("a complete authored definition parses to the runtime shape and unknown fields are rejected",()=>{
  const parsed=parseSpellMechanicDefinition(FROST_LASH,"frost lash");
  assert.equal(parsed.spellId,"homebrew.spell.frost-lash");
  assert.equal(parsed.primary.kind,"attack-damage");
  assert.deepEqual(parsed.effects?.[0],{conditionId:"prone",trigger:"hit",duration:{kind:"instant"}});
  assert.throws(()=>parseSpellMechanicDefinition({...FROST_LASH,bogus:1},"frost lash"),/unsupported fields: bogus/);
  assert.throws(()=>parseSpellMechanicDefinition({...FROST_LASH,primary:{kind:"attack-damage",damageType:"cold",dice:{count:1}}},"frost lash"),/dice\.sides/);
  assert.throws(()=>parseSpellMechanicDefinition({...FROST_LASH,primary:{kind:"save-damage",saveAbility:"luck",damageType:"cold",dice:{count:1,sides:8},successDamage:"half"}},"frost lash"),/saveAbility/);
  assert.throws(()=>parseSpellMechanicDefinition({...FROST_LASH,effects:[{conditionId:"dazed",trigger:"hit",duration:{kind:"instant"}}]},"frost lash"),/not an SRD condition/);
  assert.throws(()=>parseSpellMechanicDefinition({...FROST_LASH,targeting:{...FROST_LASH.targeting,minTargets:0,maxTargets:0}},"frost lash"),/maxTargets must be at least 1/);
  assert.throws(()=>parseSpellMechanicDefinition({...FROST_LASH,primary:{kind:"tracked-effect",summary:"x",duration:{kind:"rounds",amount:1}}},"frost lash"),/duration\.kind/);
});

test("the spellId option pins an installed definition to its content id",()=>{
  const {spellId:_ignored,...body}=FROST_LASH;
  assert.equal(parseSpellMechanicDefinition(body,"installed",{spellId:"homebrew.spell.frost-lash"}).spellId,"homebrew.spell.frost-lash");
  assert.throws(()=>parseSpellMechanicDefinition(FROST_LASH,"installed",{spellId:"homebrew.spell.other"}),/must match the content id/);
  assert.throws(()=>parseSpellMechanicDefinition(body,"installed"),/spellId is required/);
});

test("an authored file may hold one definition or a definitions array",()=>{
  assert.equal(parseSpellMechanicFile({schemaVersion:"1",...FROST_LASH},"single").length,1);
  assert.equal(parseSpellMechanicFile({schemaVersion:"1",source:{review:"x"},definitions:[FROST_LASH,{...FROST_LASH,spellId:"homebrew.spell.other"}]},"many").length,2);
});

test("the authored Chain Lightning outranks prose derivation and is combat-executable in the normalized catalog",()=>{
  const authored=authoredSpellMechanicById(CHAIN_LIGHTNING);
  assert.ok(authored,"content/spell-mechanics carries Chain Lightning");
  assert.equal(authored.primary.kind,"save-damage");
  const resolved=spellMechanicById(CHAIN_LIGHTNING)!;
  assert.equal(resolved.runtimeSupport,"combat-executable");
  assert.equal(resolved.targeting.maxTargets,4);
  assert.equal(resolved.ritual,false,"catalog facts (ritual, components) are still joined from the presentation catalog");
  assert.equal(normalizedSpellDefinitionById(CHAIN_LIGHTNING)?.primary.kind,"save-damage");
  assert.ok(SPELL_EXECUTION_COVERAGE.authored>=1);
  assert.equal(SPELL_EXECUTION_COVERAGE.authored+SPELL_EXECUTION_COVERAGE.reviewed+SPELL_EXECUTION_COVERAGE.derivedCombat+SPELL_EXECUTION_COVERAGE.tracked,SPELL_EXECUTION_COVERAGE.total);
});

test("the authored Chain Lightning casts through the unchanged spell runtime: two targets save separately, half damage on success",()=>{
  const state=runtimeState();
  state.combatants.goblin.life.hp={current:100,maximum:100,temporary:0};
  state.combatants.hero.resources.push({id:"spell-slot-6",label:"6레벨 주문 슬롯",current:1,maximum:1,recovery:{longRest:"all"}});
  const caster:SpellCasterContext={
    characterLevel:11,spellAttackModifier:8,spellSaveDc:16,spellcastingAbilityModifier:4,
    preparedSpellIds:[CHAIN_LIGHTNING],alwaysPreparedSpellIds:[],cantripSpellIds:[],slotResourceIds:{6:"spell-slot-6"},
  };
  const target=(id:string):SpellCastTarget=>({id,kind:"creature",relation:"enemy",distanceFeet:60,visible:true,cover:"none",ac:12,creatureKind:"monster",saveModifiers:{dex:0},targetCanSeeCaster:true});
  const result=resolveSpellCast(TEST_PROFILE,spellMechanicById(CHAIN_LIGHTNING)!,state,{
    id:"cast.chain-lightning",actorId:"hero",spellId:CHAIN_LIGHTNING,source:"prepared",expectedRevision:0,caster,targets:[target("goblin"),target("hero")],slotLevel:6,
    componentsSatisfied:true,useActionEconomy:false,
    dice:{
      saves:{goblin:{id:"save-goblin",purpose:"DEX save",sides:20,faces:[2]},hero:{id:"save-hero",purpose:"DEX save",sides:20,faces:[19]}},
      effectFaces:[8,8,8,8,8,8,8,8,8,8],
    },
  });
  assert.equal(result.status,"committed",JSON.stringify(result));
  if(result.status!=="committed")return;
  assert.equal(result.state.combatants.hero.resources.find((entry)=>entry.id==="spell-slot-6")?.current,0,"the 6th-level slot is spent");
  const goblinHp=result.state.combatants.goblin.life.hp.current;
  const heroHp=result.state.combatants.hero.life.hp.current;
  assert.ok(goblinHp<100,"the failed save takes full damage");
  assert.ok(heroHp<20||result.state.combatants.hero.life.hp.current<=20,"the successful save takes half damage");
  assert.ok(100-goblinHp>20-heroHp||heroHp===0,`full damage (${100-goblinHp}) exceeds half damage (${20-heroHp})`);
});
