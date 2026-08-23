import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedActionRoutingAdapter";
import type { ConnectedResolutionPresentationV1 } from "../../src/app/connectedResolutionPresentation";
import { advanceConnectedResolutionPresentation, applyConnectedResolutionPresentation } from "../../src/app/connectedSessionRuntimeAdapter";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { connectedManifest, applyConnectedClientEvents } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { MockAdapter } from "../../src/app/mockAdapter";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

type PresentationWire={type:"resolution-presentation";sessionId:string;presentation:ConnectedResolutionPresentationV1};
type EventBatchWire={type:"event-batch";sessionId:string;afterCursor:number;events:ConnectedSessionEvent[]};

function prepareClient(adapter:MockAdapter,sessionId:string) {
  const state=connectedStateFor(adapter);
  state.mode="client";
  state.sessionId=sessionId;
  state.replica=new ClientSessionReplica(sessionId);
}

test("Host attack fans the same ordered live dice/VFX presentation and terminal state to acting and observing Clients",async()=>{
  const sessionId="session.three-peer.presentation";
  const host=new MockAdapter();
  const hostState=connectedStateFor(host);
  hostState.mode="host";
  hostState.sessionId=sessionId;
  hostState.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  await host.setSessionMode("initiative");
  await host.setCurrentActor("char.aelar");
  await host.setQueuedD20(11);

  const broadcasts:string[]=[];
  const originalSend=tauriSessionTransport.send;
  tauriSessionTransport.send=async(message:string)=>{broadcasts.push(message);return 2;};
  try {
    let snapshot=await host.resolveAction("action.longsword",["combatant.goblin-a"]);
    for(let step=0;step<8&&snapshot.resolution?.stage!=="complete";step+=1) snapshot=await host.advanceResolution();
    assert.equal(snapshot.resolution?.stage,"complete");

    const messages=broadcasts.map((entry)=>JSON.parse(entry) as PresentationWire|EventBatchWire);
    const live=messages.filter((entry):entry is PresentationWire=>entry.type==="resolution-presentation");
    const batches=messages.filter((entry):entry is EventBatchWire=>entry.type==="event-batch");
    assert.ok(live.length>=2,`attack and damage stages must be observable before terminal commit; got ${messages.map((entry)=>entry.type).join(",")}`);
    assert.deepEqual(live.map((entry)=>entry.presentation.presentationSequence),live.map((_,index)=>index+1));
    assert.equal(batches.length,1);
    assert.equal(batches[0].events.length,1);

    const actingClient=new MockAdapter();
    const observingClient=new MockAdapter();
    prepareClient(actingClient,sessionId);
    prepareClient(observingClient,sessionId);

    const actingStages:string[]=[];
    const observingStages:string[]=[];
    for(const [index,message] of live.entries()) {
      assert.equal(applyConnectedResolutionPresentation(actingClient,message.presentation).status,index===0?"applied":"queued");
      assert.equal(applyConnectedResolutionPresentation(observingClient,message.presentation).status,index===0?"applied":"queued");
      const [acting,observing]=await Promise.all([actingClient.getSnapshot(),observingClient.getSnapshot()]);
      assert.deepEqual(acting.resolution,observing.resolution);
      assert.deepEqual(acting.resolutionPresentation,observing.resolutionPresentation);
    }
    while(true){
      const acting=await actingClient.getSnapshot();
      const observing=await observingClient.getSnapshot();
      actingStages.push(acting.resolution!.stage);
      observingStages.push(observing.resolution!.stage);
      const actingAdvance=advanceConnectedResolutionPresentation(actingClient);
      const observingAdvance=advanceConnectedResolutionPresentation(observingClient);
      assert.equal(actingAdvance.status,observingAdvance.status);
      if(actingAdvance.status==="empty")break;
    }
    assert.deepEqual(actingStages,live.map((entry)=>entry.presentation.resolution.stage));
    assert.deepEqual(observingStages,actingStages);

    const [actingApplied,observingApplied]=await Promise.all([
      applyConnectedClientEvents(actingClient,batches[0].events),
      applyConnectedClientEvents(observingClient,batches[0].events),
    ]);
    assert.equal(actingApplied.status,"applied");
    assert.equal(observingApplied.status,"applied");
    assert.equal(advanceConnectedResolutionPresentation(actingClient).status,"applied");
    assert.equal(advanceConnectedResolutionPresentation(observingClient).status,"applied");
    const [hostAfter,actingAfter,observingAfter]=await Promise.all([host.getSnapshot(),actingClient.getSnapshot(),observingClient.getSnapshot()]);
    const hostTarget=hostAfter.scene.entities.find((entry)=>entry.id==="combatant.goblin-a");
    const actingTarget=actingAfter.scene.entities.find((entry)=>entry.id==="combatant.goblin-a");
    const observingTarget=observingAfter.scene.entities.find((entry)=>entry.id==="combatant.goblin-a");
    assert.equal(actingTarget?.hp,hostTarget?.hp);
    assert.equal(observingTarget?.hp,hostTarget?.hp);
    assert.equal(actingAfter.resolution?.stage,"complete");
    assert.deepEqual(actingAfter.resolution,observingAfter.resolution);
  } finally {
    tauriSessionTransport.send=originalSend;
  }
});
