import assert from "node:assert/strict";
import test from "node:test";
import { resolveCommonPlayEffectActivation, type CommonPlayPersistentEffectDefinition } from "../../src/domain/commonPlayEffectRuntime";
import { appendCommonPlaySemanticOutcomeEvents, appendCommonPlaySemanticOutcomeTriggers } from "../../src/domain/commonPlaySemanticEventRuntime";
import { resolvePendingResolution } from "../../src/domain/resolution";
import type { PendingResolution } from "../../src/domain/resolutionTypes";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function execute(definitionId:string) {
  const definition:CommonPlayPersistentEffectDefinition={
    schemaVersion:"0.2-draft",
    id:definitionId,
    entryPoints:[{
      id:"activate",
      invocation:"manual",
      operations:[{kind:"effect.apply",template:"expiry-listener",target:"actor"}],
    }],
    artifactTemplates:[{
      id:"expiry-listener",
      artifactKind:"effect",
      duration:{kind:"durable"},
      rules:[{
        id:"on-expiry",
        event:"effect.expired",
        frequency:"once-per-resolution",
        operations:[{kind:"damage.apply",amount:{value:3},damageType:"force",target:"event.target"}],
      }],
      lifetime:{kind:"until-duration",onEnd:"destroy"},
    }],
  };

  let state=runtimeState();
  const activated=resolveCommonPlayEffectActivation(TEST_PROFILE,state,definition,{
    resolutionId:`activate-${definitionId}`,
    actorId:"hero",
    entryPointId:"activate",
  });
  assert.equal(activated.status,"committed");
  if(activated.status!=="committed") return undefined;
  state=activated.state;

  const seed:PendingResolution={
    id:`seed-expiring-${definitionId}`,
    actorId:"hero",
    sourceId:"external.unseen.expiring-source",
    expectedRevision:state.revision,
    operations:[{
      id:"seed-expiring-effect",
      kind:"apply-effect",
      effect:{
        id:`foreign-expiring-${definitionId}`,
        sourceId:"external.unseen.expiring-source",
        sourceActorId:"hero",
        targetId:"hero",
        kind:"marker",
        duration:{kind:"seconds",amount:1},
      },
    }],
  };
  const seeded=resolvePendingResolution(TEST_PROFILE,state,seed);
  assert.equal(seeded.status,"committed");
  if(seeded.status!=="committed") return undefined;
  state=seeded.state;

  const request:PendingResolution={
    id:`expire-${definitionId}`,
    actorId:"hero",
    sourceId:"external.unseen.clock-source",
    expectedRevision:state.revision,
    operations:[{id:"advance",kind:"advance-time",elapsedSeconds:1}],
  };
  const expanded=appendCommonPlaySemanticOutcomeTriggers(state,[definition],request,{hero:"character",goblin:"monster"});
  const committed=appendCommonPlaySemanticOutcomeEvents(expanded,resolvePendingResolution(TEST_PROFILE,state,expanded));
  assert.equal(committed.status,"committed");
  if(committed.status!=="committed") return undefined;

  return {
    hp:committed.state.combatants.hero.life.hp.current,
    expired:committed.events.some((event)=>event.kind==="effect.expired"),
    automatic:Object.keys(committed.results).some((id)=>id.includes("automatic:effect.expired")),
    foreignStillActive:committed.state.effects.some((effect)=>effect.id===`foreign-expiring-${definitionId}`),
    listenerStillActive:committed.state.effects.some((effect)=>effect.sourceId===definitionId),
  };
}

test("unknown Common Play effect.expired rule dispatches in the expiry resolution and survives source rename",()=>{
  const first=execute("external.unknown.expiry-listener");
  const renamed=execute("renamed.unseen.expiry-listener");
  assert.deepEqual(first,{
    hp:17,
    expired:true,
    automatic:true,
    foreignStillActive:false,
    listenerStillActive:true,
  });
  assert.deepEqual(renamed,first);
});
