import assert from "node:assert/strict";
import test from "node:test";
import { resolvePendingResolution } from "../../src/domain/resolution";
import { resolveSpellComponents, advanceCastingActivity } from "../../src/domain/commonPlaySpellcastingMeta";
import { resolveCommonPlayProgressionContributions } from "../../src/domain/commonPlayProgressionContribution";
import { compileCommonPlaySpecialAction } from "../../src/domain/commonPlaySpecialTimingRuntime";
import { advanceCommonPlayProject } from "../../src/domain/commonPlayProjectRuntime";
import { advanceCommonPlayExposure, recoverCommonPlayExposure } from "../../src/domain/commonPlayExposureRuntime";
import { mountFallOffOutcome, validateCommonPlayMount } from "../../src/domain/commonPlayMountRuntime";
import { environmentDamageDefense, fallDamageDice, resolveEnvironmentAttack, resolveEnvironmentMovement, type CommonPlayEnvironmentProfile } from "../../src/domain/commonPlayEnvironmentRuntime";
import { parseRuleModulePackage } from "../../src/app/ruleModulePackageImport";
import type { RulesRuntimeState } from "../../src/domain/combatState";

const profile={id:"test",version:"1"};
function state():RulesRuntimeState{return {revision:0,clock:{round:1,elapsedSeconds:0,activeActorId:"dragon",phase:"start"},combatants:{dragon:{id:"dragon",baseSpeed:30,life:{hp:10,maxHp:10,temporaryHp:0,unconscious:false,stable:false,dead:false,deathSaves:{successes:0,failures:0}},economy:{action:true,bonusAction:false,reaction:true,movementRemaining:30,extraActions:[],extraAttacks:[]},resources:[{id:"breath",label:"Breath",current:0,maximum:1},{id:"legendary",label:"Legendary",current:3,maximum:3}],hitDice:[]}},effects:[],concentration:{},history:[]};}

test("typed spell components enforce silence, free hands, substitution, cost, and consumption",()=>{
  const base={canSpeak:true,silenced:false,freeHands:1,hasFocus:true,hasComponentPouch:false,materials:{diamond:{quantity:1,unitCostGp:300}}};
  assert.equal(resolveSpellComponents({verbal:true,somatic:true,material:{}},base).usedSubstitute,"focus");
  assert.deepEqual(resolveSpellComponents({material:{id:"diamond",costGp:300,consumed:true}},base).consumed,[{materialId:"diamond",quantity:1}]);
  assert.throws(()=>resolveSpellComponents({verbal:true},{...base,silenced:true}),/verbal/);
  assert.throws(()=>resolveSpellComponents({material:{id:"ruby",costGp:100}},{...base,materials:{}}),/specific costly/);
  assert.equal(advanceCastingActivity({id:"cast",actorId:"mage",definitionId:"spell",kind:"ritual",requiredSeconds:600,elapsedSeconds:540,concentrationRequired:true,status:"active"},60,true).status,"completed");
  assert.equal(advanceCastingActivity({id:"cast",actorId:"mage",definitionId:"spell",kind:"long-cast",requiredSeconds:600,elapsedSeconds:1,concentrationRequired:true,status:"active"},1,false).status,"interrupted");
});

test("unknown progression contributions apply by track identity with revision and idempotent grants",()=>{
  const first=resolveCommonPlayProgressionContributions({revision:4,trackLevels:{"external.track":3},grants:["base"]},4,[{track:"external.track",threshold:3,grants:["external.feature"]}]);
  assert.equal(first.status,"committed");
  if(first.status!=="committed")return;
  assert.deepEqual(first.addedGrantIds,["external.feature"]);
  const replay=resolveCommonPlayProgressionContributions(first.state,first.state.revision,[{track:"external.track",threshold:3,grants:["external.feature"]}]);
  assert.deepEqual(replay.status==="committed"?replay.addedGrantIds:[],[]);
  assert.equal(resolveCommonPlayProgressionContributions(first.state,4,[]).status,"rejected");
});

test("RuleModule import preserves unknown progression contributions for activation",()=>{
  const parsed=parseRuleModulePackage(JSON.stringify({schemaVersion:"0.1-draft",moduleId:"external.progression",moduleVersion:"1",rulesProfile:{id:"test",version:"1"},defaultLocale:"en",source:{document:"External",version:"1",license:"CC0",srdDerived:false},capabilities:[],content:[{id:"class.unknown",category:"class",presentation:{defaultLocale:"en",locales:{en:{name:"Unknown"}}},progressionContributions:[{track:"external.track",threshold:3,grants:["external.feature"]}]}]}));
  assert.deepEqual(parsed.entries[0].progressionContributions,[{track:"external.track",threshold:3,grants:["external.feature"]}]);
});

test("Recharge 5-6 is deterministic, atomic, revision-safe, and undo-visible",()=>{
  const pending={id:"recharge",actorId:"dragon",sourceId:"external.recharge",expectedRevision:0,operations:[{id:"roll",kind:"recharge-resource" as const,resourceId:"breath",timing:"turn-start" as const,die:{sides:6,faces:[5]},succeedsOn:{minimum:5}}]};
  const result=resolvePendingResolution(profile,state(),pending);
  assert.equal(result.status,"committed");
  if(result.status!=="committed")return;
  assert.equal(result.state.combatants.dragon.resources[0].current,1);
  assert.equal(result.events[0].stateChanges[0]?.kind,"resource");
  assert.equal(resolvePendingResolution(profile,result.state,pending).status,"rejected");
  const failed=resolvePendingResolution(profile,state(),{...pending,id:"failed",operations:[{...pending.operations[0],die:{sides:6,faces:[4]}}]});
  assert.equal(failed.status,"committed");
  assert.equal(failed.status==="committed"?failed.state.combatants.dragon.resources[0].current:-1,0);
});

test("special timing compiles owner-authorized off-turn cost and payload into the Resolver",()=>{
  const runtime=state();
  const pending=compileCommonPlaySpecialAction(runtime,{id:"external.special",ownerActorId:"dragon",timing:{kind:"after-turn",actor:"other"},poolResourceId:"legendary",options:[{id:"tail",cost:2,operations:[]}]},{resolutionId:"special-1",requesterActorId:"dragon",optionId:"tail",event:{kind:"after-turn",actorId:"hero"}});
  const result=resolvePendingResolution(profile,runtime,pending);
  assert.equal(result.status,"committed");
  assert.equal(result.status==="committed"?result.state.combatants.dragon.resources[1].current:-1,1);
  assert.throws(()=>compileCommonPlaySpecialAction(runtime,{id:"x",ownerActorId:"dragon",timing:{kind:"after-turn",actor:"other"},options:[{id:"x",cost:0,operations:[]}]},{resolutionId:"x",requesterActorId:"hero",optionId:"x",event:{kind:"after-turn",actorId:"hero"}}),/owner/);
});

test("durable projects and exposure counters are revision-safe and threshold based",()=>{
  const project=advanceCommonPlayProject({id:"scroll",ownerId:"mage",definitionId:"craft",revision:2,requiredWork:16,completedWork:8,status:"active",payments:{}},{expectedRevision:2,ownerId:"mage",work:8,payments:{gp:25}});
  assert.equal(project.status,"committed");
  assert.equal(project.status==="committed"?project.project.status:"","completed");
  const tick=advanceCommonPlayExposure({id:"cold",subjectId:"hero",definitionId:"extreme-cold",revision:0,elapsedSeconds:0,thresholdSeconds:3600,intervalSeconds:3600,appliedIntervals:0,status:"active"},0,7200);
  assert.deepEqual(tick.newlyTriggeredIntervals,[1,2]);
  assert.equal(recoverCommonPlayExposure(tick.exposure,1).status,"recovered");
});

test("mount and environment facts compose without actor or weapon identity dispatch",()=>{
  assert.equal(validateCommonPlayMount({riderId:"hero",mountId:"horse",controllerId:"hero",mode:"controlled",riderSize:"medium",mountSize:"large",movementCostFeet:15,controlledActionIds:["dash","disengage","dodge"]}).mode,"controlled");
  assert.deepEqual(mountFallOffOutcome(false),{fallsOff:true,prone:true});
  const underwater:CommonPlayEnvironmentProfile={id:"underwater",movementCostMultiplier:2,bypassMovementMultiplierWithModes:["swim"],attackRules:[{attackKind:"melee-weapon",adaptedProperty:"underwater-adapted",otherwise:"disadvantage"},{attackKind:"ranged-weapon",normalRangeOnly:true,otherwise:"automatic-miss"}],damageDefenses:[{damageType:"fire",kind:"resistance"}]};
  assert.equal(resolveEnvironmentMovement(underwater,"swim",true),1);
  assert.deepEqual(resolveEnvironmentAttack(underwater,{attackKind:"melee-weapon",properties:[],rangeBand:"normal"}),{allowed:true,disadvantage:true});
  assert.deepEqual(resolveEnvironmentAttack(underwater,{attackKind:"ranged-weapon",properties:[],rangeBand:"long"}),{allowed:false,disadvantage:false});
  assert.equal(environmentDamageDefense(underwater,"fire"),"resistance");
  assert.equal(fallDamageDice(250),20);
});
