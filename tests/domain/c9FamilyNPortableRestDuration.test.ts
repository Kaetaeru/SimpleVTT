import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveCommonPlayEffectActivation, type CommonPlayPersistentEffectDefinition } from "../../src/domain/commonPlayEffectRuntime";
import { expireEffectsForRest } from "../../src/domain/effects";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const BASE=JSON.parse(readFileSync(
  new URL("../fixtures/play-contract/persistent-effect-trigger.json",import.meta.url),
  "utf8",
)) as CommonPlayPersistentEffectDefinition;

function activate(timing:"rest.short.complete"|"rest.long.complete") {
  const definition=structuredClone(BASE);
  definition.id=`external.unknown.family-n.${timing}`;
  definition.artifactTemplates[0].duration={kind:"until-timing",timing};
  const result=resolveCommonPlayEffectActivation(TEST_PROFILE,runtimeState(),definition,{
    resolutionId:`family-n-${timing}`,
    actorId:"hero",
    entryPointId:"activate",
  });
  assert.equal(result.status,"committed");
  if(result.status!=="committed") throw new Error(result.error);
  assert.equal(result.state.effects.length,1);
  return result.state.effects;
}

test("Family N lowers portable short-rest timing to the shared rest expiry kernel",()=>{
  const effects=activate("rest.short.complete");
  assert.deepEqual(effects[0].expiry,{kind:"rest",rest:"short"});
  assert.deepEqual(expireEffectsForRest(effects,"short").expired.map((effect)=>effect.id),[effects[0].id]);
});

test("Family N keeps long-rest timing active through short rest and expires it on long rest",()=>{
  const effects=activate("rest.long.complete");
  assert.deepEqual(effects[0].expiry,{kind:"rest",rest:"long"});
  assert.equal(expireEffectsForRest(effects,"short").expired.length,0);
  assert.deepEqual(expireEffectsForRest(effects,"long").expired.map((effect)=>effect.id),[effects[0].id]);
});

test("Family N rejects unrelated until-timing values instead of inventing a second lifecycle engine",()=>{
  const definition=structuredClone(BASE);
  definition.id="external.unknown.family-n.unsupported-timing";
  definition.artifactTemplates[0].duration={kind:"until-timing",timing:"turn.end"};
  const state=runtimeState();
  const result=resolveCommonPlayEffectActivation(TEST_PROFILE,state,definition,{
    resolutionId:"family-n-unsupported-timing",
    actorId:"hero",
    entryPointId:"activate",
  });
  assert.equal(result.status,"rejected");
  if(result.status!=="rejected") return;
  assert.match(result.error,/supports rest\.short\.complete or rest\.long\.complete/);
  assert.equal(result.state,state);
  assert.equal(state.effects.length,0);
});
