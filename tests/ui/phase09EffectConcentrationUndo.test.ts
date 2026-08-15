import assert from "node:assert/strict";
import test from "node:test";
import type { SceneVm } from "../../src/app/contracts";
import { undoResolutionEvents } from "../../src/app/realEventUndoService";
import { createEffect } from "../../src/domain/effects";
import { resolvePendingResolution } from "../../src/domain/resolution";
import type { PendingResolution } from "../../src/domain/resolutionTypes";
import { runtimeState, TEST_PROFILE } from "../domain/rulesTestState";

const runtimeOnlyScene = {} as SceneVm;

function concentrationFixture() {
  const state=runtimeState();
  const concentration={ actorId:"hero",groupId:"hero:focus",sourceId:"spell:focus" };
  const effect=createEffect({
    id:"focus-effect",
    sourceId:"spell:focus",
    sourceActorId:"hero",
    targetId:"goblin",
    kind:"marker",
    duration:{ kind:"concentration" },
    concentrationGroupId:concentration.groupId,
    metadata:{ phase:"before" },
  },state.clock);
  state.effects.push(effect);
  state.concentration.hero=structuredClone(concentration);
  return { state,concentration,effect };
}

test("ConcentrationStateChange retains full before/after snapshots instead of group IDs", () => {
  const state=runtimeState();
  const before={ actorId:"hero",groupId:"hero:old",sourceId:"spell:old" };
  state.concentration.hero=structuredClone(before);
  const pending:PendingResolution={
    id:"replace-concentration",
    actorId:"hero",
    sourceId:"spell:new",
    expectedRevision:state.revision,
    operations:[{
      id:"start-new",
      kind:"start-concentration",
      actorId:"hero",
      groupId:"hero:new",
      sourceId:"spell:new",
    }],
  };

  const committed=resolvePendingResolution(TEST_PROFILE,state,pending);
  assert.equal(committed.status,"committed");
  if (committed.status!=="committed") return;
  const change=committed.events[0].stateChanges.find((entry)=>entry.kind==="concentration");
  assert.ok(change && change.kind==="concentration");
  assert.deepEqual(change.before,before);
  assert.deepEqual(change.after,{ actorId:"hero",groupId:"hero:new",sourceId:"spell:new" });

  committed.state.concentration.hero!.sourceId="spell:mutated-after-commit";
  assert.equal(change.after?.sourceId,"spell:new","event snapshot must not drift with later runtime mutation");
});

test("event-native runtime Undo restores exact EffectInstance and ConcentrationState snapshots", () => {
  const { state,concentration,effect }=concentrationFixture();
  const pending:PendingResolution={
    id:"effect-concentration-undo",
    actorId:"hero",
    sourceId:"spell:focus",
    expectedRevision:state.revision,
    operations:[
      {
        id:"update-effect",
        kind:"update-effect",
        effectId:effect.id,
        metadataPatch:{ phase:"after" },
      },
      {
        id:"end-focus",
        kind:"end-concentration",
        actorId:"hero",
        reason:"test end",
      },
    ],
  };

  const committed=resolvePendingResolution(TEST_PROFILE,state,pending);
  assert.equal(committed.status,"committed");
  if (committed.status!=="committed") return;
  assert.equal(committed.state.effects.some((entry)=>entry.id===effect.id),false);
  assert.equal(committed.state.concentration.hero,undefined);

  const undone=undoResolutionEvents(runtimeOnlyScene,committed.events,[],[],committed.state);
  assert.equal(undone.status,"committed");
  if (undone.status!=="committed") return;
  assert.deepEqual(undone.runtimeState?.effects,[effect]);
  assert.deepEqual(undone.runtimeState?.concentration.hero,concentration);
  assert.equal(undone.runtimeState?.revision,committed.state.revision+1,"Undo is a new runtime revision, not revision time travel");
});

test("event-native runtime Undo rejects concentration drift without mutating the supplied state", () => {
  const { state,effect }=concentrationFixture();
  const pending:PendingResolution={
    id:"concentration-drift",
    actorId:"hero",
    sourceId:"spell:focus",
    expectedRevision:state.revision,
    operations:[
      { id:"update-effect",kind:"update-effect",effectId:effect.id,metadataPatch:{ phase:"after" } },
      { id:"end-focus",kind:"end-concentration",actorId:"hero",reason:"test end" },
    ],
  };
  const committed=resolvePendingResolution(TEST_PROFILE,state,pending);
  assert.equal(committed.status,"committed");
  if (committed.status!=="committed") return;

  const drifted=structuredClone(committed.state);
  drifted.concentration.hero={ actorId:"hero",groupId:"hero:external",sourceId:"spell:external" };
  const beforeAttempt=structuredClone(drifted);
  const undone=undoResolutionEvents(runtimeOnlyScene,committed.events,[],[],drifted);
  assert.equal(undone.status,"rejected");
  if (undone.status!=="rejected") return;
  assert.match(undone.error,/concentration/);
  assert.deepEqual(drifted,beforeAttempt,"failed Undo must not mutate current runtime state");
});

test("event-native runtime Undo rejects effect drift and requires runtime state for runtime-only changes", () => {
  const { state,effect }=concentrationFixture();
  const pending:PendingResolution={
    id:"effect-drift",
    actorId:"hero",
    sourceId:"spell:focus",
    expectedRevision:state.revision,
    operations:[{ id:"end-focus",kind:"end-concentration",actorId:"hero",reason:"test end" }],
  };
  const committed=resolvePendingResolution(TEST_PROFILE,state,pending);
  assert.equal(committed.status,"committed");
  if (committed.status!=="committed") return;

  const withoutRuntime=undoResolutionEvents(runtimeOnlyScene,committed.events);
  assert.equal(withoutRuntime.status,"rejected");
  if (withoutRuntime.status==="rejected") assert.match(withoutRuntime.error,/requires runtime state/);

  const drifted=structuredClone(committed.state);
  drifted.effects.push({ ...effect,metadata:{ phase:"external" } });
  const undone=undoResolutionEvents(runtimeOnlyScene,committed.events,[],[],drifted);
  assert.equal(undone.status,"rejected");
  if (undone.status==="rejected") assert.match(undone.error,/effect\.focus-effect/);
});
