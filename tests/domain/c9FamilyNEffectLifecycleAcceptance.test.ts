import assert from "node:assert/strict";
import test from "node:test";
import {
  createEffect,
  expireEffectsAtClock,
  expireEffectsForRest,
  suppressEffect,
  terminateEffectsForCreatureState,
  terminateEffectsForDamage,
  unsuppressEffect,
  type EffectApplyRequest,
  type RuntimeClock,
} from "../../src/domain/effects";

const CLOCK:RuntimeClock={round:1,elapsedSeconds:10,activeActorId:"hero",phase:"action"};

function effect(overrides:Partial<EffectApplyRequest>={}) {
  return createEffect({
    id:"external.effect.lifecycle",
    sourceId:"external.unknown.lifecycle-rule",
    sourceActorId:"source",
    targetId:"hero",
    kind:"marker",
    duration:{kind:"seconds",amount:30},
    ...overrides,
  },CLOCK);
}

test("Family N pauses and resumes an arbitrary timed effect without consuming suppressed duration",()=>{
  const active=effect();
  assert.deepEqual(active.expiry,{kind:"time",elapsedSeconds:40});

  const suppressed=suppressEffect(active,{...CLOCK,elapsedSeconds:20},"portable suppression",true);
  assert.deepEqual(suppressed.suppression,{
    reason:"portable suppression",
    pauseDuration:true,
    remainingSeconds:20,
  });
  assert.deepEqual(
    expireEffectsAtClock([suppressed],{...CLOCK,elapsedSeconds:200}),
    {active:[suppressed],expired:[],provenance:[]},
    "paused duration must not expire while the effect is suppressed",
  );

  const resumed=unsuppressEffect(suppressed,{...CLOCK,elapsedSeconds:200});
  assert.equal(resumed.suppression,undefined);
  assert.deepEqual(resumed.expiry,{kind:"time",elapsedSeconds:220});
  assert.equal(expireEffectsAtClock([resumed],{...CLOCK,elapsedSeconds:219}).active.length,1);
  assert.equal(expireEffectsAtClock([resumed],{...CLOCK,elapsedSeconds:220}).expired.length,1);
});

test("Family N ends arbitrary effects from damage and source or target creature-state policy",()=>{
  const damageEnded=effect({
    id:"external.effect.damage-ended",
    termination:{targetTakesDamage:true},
  });
  const sourceDeathEnded=effect({
    id:"external.effect.source-death-ended",
    termination:{sourceDies:true},
  });
  const targetIncapEnded=effect({
    id:"external.effect.target-incap-ended",
    termination:{targetBecomesIncapacitated:true},
  });

  const afterDamage=terminateEffectsForDamage([damageEnded,sourceDeathEnded,targetIncapEnded],"hero");
  assert.deepEqual(afterDamage.expired.map((candidate)=>candidate.id),["external.effect.damage-ended"]);
  assert.deepEqual(afterDamage.active.map((candidate)=>candidate.id),[
    "external.effect.source-death-ended",
    "external.effect.target-incap-ended",
  ]);

  const afterSourceDeath=terminateEffectsForCreatureState(afterDamage.active,"source",{incapacitated:false,dead:true});
  assert.deepEqual(afterSourceDeath.expired.map((candidate)=>candidate.id),["external.effect.source-death-ended"]);

  const afterTargetIncap=terminateEffectsForCreatureState(afterSourceDeath.active,"hero",{incapacitated:true,dead:false});
  assert.deepEqual(afterTargetIncap.expired.map((candidate)=>candidate.id),["external.effect.target-incap-ended"]);
  assert.equal(afterTargetIncap.active.length,0);
});

test("Family N applies rest and turn-boundary expiry without content identity dispatch",()=>{
  const restEnded=effect({
    id:"external.effect.rest-ended",
    duration:{kind:"until-rest",rest:"short"},
  });
  const turnEnded=effect({
    id:"external.effect.turn-ended",
    duration:{kind:"until-turn-boundary",actorId:"hero",round:2,boundary:"end"},
  });

  const afterLongRest=expireEffectsForRest([restEnded,turnEnded],"long");
  assert.deepEqual(afterLongRest.expired.map((candidate)=>candidate.id),["external.effect.rest-ended"]);
  assert.deepEqual(afterLongRest.active.map((candidate)=>candidate.id),["external.effect.turn-ended"]);

  assert.equal(expireEffectsAtClock(afterLongRest.active,{round:2,elapsedSeconds:20,activeActorId:"hero",phase:"start"}).expired.length,0);
  assert.deepEqual(
    expireEffectsAtClock(afterLongRest.active,{round:2,elapsedSeconds:20,activeActorId:"hero",phase:"end"}).expired.map((candidate)=>candidate.id),
    ["external.effect.turn-ended"],
  );
});
