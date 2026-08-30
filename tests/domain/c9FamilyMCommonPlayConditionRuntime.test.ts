import assert from "node:assert/strict";
import test from "node:test";
import {compileCommonPlayEntryPointOperations,parseManualCommonPlayOperationDefinition,resolveCommonPlayEntryPointOperations} from "../../src/domain/commonPlayOperationRuntime";
import {runtimeState,TEST_PROFILE} from "./rulesTestState";
function definition(id:string,kind:"condition.apply"|"condition.remove",condition:string){return parseManualCommonPlayOperationDefinition({schemaVersion:"0.2-draft",id,entryPoints:[{id:"activate",invocation:"manual",operations:[{kind,condition,target:"target"}]}]});}
test("portable condition.apply lowers to canonical Effect and commits",()=>{const state=runtimeState();const d=definition("external.unknown.condition-source","condition.apply","poisoned");const input={resolutionId:"condition-apply",actorId:"hero",entryPointId:"activate",targetId:"goblin"};const pending=compileCommonPlayEntryPointOperations(TEST_PROFILE,state,d,input);const op=pending.operations[0];assert.equal(op?.kind,"apply-effect");if(op?.kind!=="apply-effect")return;assert.equal(op.effect.conditionId,"poisoned");assert.equal(op.effect.targetId,"goblin");const committed=resolveCommonPlayEntryPointOperations(TEST_PROFILE,state,d,input);assert.equal(committed.status,"committed",committed.status==="rejected"?committed.error:undefined);if(committed.status!=="committed")return;const effect=committed.state.effects.find(e=>e.targetId==="goblin"&&e.conditionId==="poisoned");assert.ok(effect);assert.ok(committed.events.flatMap(e=>e.stateChanges).some(c=>c.kind==="effect"&&c.effectId===effect.id&&c.operation==="added"));});
test("portable condition.remove removes one matching instance independent of source identity",()=>{const first=resolveCommonPlayEntryPointOperations(TEST_PROFILE,runtimeState(),definition("external.first.source","condition.apply","exhaustion"),{resolutionId:"condition-a",actorId:"hero",entryPointId:"activate",targetId:"goblin"});assert.equal(first.status,"committed",first.status==="rejected"?first.error:undefined);if(first.status!=="committed")return;const second=resolveCommonPlayEntryPointOperations(TEST_PROFILE,first.state,definition("external.renamed.source","condition.apply","exhaustion"),{resolutionId:"condition-b",actorId:"hero",entryPointId:"activate",targetId:"goblin"});assert.equal(second.status,"committed",second.status==="rejected"?second.error:undefined);if(second.status!=="committed")return;assert.equal(second.state.effects.filter(e=>e.targetId==="goblin"&&e.conditionId==="exhaustion").length,2);const removed=resolveCommonPlayEntryPointOperations(TEST_PROFILE,second.state,definition("external.unrelated.cure","condition.remove","exhaustion"),{resolutionId:"condition-remove",actorId:"hero",entryPointId:"activate",targetId:"goblin"});assert.equal(removed.status,"committed",removed.status==="rejected"?removed.error:undefined);if(removed.status!=="committed")return;assert.equal(removed.state.effects.filter(e=>e.targetId==="goblin"&&e.conditionId==="exhaustion").length,1);assert.ok(removed.events.flatMap(e=>e.stateChanges).some(c=>c.kind==="effect"&&c.operation==="removed"));});
test("portable condition operations fail closed",()=>{assert.throws(()=>definition("external.bad","condition.apply","not-a-condition"),/not a registered SRD condition/);const missing=resolveCommonPlayEntryPointOperations(TEST_PROFILE,runtimeState(),definition("external.cure","condition.remove","poisoned"),{resolutionId:"condition-missing",actorId:"hero",entryPointId:"activate",targetId:"goblin"});assert.equal(missing.status,"rejected");assert.match(missing.status==="rejected"?missing.error:"",/found no poisoned Effect/);});


test("portable condition-derived d20 context reaches the generic Resolver",()=>{
  const restrained=resolveCommonPlayEntryPointOperations(TEST_PROFILE,runtimeState(),definition("external.condition.restrained","condition.apply","restrained"),{resolutionId:"condition-restrained",actorId:"hero",entryPointId:"activate",targetId:"hero"});
  assert.equal(restrained.status,"committed",restrained.status==="rejected"?restrained.error:undefined);
  if(restrained.status!=="committed")return;
  const save=parseManualCommonPlayOperationDefinition({schemaVersion:"0.2-draft",id:"external.unknown.restrained-save",entryPoints:[{id:"activate",invocation:"manual",test:{kind:"saving-throw",roller:"actor",property:"save.dex.modifier",dc:{value:10}},operations:[]}]});
  const saved=resolveCommonPlayEntryPointOperations(TEST_PROFILE,restrained.state,save,{resolutionId:"restrained-save",actorId:"hero",entryPointId:"activate",d20:{faces:[18,4],modifierContributions:[]}});
  assert.equal(saved.status,"committed",saved.status==="rejected"?saved.error:undefined);
  if(saved.status!=="committed")return;
  const saveResult=saved.results["restrained-save:test"] as {natural:number;rollState:string};
  assert.equal(saveResult.rollState,"disadvantage");
  assert.equal(saveResult.natural,4);

  const prone=resolveCommonPlayEntryPointOperations(TEST_PROFILE,runtimeState(),definition("external.condition.prone","condition.apply","prone"),{resolutionId:"condition-prone",actorId:"hero",entryPointId:"activate",targetId:"goblin"});
  assert.equal(prone.status,"committed",prone.status==="rejected"?prone.error:undefined);
  if(prone.status!=="committed")return;
  const attack=parseManualCommonPlayOperationDefinition({schemaVersion:"0.2-draft",id:"external.unknown.prone-attack",entryPoints:[{id:"activate",invocation:"manual",test:{kind:"attack-roll",roller:"actor",dc:{value:10}},operations:[]}]});
  const attacked=resolveCommonPlayEntryPointOperations(TEST_PROFILE,prone.state,attack,{resolutionId:"prone-attack",actorId:"hero",entryPointId:"activate",targetId:"goblin",targetingTargets:[{id:"goblin",kind:"creature",relation:"enemy",distanceFeet:5}],d20:{faces:[4,18],targetId:"goblin",modifierContributions:[]}});
  assert.equal(attacked.status,"committed",attacked.status==="rejected"?attacked.error:undefined);
  if(attacked.status!=="committed")return;
  const attackResult=attacked.results["prone-attack:test"] as {natural:number;rollState:string};
  assert.equal(attackResult.rollState,"advantage");
  assert.equal(attackResult.natural,18);
});
