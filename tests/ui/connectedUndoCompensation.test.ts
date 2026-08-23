import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { MockAdapter } from "../../src/app/mockAdapter";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

type BatchWire={type:"event-batch";events:ConnectedSessionEvent[]};

test("Host Undo commits one inverse event and both Clients converge without deleting the original Activity",async()=>{
  const sessionId="session.undo.compensation";
  const host=new MockAdapter();
  await host.setSessionMode("freeform");
  await host.setCurrentActor("char.aelar");
  await host.setQueuedD20(11);
  const initial=await host.getSnapshot();
  const initialHp=initial.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")!.hp;
  const state=connectedStateFor(host);
  state.mode="host";state.sessionId=sessionId;state.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  const broadcasts:string[]=[];
  const originalSend=tauriSessionTransport.send;
  tauriSessionTransport.send=async(message)=>{broadcasts.push(message);return 2;};
  try{
    let completed=await host.resolveAction("action.longsword",["combatant.goblin-a"]);
    for(let step=0;step<8&&completed.resolution?.stage!=="complete";step+=1)completed=await host.advanceResolution();
    assert.equal(completed.resolution?.stage,"complete");
    const resolutionId=completed.resolution!.id;
    const damagedHp=completed.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")!.hp;
    assert.ok(damagedHp<initialHp);
    const firstBatch=broadcasts.map((entry)=>JSON.parse(entry) as BatchWire).find((entry)=>entry.type==="event-batch");
    assert.ok(firstBatch);

    const clients=[new MockAdapter(),new MockAdapter()];
    for(const client of clients){const clientState=connectedStateFor(client);clientState.mode="client";clientState.sessionId=sessionId;clientState.replica=new ClientSessionReplica(sessionId);assert.equal((await applyConnectedClientEvents(client,firstBatch.events)).status,"applied");}
    assert.ok(clients.every((client)=>connectedStateFor(client).replica?.cursor===1));
    assert.equal((await clients[0].getSnapshot()).scene.entities.find((entry)=>entry.id==="combatant.goblin-a")?.hp,damagedHp);

    const undone=await host.undoLastResolution();
    assert.equal(undone.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")?.hp,initialHp);
    const batches=broadcasts.map((entry)=>JSON.parse(entry) as BatchWire).filter((entry)=>entry.type==="event-batch");
    assert.equal(batches.length,2);
    const undoEvent=batches[1].events[0];
    assert.equal(undoEvent.sequence,2);
    assert.equal(undoEvent.payload.kind,"resolution-undo");
    if(undoEvent.payload.kind!=="resolution-undo")throw new Error("expected resolution-undo");
    assert.equal(undoEvent.payload.undoOf,resolutionId);
    assert.ok(undoEvent.payload.inverseResolutionEvents.some((event)=>event.stateChanges.some((change)=>change.kind==="hp"&&change.before===damagedHp&&change.after===initialHp)));

    for(const client of clients)assert.equal((await applyConnectedClientEvents(client,[undoEvent])).status,"applied");
    const [actor,observer]=await Promise.all(clients.map((client)=>client.getSnapshot()));
    assert.equal(actor.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")?.hp,initialHp);
    assert.deepEqual(actor.scene.entities,observer.scene.entities);
    assert.equal(actor.activity.find((entry)=>entry.id===resolutionId)?.reversed,true);
    assert.equal(observer.activity.find((entry)=>entry.id===resolutionId)?.reversed,true);
    assert.equal(actor.activity[0]?.undoOf,resolutionId);
    assert.equal((await applyConnectedClientEvents(clients[0],[undoEvent])).status,"duplicate");
    assert.equal((await clients[0].getSnapshot()).scene.entities.find((entry)=>entry.id==="combatant.goblin-a")?.hp,initialHp);
  }finally{tauriSessionTransport.send=originalSend;}
});
