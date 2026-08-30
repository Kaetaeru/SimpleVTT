import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { CharacterLibraryRepository } from "../../src/app/characterLibraryPersistence";
import { setCharacterLibraryStoreForTests } from "../../src/app/characterLibraryRuntimeAdapter";
import type { CharacterSheet } from "../../src/app/contracts";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";
import { snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";
import { activeCastingProcess } from "../../src/domain/commonPlayCastingProcessRuntime";

const CHARACTER_ID="char.family-z-connected";
const SPELL_ID="dnd.srd521.spell.alarm";
const SESSION_ID="session.c9-family-z-spellcasting";

function sheet():CharacterSheet {
  return {
    id:CHARACTER_ID,name:"Family Z Connected",className:"위저드",level:1,species:"인간",background:"학자",
    hp:8,maxHp:8,tempHp:0,ac:12,speed:30,proficiencyBonus:2,saveState:"saved",
    abilities:{str:8,dex:14,con:14,int:16,wis:10,cha:10},saves:["INT +5"],skills:["비전"],features:["주문 시전","의식 시전자"],equipment:[],resources:[],attacks:[],
    classLevels:[{classId:"dnd.srd521.class.wizard",className:"위저드",level:1}],cantrips:[],preparedSpells:[SPELL_ID],spellbookSpells:[SPELL_ID],spellSlotMaximums:{1:1},
    items:[{id:"connected-pouch",definitionId:"external.renamed.pouch",name:"Renamed Pouch",kind:"equipment",quantity:1,equipped:true,spellcastingComponent:"component-pouch",passiveEffects:[],grantedActionIds:[],provenance:["external fixture"]}],
  };
}

async function store() {
  const store=new MemoryCharacterLibraryStore(),repository=new CharacterLibraryRepository(store),character=sheet();
  await repository.hydrate([character],character.id);await repository.commit([character],character.id);
  return store;
}

async function adapter(characterStore:MemoryCharacterLibraryStore) {
  const adapter=new MockAdapter();setCharacterLibraryStoreForTests(adapter,characterStore);await adapter.startProductionLocalPlay("player");
  return adapter;
}

function connectClient(adapter:MockAdapter) {
  const state=connectedStateFor(adapter);state.mode="client";state.sessionId=SESSION_ID;state.replica=new ClientSessionReplica(SESSION_ID);
}

function process(adapter:MockAdapter,snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  const runtime=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene);
  return runtime?activeCastingProcess(runtime,CHARACTER_ID,SPELL_ID):undefined;
}

async function capture(operation:()=>Promise<unknown>) {
  const wires:string[]=[];const send=tauriSessionTransport.send;tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
  try { await operation(); } finally { tauriSessionTransport.send=send; }
  const batch=wires.map((wire)=>JSON.parse(wire) as {type:string;events?:ConnectedSessionEvent[]}).filter((wire)=>wire.type==="event-batch").at(-1);
  assert.ok(batch?.events,JSON.stringify(wires));return batch.events;
}

test("maintained spell casting converges through connected replay, Undo, and fresh reconnect",async()=>{
  const hostStore=await store(),clientStore=await store();
  const host=await adapter(hostStore),hostState=connectedStateFor(host);
  hostState.mode="host";hostState.sessionId=SESSION_ID;hostState.ledger=new HostSessionLedger(SESSION_ID,connectedManifest(host));
  const client=await adapter(clientStore);connectClient(client);
  const action=(await host.getSnapshot()).scene.actionsByActor[CHARACTER_ID]?.find((entry)=>entry.spellCast?.spellId===SPELL_ID&&entry.spellCast.castSource!=="ritual");
  assert.ok(action);

  const applyEvents=await capture(()=>host.resolveAction(action.id,[]));
  assert.equal((await applyConnectedClientEvents(client,applyEvents)).status,"applied");
  assert.equal(process(host,await host.getSnapshot())?.activity.status,"active");
  assert.equal(process(client,await client.getSnapshot())?.activity.status,"active");
  assert.equal((await applyConnectedClientEvents(client,applyEvents)).status,"duplicate");

  const undoEvents=await capture(()=>host.undoLastResolution());
  assert.equal((await applyConnectedClientEvents(client,undoEvents)).status,"applied");
  assert.equal(process(host,await host.getSnapshot()),undefined);
  assert.equal(process(client,await client.getSnapshot()),undefined);

  const reconnect=await adapter(await store());connectClient(reconnect);
  assert.equal((await applyConnectedClientEvents(reconnect,hostState.ledger!.eventsAfter(0))).status,"applied");
  assert.equal(process(reconnect,await reconnect.getSnapshot()),undefined);
});
