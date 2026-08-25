import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedActionRoutingAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { CharacterSheet, CombatantDefinitionVm, SceneVm } from "../../src/app/contracts";
import { PALADIN_CHANNEL_DIVINITY_RESOURCE_ID, PALADIN_ID } from "../../src/domain/coreClassResources";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

async function paladin(){
  const adapter=new MockAdapter();const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:SceneVm;combatantDefinitions:CombatantDefinitionVm[]};
  internal.activeCharacter={...internal.activeCharacter,className:"팔라딘",level:9,classLevels:[{classId:PALADIN_ID,className:"팔라딘",level:9}],resources:[]};
  internal.combatantDefinitions.push({id:"combatant.skeleton",name:"해골",ac:13,maxHp:20,source:"test",version:"1",actions:[],statusImmunities:[],runtimeStats:{creatureType:"undead",abilities:{str:10,dex:14,con:15,int:6,wis:8,cha:5},proficiencyBonus:2,savingThrowProficiencies:[],speed:30,resistances:[],immunities:[],vulnerabilities:[]}});
  internal.scene.entities.push({id:"combatant.skeleton.instance-1",name:"해골",side:"enemy",kind:"combatant",hp:20,maxHp:20,tempHp:0,ac:13,initiative:9,status:[],resistances:[],immunities:[],vulnerabilities:[],reactions:[]});internal.scene.actionsByActor["combatant.skeleton.instance-1"]=[];internal.scene.economyByActor["combatant.skeleton.instance-1"]={action:true,bonusAction:true,reaction:true,movement:30,movementMax:30};
  await adapter.getSnapshot();await adapter.startInitiative();await adapter.setCurrentActor(internal.activeCharacter.id);await adapter.selectDmActor(internal.activeCharacter.id);return adapter;
}

test("Divine Sense detects typed Undead, spends Channel Divinity and Bonus Action, and Undo restores",async()=>{
  const adapter=await paladin();let snapshot=await adapter.getSnapshot();const action=snapshot.scene.actionsByActor[snapshot.activeCharacter.id]?.find((entry)=>entry.id==="action.paladin.divine-sense");assert.equal(action?.summary,"60피트 내 천상체·악마·언데드 감지 · 2/2");
  await adapter.resolveAction("action.paladin.divine-sense",[snapshot.activeCharacter.id]);snapshot=await adapter.getSnapshot();assert.match(snapshot.resolution?.detail.join(" ")??"",/해골 \(undead\)/);assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===PALADIN_CHANNEL_DIVINITY_RESOURCE_ID)?.current,1);assert.equal(snapshot.scene.economyByActor[snapshot.activeCharacter.id]?.bonusAction,false);
  await adapter.undoLastResolution();snapshot=await adapter.getSnapshot();assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===PALADIN_CHANNEL_DIVINITY_RESOURCE_ID)?.current,2);assert.equal(snapshot.scene.economyByActor[snapshot.activeCharacter.id]?.bonusAction,true);
});

test("freeform Divine Sense does not strand Bonus Action",async()=>{const adapter=await paladin();await adapter.setSessionMode("freeform");const snapshot=await adapter.getSnapshot();await adapter.resolveAction("action.paladin.divine-sense",[snapshot.activeCharacter.id]);assert.equal((await adapter.getSnapshot()).scene.economyByActor[snapshot.activeCharacter.id]?.bonusAction,true);});

test("connected Divine Sense converges resource exactly once",async()=>{
  const sessionId="session.divine-sense";const host=await paladin();const actorId=(await host.getSnapshot()).activeCharacter.id;const hostState=connectedStateFor(host);hostState.mode="host";hostState.sessionId=sessionId;hostState.ledger=new HostSessionLedger(sessionId,connectedManifest(host));const wires:string[]=[];const send=tauriSessionTransport.send;tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};try{await host.resolveAction("action.paladin.divine-sense",[actorId]);}finally{tauriSessionTransport.send=send;}
  const batch=wires.map((wire)=>JSON.parse(wire)).find((wire)=>wire.type==="event-batch") as {events:ConnectedSessionEvent[]}|undefined;assert.ok(batch);const client=await paladin();const state=connectedStateFor(client);state.mode="client";state.sessionId=sessionId;state.replica=new ClientSessionReplica(sessionId);assert.equal((await applyConnectedClientEvents(client,batch.events)).status,"applied");assert.equal((await applyConnectedClientEvents(client,batch.events)).status,"duplicate");assert.equal((await client.getSnapshot()).activeCharacter.resources.find((entry)=>entry.id===PALADIN_CHANNEL_DIVINITY_RESOURCE_ID)?.current,1);
});
