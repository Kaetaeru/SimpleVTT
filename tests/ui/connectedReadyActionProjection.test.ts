import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { applyConnectedClientEvents } from "../../src/app/connectedSessionRuntimeAdapter";
import { ClientSessionReplica, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { MockAdapter } from "../../src/app/mockAdapter";
import { readyActionConfigurationFor } from "../../src/app/standardActionReadyState";

function readyEvent(sequence:number,transition:"armed"|"cleared"):ConnectedSessionEvent {
  return {
    sessionId:"session.ready",
    eventId:`session.ready:event:${sequence}`,
    sequence,
    actorId:"char.aelar",
    payload:{
      kind:"ready-action",
      actorId:"char.aelar",
      transition,
      configuration:transition==="armed"?{actorId:"char.aelar",actionId:"action.shortbow",trigger:"문이 열리면"}:undefined,
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
  assert.equal(readyActionConfigurationFor(adapter)?.trigger,"문이 열리면");

  assert.equal((await applyConnectedClientEvents(adapter,[readyEvent(2,"cleared")])).status,"applied");
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id==="char.aelar")?.status.includes("준비 행동"),false);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.reaction,false);
  assert.equal(readyActionConfigurationFor(adapter),undefined);
});
