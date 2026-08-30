import assert from "node:assert/strict";
import test from "node:test";
import { resolveCommonPlayEffectActivation, type CommonPlayPersistentEffectDefinition } from "../../src/domain/commonPlayEffectRuntime";
import { appendCommonPlaySemanticOutcomeEvents, appendCommonPlaySemanticOutcomeTriggers } from "../../src/domain/commonPlaySemanticEventRuntime";
import { resolvePendingResolution } from "../../src/domain/resolution";
import type { PendingResolution, ResolutionCommit } from "../../src/domain/resolutionTypes";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const DEFINITION:CommonPlayPersistentEffectDefinition={
  schemaVersion:"0.2-draft",id:"external.unknown.semantic-ward",
  entryPoints:[{id:"activate",invocation:"manual",operations:[{kind:"effect.apply",template:"semantic-ward",target:"actor"}]}],
  artifactTemplates:[{
    id:"semantic-ward",artifactKind:"effect",
    duration:{kind:"elapsed",amount:{value:1},unit:"hours"},
    rules:[
      {id:"on-hit",event:"attack.hit",frequency:"once-per-resolution",operations:[{kind:"damage.apply",amount:{value:2},damageType:"force",target:"event.actor"}]},
      {id:"on-save-failure",event:"save.failure",frequency:"once-per-resolution",operations:[{kind:"damage.apply",amount:{value:3},damageType:"psychic",target:"event.actor"}]},
    ],
    lifetime:{kind:"until-duration",onEnd:"destroy"},
  }],
};

function committed(value:ResolutionCommit,label:string) {
  assert.equal(value.status,"committed",label);
  if(value.status!=="committed") throw new Error(`${label}: ${value.error}`);
  return value;
}

test("semantic attack/save outcomes dispatch persistent-effect rules through the same pending resolution",()=>{
  let state=runtimeState();
  state=committed(resolveCommonPlayEffectActivation(TEST_PROFILE,state,DEFINITION,{resolutionId:"ward-hero",actorId:"hero",entryPointId:"activate"}),"hero ward").state;
  state=committed(resolveCommonPlayEffectActivation(TEST_PROFILE,state,DEFINITION,{resolutionId:"ward-goblin",actorId:"goblin",entryPointId:"activate"}),"goblin ward").state;
  const pending:PendingResolution={
    id:"semantic-trigger-probe",actorId:"hero",sourceId:"external.renamable.source",expectedRevision:state.revision,
    operations:[
      {id:"attack",kind:"d20",targetId:"goblin",request:{family:"attack-roll",target:10,modifierContributions:[],targetSource:"external-ac",dice:{id:"attack-d20",purpose:"attack",sides:20,faces:[15]}}},
      {id:"save",kind:"d20",actorId:"goblin",request:{family:"saving-throw",target:14,modifierContributions:[],targetSource:"external-dc",dice:{id:"save-d20",purpose:"save",sides:20,faces:[4]}}},
    ],
  };
  const expanded=appendCommonPlaySemanticOutcomeTriggers(state,[DEFINITION],pending,{hero:"character",goblin:"monster"});
  const resolved=appendCommonPlaySemanticOutcomeEvents(expanded,resolvePendingResolution(TEST_PROFILE,state,expanded));
  assert.equal(resolved.status,"committed");
  if(resolved.status!=="committed") return;
  assert.equal(resolved.state.combatants.hero.life.hp.current,18);
  assert.equal(resolved.state.combatants.goblin.life.hp.current,12);
  assert.equal(resolved.events.some((event)=>event.kind==="attack.hit"),true);
  assert.equal(resolved.events.some((event)=>event.kind==="save.failure"),true);
  assert.equal(Object.keys(resolved.results).some((id)=>id.includes("automatic:attack.hit")),true);
  assert.equal(Object.keys(resolved.results).some((id)=>id.includes("automatic:save.failure")),true);
});
