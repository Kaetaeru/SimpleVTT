import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedActionRoutingAdapter";
import type { ConnectedResolutionPresentationV1 } from "../../src/app/connectedResolutionPresentation";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { advanceConnectedResolutionPresentation, applyConnectedClientEvents, applyConnectedResolutionPresentation, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
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

// MP-I06: H/P1/P2 diagnostics correlate session/event/request/resolution identifiers through the
// existing Activity projection without dumping raw payloads into human-readable diagnostics.
test("Host and both Clients correlate the same session, event, and resolution identifiers in their Activity diagnostics",async()=>{
  const sessionId="session.diagnostic-correlation";
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
    const resolutionId=snapshot.resolution!.id;
    const messages=broadcasts.map((entry)=>JSON.parse(entry) as PresentationWire|EventBatchWire);
    const live=messages.filter((entry):entry is PresentationWire=>entry.type==="resolution-presentation");
    const batch=messages.find((entry):entry is EventBatchWire=>entry.type==="event-batch");
    assert.ok(batch);
    const event=batch.events[0];

    // Every wire message names the session; the committed event carries a session-scoped ordered id.
    assert.ok(live.every((entry)=>entry.sessionId===sessionId));
    assert.equal(batch.sessionId,sessionId);
    assert.equal(event.eventId,`${sessionId}:event:${event.sequence}`);
    assert.equal(event.payload.kind,"resolution");
    if(event.payload.kind!=="resolution") throw new Error("expected resolution event");
    assert.equal(event.payload.resolutionId,resolutionId);
    assert.equal(event.payload.presentation.activityLink.resolutionId,resolutionId);
    assert.ok(live.every((entry)=>entry.presentation.resolutionId===resolutionId&&entry.presentation.activityLink.resolutionId===resolutionId));

    const p1=new MockAdapter();
    const p2=new MockAdapter();
    prepareClient(p1,sessionId);
    prepareClient(p2,sessionId);
    for(const message of live){
      applyConnectedResolutionPresentation(p1,message.presentation);
      applyConnectedResolutionPresentation(p2,message.presentation);
    }
    while(advanceConnectedResolutionPresentation(p1).status==="applied");
    while(advanceConnectedResolutionPresentation(p2).status==="applied");
    assert.equal((await applyConnectedClientEvents(p1,batch.events)).status,"applied");
    assert.equal((await applyConnectedClientEvents(p2,batch.events)).status,"applied");

    const hostActivity=(await host.getSnapshot()).activity.find((entry)=>entry.id===resolutionId);
    const [p1Snapshot,p2Snapshot]=await Promise.all([p1.getSnapshot(),p2.getSnapshot()]);
    const p1Activity=p1Snapshot.activity.find((entry)=>entry.id===resolutionId);
    const p2Activity=p2Snapshot.activity.find((entry)=>entry.id===resolutionId);
    assert.ok(hostActivity&&p1Activity&&p2Activity,"all three peers record the resolution under its authoritative id");

    // Clients keep the Host event id and sequence next to the resolution id, so a log line from any peer can be joined on either key.
    for(const [label,activity] of [["P1",p1Activity],["P2",p2Activity]] as const){
      assert.ok(activity.detail.includes(`eventId=${event.eventId}`),`${label} detail must carry the Host event id`);
      assert.equal(activity.summary,`Host event #${event.sequence}`);
      assert.ok(activity.detail.some((line)=>/^ResolutionEvent \d+개$/.test(line)),`${label} reports the applied event count, not the payload`);
      assert.equal(activity.detail.some((line)=>line.includes("authoritativeDice")||line.includes("{")),false,`${label} diagnostics must not dump raw payload JSON`);
    }
    assert.deepEqual(p1Activity.detail,p2Activity.detail);
    assert.equal(p1Snapshot.resolution?.id,p2Snapshot.resolution?.id);
    assert.equal(p1Snapshot.resolution?.id,resolutionId);
    assert.equal(connectedStateFor(p1).replica?.cursor,event.sequence);
    assert.equal(connectedStateFor(p2).replica?.cursor,event.sequence);
    assert.equal(hostState.ledger.cursor,event.sequence);
  } finally {
    tauriSessionTransport.send=originalSend;
  }
});
