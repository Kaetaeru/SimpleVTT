import assert from "node:assert/strict";
import test from "node:test";
import { resolvePendingResolution } from "../../src/domain/resolution";
import type { PendingResolution, ResolutionOperation } from "../../src/domain/resolutionTypes";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function d20(id:string,actorId:string,targetId:string,faces:number|number[],target=12):Extract<ResolutionOperation,{kind:"d20"}>{return {id,kind:"d20",actorId,targetId,request:{family:"attack-roll",target,modifierContributions:[],dice:{id:`${id}:die`,purpose:id,sides:20,faces:Array.isArray(faces)?faces:[faces]}}};}
function resolve(operations:ResolutionOperation[],sourceId="external.unknown.mastery"){const state=runtimeState();state.combatants.orc=structuredClone(state.combatants.goblin);state.combatants.orc.id="orc";state.clock={...state.clock,activeActorId:"hero",phase:"action"};state.turnFeatureUsage={actorId:"hero",featureIds:[]};return resolvePendingResolution(TEST_PROFILE,state,{id:`resolution:${sourceId}`,actorId:"hero",sourceId,expectedRevision:0,operations});}

test("Cleave composes hit-gated once-per-turn secondary attack and damage",()=>{
  const result=resolve([d20("primary","hero","goblin",18),{id:"frequency",kind:"use-turn-feature",actorId:"hero",featureId:"mastery.once-per-turn",when:{operationId:"primary",field:"outcome",equals:"success"}},d20("secondary","hero","orc",17),{id:"damage",kind:"damage",targetId:"orc",damageType:"slashing",amount:4,creatureKind:"monster",when:{operationId:"secondary",field:"outcome",equals:"success"}}]);
  assert.equal(result.status,"committed");
  assert.equal(result.status==="committed"?result.state.combatants.orc.life.hp.current:-1,11);
});

test("Graze composes miss-gated ability-modifier damage",()=>{
  const result=resolve([d20("attack","hero","goblin",2),{id:"graze",kind:"damage",targetId:"goblin",damageType:"slashing",amount:3,creatureKind:"monster",when:{operationId:"attack",field:"outcome",equals:"failure"}}]);
  assert.equal(result.status,"committed");
  assert.equal(result.status==="committed"?result.state.combatants.goblin.life.hp.current:-1,12);
});

test("Nick composes the Light extra attack inside one Attack action",()=>{
  const result=resolve([{id:"attack-action",kind:"use-economy",actorId:"hero",slot:"action",actionKind:"attack",attacksPerAction:2}]);
  assert.equal(result.status,"committed");
  assert.equal(result.status==="committed"?result.state.combatants.hero.economy.extraAttacks.length:-1,1);
});

test("Push composes hit-gated forced movement with no Opportunity Attack",()=>{
  const result=resolve([d20("attack","hero","goblin",18),{id:"push",kind:"free-move",actorId:"goblin",distanceFeet:10,maximumDistanceFeet:10,movementMode:"push",destinationRef:"manual:away",doesNotProvokeOpportunityAttacks:true,when:{operationId:"attack",field:"outcome",equals:"success"}}]);
  assert.equal(result.status,"committed");
  assert.equal(result.status==="committed"?(result.results.push as {movementMode:string}).movementMode:"","push");
});

test("Sap composes a target's next attack disadvantage and consumes it",()=>{
  const applied=resolve([d20("attack","hero","goblin",18),{id:"sap",kind:"apply-effect",when:{operationId:"attack",field:"outcome",equals:"success"},effect:{id:"sap-effect",sourceId:"external.mastery",sourceActorId:"hero",targetId:"goblin",kind:"modifier",duration:{kind:"rounds",amount:1,anchorActorId:"hero",boundary:"start"},metadata:{d20Family:"attack-roll",d20RollState:"disadvantage",d20Scope:"actor",consumeOnUse:true}}}]);
  assert.equal(applied.status,"committed");if(applied.status!=="committed")return;
  const used=resolvePendingResolution(TEST_PROFILE,applied.state,{id:"sap-use",actorId:"goblin",sourceId:"attack",expectedRevision:1,operations:[d20("goblin-attack","goblin","hero",[18,3])]});
  assert.equal(used.status,"committed");
  assert.equal(used.status==="committed"?(used.results["goblin-attack"] as {rollState:string}).rollState:"","disadvantage");
  assert.equal(used.status==="committed"?used.state.effects.length:-1,0);
});

test("Slow composes a maintained speed delta into the next turn budget",()=>{
  const applied=resolve([{id:"slow",kind:"apply-effect",effect:{id:"slow-effect",sourceId:"external.mastery",sourceActorId:"hero",targetId:"goblin",kind:"modifier",duration:{kind:"rounds",amount:1,anchorActorId:"hero",boundary:"start"},metadata:{speedDelta:-10}}}]);
  assert.equal(applied.status,"committed");if(applied.status!=="committed")return;
  const turn=resolvePendingResolution(TEST_PROFILE,applied.state,{id:"turn",actorId:"goblin",sourceId:"turn",expectedRevision:1,operations:[{id:"begin",kind:"begin-turn",actorId:"goblin",round:1}]});
  assert.equal(turn.status,"committed");
  assert.equal(turn.status==="committed"?turn.state.combatants.goblin.economy.movement:-1,20);
});

test("Topple composes a hit-gated save and Prone on failure",()=>{
  const save:Extract<ResolutionOperation,{kind:"d20"}>={id:"save",kind:"d20",actorId:"goblin",targetId:"goblin",when:{operationId:"attack",field:"outcome",equals:"success"},request:{family:"saving-throw",target:15,modifierContributions:[],dice:{id:"save-die",purpose:"topple",sides:20,faces:[5]}}};
  const result=resolve([d20("attack","hero","goblin",18),save,{id:"prone",kind:"apply-effect",when:{operationId:"save",field:"outcome",equals:"failure"},effect:{id:"prone",sourceId:"external.mastery",sourceActorId:"hero",targetId:"goblin",kind:"condition",conditionId:"prone",duration:{kind:"permanent"}}}]);
  assert.equal(result.status,"committed");
  assert.equal(result.status==="committed"?result.state.effects[0]?.conditionId:undefined,"prone");
});

test("Vex composes target-constrained advantage and consumes only on that attack",()=>{
  const applied=resolve([{id:"vex",kind:"apply-effect",effect:{id:"vex-effect",sourceId:"external.mastery",sourceActorId:"hero",targetId:"hero",kind:"modifier",duration:{kind:"rounds",amount:1,anchorActorId:"hero",boundary:"end"},metadata:{d20Family:"attack-roll",d20RollState:"advantage",d20Scope:"actor",d20TargetId:"goblin",consumeOnUse:true}}}]);
  assert.equal(applied.status,"committed");if(applied.status!=="committed")return;
  const other=resolvePendingResolution(TEST_PROFILE,applied.state,{id:"other",actorId:"hero",sourceId:"attack",expectedRevision:1,operations:[d20("other-attack","hero","orc",10)]});
  assert.equal(other.status,"committed","unmatched target stays normal and keeps the effect");if(other.status!=="committed")return;
  assert.equal(other.state.effects.length,1);
  const vex=resolvePendingResolution(TEST_PROFILE,other.state,{id:"vex-use",actorId:"hero",sourceId:"attack",expectedRevision:2,operations:[d20("vex-attack","hero","goblin",[10,18])]});
  assert.equal(vex.status,"committed");
  assert.equal(vex.status==="committed"?(vex.results["vex-attack"] as {rollState:string}).rollState:"","advantage");
  assert.equal(vex.status==="committed"?vex.state.effects.length:-1,0);
});
