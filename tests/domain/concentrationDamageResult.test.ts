import assert from "node:assert/strict";
import test from "node:test";
import { createEffect } from "../../src/domain/effects";
import { resolvePendingResolution } from "../../src/domain/resolution";
import type { PendingResolution } from "../../src/domain/resolutionTypes";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function concentratingState() {
  const state=runtimeState();
  state.effects.push(createEffect({
    id:"hero-concentration-effect",
    sourceId:"spell:focus",
    sourceActorId:"hero",
    targetId:"goblin",
    kind:"marker",
    duration:{ kind:"concentration" },
    concentrationGroupId:"hero:focus",
  },state.clock));
  state.concentration.hero={ actorId:"hero",groupId:"hero:focus",sourceId:"spell:focus" };
  return state;
}

test("successful concentration damage save retains the authoritative d20 result in damage result and event", () => {
  const state=concentratingState();

  const pending:PendingResolution={
    id:"successful-concentration-save",
    actorId:"goblin",
    sourceId:"attack:test",
    expectedRevision:0,
    operations:[{
      id:"damage",
      kind:"damage",
      targetId:"hero",
      damageType:"slashing",
      amount:8,
      creatureKind:"character",
      concentrationCheck:{
        dice:{ id:"concentration-d20",purpose:"concentration",sides:20,faces:[15] },
        modifierContributions:[{ source:"fixture:hero:con-save",value:2 }],
      },
    }],
  };

  const committed=resolvePendingResolution(TEST_PROFILE,state,pending);
  assert.equal(committed.status,"committed");
  if (committed.status!=="committed") return;

  assert.equal(committed.state.combatants.hero.life.hp.current,12);
  assert.equal(committed.state.concentration.hero?.groupId,"hero:focus");
  assert.ok(committed.state.effects.some((effect)=>effect.id==="hero-concentration-effect"));

  const result=committed.results.damage as {
    finalDamage:number;
    concentrationCheck?:{
      dc:number;
      maintained:boolean;
      test?:{ natural:number;modifier:number;total:number;target:number;outcome:"success"|"failure" };
    };
  };
  assert.equal(result.finalDamage,8);
  assert.equal(result.concentrationCheck?.dc,10);
  assert.equal(result.concentrationCheck?.maintained,true);
  assert.deepEqual(
    result.concentrationCheck?.test && {
      natural:result.concentrationCheck.test.natural,
      modifier:result.concentrationCheck.test.modifier,
      total:result.concentrationCheck.test.total,
      target:result.concentrationCheck.test.target,
      outcome:result.concentrationCheck.test.outcome,
    },
    { natural:15,modifier:2,total:17,target:10,outcome:"success" },
  );

  const eventResult=committed.events.find((event)=>event.operationId==="damage")?.result as typeof result|undefined;
  assert.equal(eventResult?.concentrationCheck?.test?.total,17);
  assert.ok(committed.events[0].provenance.some((entry)=>entry.source==="fixture:hero:con-save"));
  assert.equal(committed.events[0].stateChanges.some((change)=>change.kind==="concentration"),false);
  assert.equal(committed.events[0].stateChanges.some((change)=>change.kind==="effect"),false);
});

test("failed concentration damage save emits reversible concentration and dependent-effect removal events", () => {
  const state=concentratingState();
  const pending:PendingResolution={
    id:"failed-concentration-save",
    actorId:"goblin",
    sourceId:"external.unknown.damage",
    expectedRevision:0,
    operations:[{
      id:"damage",
      kind:"damage",
      targetId:"hero",
      damageType:"force",
      amount:8,
      creatureKind:"character",
      concentrationCheck:{
        dice:{ id:"concentration-d20-fail",purpose:"concentration",sides:20,faces:[1] },
      },
    }],
  };

  const committed=resolvePendingResolution(TEST_PROFILE,state,pending);
  assert.equal(committed.status,"committed");
  if (committed.status!=="committed") return;

  assert.equal(committed.state.combatants.hero.life.hp.current,12);
  assert.equal(committed.state.concentration.hero,undefined);
  assert.equal(committed.state.effects.some((effect)=>effect.id==="hero-concentration-effect"),false);

  const event=committed.events.find((candidate)=>candidate.operationId==="damage");
  assert.ok(event);
  const result=event.result as { concentrationCheck?:{dc:number;maintained:boolean} };
  assert.equal(result.concentrationCheck?.dc,10);
  assert.equal(result.concentrationCheck?.maintained,false);
  const concentrationChange=event.stateChanges.find((change)=>change.kind==="concentration");
  assert.ok(concentrationChange&&concentrationChange.kind==="concentration");
  if (concentrationChange?.kind==="concentration") {
    assert.equal(concentrationChange.before?.groupId,"hero:focus");
    assert.equal(concentrationChange.after,undefined);
  }
  const effectChange=event.stateChanges.find((change)=>change.kind==="effect"&&change.effectId==="hero-concentration-effect");
  assert.ok(effectChange&&effectChange.kind==="effect");
  if (effectChange?.kind==="effect") {
    assert.equal(effectChange.operation,"removed");
    assert.equal(effectChange.before?.concentrationGroupId,"hero:focus");
    assert.equal(effectChange.after,undefined);
  }
});
