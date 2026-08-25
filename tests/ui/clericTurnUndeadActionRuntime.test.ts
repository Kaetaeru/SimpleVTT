import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedActionRoutingAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { CharacterSheet, CombatantDefinitionVm, SceneVm } from "../../src/app/contracts";
import { CLERIC_CHANNEL_DIVINITY_RESOURCE_ID, CLERIC_ID } from "../../src/domain/coreClassResources";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

async function cleric(){
  const adapter=new MockAdapter();const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:SceneVm;combatantDefinitions:CombatantDefinitionVm[]};
  internal.activeCharacter={...internal.activeCharacter,className:"클레릭",level:5,classLevels:[{classId:CLERIC_ID,className:"클레릭",level:5}],abilities:{...internal.activeCharacter.abilities,wis:18},resources:[]};
  internal.combatantDefinitions.push({id:"combatant.skeleton",name:"해골",ac:13,maxHp:20,source:"test",version:"1",actions:[],statusImmunities:[],runtimeStats:{creatureType:"undead",abilities:{str:10,dex:14,con:15,int:6,wis:8,cha:5},proficiencyBonus:2,savingThrowProficiencies:[],speed:30,resistances:[],immunities:[],vulnerabilities:[]}});
  internal.scene.entities.push({id:"combatant.skeleton.instance-1",name:"해골",side:"enemy",kind:"combatant",hp:20,maxHp:20,tempHp:0,ac:13,initiative:9,status:[],resistances:[],immunities:[],vulnerabilities:[],reactions:[]});
  internal.scene.actionsByActor["combatant.skeleton.instance-1"]=[];internal.scene.economyByActor["combatant.skeleton.instance-1"]={action:true,bonusAction:true,reaction:true,movement:30,movementMax:30};
  await adapter.getSnapshot();await adapter.startInitiative();await adapter.setCurrentActor(internal.activeCharacter.id);await adapter.selectDmActor(internal.activeCharacter.id);return adapter;
}

test("Turn Undead selects only typed Undead, applies public conditions, spends once, and Undo restores",async()=>{
  const adapter=await cleric();let snapshot=await adapter.getSnapshot();const action=snapshot.scene.actionsByActor[snapshot.activeCharacter.id]?.find((entry)=>entry.id==="action.cleric.turn-undead");assert.deepEqual(action?.eligibleTargetIds,["combatant.skeleton.instance-1"]);
  await adapter.setQueuedD20(1);await adapter.resolveAction("action.cleric.turn-undead",["combatant.skeleton.instance-1"]);snapshot=await adapter.getSnapshot();const skeleton=snapshot.scene.entities.find((entry)=>entry.id==="combatant.skeleton.instance-1")!;
  assert.ok(skeleton.status.some((status)=>status.includes("공포 · 언데드 퇴치")));assert.ok(skeleton.status.some((status)=>status.includes("행동불능 · 언데드 퇴치")));assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===CLERIC_CHANNEL_DIVINITY_RESOURCE_ID)?.current,1);assert.equal(snapshot.scene.economyByActor[snapshot.activeCharacter.id]?.action,false);
  await adapter.undoLastResolution();snapshot=await adapter.getSnapshot();assert.equal(snapshot.scene.entities.find((entry)=>entry.id==="combatant.skeleton.instance-1")!.status.some((status)=>status.includes("언데드 퇴치")),false);assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===CLERIC_CHANNEL_DIVINITY_RESOURCE_ID)?.current,2);
});

test("Turn Undead rejects an untyped non-Undead without spending",async()=>{
  const adapter=await cleric();const before=(await adapter.getSnapshot()).activeCharacter.resources.find((entry)=>entry.id===CLERIC_CHANNEL_DIVINITY_RESOURCE_ID)?.current;await adapter.resolveAction("action.cleric.turn-undead",["combatant.goblin-a"]);const snapshot=await adapter.getSnapshot();assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===CLERIC_CHANNEL_DIVINITY_RESOURCE_ID)?.current,before);assert.equal(snapshot.scene.economyByActor[snapshot.activeCharacter.id]?.action,true);
});

test("connected Turn Undead converges public conditions and resource exactly once",async()=>{
  const sessionId="session.turn-undead";const host=await cleric();const hostState=connectedStateFor(host);hostState.mode="host";hostState.sessionId=sessionId;hostState.ledger=new HostSessionLedger(sessionId,connectedManifest(host));const wires:string[]=[];const send=tauriSessionTransport.send;tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
  try{await host.setQueuedD20(1);await host.resolveAction("action.cleric.turn-undead",["combatant.skeleton.instance-1"]);}finally{tauriSessionTransport.send=send;}
  const batch=wires.map((wire)=>JSON.parse(wire)).find((wire)=>wire.type==="event-batch") as {events:ConnectedSessionEvent[]}|undefined;assert.ok(batch);const client=await cleric();const state=connectedStateFor(client);state.mode="client";state.sessionId=sessionId;state.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(client,batch.events)).status,"applied");assert.equal((await applyConnectedClientEvents(client,batch.events)).status,"duplicate");const snapshot=await client.getSnapshot();const status=snapshot.scene.entities.find((entry)=>entry.id==="combatant.skeleton.instance-1")!.status;assert.ok(status.some((entry)=>entry.includes("공포 · 언데드 퇴치")));assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===CLERIC_CHANNEL_DIVINITY_RESOURCE_ID)?.current,1);
});
