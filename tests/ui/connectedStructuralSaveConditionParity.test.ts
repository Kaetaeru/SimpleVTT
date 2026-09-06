import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import type { ConnectedResolutionPresentationV1 } from "../../src/app/connectedResolutionPresentation";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { advanceConnectedResolutionPresentation, applyConnectedClientEvents, applyConnectedResolutionPresentation, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { MockAdapter } from "../../src/app/mockAdapter";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

type PresentationWire={type:"resolution-presentation";sessionId:string;presentation:ConnectedResolutionPresentationV1};
type EventBatchWire={type:"event-batch";sessionId:string;afterCursor:number;events:ConnectedSessionEvent[]};

function prepareClient(adapter:MockAdapter,sessionId:string){
  const state=connectedStateFor(adapter);
  state.mode="client";
  state.sessionId=sessionId;
  state.replica=new ClientSessionReplica(sessionId);
}

/**
 * V1.6 S1-04 (무너진 종탑 장면 2): 카엘's 맨손 타격 · 붙잡기 put "✦ 붙잡힘" on 해골 1 on the Host, and every replica had the
 * activity entry ("DEX 6 vs DC 13 · 붙잡힘 적용") but no chip on the skeleton. The condition effect a structural save
 * applies must reach every replica's runtime and be projected on the target like the Host's.
 */
test("S1-04: a structural save condition (붙잡기) shows on the target on every replica, not only on the Host", async () => {
  const sessionId="session.structural-save.grapple";
  const host=new MockAdapter();
  await host.setReferenceRole("dm");
  // The fixture fighter projects action.unarmed-strike.grapple once Initiative runs and he holds the turn.
  await host.startInitiative();
  await host.setCurrentActor("char.aelar");
  await host.selectDmActor("char.aelar");
  await host.setQueuedD20(1);
  const grapple={id:"action.unarmed-strike.grapple"};
  const state=connectedStateFor(host);
  state.mode="host";
  state.sessionId=sessionId;
  state.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  const broadcasts:string[]=[];
  const originalSend=tauriSessionTransport.send;
  tauriSessionTransport.send=async(message)=>{broadcasts.push(message);return 2;};
  try{
    let completed=await host.resolveAction(grapple.id,["combatant.goblin-a"]);
    for(let step=0;step<12&&completed.resolution&&completed.resolution.stage!=="complete";step+=1)completed=await host.advanceResolution();
    assert.equal(completed.resolution?.stage,"complete",JSON.stringify(completed.resolution));
    const hostGoblin=completed.scene.entities.find((entry)=>entry.id==="combatant.goblin-a");
    assert.ok(hostGoblin?.status.some((status)=>status.includes("붙잡힘")),`the Host shows the grapple; got ${JSON.stringify(hostGoblin?.status)}`);

    const messages=broadcasts.map((entry)=>JSON.parse(entry) as PresentationWire|EventBatchWire);
    const live=messages.filter((entry):entry is PresentationWire=>entry.type==="resolution-presentation");
    const batches=messages.filter((entry):entry is EventBatchWire=>entry.type==="event-batch");
    assert.equal(batches.length,1,`exactly one committed batch; got ${JSON.stringify(messages.map((entry)=>entry.type))}`);
    const observer=new MockAdapter();
    prepareClient(observer,sessionId);
    for(const message of live)applyConnectedResolutionPresentation(observer,message.presentation);
    while(advanceConnectedResolutionPresentation(observer).status!=="empty"){ /* drain the shared presentation */ }
    const applied=await applyConnectedClientEvents(observer,batches[0].events);
    assert.equal(applied.status,"applied",JSON.stringify(applied));
    while(advanceConnectedResolutionPresentation(observer).status!=="empty"){ /* drain */ }
    const observed=await observer.getSnapshot();
    const goblin=observed.scene.entities.find((entry)=>entry.id==="combatant.goblin-a");
    assert.ok(goblin?.status.some((status)=>status.includes("붙잡힘")),`the observer shows the grapple on the target; got ${JSON.stringify(goblin?.status)}`);
  }finally{
    tauriSessionTransport.send=originalSend;
  }
});
