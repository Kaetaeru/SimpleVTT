import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealAtomicSavingThrowAdapter";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import type { ConnectedResolutionPresentationV1 } from "../../src/app/connectedResolutionPresentation";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { advanceConnectedResolutionPresentation, applyConnectedClientEvents, applyConnectedResolutionPresentation, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { MockAdapter } from "../../src/app/mockAdapter";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

type PresentationWire={type:"resolution-presentation";presentation:ConnectedResolutionPresentationV1};
type BatchWire={type:"event-batch";events:ConnectedSessionEvent[]};

for(const scenario of [
  {name:"single target",actionId:"action.vicious-mockery",targets:["combatant.goblin-a"]},
  {name:"ordered multiple targets",actionId:"action.thunderwave",targets:["combatant.goblin-a","combatant.training-guardian"]},
])test(`three-peer saving throw presentation · ${scenario.name}`,async()=>{
  const sessionId=`session.save.${scenario.name.replaceAll(" ","-")}`;
  const host=new MockAdapter();
  await host.setCurrentActor("char.mira");
  const hostState=connectedStateFor(host);
  hostState.mode="host";hostState.sessionId=sessionId;hostState.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  const broadcasts:string[]=[];
  const originalSend=tauriSessionTransport.send;
  tauriSessionTransport.send=async(message)=>{broadcasts.push(message);return 2;};
  try{
    let completed=await host.resolveAction(scenario.actionId,scenario.targets);
    assert.equal(completed.resolution?.stage,"save-animation");
    for(let i=0;i<8&&completed.resolution?.stage!=="complete";i+=1)completed=await host.advanceResolution();
    assert.equal(completed.resolution?.stage,"complete");
    const wires=broadcasts.map((entry)=>JSON.parse(entry) as PresentationWire|BatchWire);
    const live=wires.filter((entry):entry is PresentationWire=>entry.type==="resolution-presentation");
    const batches=wires.filter((entry):entry is BatchWire=>entry.type==="event-batch");
    assert.ok(live.some((entry)=>entry.presentation.resolution.stage==="save-animation"));
    assert.ok(live.some((entry)=>entry.presentation.resolution.stage==="save-result"));
    assert.equal(batches.length,1);
    const clients=[new MockAdapter(),new MockAdapter()];
    for(const client of clients){const state=connectedStateFor(client);state.mode="client";state.sessionId=sessionId;state.replica=new ClientSessionReplica(sessionId);}
    for(const message of live)for(const client of clients)applyConnectedResolutionPresentation(client,message.presentation);
    while(advanceConnectedResolutionPresentation(clients[0]).status!=="empty")advanceConnectedResolutionPresentation(clients[1]);
    assert.equal(advanceConnectedResolutionPresentation(clients[1]).status,"empty");
    for(const client of clients)assert.equal((await applyConnectedClientEvents(client,batches[0].events)).status,"applied");
    for(const client of clients)assert.equal(advanceConnectedResolutionPresentation(client).status,"applied");
    const [actor,observer]=await Promise.all(clients.map((client)=>client.getSnapshot()));
    assert.deepEqual(actor.resolution,observer.resolution);
    assert.deepEqual(actor.resolution?.saveResults.map((entry)=>[entry.targetId,entry.d20,entry.total,entry.outcome,entry.finalDamage]),completed.resolution?.saveResults.map((entry)=>[entry.targetId,entry.d20,entry.total,entry.outcome,entry.finalDamage]));
    assert.deepEqual(actor.scene.entities,observer.scene.entities);
  }finally{tauriSessionTransport.send=originalSend;}
});
