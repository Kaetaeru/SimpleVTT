import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { applyConnectedClientEvents } from "../../src/app/connectedSessionRuntimeAdapter";
import { ClientSessionReplica, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { MockAdapter } from "../../src/app/mockAdapter";
import { readyActionConfigurationFor } from "../../src/app/standardActionReadyState";

function readyEvent(sequence:number,transition:"armed"|"cleared",actorId="char.aelar",trigger="문이 열리면"):ConnectedSessionEvent {
  return {
    sessionId:"session.ready",
    eventId:`session.ready:event:${sequence}`,
    sequence,
    actorId,
    payload:{
      kind:"ready-action",
      actorId,
      transition,
      configuration:transition==="armed"?{actorId,actionId:"action.test.ready",trigger}:undefined,
      economy:{action:false,bonusAction:true,reaction:transition==="armed",movement:30,movementMax:30},
      stateChanges:[transition==="armed"?"준비 행동 설정":"준비 행동 해제"],
      provenance:["host-authoritative ready-action lifecycle"],
    },
  };
}

test("client projects host ready-action arm and clear events in sequence",async()=>{
  const adapter=new MockAdapter();
  connectedStateFor(adapter).replica=new ClientSessionReplica("session.ready");
  assert.equal((await applyConnectedClientEvents(adapter,[readyEvent(1,"armed")])).status,"applied");
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id==="char.aelar")?.status.includes("준비 행동"),true);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false);
  assert.equal(readyActionConfigurationFor(adapter,"char.aelar")?.trigger,"문이 열리면");

  const clear=readyEvent(2,"cleared");
  assert.equal((await applyConnectedClientEvents(adapter,[clear])).status,"applied");
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id==="char.aelar")?.status.includes("준비 행동"),false);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.reaction,false);
  assert.equal(readyActionConfigurationFor(adapter,"char.aelar"),undefined);

  assert.equal((await applyConnectedClientEvents(adapter,[clear])).status,"duplicate");
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id==="char.aelar")?.status.includes("준비 행동"),false);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.reaction,false);
  assert.equal(readyActionConfigurationFor(adapter,"char.aelar"),undefined);
});

test("clearing one connected Ready actor preserves another actor configuration",async()=>{
  const adapter=new MockAdapter();
  connectedStateFor(adapter).replica=new ClientSessionReplica("session.ready");
  const goblinId="combatant.goblin-a";

  assert.equal((await applyConnectedClientEvents(adapter,[
    readyEvent(1,"armed","char.aelar","문이 열리면"),
    readyEvent(2,"armed",goblinId,"Aelar가 주문을 쓰면"),
  ])).status,"applied");
  assert.equal(readyActionConfigurationFor(adapter,"char.aelar")?.trigger,"문이 열리면");
  assert.equal(readyActionConfigurationFor(adapter,goblinId)?.trigger,"Aelar가 주문을 쓰면");
  assert.equal(readyActionConfigurationFor(adapter),undefined,"ambiguous multi-actor Ready must not pick an arbitrary actor");

  assert.equal((await applyConnectedClientEvents(adapter,[readyEvent(3,"cleared","char.aelar")])).status,"applied");
  const snapshot=await adapter.getSnapshot();
  assert.equal(readyActionConfigurationFor(adapter,"char.aelar"),undefined);
  assert.equal(readyActionConfigurationFor(adapter,goblinId)?.trigger,"Aelar가 주문을 쓰면");
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id==="char.aelar")?.status.includes("준비 행동"),false);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===goblinId)?.status.includes("준비 행동"),true);
});
