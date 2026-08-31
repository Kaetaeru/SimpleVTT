import assert from "node:assert/strict";
import test from "node:test";
import { compileCommonPlayMovement } from "../../src/domain/commonPlayMovementRuntime";
import { resolveCommonPlayStoredInvocationCapture, resolveCommonPlayStoredInvocationTrigger } from "../../src/domain/commonPlayStoredInvocationRuntime";
import { resolveCommonPlayInventoryTransaction, type CommonPlayInventoryState } from "../../src/domain/commonPlayInventoryRuntime";
import { advanceCommonPlayProject } from "../../src/domain/commonPlayProjectRuntime";
import { advanceCommonPlayExposure } from "../../src/domain/commonPlayExposureRuntime";
import { resolvePendingResolution } from "../../src/domain/resolution";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

test("grapple drag composes authoritative movement with doubled movement cost",()=>{
  const result=compileCommonPlayMovement({id:"drag",definition:{kind:"movement.relocate",mode:"move",movementType:"walk",target:"hero",distance:{value:10},costMultiplier:{value:2},destinationFact:{id:"destination",fact:"spatial.legal-destination",subject:"hero",authority:"dm",visibility:"authority-only",unknownPolicy:"request-authority"}},answer:{queryId:"destination",fact:"spatial.legal-destination",subject:"hero",value:"manual:drag",resolutionId:"drag",provenance:{kind:"authority",responderId:"dm"}}});
  assert.equal(result.status,"compiled");
  if(result.status==="compiled")assert.deepEqual({kind:result.operation.kind,cost:result.operation.distanceFeet,distance:result.operation.kind==="move"?result.operation.distanceTraveledFeet:undefined},{kind:"move",cost:20,distance:10});
});

test("Ready spell captures Concentration, spends Reaction on release, ends held Concentration, and consumes once",()=>{
  const state=runtimeState();
  state.concentration.hero={actorId:"hero",groupId:"held-spell",sourceId:"external.spell"};
  const captured=resolveCommonPlayStoredInvocationCapture(TEST_PROFILE,state,{resolutionId:"ready-spell",actorId:"hero",definitionId:"external.spell",entryPointId:"release",definitionRevision:"1",binding:"snapshot",trigger:{op:"eq",left:{ref:"event.kind"},right:{value:"trigger"}},concentrationGroupId:"held-spell",onTriggerConcentration:"end",captureOperations:[{id:"action",kind:"use-economy",slot:"action"}]});
  assert.equal(captured.status,"committed");if(captured.status!=="committed")return;
  const artifact=captured.state.artifacts![0];
  const released=resolveCommonPlayStoredInvocationTrigger(TEST_PROFILE,captured.state,{resolutionId:"release",artifactId:artifact.id,expectedRevision:1,definitionRevision:"1",eventFacts:{"event.kind":"trigger"},invocation:{id:"payload",actorId:"hero",sourceId:"external.spell",expectedRevision:1,operations:[{id:"damage",kind:"damage",targetId:"goblin",damageType:"force",amount:3,creatureKind:"monster"}]}});
  assert.equal(released.status,"committed");
  if(released.status==="committed"){assert.equal(released.state.concentration.hero,undefined);assert.equal(released.state.artifacts?.length,0);assert.equal(released.state.combatants.hero.economy.reaction,false);}
});

function inventory():CommonPlayInventoryState{return {ownerId:"hero",revision:0,items:[{id:"wand",definitionId:"external.wand",quantity:1,stackable:false,equipped:false,wielded:false,charges:{current:1,maximum:3},grantedEntryPointIds:[],effectDefinitionIds:[],spellDefinitionIds:[]}]};}

test("item charges recharge through the durable inventory revision transaction",()=>{
  const result=resolveCommonPlayInventoryTransaction(inventory(),{id:"recharge",ownerId:"hero",expectedRevision:0,operations:[{kind:"charges",itemId:"wand",delta:2}]});
  assert.equal(result.status,"committed");
  assert.equal(result.status==="committed"?result.state.items[0].charges?.current:-1,3);
});

test("spell scroll crafting completes durable work then grants its item output",()=>{
  const project=advanceCommonPlayProject({id:"scroll-project",ownerId:"hero",definitionId:"external.scroll-recipe",revision:0,requiredWork:8,completedWork:0,status:"active",payments:{}},{expectedRevision:0,ownerId:"hero",work:8,payments:{gp:25}});
  assert.equal(project.status,"committed");if(project.status!=="committed")return;
  const granted=resolveCommonPlayInventoryTransaction({ownerId:"hero",revision:0,items:[]},{id:"scroll-output",ownerId:"hero",expectedRevision:0,operations:[{kind:"grant",item:{id:"scroll",definitionId:"external.scroll",quantity:1,stackable:false,equipped:false,wielded:false,grantedEntryPointIds:["cast"],effectDefinitionIds:[],spellDefinitionIds:["external.spell"]}}]});
  assert.equal(project.project.status,"completed");assert.equal(granted.status,"committed");
});

test("dehydration exposure emits every elapsed threshold exactly once",()=>{
  const first=advanceCommonPlayExposure({id:"dehydration",subjectId:"hero",definitionId:"external.dehydration",revision:0,elapsedSeconds:0,thresholdSeconds:86400,intervalSeconds:86400,appliedIntervals:0,status:"active"},0,172800);
  assert.deepEqual(first.newlyTriggeredIntervals,[1,2]);
  assert.deepEqual(advanceCommonPlayExposure(first.exposure,1,1).newlyTriggeredIntervals,[]);
});

test("vehicle repair reuses damageable object authority and reversible Resolver state",()=>{
  const state=runtimeState();
  const spawned=resolvePendingResolution(TEST_PROFILE,state,{id:"vehicle",actorId:"hero",sourceId:"external.vehicle",expectedRevision:0,operations:[{id:"spawn",kind:"spawn-artifact",artifact:{id:"cart",sourceId:"external.vehicle",templateId:"cart",artifactKind:"object",expiry:{kind:"permanent"},object:{size:"large",armorClass:13,hp:{current:5,maximum:20},damageThreshold:5,repairable:true}}}]});
  assert.equal(spawned.status,"committed");if(spawned.status!=="committed")return;
  const repaired=resolvePendingResolution(TEST_PROFILE,spawned.state,{id:"repair",actorId:"hero",sourceId:"external.repair",expectedRevision:1,operations:[{id:"repair",kind:"repair-artifact",artifactId:"cart",amount:4}]});
  assert.equal(repaired.status,"committed");
  assert.equal(repaired.status==="committed"?repaired.state.artifacts?.[0].object?.hp.current:-1,9);
});
