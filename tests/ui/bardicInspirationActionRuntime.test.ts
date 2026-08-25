import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedActionRoutingAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { CharacterSheet, SceneVm } from "../../src/app/contracts";
import { BARDIC_INSPIRATION_RESOURCE_ID, BARD_ID } from "../../src/domain/bardicInspiration";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

async function bard() {
  const adapter=new MockAdapter();
  const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:SceneVm};
  internal.activeCharacter={...internal.activeCharacter,className:"바드",level:5,classLevels:[{classId:BARD_ID,className:"바드",level:5}],abilities:{...internal.activeCharacter.abilities,cha:18},resources:[]};
  await adapter.getSnapshot();
  internal.scene.entities.push({id:"combatant.ally",name:"동료",side:"ally",kind:"combatant",hp:20,maxHp:20,tempHp:0,ac:14,initiative:10,status:[],resistances:[],immunities:[],vulnerabilities:[],reactions:[]});
  internal.scene.actionsByActor["combatant.ally"]=[];
  internal.scene.economyByActor["combatant.ally"]={action:true,bonusAction:true,reaction:true,movement:30,movementMax:30};
  await adapter.startInitiative();await adapter.setCurrentActor(internal.activeCharacter.id);await adapter.selectDmActor(internal.activeCharacter.id);
  return adapter;
}

test("Bardic Inspiration spends one use and Bonus Action, publishes the die, and Undo restores all",async()=>{
  const adapter=await bard();
  let snapshot=await adapter.getSnapshot();
  const action=snapshot.scene.actionsByActor[snapshot.activeCharacter.id]?.find((entry)=>entry.id==="action.bard.bardic-inspiration");
  assert.equal(action?.summary,"d8 지급 · 4/4");
  assert.ok(action?.eligibleTargetIds.includes("combatant.ally"));

  await adapter.resolveAction("action.bard.bardic-inspiration",["combatant.ally"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===BARDIC_INSPIRATION_RESOURCE_ID)?.current,3);
  assert.equal(snapshot.scene.economyByActor[snapshot.activeCharacter.id]?.bonusAction,false);
  assert.ok(snapshot.scene.entities.find((entry)=>entry.id==="combatant.ally")?.status.includes("✦ 바드의 영감 · d8"));

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===BARDIC_INSPIRATION_RESOURCE_ID)?.current,4);
  assert.equal(snapshot.scene.economyByActor[snapshot.activeCharacter.id]?.bonusAction,true);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id==="combatant.ally")?.status.includes("✦ 바드의 영감 · d8"),false);
});

test("connected Bardic Inspiration converges resource, economy, and public marker exactly once",async()=>{
  const sessionId="session.bardic-inspiration";
  const host=await bard();
  const hostState=connectedStateFor(host);hostState.mode="host";hostState.sessionId=sessionId;hostState.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  const wires:string[]=[];const send=tauriSessionTransport.send;tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
  try{await host.resolveAction("action.bard.bardic-inspiration",["combatant.ally"]);}finally{tauriSessionTransport.send=send;}
  const batch=wires.map((wire)=>JSON.parse(wire)).find((wire)=>wire.type==="event-batch") as {events:ConnectedSessionEvent[]}|undefined;assert.ok(batch);
  const client=await bard();const clientState=connectedStateFor(client);clientState.mode="client";clientState.sessionId=sessionId;clientState.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(client,batch.events)).status,"applied");assert.equal((await applyConnectedClientEvents(client,batch.events)).status,"duplicate");
  const snapshot=await client.getSnapshot();
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===BARDIC_INSPIRATION_RESOURCE_ID)?.current,3);
  assert.equal(snapshot.scene.economyByActor[snapshot.activeCharacter.id]?.bonusAction,false);
  assert.ok(snapshot.scene.entities.find((entry)=>entry.id==="combatant.ally")?.status.includes("✦ 바드의 영감 · d8"));
});
