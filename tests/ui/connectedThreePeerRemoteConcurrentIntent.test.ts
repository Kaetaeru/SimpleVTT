import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import "../../src/app/productionSessionLifecycleAdapter";
import { buildCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { materializeCreatedWeaponAttacks } from "../../src/app/characterCreationWeaponAttackAdapter";
import { projectedCharacterById } from "../../src/app/characterSessionProjectionRegistry";
import { MockAdapter } from "../../src/app/mockAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { CONNECTED_CAPABILITIES, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { encodeConnectedWireMessage, type ConnectedWireMessage } from "../../src/app/connectedSessionWire";
import {
  tauriSessionTransport,
  type SessionTransportMessage,
  type SessionTransportStatus,
} from "../../src/app/tauriSessionTransport";

const HOST_STATUS:SessionTransportStatus={role:"host",state:"connected",address:"127.0.0.1:3210",peerCount:0};
const STOPPED_STATUS:SessionTransportStatus={role:null,state:"disconnected",address:"",peerCount:0};

type PlayerFixture={
  characterId:string;
  sourceRevision:number;
  runtimeRevision:number;
  projection:ReturnType<typeof buildCharacterSessionProjectionV1>;
};

function installThreePeerHostTransport(){
  const original={
    available:tauriSessionTransport.available,
    startHost:tauriSessionTransport.startHost,
    send:tauriSessionTransport.send,
    sendTo:tauriSessionTransport.sendTo,
    stop:tauriSessionTransport.stop,
    onMessage:tauriSessionTransport.onMessage,
    onState:tauriSessionTransport.onState,
    onPeerLifecycle:tauriSessionTransport.onPeerLifecycle,
  };
  let listener:((message:SessionTransportMessage)=>void)|undefined;
  const broadcasts:string[]=[];
  const directed:Array<{peer:string;message:string}>=[];
  tauriSessionTransport.available=()=>true;
  tauriSessionTransport.startHost=async()=>structuredClone(HOST_STATUS);
  tauriSessionTransport.send=async(message)=>{broadcasts.push(message);return 2;};
  tauriSessionTransport.sendTo=async(peer,message)=>{directed.push({peer,message});return 1;};
  tauriSessionTransport.stop=async()=>structuredClone(STOPPED_STATUS);
  tauriSessionTransport.onMessage=async(handler)=>{listener=handler;return()=>{};};
  tauriSessionTransport.onState=async()=>()=>{};
  tauriSessionTransport.onPeerLifecycle=async()=>()=>{};
  return {
    broadcastCount:()=>broadcasts.length,
    broadcastsAfter:(index:number)=>broadcasts.slice(index).map((entry)=>JSON.parse(entry) as ConnectedWireMessage),
    directed:()=>directed.map((entry)=>({peer:entry.peer,message:JSON.parse(entry.message) as ConnectedWireMessage})),
    emitFrom(peer:string,message:ConnectedWireMessage){
      assert.ok(listener,"Host connected listener must be registered before a peer message is emitted");
      listener({peer,message:encodeConnectedWireMessage(message)});
    },
    restore(){
      tauriSessionTransport.available=original.available;
      tauriSessionTransport.startHost=original.startHost;
      tauriSessionTransport.send=original.send;
      tauriSessionTransport.sendTo=original.sendTo;
      tauriSessionTransport.stop=original.stop;
      tauriSessionTransport.onMessage=original.onMessage;
      tauriSessionTransport.onState=original.onState;
      tauriSessionTransport.onPeerLifecycle=original.onPeerLifecycle;
    },
  };
}

async function eventually(predicate:()=>boolean|Promise<boolean>,message:string){
  for(let attempt=0;attempt<100;attempt+=1){
    if(await predicate())return;
    await new Promise<void>((resolve)=>setImmediate(resolve));
  }
  assert.fail(message);
}

async function createPlayerFixture(host:MockAdapter,characterId:string,name:string,revision:number):Promise<PlayerFixture>{
  const snapshot=await host.getSnapshot();
  const fighter=snapshot.catalog.find((entry)=>entry.category==="class"&&/fighter/i.test(`${entry.id} ${entry.nameEn}`));
  const human=snapshot.catalog.find((entry)=>entry.category==="species"&&/human/i.test(`${entry.id} ${entry.nameEn}`));
  const soldier=snapshot.catalog.find((entry)=>entry.category==="background"&&/soldier/i.test(`${entry.id} ${entry.nameEn}`));
  assert.ok(fighter?.contentId&&human?.contentId&&soldier?.contentId,"concurrent fixture requires canonical Fighter/Human/Soldier identities");
  const sheet=structuredClone(snapshot.activeCharacter);
  sheet.id=characterId;
  sheet.name=name;
  sheet.className=fighter.nameKo;
  sheet.subclassName=undefined;
  sheet.species=human.nameKo;
  sheet.background=soldier.nameKo;
  sheet.classLevels=[{classId:fighter.contentId,level:sheet.level}];
  sheet.cantrips=[];
  sheet.preparedSpells=[];
  sheet.spellbookSpells=[];
  sheet.masteryWeapons=[];
  sheet.sourceRevision=revision;
  sheet.runtimeRevision=revision;
  sheet.items=sheet.items.filter((item)=>item.definitionId==="dnd.srd521.item.weapon.longsword");
  assert.equal(sheet.items.length,1,"concurrent fixture requires the canonical longsword item");
  sheet.equipment=sheet.items.map((item)=>item.name);
  sheet.attacks=materializeCreatedWeaponAttacks(sheet);
  return {characterId,sourceRevision:revision,runtimeRevision:revision,projection:buildCharacterSessionProjectionV1(sheet,snapshot.catalog)};
}

async function connectPlayer(
  host:MockAdapter,
  transport:ReturnType<typeof installThreePeerHostTransport>,
  peer:string,
  name:string,
  fixture:PlayerFixture,
){
  const manifest=connectedManifest(host);
  manifest.character={characterId:fixture.characterId,sourceRevision:fixture.sourceRevision,runtimeRevision:fixture.runtimeRevision};
  transport.emitFrom(peer,{
    type:"hello",
    manifest,
    participantId:`client:${fixture.characterId}`,
    participantName:name,
    knownEventCursor:0,
    projection:fixture.projection,
  });
  await eventually(
    ()=>connectedStateFor(host).peerManifests.get(peer)?.character?.characterId===fixture.characterId,
    `${name} hello must mount an accepted Host SessionProjection`,
  );
  assert.equal(projectedCharacterById(host,fixture.characterId)?.peerId,peer);
  return manifest.character;
}

async function finishResolution(host:MockAdapter,actorId:string){
  await eventually(async()=>{
    const resolution=(await host.getSnapshot()).resolution;
    return resolution?.actorId===actorId;
  },`Host did not start the requested resolution for ${actorId}`);
  for(let step=0;step<12;step+=1){
    const snapshot=await host.getSnapshot();
    if(snapshot.resolution?.stage==="complete")return snapshot;
    assert.ok(snapshot.resolution?.canAdvance,`resolution ${snapshot.resolution?.id??"<missing>"} stopped before complete`);
    await host.advanceResolution();
  }
  assert.fail(`resolution for ${actorId} did not complete within 12 presentation advances`);
}

function terminalResolution(messages:ConnectedWireMessage[]){
  const batches=messages.filter((message):message is Extract<ConnectedWireMessage,{type:"event-batch"}>=>message.type==="event-batch");
  assert.equal(batches.length,1,"each accepted concurrent action must commit exactly one event batch");
  const terminal=batches[0].events.find((event)=>event.payload.kind==="resolution");
  assert.ok(terminal,"accepted concurrent action must produce one terminal resolution event");
  return terminal;
}

test("MP-C22 core · concurrent P1/P2 intents keep the first pending action canonical, then permit P2 as the next ordered commit",async()=>{
  const transport=installThreePeerHostTransport();
  const host=new MockAdapter();
  let stopped=false;
  try{
    await host.hostSession();
    const state=connectedStateFor(host);
    assert.ok(state.ledger&&state.sessionId,"Host session must establish one authoritative ledger");

    const p1=await createPlayerFixture(host,"char.mp-c.concurrent-p1","MP-C Concurrent P1",1201);
    const p2=await createPlayerFixture(host,"char.mp-c.concurrent-p2","MP-C Concurrent P2",1202);
    const p1Character=await connectPlayer(host,transport,"peer.mp-c.concurrent-p1","MP-C Concurrent P1",p1);
    const p2Character=await connectPlayer(host,transport,"peer.mp-c.concurrent-p2","MP-C Concurrent P2",p2);
    assert.equal(state.peerParticipants.size,2,"Host must retain P1 and P2 for concurrent ordering verification");

    const before=await host.getSnapshot();
    const p1Attack=before.scene.actionsByActor[p1.characterId]?.find((action)=>action.resolutionKind==="attack"&&(action.name.includes("롱소드")||action.name.toLowerCase().includes("longsword")));
    const p2Attack=before.scene.actionsByActor[p2.characterId]?.find((action)=>action.resolutionKind==="attack"&&(action.name.includes("롱소드")||action.name.toLowerCase().includes("longsword")));
    assert.ok(p1Attack&&p2Attack,"both projected Fighters must expose canonical longsword attacks");
    const p1TargetId="combatant.goblin-a";
    const p2TargetId="combatant.goblin-b";
    const p1TargetBefore=before.scene.entities.find((entity)=>entity.id===p1TargetId);
    const p2TargetBefore=before.scene.entities.find((entity)=>entity.id===p2TargetId);
    assert.ok(p1TargetBefore&&p2TargetBefore,"concurrent fixture requires both goblin targets");
    const p1DurabilityBefore=p1TargetBefore.hp+p1TargetBefore.tempHp;
    const p2DurabilityBefore=p2TargetBefore.hp+p2TargetBefore.tempHp;

    await host.setQueuedD20(19);
    const firstBroadcastStart=transport.broadcastCount();
    transport.emitFrom("peer.mp-c.concurrent-p1",{
      type:"action-request",
      request:{
        sessionId:state.sessionId,
        requestId:"mp-c22.p1-first",
        actorId:p1.characterId,
        actionId:p1Attack.id,
        targetIds:[p1TargetId],
        knownEventCursor:state.ledger.cursor,
        character:p1Character!,
        capabilities:[...CONNECTED_CAPABILITIES],
      },
    });
    await eventually(
      ()=>state.pendingRemoteAction?.request.requestId==="mp-c22.p1-first",
      "P1 must become the one canonical pending remote action before P2 races it",
    );

    const cursorBeforeBusy=state.ledger.cursor;
    const broadcastBeforeBusy=transport.broadcastCount();
    const directedBeforeBusy=transport.directed().length;
    transport.emitFrom("peer.mp-c.concurrent-p2",{
      type:"action-request",
      request:{
        sessionId:state.sessionId,
        requestId:"mp-c22.p2-concurrent",
        actorId:p2.characterId,
        actionId:p2Attack.id,
        targetIds:[p2TargetId],
        knownEventCursor:state.ledger.cursor,
        character:p2Character!,
        capabilities:[...CONNECTED_CAPABILITIES],
      },
    });
    await eventually(
      ()=>transport.directed().slice(directedBeforeBusy).some((entry)=>entry.peer==="peer.mp-c.concurrent-p2"&&entry.message.type==="error"&&entry.message.code==="host-busy"),
      "concurrent P2 intent must receive the explicit host-busy ordering response",
    );
    assert.equal(state.pendingRemoteAction?.request.requestId,"mp-c22.p1-first","P2 must not overwrite the canonical pending P1 request");
    assert.equal(state.ledger.cursor,cursorBeforeBusy,"busy P2 intent must not commit or advance the ledger");
    assert.equal(transport.broadcastCount(),broadcastBeforeBusy,"busy P2 intent must not publish a competing live presentation");

    const firstCompleted=await finishResolution(host,p1.characterId);
    const firstTerminal=terminalResolution(transport.broadcastsAfter(firstBroadcastStart));
    assert.equal(firstTerminal.actorId,p1.characterId);
    assert.equal(state.pendingRemoteAction,null,"P1 terminal commit must release the remote-action slot");
    const p1TargetAfter=firstCompleted.scene.entities.find((entity)=>entity.id===p1TargetId);
    const p2TargetAfterBusy=firstCompleted.scene.entities.find((entity)=>entity.id===p2TargetId);
    assert.ok(p1TargetAfter&&p1TargetAfter.hp+p1TargetAfter.tempHp<p1DurabilityBefore,"P1 first action must apply its Host-authoritative damage exactly once");
    assert.equal((p2TargetAfterBusy?.hp??0)+(p2TargetAfterBusy?.tempHp??0),p2DurabilityBefore,"rejected concurrent P2 intent must not mutate its target");

    await host.setQueuedD20(18);
    const secondBroadcastStart=transport.broadcastCount();
    transport.emitFrom("peer.mp-c.concurrent-p2",{
      type:"action-request",
      request:{
        sessionId:state.sessionId,
        requestId:"mp-c22.p2-retry",
        actorId:p2.characterId,
        actionId:p2Attack.id,
        targetIds:[p2TargetId],
        knownEventCursor:state.ledger.cursor,
        character:p2Character!,
        capabilities:[...CONNECTED_CAPABILITIES],
      },
    });
    const secondCompleted=await finishResolution(host,p2.characterId);
    const secondTerminal=terminalResolution(transport.broadcastsAfter(secondBroadcastStart));
    assert.equal(secondTerminal.actorId,p2.characterId);
    assert.ok(secondTerminal.sequence>firstTerminal.sequence,"P2 retry must commit after P1 in one canonical ledger order");
    const p2TargetAfter=secondCompleted.scene.entities.find((entity)=>entity.id===p2TargetId);
    assert.ok(p2TargetAfter&&p2TargetAfter.hp+p2TargetAfter.tempHp<p2DurabilityBefore,"P2 retry must resolve normally after P1 releases the pending slot");
    assert.equal(state.pendingRemoteAction,null,"both ordered actions must finish without leaving a stale pending request");

    await host.stopSession();
    stopped=true;
  }finally{
    if(!stopped)await host.stopSession().catch(()=>undefined);
    transport.restore();
  }
});
