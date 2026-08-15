import assert from "node:assert/strict";
import test from "node:test";
import { createEffect } from "../../src/domain/effects";
import { resolvePendingResolution } from "../../src/domain/resolution";
import type { PendingResolution } from "../../src/domain/resolutionTypes";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

test("successful concentration damage save retains the authoritative d20 result in damage result and event", () => {
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
