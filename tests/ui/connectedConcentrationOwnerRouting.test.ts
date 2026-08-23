import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09ConcentrationSaveAdapter";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import type { CharacterSheet } from "../../src/app/contracts";
import { routeConnectedConcentrationResponse } from "../../src/app/connectedConcentrationResponsePort";
import { applyConnectedConcentrationPrompt, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { HostSessionLedger } from "../../src/app/connectedSessionProtocol";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { MockAdapter } from "../../src/app/mockAdapter";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";
import { createEffect } from "../../src/domain/effects";

function scene(adapter:MockAdapter){return (adapter as unknown as {scene:Awaited<ReturnType<MockAdapter["getSnapshot"]>>["scene"]}).scene;}
function seed(adapter:MockAdapter){const before=snapshotAdapterTurnRuntimeState(adapter,scene(adapter))!;const next=structuredClone(before);next.concentration["combatant.goblin-a"]={actorId:"combatant.goblin-a",groupId:"goblin:focus",sourceId:"spell:focus"};next.effects.push(createEffect({id:"focus",sourceId:"spell:focus",sourceActorId:"combatant.goblin-a",targetId:"char.aelar",kind:"marker",duration:{kind:"concentration"},concentrationGroupId:"goblin:focus"},next.clock));next.revision+=1;assert.equal(commitAdapterTurnRuntimeState(adapter,scene(adapter),before.revision,next),true);}

test("concentration d20 prompt is owner-only and the Host validates the responding peer",async()=>{
  const sessionId="session.concentration.owner",ownerPeer="peer.goblin-owner",observerPeer="peer.observer";
  const host=new MockAdapter();await host.startInitiative();await host.setCurrentActor("char.aelar");seed(host);await host.setQueuedD20(11);
  const state=connectedStateFor(host);state.mode="host";state.sessionId=sessionId;state.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  const manifest=connectedManifest(host);state.peerManifests.set(ownerPeer,{...manifest,character:{characterId:"combatant.goblin-a",sourceRevision:0,runtimeRevision:0}});state.peerManifests.set(observerPeer,{...manifest,character:{characterId:"char.aelar",sourceRevision:0,runtimeRevision:0}});
  const broadcasts:string[]=[],direct:Array<{peer:string;message:string}>=[];const originalSend=tauriSessionTransport.send,originalSendTo=tauriSessionTransport.sendTo;
  tauriSessionTransport.send=async(message)=>{broadcasts.push(message);return 2;};tauriSessionTransport.sendTo=async(peer,message)=>{direct.push({peer,message});return 1;};
  try{
    let snapshot=await host.resolveAction("action.shortbow",["combatant.goblin-a"]);snapshot=await host.advanceResolution();snapshot=await host.advanceResolution();snapshot=await host.advanceResolution();
    assert.equal(snapshot.resolution?.stage,"save-animation");assert.equal(snapshot.resolution?.concentrationSave?.natural,undefined);
    const publicPrompt=broadcasts.map(JSON.parse).find((wire)=>wire.type==="resolution-presentation"&&wire.presentation.resolution.stage==="save-animation");assert.ok(publicPrompt);assert.equal(publicPrompt.presentation.resolution.concentrationSave,undefined);assert.doesNotMatch(JSON.stringify(publicPrompt),/modifierSource|goblin:focus/);
    const privatePrompt=direct.map((entry)=>({peer:entry.peer,wire:JSON.parse(entry.message)})).find((entry)=>entry.wire.type==="resolution-concentration-prompt");assert.ok(privatePrompt);assert.equal(privatePrompt.peer,ownerPeer);
    const owner=new MockAdapter();(owner as unknown as {activeCharacter:CharacterSheet}).activeCharacter={...(owner as unknown as {activeCharacter:CharacterSheet}).activeCharacter,id:"combatant.goblin-a"};const ownerState=connectedStateFor(owner);ownerState.mode="client";ownerState.sessionId=sessionId;assert.equal(applyConnectedConcentrationPrompt(owner,privatePrompt.wire).status,"applied");
    assert.equal(await routeConnectedConcentrationResponse(host,{peer:observerPeer,message:""},{sessionId,resolutionId:snapshot.resolution!.id,face:1}),true);assert.equal((await host.getSnapshot()).resolution?.concentrationSave?.natural,undefined);
    assert.equal(await routeConnectedConcentrationResponse(host,{peer:ownerPeer,message:""},{sessionId,resolutionId:snapshot.resolution!.id,face:1}),true);snapshot=await host.getSnapshot();assert.equal(snapshot.resolution?.concentrationSave?.natural,1);assert.equal(snapshot.resolution?.concentrationSave?.outcome,"실패");
    snapshot=await host.advanceResolution();assert.equal(snapshot.resolution?.stage,"complete");assert.equal(snapshotAdapterTurnRuntimeState(host,scene(host))?.concentration["combatant.goblin-a"],undefined);
  }finally{tauriSessionTransport.send=originalSend;tauriSessionTransport.sendTo=originalSendTo;}
});
