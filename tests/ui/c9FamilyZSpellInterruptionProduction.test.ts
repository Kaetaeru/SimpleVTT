import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import { CharacterLibraryRepository } from "../../src/app/characterLibraryPersistence";
import { setCharacterLibraryStoreForTests } from "../../src/app/characterLibraryRuntimeAdapter";
import type { CharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { mountCharacterSessionProjection } from "../../src/app/characterSessionProjectionRegistry";
import type { AppSnapshot, CharacterSheet } from "../../src/app/contracts";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { HostSessionLedger } from "../../src/app/connectedSessionProtocol";
import { routeConnectedInterruptResponse } from "../../src/app/connectedInterruptResponsePort";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";
import { addTurnRuntimeCombatant } from "../../src/app/realTurnRuntimeService";
import { snapshotAdapterTurnRuntimeState, turnRuntimeSessions } from "../../src/app/turnRuntimeSessionRegistry";

const CASTER="char.interrupted-caster";
const REACTOR="char.renamed-reactor";
const MISSILE="dnd.srd521.spell.magic-missile";
const COUNTER="dnd.srd521.spell.counterspell";

function sheet(id=CASTER):CharacterSheet {
  return {
    id,name:id===CASTER?"Interrupted Caster":"Arbitrarily Renamed Reactor",className:"위저드",level:5,species:"인간",background:"학자",
    hp:30,maxHp:30,tempHp:0,ac:13,speed:30,proficiencyBonus:3,saveState:"saved",
    abilities:{str:8,dex:14,con:14,int:18,wis:12,cha:10},saves:["INT +7","WIS +4"],skills:["비전"],features:["주문 시전"],equipment:[],items:[],resources:[],attacks:[],
    classLevels:[{classId:"dnd.srd521.class.wizard",className:"위저드",level:5}],cantrips:[],preparedSpells:[MISSILE,COUNTER],spellSlotMaximums:{1:1,3:1},
  };
}

async function createAdapter() {
  const store=new MemoryCharacterLibraryStore(),repository=new CharacterLibraryRepository(store),caster=sheet();
  await repository.hydrate([caster],caster.id);await repository.commit([caster],caster.id);
  const adapter=new MockAdapter();setCharacterLibraryStoreForTests(adapter,store);await adapter.startProductionLocalPlay("player");await adapter.startInitiative();await adapter.setCurrentActor(CASTER);
  return adapter;
}

function runtime(adapter:MockAdapter,snapshot:AppSnapshot) {
  const state=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene);assert.ok(state);return state;
}

test("visible component casting opens structural Counterspell, preserves interrupted slot, and Undo restores both economies",async()=>{
  const adapter=await createAdapter();
  let snapshot=await adapter.getSnapshot();
  const internal=adapter as unknown as {scene:AppSnapshot["scene"];characters:AppSnapshot["characters"]};
  const counter=(snapshot.scene.actionsByActor[CASTER]??[]).find((action)=>action.spellCast?.spellId===COUNTER);
  const missile=(snapshot.scene.actionsByActor[CASTER]??[]).find((action)=>action.spellCast?.spellId===MISSILE);
  assert.ok(counter&&missile);
  const reactorSheet=sheet(REACTOR);
  internal.characters.push(reactorSheet);
  mountCharacterSessionProjection(adapter,{peerId:"peer.renamed-reactor",characterId:REACTOR,sourceRevision:0,runtimeRevision:0,projection:{characterId:REACTOR,sourceRevision:0,runtimeRevision:0} as CharacterSessionProjectionV1,sheet:reactorSheet});
  internal.scene.entities.push({id:REACTOR,name:reactorSheet.name,side:"enemy",kind:"character",hp:30,maxHp:30,tempHp:0,ac:13,initiative:10,status:[],distance:"30피트",resistances:[],immunities:[],vulnerabilities:[],reactions:[]});
  internal.scene.economyByActor[REACTOR]={action:true,bonusAction:true,reaction:true,movement:30,movementMax:30};
  internal.scene.actionsByActor[REACTOR]=[];
  const session=turnRuntimeSessions.get(adapter);assert.ok(session);assert.equal(addTurnRuntimeCombatant(session,internal.scene,REACTOR),true);
  session.state.combatants[REACTOR].resources.push({id:"spell-slot-3",label:"3레벨 주문 슬롯",current:1,maximum:1});
  snapshot=await adapter.getSnapshot();
  assert.ok(snapshot.scene.actionsByActor[REACTOR]?.some((entry)=>entry.spellCast?.spellId===COUNTER),JSON.stringify(snapshot.scene.actionsByActor[REACTOR]));
  assert.ok(snapshot.scene.spellcastingByActor?.[REACTOR]);
  const target=snapshot.scene.entities.find((entry)=>entry.side==="enemy"&&entry.id!==REACTOR);assert.ok(target);

  const sessionId="session.family-z-counter",peer="peer.renamed-reactor",connected=connectedStateFor(adapter),manifest=connectedManifest(adapter);
  connected.mode="host";connected.sessionId=sessionId;connected.ledger=new HostSessionLedger(sessionId,manifest);
  connected.peerManifests.set(peer,{...manifest,character:{characterId:REACTOR,sourceRevision:0,runtimeRevision:0}});
  const direct:Array<{peer:string;message:string}>=[],broadcasts:string[]=[];
  const send=tauriSessionTransport.send,sendTo=tauriSessionTransport.sendTo;
  tauriSessionTransport.send=async(message)=>{broadcasts.push(message);return 1;};
  tauriSessionTransport.sendTo=async(destination,message)=>{direct.push({peer:destination,message});return 1;};
  try{
    await adapter.setQueuedD20(1);
    snapshot=await adapter.resolveAction(missile.id,[target.id,target.id,target.id]);
    assert.equal(snapshot.resolution?.stage,"interrupt",JSON.stringify(snapshot.resolution));
    assert.equal(snapshot.resolution?.interrupt?.responderId,REACTOR);
    const resolutionId=snapshot.resolution!.id,promptId=snapshot.resolution!.interrupt!.id;
    assert.ok(direct.some((entry)=>entry.peer===peer&&JSON.parse(entry.message).type==="resolution-interrupt-prompt"),JSON.stringify(direct));
    assert.equal(runtime(adapter,snapshot).combatants[CASTER].resources.find((entry)=>entry.id==="spell-slot-1")?.current,1,"nothing commits before reaction response");
    assert.equal(await routeConnectedInterruptResponse(adapter,{peer,message:""},{sessionId,resolutionId,promptId,accept:true}),true);
    snapshot=await adapter.getSnapshot();
    assert.equal(snapshot.resolution?.stage,"complete");
    assert.equal(snapshot.resolution?.finalOutcome,"주문 차단됨");
    let state=runtime(adapter,snapshot);
    assert.equal(state.combatants[CASTER].resources.find((entry)=>entry.id==="spell-slot-1")?.current,1,"interrupted spell slot is preserved");
    assert.equal(state.combatants[CASTER].economy.action,false,"interrupted casting action is spent");
    assert.equal(state.combatants[REACTOR].resources.find((entry)=>entry.id==="spell-slot-3")?.current,0);
    assert.equal(state.combatants[REACTOR].economy.reaction,false);
    assert.ok(broadcasts.some((wire)=>JSON.parse(wire).type==="event-batch"),JSON.stringify(broadcasts));

    const revision=state.revision;
    assert.equal(await routeConnectedInterruptResponse(adapter,{peer,message:""},{sessionId,resolutionId,promptId,accept:true}),true);
    assert.equal(runtime(adapter,await adapter.getSnapshot()).revision,revision,"duplicate remote response must not recommit");

    snapshot=await adapter.undoLastResolution();
    state=runtime(adapter,snapshot);
    assert.equal(state.combatants[CASTER].resources.find((entry)=>entry.id==="spell-slot-1")?.current,1);
    assert.equal(state.combatants[CASTER].economy.action,true);
    assert.equal(state.combatants[REACTOR].resources.find((entry)=>entry.id==="spell-slot-3")?.current,1);
    assert.equal(state.combatants[REACTOR].economy.reaction,true);
  }finally{tauriSessionTransport.send=send;tauriSessionTransport.sendTo=sendTo;}
});
