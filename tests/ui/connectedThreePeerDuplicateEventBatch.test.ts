import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedActionRoutingAdapter";
import type { ConnectedResolutionPresentationV1 } from "../../src/app/connectedResolutionPresentation";
import {
  advanceConnectedResolutionPresentation,
  applyConnectedClientEvents,
  applyConnectedResolutionPresentation,
  connectedManifest,
} from "../../src/app/connectedSessionRuntimeAdapter";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
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

test("MP-C24 core · duplicate terminal event batches do not reapply state, Activity, cursor, or completed dice presentation",async()=>{
  const sessionId="session.mp-c24.duplicate-event-batch";
  const host=new MockAdapter();
  const hostState=connectedStateFor(host);
  hostState.mode="host";
  hostState.sessionId=sessionId;
  hostState.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  await host.setSessionMode("initiative");
  await host.setCurrentActor("char.aelar");
  await host.setQueuedD20(18);

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
    assert.ok(live.length>=2,"C24 fixture requires the ordinary live presentation before terminal commit");
    assert.equal(batches.length,1,"C24 fixture requires one canonical terminal event batch");
    assert.equal(batches[0].events.length,1);

    const actingClient=new MockAdapter();
    const observingClient=new MockAdapter();
    prepareClient(actingClient,sessionId);
    prepareClient(observingClient,sessionId);

    for(const message of live){
      const acting=applyConnectedResolutionPresentation(actingClient,message.presentation);
      const observing=applyConnectedResolutionPresentation(observingClient,message.presentation);
      assert.notEqual(acting.status,"rejected");
      assert.equal(observing.status,acting.status);
    }
    while(advanceConnectedResolutionPresentation(actingClient).status!=="empty"){}
    while(advanceConnectedResolutionPresentation(observingClient).status!=="empty"){}

    const [actingApplied,observingApplied]=await Promise.all([
      applyConnectedClientEvents(actingClient,batches[0].events),
      applyConnectedClientEvents(observingClient,batches[0].events),
    ]);
    assert.equal(actingApplied.status,"applied");
    assert.equal(observingApplied.status,"applied");
    assert.equal(advanceConnectedResolutionPresentation(actingClient).status,"applied");
    assert.equal(advanceConnectedResolutionPresentation(observingClient).status,"applied");

    const actingState=connectedStateFor(actingClient);
    const observingState=connectedStateFor(observingClient);
    const actingCursor=actingState.replica?.cursor;
    const observingCursor=observingState.replica?.cursor;
    const [actingBeforeDuplicate,observingBeforeDuplicate]=await Promise.all([
      actingClient.getSnapshot(),
      observingClient.getSnapshot(),
    ]);
    assert.equal(actingBeforeDuplicate.resolution?.stage,"complete");
    assert.equal(observingBeforeDuplicate.resolution?.stage,"complete");
    assert.equal(actingState.pendingPresentations.length,0);
    assert.equal(observingState.pendingPresentations.length,0);

    const [actingDuplicate,observingDuplicate]=await Promise.all([
      applyConnectedClientEvents(actingClient,batches[0].events),
      applyConnectedClientEvents(observingClient,batches[0].events),
    ]);
    assert.equal(actingDuplicate.status,"duplicate");
    assert.equal(observingDuplicate.status,"duplicate");
    assert.equal(actingState.replica?.cursor,actingCursor,"duplicate batch must not advance P1 cursor");
    assert.equal(observingState.replica?.cursor,observingCursor,"duplicate batch must not advance P2 cursor");

    const [actingAfterDuplicate,observingAfterDuplicate]=await Promise.all([
      actingClient.getSnapshot(),
      observingClient.getSnapshot(),
    ]);
    assert.deepEqual(actingAfterDuplicate.scene,actingBeforeDuplicate.scene,"duplicate batch must not apply shared state twice");
    assert.deepEqual(observingAfterDuplicate.scene,observingBeforeDuplicate.scene,"duplicate batch must not apply observer state twice");
    assert.deepEqual(actingAfterDuplicate.activity,actingBeforeDuplicate.activity,"duplicate batch must not duplicate P1 Activity");
    assert.deepEqual(observingAfterDuplicate.activity,observingBeforeDuplicate.activity,"duplicate batch must not duplicate P2 Activity");
    assert.deepEqual(actingAfterDuplicate.resolution,actingBeforeDuplicate.resolution);
    assert.deepEqual(observingAfterDuplicate.resolution,observingBeforeDuplicate.resolution);
    assert.deepEqual(actingAfterDuplicate.resolutionPresentation,actingBeforeDuplicate.resolutionPresentation);
    assert.deepEqual(observingAfterDuplicate.resolutionPresentation,observingBeforeDuplicate.resolutionPresentation);
    assert.equal(actingState.pendingPresentations.length,0,"duplicate batch must not enqueue completed P1 dice again");
    assert.equal(observingState.pendingPresentations.length,0,"duplicate batch must not enqueue completed P2 dice again");
    assert.equal(advanceConnectedResolutionPresentation(actingClient).status,"empty","duplicate batch must not replay completed P1 presentation");
    assert.equal(advanceConnectedResolutionPresentation(observingClient).status,"empty","duplicate batch must not replay completed P2 presentation");
  } finally {
    tauriSessionTransport.send=originalSend;
  }
});
