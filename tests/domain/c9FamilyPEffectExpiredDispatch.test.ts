import assert from "node:assert/strict";
import test from "node:test";
import { createEffect } from "../../src/domain/effects";
import { resolveCommonPlayEffectActivation, type CommonPlayPersistentEffectDefinition } from "../../src/domain/commonPlayEffectRuntime";
import { appendCommonPlaySemanticOutcomeEvents, appendCommonPlaySemanticOutcomeTriggers } from "../../src/domain/commonPlaySemanticEventRuntime";
import { resolvePendingResolution } from "../../src/domain/resolution";
import type { PendingResolution } from "../../src/domain/resolutionTypes";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function execute(definitionId:string) {
  const definition:CommonPlayPersistentEffectDefinition={
    schemaVersion:"0.2-draft",id:definitionId,
    entryPoints:[{id:"activate",invocation:"manual",operations:[{kind:"effect.apply",template:"listener",target:"actor"}]}],
    artifactTemplates:[{id:"listener",artifactKind:"effect",duration:{kind:"durable"},rules:[{
      id:"on-expiry",event:"effect.expired",frequency:"once-per-resolution",
      operations:[{kind:"damage.apply",amount:{value:2},damageType:"force",target:"event.target"}],
    }],lifetime:{kind:"until-duration",onEnd:"destroy"}}],
  };
  let state=runtimeState();
  const activated=resolveCommonPlayEffectActivation(TEST_PROFILE,state,definition,{resolutionId:`${definitionId}:activate`,actorId:"hero",entryPointId:"activate"});
  assert.equal(activated.status,"committed");
  if(activated.status!=="committed") throw new Error(activated.error);
  state=activated.state;
  state.effects.push(createEffect({
    id:`${definitionId}:foreign-expiring`,sourceId:"external.foreign.expiring",sourceActorId:"goblin",targetId:"hero",kind:"marker",duration:{kind:"seconds",amount:1},
  },state.clock));
  const request:PendingResolution={
    id:`${definitionId}:expiry`,actorId:"hero",sourceId:"external.unknown.lifecycle-source",expectedRevision:state.revision,
    operations:[{id:"advance",kind:"advance-time",elapsedSeconds:1}],
  };
  const expanded=appendCommonPlaySemanticOutcomeTriggers(state,[definition],request,{hero:"character",goblin:"monster"});
  const resolved=appendCommonPlaySemanticOutcomeEvents(expanded,resolvePendingResolution(TEST_PROFILE,state,expanded));
  assert.equal(resolved.status,"committed");
  if(resolved.status!=="committed") throw new Error(resolved.error);
  return {
    hp:resolved.state.combatants.hero.life.hp.current,
    semantic:resolved.events.filter((event)=>event.kind==="effect.expired").map((event)=>({kind:event.kind,targetId:event.targetId})),
    dispatched:Object.keys(resolved.results).filter((id)=>id.includes("automatic:effect.expired")&&!id.includes(":frequency:")).length,
  };
}

test("effect.expired dispatches an active portable effect rule atomically and is identity invariant",()=>{
  const first=execute("external.unknown.expiry-listener");
  const renamed=execute("renamed.unseen.expiry-listener");
  assert.equal(first.hp,18);
  assert.equal(first.dispatched,1);
  assert.deepEqual(first.semantic,[{kind:"effect.expired",targetId:"hero"}]);
  assert.deepEqual(first,renamed);
});
