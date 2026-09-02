import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import "../../src/app/productionSessionLifecycleAdapter";
import { buildCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { materializeCreatedWeaponAttacks } from "../../src/app/characterCreationWeaponAttackAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { CONNECTED_CAPABILITIES, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { encodeConnectedWireMessage, type ConnectedWireMessage } from "../../src/app/connectedSessionWire";
import { tauriSessionTransport, type SessionTransportMessage, type SessionTransportStatus } from "../../src/app/tauriSessionTransport";

const HOST_STATUS:SessionTransportStatus={role:"host",state:"connected",address:"127.0.0.1:3210",peerCount:0};
const STOPPED_STATUS:SessionTransportStatus={role:null,state:"disconnected",address:"",peerCount:0};

async function eventually(predicate:()=>boolean|Promise<boolean>,message:string){
  for(let attempt=0;attempt<100;attempt+=1){
    if(await predicate())return;
    await new Promise<void>((resolve)=>setImmediate(resolve));
  }
  assert.fail(message);
}

function installHostTransport(){
  const original={available:tauriSessionTransport.available,startHost:tauriSessionTransport.startHost,send:tauriSessionTransport.send,sendTo:tauriSessionTransport.sendTo,stop:tauriSessionTransport.stop,onMessage:tauriSessionTransport.onMessage,onState:tauriSessionTransport.onState,onPeerLifecycle:tauriSessionTransport.onPeerLifecycle};
  let listener:((message:SessionTransportMessage)=>void)|undefined;
  const broadcasts:string[]=[];
  const directed:Array<{peer:string;message:string}>=[];
  tauriSessionTransport.available=()=>true;
  tauriSessionTransport.startHost=async()=>structuredClone(HOST_STATUS);
  tauriSessionTransport.send=async(message)=>{broadcasts.push(message);return 1;};
  tauriSessionTransport.sendTo=async(peer,message)=>{directed.push({peer,message});return 1;};
  tauriSessionTransport.stop=async()=>structuredClone(STOPPED_STATUS);
  tauriSessionTransport.onMessage=async(handler)=>{listener=handler;return()=>{};};
  tauriSessionTransport.onState=async()=>()=>{};
  tauriSessionTransport.onPeerLifecycle=async()=>()=>{};
  return {
    broadcasts:()=>broadcasts.map((entry)=>JSON.parse(entry) as ConnectedWireMessage),
    directed:()=>directed.map((entry)=>({peer:entry.peer,message:JSON.parse(entry.message) as ConnectedWireMessage})),
    emitFrom(peer:string,message:ConnectedWireMessage){assert.ok(listener);listener({peer,message:encodeConnectedWireMessage(message)});},
    restore(){tauriSessionTransport.available=original.available;tauriSessionTransport.startHost=original.startHost;tauriSessionTransport.send=original.send;tauriSessionTransport.sendTo=original.sendTo;tauriSessionTransport.stop=original.stop;tauriSessionTransport.onMessage=original.onMessage;tauriSessionTransport.onState=original.onState;tauriSessionTransport.onPeerLifecycle=original.onPeerLifecycle;},
  };
}

test("MP-C20 core · a disabled remote action returns its explicit production reason without roll, presentation, commit, or debit",async()=>{
  const transport=installHostTransport();
  const host=new MockAdapter();
  let stopped=false;
  try{
    await host.hostSession();
    const state=connectedStateFor(host);
    assert.ok(state.ledger&&state.sessionId);
    const snapshot=await host.getSnapshot();
    const fighter=snapshot.catalog.find((entry)=>entry.category==="class"&&/fighter/i.test(`${entry.id} ${entry.nameEn}`));
    const human=snapshot.catalog.find((entry)=>entry.category==="species"&&/human/i.test(`${entry.id} ${entry.nameEn}`));
    const soldier=snapshot.catalog.find((entry)=>entry.category==="background"&&/soldier/i.test(`${entry.id} ${entry.nameEn}`));
    assert.ok(fighter?.contentId&&human?.contentId&&soldier?.contentId);
    const sheet=structuredClone(snapshot.activeCharacter);
    sheet.id="char.mp-c20.p1";
    sheet.name="MP-C20 P1";
    sheet.className=fighter.nameKo;
    sheet.species=human.nameKo;
    sheet.background=soldier.nameKo;
    sheet.classLevels=[{classId:fighter.contentId,level:sheet.level}];
    sheet.cantrips=[];sheet.preparedSpells=[];sheet.spellbookSpells=[];sheet.masteryWeapons=[];
    sheet.sourceRevision=720;sheet.runtimeRevision=720;
    sheet.items=sheet.items.filter((item)=>item.definitionId==="dnd.srd521.item.weapon.longsword");
    sheet.equipment=sheet.items.map((item)=>item.name);
    sheet.attacks=materializeCreatedWeaponAttacks(sheet);
    const projection=buildCharacterSessionProjectionV1(sheet,snapshot.catalog);
    const manifest=connectedManifest(host);
    manifest.character={characterId:sheet.id,sourceRevision:720,runtimeRevision:720};
    transport.emitFrom("peer.mp-c20",{type:"hello",manifest,participantId:"client:char.mp-c20.p1",participantName:"MP-C20 P1",knownEventCursor:0,projection});
    await eventually(()=>connectedStateFor(host).peerManifests.has("peer.mp-c20"),"P1 must complete the connected projection handshake");

    await host.setSessionMode("initiative");
    await host.setCurrentActor("combatant.goblin-a");
    const disabledSnapshot=await host.getSnapshot();
    const disabled=disabledSnapshot.scene.actionsByActor[sheet.id]?.find((action)=>action.resolutionKind==="attack"&&!action.available&&action.disabledReason);
    assert.ok(disabled?.disabledReason,"fixture requires a production-disabled projected attack with an explicit reason");
    const reason=disabled.disabledReason;
    const cursorBefore=state.ledger.cursor;
    const broadcastBefore=transport.broadcasts().length;
    const resourceBefore=structuredClone(disabledSnapshot.activeCharacter.resources);
    const itemBefore=structuredClone(disabledSnapshot.activeCharacter.items);

    transport.emitFrom("peer.mp-c20",{type:"action-request",request:{sessionId:state.sessionId,requestId:"mp-c20.disabled",actorId:sheet.id,actionId:disabled.id,targetIds:["combatant.goblin-a"],knownEventCursor:state.ledger.cursor,character:manifest.character!,capabilities:[...CONNECTED_CAPABILITIES]}});
    await eventually(()=>transport.directed().some((entry)=>entry.peer==="peer.mp-c20"&&entry.message.type==="error"),"disabled action must terminate with an explicit error");
    const error=transport.directed().findLast((entry)=>entry.peer==="peer.mp-c20"&&entry.message.type==="error")?.message;
    assert.equal(error?.type,"error");
    if(error?.type!=="error")throw new Error("missing disabled-action error");
    assert.equal(error.code,"action-disabled");
    assert.equal(error.message,reason);
    assert.equal(state.ledger.cursor,cursorBefore,"disabled action must not commit an event");
    assert.equal(transport.broadcasts().length,broadcastBefore,"disabled action must not publish a roll or cinematic");
    assert.equal(state.pendingRemoteAction,null,"disabled action must not leave a pending resolution");
    const after=await host.getSnapshot();
    assert.equal(after.resolution,null,"disabled action must not start mechanics");
    assert.deepEqual(after.activeCharacter.resources,resourceBefore,"disabled action must not debit resources");
    assert.deepEqual(after.activeCharacter.items,itemBefore,"disabled action must not debit items");
    await host.stopSession();stopped=true;
  }finally{
    if(!stopped)await host.stopSession().catch(()=>undefined);
    transport.restore();
  }
});
