import assert from "node:assert/strict";
import test from "node:test";
import { resolveCommonPlayEffectActivation, type CommonPlayPersistentEffectDefinition } from "../../src/domain/commonPlayEffectRuntime";
import { appendCommonPlaySemanticOutcomeEvents, appendCommonPlaySemanticOutcomeTriggers } from "../../src/domain/commonPlaySemanticEventRuntime";
import { resolvePendingResolution } from "../../src/domain/resolution";
import type { PendingResolution } from "../../src/domain/resolutionTypes";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function pending(sourceId:string):PendingResolution {
  return {
    id:`semantic-${sourceId}`,
    actorId:"hero",
    sourceId,
    expectedRevision:0,
    operations:[
      {
        id:"attack-test",
        kind:"d20",
        targetId:"goblin",
        request:{
          family:"attack-roll",target:10,modifierContributions:[],targetSource:"external-ac",
          dice:{id:"attack-d20",purpose:"external attack",sides:20,faces:[15]},
        },
      },
      {
        id:"save-test",
        kind:"d20",
        actorId:"goblin",
        request:{
          family:"saving-throw",target:14,modifierContributions:[],targetSource:"external-dc",
          dice:{id:"save-d20",purpose:"external save",sides:20,faces:[4]},
        },
      },
    ],
  };
}

function execute(sourceId:string) {
  const request=pending(sourceId);
  const committed=resolvePendingResolution(TEST_PROFILE,runtimeState(),request);
  assert.equal(committed.status,"committed");
  return appendCommonPlaySemanticOutcomeEvents(request,committed);
}

test("Common Play derives authoritative attack and save outcome vocabulary from generic d20 results",()=>{
  const committed=execute("external.unknown.semantic-source");
  assert.equal(committed.status,"committed");
  if(committed.status!=="committed") return;
  const attack=committed.events.find((event)=>event.kind==="attack.hit");
  const save=committed.events.find((event)=>event.kind==="save.failure");
  assert.ok(attack);
  assert.equal(attack.actorId,"hero");
  assert.equal(attack.targetId,"goblin");
  assert.ok(save);
  assert.equal(save.actorId,"goblin","saving-throw semantic actor must be the actual roller, not the resolution source");
  assert.equal(save.targetId,undefined);
  assert.equal(committed.state.history.some((entry)=>entry.kind==="attack.hit"),true);
  assert.equal(committed.state.history.some((entry)=>entry.kind==="save.failure"),true);
  const replay=appendCommonPlaySemanticOutcomeEvents(pending("external.unknown.semantic-source"),committed);
  assert.equal(replay.status,"committed");
  if(replay.status!=="committed") return;
  assert.equal(replay.events.filter((event)=>event.kind==="attack.hit").length,1,"semantic enrichment must be idempotent");
});

test("semantic outcome vocabulary is invariant under external source identity",()=>{
  const summarize=(sourceId:string)=>{
    const committed=execute(sourceId);
    assert.equal(committed.status,"committed");
    if(committed.status!=="committed") return [];
    return committed.events.filter((event)=>event.kind.startsWith("attack.")||event.kind.startsWith("save.")).map((event)=>({
      kind:event.kind,actorId:event.actorId,targetId:event.targetId,
    }));
  };
  assert.deepEqual(summarize("external.first.identity"),summarize("renamed.completely.unseen.identity"));
});


test("semantic outcomes dispatch active persistent-effect rules in the same resolution",()=>{
  const definition:CommonPlayPersistentEffectDefinition={
    schemaVersion:"0.2-draft",id:"external.unknown.semantic-ward",
    entryPoints:[{id:"activate",invocation:"manual",operations:[{kind:"effect.apply",template:"ward",target:"actor"}]}],
    artifactTemplates:[{id:"ward",artifactKind:"effect",duration:{kind:"elapsed",amount:{value:1},unit:"hours"},rules:[
      {id:"on-hit",event:"attack.hit",frequency:"once-per-resolution",operations:[{kind:"damage.apply",amount:{value:2},damageType:"force",target:"event.actor"}]},
      {id:"on-save-failure",event:"save.failure",frequency:"once-per-resolution",operations:[{kind:"damage.apply",amount:{value:3},damageType:"psychic",target:"event.actor"}]},
    ],lifetime:{kind:"until-duration",onEnd:"destroy"}}],
  };
  let state=runtimeState();
  const heroWard=resolveCommonPlayEffectActivation(TEST_PROFILE,state,definition,{resolutionId:"hero-ward",actorId:"hero",entryPointId:"activate"});
  assert.equal(heroWard.status,"committed"); if(heroWard.status!=="committed") return; state=heroWard.state;
  const goblinWard=resolveCommonPlayEffectActivation(TEST_PROFILE,state,definition,{resolutionId:"goblin-ward",actorId:"goblin",entryPointId:"activate"});
  assert.equal(goblinWard.status,"committed"); if(goblinWard.status!=="committed") return; state=goblinWard.state;
  const request=pending("external.renamable.semantic-source");
  request.expectedRevision=state.revision;
  const expanded=appendCommonPlaySemanticOutcomeTriggers(state,[definition],request,{hero:"character",goblin:"monster"});
  const resolved=appendCommonPlaySemanticOutcomeEvents(expanded,resolvePendingResolution(TEST_PROFILE,state,expanded));
  assert.equal(resolved.status,"committed"); if(resolved.status!=="committed") return;
  assert.equal(resolved.state.combatants.hero.life.hp.current,18);
  assert.equal(resolved.state.combatants.goblin.life.hp.current,12);
  assert.equal(Object.keys(resolved.results).some((id)=>id.includes("automatic:attack.hit")),true);
  assert.equal(Object.keys(resolved.results).some((id)=>id.includes("automatic:save.failure")),true);
});
