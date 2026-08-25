import assert from "node:assert/strict";
import test from "node:test";
import { buildCombatVfxProfile } from "../../src/app/combatVisuals";
import {
  actionFromConnectedPresentation,
  buildConnectedResolutionPresentation,
  isConnectedResolutionPresentation,
} from "../../src/app/connectedResolutionPresentation";
import { buildVisualDiceRoll } from "../../src/app/diceVisuals";
import { MockAdapter } from "../../src/app/mockAdapter";
import { advanceConnectedResolutionPresentation, applyConnectedResolutionPresentation } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";

async function attackPresentation() {
  const adapter=new MockAdapter();
  await adapter.setSessionMode("initiative");
  await adapter.setCurrentActor("char.aelar");
  await adapter.setQueuedD20(11);
  const snapshot=await adapter.resolveAction("action.longsword",["combatant.goblin-a"]);
  const envelope=buildConnectedResolutionPresentation(snapshot,1,"live");
  assert.ok(snapshot.resolution);
  assert.ok(envelope);
  return {snapshot,envelope};
}

test("Host builds one public immutable presentation envelope without private response controls",async()=>{
  const {envelope}=await attackPresentation();
  assert.equal(envelope.schemaId,"simplevtt.connected-resolution-presentation");
  assert.equal(envelope.schemaVersion,1);
  assert.equal(envelope.presentationSequence,1);
  assert.equal(envelope.delivery,"live");
  assert.deepEqual(envelope.actor,{id:"char.aelar",label:"Aelar"});
  assert.deepEqual(envelope.targets,[{id:"combatant.goblin-a",label:"고블린 A"}]);
  assert.equal(envelope.resolution.actionName,"롱소드");
  assert.deepEqual(envelope.resolution.authoritativeDice,[11]);
  assert.equal(envelope.resolution.interrupt,undefined);
  assert.equal(envelope.resolution.canAdvance,false);
  assert.equal(envelope.resolution.nextLabel,undefined);
  assert.equal(envelope.action?.damage?.[0]?.dice,"1d8");
  assert.deepEqual(envelope.dice,{faces:[11],selectedIndices:[0],discardedIndices:[],selection:"all",total:18,modifier:7});
  assert.deepEqual(envelope.timeline,[{key:"roll",label:"판정 굴림",terminal:false}]);
  assert.deepEqual(envelope.activityLink,{resolutionId:envelope.resolutionId});
  assert.equal("resourceCost" in (envelope.action??{}),false);
  assert.equal("details" in (envelope.action??{}),false);
  assert.equal(isConnectedResolutionPresentation(envelope),true);
});

test("remote presentation metadata reproduces the same shared dice and VFX projections",async()=>{
  const {snapshot,envelope}=await attackPresentation();
  const localAction=Object.values(snapshot.scene.actionsByActor).flat().find((entry)=>entry.id===envelope.resolution.actionId);
  const remoteAction=actionFromConnectedPresentation(envelope.action);
  assert.deepEqual(buildVisualDiceRoll(envelope.resolution,remoteAction),buildVisualDiceRoll(envelope.resolution,localAction));
  assert.deepEqual(buildCombatVfxProfile(envelope.resolution,remoteAction),buildCombatVfxProfile(envelope.resolution,localAction));
});

test("presentation validation rejects private controls, identity drift, and malformed dice",async()=>{
  const {envelope}=await attackPresentation();
  const privateControl=structuredClone(envelope) as unknown as {resolution:{nextLabel?:string}};
  privateControl.resolution.nextLabel="Host only";
  assert.equal(isConnectedResolutionPresentation(privateControl),false);

  const identityDrift=structuredClone(envelope);
  identityDrift.resolutionId="resolution.other";
  assert.equal(isConnectedResolutionPresentation(identityDrift),false);

  const malformedDice=structuredClone(envelope) as unknown as {resolution:{authoritativeDice:unknown[]}};
  malformedDice.resolution.authoritativeDice=["11"];
  assert.equal(isConnectedResolutionPresentation(malformedDice),false);
});

test("a separate Client applies each live presentation sequence once without running mechanics",async()=>{
  const {envelope}=await attackPresentation();
  const observer=new MockAdapter();
  const state=connectedStateFor(observer);
  state.mode="client";
  state.sessionId="session.presentation";

  const first=applyConnectedResolutionPresentation(observer,envelope);
  assert.equal(first.status,"applied");
  let snapshot=await observer.getSnapshot();
  assert.equal(snapshot.resolution?.id,envelope.resolutionId);
  assert.deepEqual(snapshot.resolution?.authoritativeDice,[11]);
  assert.equal(snapshot.resolutionPresentation?.action?.damage?.[0]?.dice,"1d8");
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")?.hp,12,"presentation must not mutate mechanics state");

  const duplicate=applyConnectedResolutionPresentation(observer,structuredClone(envelope));
  assert.equal(duplicate.status,"duplicate");
  assert.equal(connectedStateFor(observer).lastAppliedPresentationSequence,1);

  const next=structuredClone(envelope);
  next.presentationSequence=2;
  next.resolution.stage="attack-result";
  assert.equal(applyConnectedResolutionPresentation(observer,next).status,"queued");
  assert.equal(connectedStateFor(observer).pendingPresentations.length,1);
  assert.equal(advanceConnectedResolutionPresentation(observer).status,"applied");
  snapshot=await observer.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"attack-result");
});

test("a new remote dice signal cancels the active replay and discards older queued presentation steps",async()=>{
  const {envelope}=await attackPresentation();
  const observer=new MockAdapter();
  const state=connectedStateFor(observer);
  state.mode="client";
  state.sessionId="session.presentation-replace";

  assert.equal(applyConnectedResolutionPresentation(observer,envelope).status,"applied");
  const result=structuredClone(envelope);
  result.presentationSequence=2;
  result.resolution.stage="attack-result";
  assert.equal(applyConnectedResolutionPresentation(observer,result).status,"queued");
  assert.equal(state.pendingPresentations.length,1);

  const nextRoll=structuredClone(envelope);
  nextRoll.presentationSequence=3;
  nextRoll.resolutionId="resolution.remote-new-roll";
  nextRoll.actor={id:"char.mira",label:"Mira"};
  nextRoll.resolution.id=nextRoll.resolutionId;
  nextRoll.resolution.actorId="char.mira";
  nextRoll.resolution.actionId="action.remote-mira-roll";
  nextRoll.resolution.actionName="Mira 원격 공격";
  nextRoll.resolution.authoritativeDice=[17];
  nextRoll.resolution.attackTotal=24;
  nextRoll.action={...nextRoll.action!,id:nextRoll.resolution.actionId,actorId:"char.mira",name:nextRoll.resolution.actionName};
  nextRoll.dice={faces:[17],selectedIndices:[0],discardedIndices:[],selection:"all",total:24,modifier:7};
  nextRoll.activityLink.resolutionId=nextRoll.resolutionId;

  const replaced=applyConnectedResolutionPresentation(observer,nextRoll);
  assert.equal(replaced.status,"replaced");
  assert.equal(state.pendingPresentations.length,0,"stale result steps must not replay after the newer dice signal");
  const snapshot=await observer.getSnapshot();
  assert.equal(snapshot.resolution?.id,nextRoll.resolutionId);
  assert.equal(snapshot.resolution?.actorId,"char.mira");
  assert.deepEqual(snapshot.resolution?.authoritativeDice,[17]);
  assert.equal(snapshot.resolutionPresentation?.presentationSequence,3);
});

test("advantage-like presentation freezes selected and discarded authoritative faces",async()=>{
  const {snapshot}=await attackPresentation();
  assert.ok(snapshot.resolution);
  snapshot.resolution.authoritativeDice=[6,17];
  snapshot.resolution.attackTotal=24;
  snapshot.resolution.finalOutcome="유리점 적용 · 명중";
  const envelope=buildConnectedResolutionPresentation(snapshot,3,"live");
  assert.ok(envelope);
  assert.deepEqual(envelope.dice.faces,[6,17]);
  assert.equal(envelope.dice.selection,"highest");
  assert.deepEqual(envelope.dice.selectedIndices,[1]);
  assert.deepEqual(envelope.dice.discardedIndices,[0]);
  assert.equal(envelope.dice.modifier,7);
  assert.equal(isConnectedResolutionPresentation(envelope),true);
});
