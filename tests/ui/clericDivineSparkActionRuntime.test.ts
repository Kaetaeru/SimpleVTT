import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedActionRoutingAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { CharacterSheet, SceneVm } from "../../src/app/contracts";
import { CLERIC_CHANNEL_DIVINITY_RESOURCE_ID, CLERIC_ID } from "../../src/domain/coreClassResources";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

async function cleric(){
  const adapter=new MockAdapter();const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:SceneVm};
  internal.activeCharacter={...internal.activeCharacter,className:"클레릭",level:7,classLevels:[{classId:CLERIC_ID,className:"클레릭",level:7}],abilities:{...internal.activeCharacter.abilities,wis:18},resources:[]};
  await adapter.getSnapshot();await adapter.startInitiative();await adapter.setCurrentActor(internal.activeCharacter.id);await adapter.selectDmActor(internal.activeCharacter.id);return adapter;
}

test("Divine Spark damage spends Action and Channel Divinity, applies HP, and Undo restores all",async()=>{
  const adapter=await cleric();let snapshot=await adapter.getSnapshot();const action=snapshot.scene.actionsByActor[snapshot.activeCharacter.id]?.find((entry)=>entry.id==="action.cleric.divine-spark.radiant");
  assert.equal(action?.summary,"건강 내성 DC 15 · 2d8 +4 광휘 피해 · 3/3");assert.equal(action?.eligibleTargetIds.includes(snapshot.activeCharacter.id),false);
  const before=snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")!.hp;await adapter.setQueuedD20(1);await adapter.resolveAction("action.cleric.divine-spark.radiant",["combatant.goblin-a"]);snapshot=await adapter.getSnapshot();
  assert.ok(snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")!.hp<before);assert.equal(snapshot.scene.economyByActor[snapshot.activeCharacter.id]?.action,false);assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===CLERIC_CHANNEL_DIVINITY_RESOURCE_ID)?.current,2);
  await adapter.undoLastResolution();snapshot=await adapter.getSnapshot();assert.equal(snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")!.hp,before);assert.equal(snapshot.scene.economyByActor[snapshot.activeCharacter.id]?.action,true);assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===CLERIC_CHANNEL_DIVINITY_RESOURCE_ID)?.current,3);
});

test("freeform Divine Spark does not strand Action economy",async()=>{
  const adapter=await cleric();await adapter.setSessionMode("freeform");const before=(await adapter.getSnapshot()).scene.entities.find((entry)=>entry.id==="combatant.goblin-a")!.hp;await adapter.setQueuedD20(1);await adapter.resolveAction("action.cleric.divine-spark.necrotic",["combatant.goblin-a"]);const snapshot=await adapter.getSnapshot();assert.ok(snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")!.hp<before);assert.equal(snapshot.scene.economyByActor[snapshot.activeCharacter.id]?.action,true);
});

test("connected Divine Spark converges HP and resource exactly once",async()=>{
  const sessionId="session.divine-spark";const host=await cleric();const hostState=connectedStateFor(host);hostState.mode="host";hostState.sessionId=sessionId;hostState.ledger=new HostSessionLedger(sessionId,connectedManifest(host));const wires:string[]=[];const send=tauriSessionTransport.send;tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
  try{await host.setQueuedD20(1);await host.resolveAction("action.cleric.divine-spark.radiant",["combatant.goblin-a"]);}finally{tauriSessionTransport.send=send;}
  const batch=wires.map((wire)=>JSON.parse(wire)).find((wire)=>wire.type==="event-batch") as {events:ConnectedSessionEvent[]}|undefined;assert.ok(batch);const client=await cleric();const state=connectedStateFor(client);state.mode="client";state.sessionId=sessionId;state.replica=new ClientSessionReplica(sessionId);const before=(await client.getSnapshot()).scene.entities.find((entry)=>entry.id==="combatant.goblin-a")!.hp;
  assert.equal((await applyConnectedClientEvents(client,batch.events)).status,"applied");assert.equal((await applyConnectedClientEvents(client,batch.events)).status,"duplicate");const snapshot=await client.getSnapshot();assert.ok(snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")!.hp<before);assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===CLERIC_CHANNEL_DIVINITY_RESOURCE_ID)?.current,2);
});
