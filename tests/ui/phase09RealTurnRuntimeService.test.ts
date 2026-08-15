import assert from "node:assert/strict";
import test from "node:test";
import type { SceneVm } from "../../src/app/contracts";
import {
  advanceTurnRuntimeSession,
  createTurnRuntimeSession,
  projectTurnRuntimeToScene,
  setTurnRuntimeActiveActor,
  synchronizeTurnRuntimeFromScene,
} from "../../src/app/realTurnRuntimeService";
import { createEffect } from "../../src/domain/effects";

function scene():SceneVm {
  return {
    id:"scene.test",
    name:"Test",
    round:0,
    currentActorId:"slow",
    selectedActorId:"fast",
    entities:[
      { id:"fast", name:"Fast", side:"ally", kind:"character", hp:20, maxHp:20, tempHp:0, ac:15, initiative:18, status:[], resistances:[], immunities:[], vulnerabilities:[], reactions:[] },
      { id:"slow", name:"Slow", side:"enemy", kind:"combatant", hp:20, maxHp:20, tempHp:0, ac:15, initiative:10, status:[], resistances:[], immunities:[], vulnerabilities:[], reactions:[] },
    ],
    actionsByActor:{ fast:[], slow:[] },
    economyByActor:{
      fast:{ action:false, bonusAction:false, reaction:false, movement:0, movementMax:30 },
      slow:{ action:false, bonusAction:false, reaction:false, movement:0, movementMax:40 },
    },
  };
}

test("turn runtime starts initiative from domain ordering and beginTurn economy", () => {
  const value=scene();
  const session=createTurnRuntimeSession(value);
  projectTurnRuntimeToScene(session,value);
  assert.deepEqual(session.initiativeOrder,["fast","slow"]);
  assert.equal(value.round,1);
  assert.equal(value.currentActorId,"fast");
  assert.deepEqual(value.economyByActor.fast,{ action:true, bonusAction:true, reaction:true, movement:30, movementMax:30 });
  assert.deepEqual(value.economyByActor.slow,{ action:true, bonusAction:true, reaction:true, movement:40, movementMax:40 });
});

test("turn runtime absorbs committed economy projection and only resets the actor whose turn begins", () => {
  const value=scene();
  const session=createTurnRuntimeSession(value);
  projectTurnRuntimeToScene(session,value);
  value.economyByActor.fast={ action:false, bonusAction:true, reaction:false, movement:12, movementMax:60 };
  assert.equal(synchronizeTurnRuntimeFromScene(session,value),true);
  assert.equal(session.state.combatants.fast.economy.action,false);
  assert.equal(session.state.combatants.fast.economy.movementMaximum,60);

  advanceTurnRuntimeSession(session);
  projectTurnRuntimeToScene(session,value);
  assert.equal(value.currentActorId,"slow");
  assert.deepEqual(value.economyByActor.slow,{ action:true, bonusAction:true, reaction:true, movement:40, movementMax:40 });
  assert.equal(value.economyByActor.fast.action,false,"ended actor stays spent until its next turn");

  advanceTurnRuntimeSession(session);
  projectTurnRuntimeToScene(session,value);
  assert.equal(value.round,2);
  assert.equal(value.currentActorId,"fast");
  assert.deepEqual(value.economyByActor.fast,{ action:true, bonusAction:true, reaction:true, movement:30, movementMax:30 },"next turn resets to base speed, not a previous temporary movement maximum");
});

test("turn advance expires boundary effects before computing next actor speed and action availability", () => {
  const value=scene();
  const session=createTurnRuntimeSession(value);
  const currentId=session.initiativeOrder[0];
  const nextId=session.initiativeOrder[1];
  const round=session.state.clock.round;
  const historyBefore=session.state.history.length;

  session.state.effects.push(
    createEffect({
      id:"expire-current-end",
      sourceId:"test:end-boundary",
      targetId:currentId,
      kind:"marker",
      duration:{ kind:"until-turn-boundary",actorId:currentId,round,boundary:"end" },
    },session.state.clock),
    createEffect({
      id:"expire-next-start-grappled",
      sourceId:"test:start-boundary",
      targetId:nextId,
      kind:"condition",
      conditionId:"grappled",
      duration:{ kind:"until-turn-boundary",actorId:nextId,round,boundary:"start" },
    },session.state.clock),
    createEffect({
      id:"persist-next-incapacitated",
      sourceId:"test:incapacitated",
      targetId:nextId,
      kind:"condition",
      conditionId:"incapacitated",
      duration:{ kind:"permanent" },
    },session.state.clock),
  );

  advanceTurnRuntimeSession(session);

  assert.equal(session.state.clock.activeActorId,nextId);
  assert.equal(session.state.effects.some((effect)=>effect.id==="expire-current-end"),false,"current end-turn effect expires in end-turn operation");
  assert.equal(session.state.effects.some((effect)=>effect.id==="expire-next-start-grappled"),false,"next start-turn effect expires before begin-turn economy is calculated");
  assert.equal(session.state.effects.some((effect)=>effect.id==="persist-next-incapacitated"),true);
  const economy=session.state.combatants[nextId].economy;
  assert.equal(economy.movement,session.state.combatants[nextId].baseSpeed,"expired Grappled cannot leave movement at 0");
  assert.equal(economy.movementMaximum,session.state.combatants[nextId].baseSpeed);
  assert.equal(economy.action,false,"persistent Incapacitated suppresses Action on begin-turn");
  assert.equal(economy.bonusAction,false,"persistent Incapacitated suppresses Bonus Action on begin-turn");
  assert.equal(economy.reaction,false,"persistent Incapacitated suppresses Reaction on begin-turn");
  assert.equal(session.state.history.length,historyBefore+2,"turn advance records end-turn and begin-turn ResolutionEvents");
  assert.equal(session.state.history.at(-2)?.kind,"end-turn");
  assert.equal(session.state.history.at(-1)?.kind,"begin-turn");
});

test("manual active-actor selection changes turn pointer without resetting spent economy", () => {
  const value=scene();
  const session=createTurnRuntimeSession(value);
  projectTurnRuntimeToScene(session,value);
  value.economyByActor.fast.action=false;
  synchronizeTurnRuntimeFromScene(session,value);
  assert.equal(setTurnRuntimeActiveActor(session,"slow"),true);
  assert.equal(setTurnRuntimeActiveActor(session,"fast"),true);
  projectTurnRuntimeToScene(session,value);
  assert.equal(value.currentActorId,"fast");
  assert.equal(value.economyByActor.fast.action,false);
  assert.equal(setTurnRuntimeActiveActor(session,"missing"),false);
});
