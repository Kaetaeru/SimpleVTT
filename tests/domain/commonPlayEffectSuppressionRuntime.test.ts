import assert from "node:assert/strict";
import test from "node:test";
import { conditionEffectsFor } from "../../src/domain/combatState";
import { createEffect } from "../../src/domain/effects";
import { resolvePendingResolution } from "../../src/domain/resolution";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

test("effect suppression removes mechanics and can pause then resume elapsed duration",()=>{
  const state=runtimeState();
  state.effects.push(createEffect({
    id:"external-blinded",sourceId:"external.unknown.effect",targetId:"hero",kind:"condition",conditionId:"blinded",
    duration:{kind:"seconds",amount:60},
  },state.clock));
  const suppressed=resolvePendingResolution(TEST_PROFILE,state,{
    id:"suppress",actorId:"hero",sourceId:"external.suppression",expectedRevision:0,
    operations:[{id:"suppress-effect",kind:"set-effect-suppression",effectId:"external-blinded",suppressed:true,reason:"source inactive",pauseDuration:true}],
  });
  assert.equal(suppressed.status,"committed");
  if(suppressed.status!=="committed") return;
  assert.deepEqual(conditionEffectsFor(suppressed.state,"hero"),[]);
  assert.equal(suppressed.state.effects[0].suppression?.remainingSeconds,60);

  const advanced=resolvePendingResolution(TEST_PROFILE,suppressed.state,{
    id:"advance",actorId:"hero",sourceId:"clock",expectedRevision:1,
    operations:[{id:"time",kind:"advance-time",elapsedSeconds:100}],
  });
  assert.equal(advanced.status,"committed");
  if(advanced.status!=="committed") return;
  assert.equal(advanced.state.effects.length,1,"paused effect does not expire");

  const resumed=resolvePendingResolution(TEST_PROFILE,advanced.state,{
    id:"resume",actorId:"hero",sourceId:"external.suppression",expectedRevision:2,
    operations:[{id:"resume-effect",kind:"set-effect-suppression",effectId:"external-blinded",suppressed:false}],
  });
  assert.equal(resumed.status,"committed");
  if(resumed.status!=="committed") return;
  assert.equal(resumed.state.effects[0].expiry.kind,"time");
  if(resumed.state.effects[0].expiry.kind==="time") assert.equal(resumed.state.effects[0].expiry.elapsedSeconds,160);
  assert.equal(conditionEffectsFor(resumed.state,"hero")[0]?.conditionId,"blinded");

  const expired=resolvePendingResolution(TEST_PROFILE,resumed.state,{
    id:"expire",actorId:"hero",sourceId:"clock",expectedRevision:3,
    operations:[{id:"time",kind:"advance-time",elapsedSeconds:160}],
  });
  assert.equal(expired.status,"committed");
  if(expired.status==="committed") assert.equal(expired.state.effects.length,0);
});

test("suppression rejects duration pause for non-time effects atomically",()=>{
  const state=runtimeState();
  state.effects.push(createEffect({id:"round-effect",sourceId:"x",targetId:"hero",kind:"marker",duration:{kind:"rounds",amount:1,anchorActorId:"hero",boundary:"end"}},state.clock));
  const rejected=resolvePendingResolution(TEST_PROFILE,state,{
    id:"bad-pause",actorId:"hero",sourceId:"x",expectedRevision:0,
    operations:[{id:"pause",kind:"set-effect-suppression",effectId:"round-effect",suppressed:true,reason:"pause",pauseDuration:true}],
  });
  assert.equal(rejected.status,"rejected");
  assert.equal(rejected.state,state);
  assert.equal(state.effects[0].suppression,undefined);
});
