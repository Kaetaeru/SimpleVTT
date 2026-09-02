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
  assert.ok(fighter?.contentId&&human?.contentId&&soldier?.contentId,"three-peer fixture requires canonical Fighter/Human/Soldier identities");
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
  assert.equal(sheet.items.length,1,"three-peer fixture requires the canonical longsword item");
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

test("MP-C21/C23 core · invalid targets publish nothing and duplicate remote requests do not replay live state",async()=>{
  const transport=installThreePeerHostTransport();
  const host=new MockAdapter();
  let stopped=false;
  try{
    await host.hostSession();
    const state=connectedStateFor(host);
    assert.ok(state.ledger&&state.sessionId,"Host session must establish one authoritative ledger");

    const p1=await createPlayerFixture(host,"char.mp-c.once-p1","MP-C Once P1",505);
    const p2=await createPlayerFixture(host,"char.mp-c.once-p2","MP-C Once P2",606);
    const p1Character=await connectPlayer(host,transport,"peer.mp-c.once-p1","MP-C Once P1",p1);
    await connectPlayer(host,transport,"peer.mp-c.once-p2","MP-C Once P2",p2);
    assert.equal(state.peerParticipants.size,2,"Host must retain P1 and P2 during rejection/exactly-once verification");

    const snapshot=await host.getSnapshot();
    const p1Attack=snapshot.scene.actionsByActor[p1.characterId]?.find((action)=>action.resolutionKind==="attack"&&(action.name.includes("롱소드")||action.name.toLowerCase().includes("longsword")));
    assert.ok(p1Attack,"Host projection must expose P1 canonical longsword attack");

    const invalidDirectedStart=transport.directed().length;
    const invalidBroadcastStart=transport.broadcastCount();
    const invalidCursorStart=state.ledger.cursor;
    transport.emitFrom("peer.mp-c.once-p1",{
      type:"action-request",
      request:{
        sessionId:state.sessionId,
        requestId:"mp-c21.invalid-target",
        actorId:p1.characterId,
        actionId:p1Attack.id,
        targetIds:["missing.mp-c21.target"],
        knownEventCursor:state.ledger.cursor,
        character:p1Character!,
        capabilities:[...CONNECTED_CAPABILITIES],
      },
    });
    await eventually(
      ()=>transport.directed().slice(invalidDirectedStart).some((entry)=>entry.peer==="peer.mp-c.once-p1"&&entry.message.type==="error"&&entry.message.code==="action-rejected"),
      "MP-C21 invalid target must receive an explicit terminal action-rejected error",
    );
    assert.equal(state.ledger.cursor,invalidCursorStart,"MP-C21 invalid target must not commit an event");
    assert.equal(transport.broadcastCount(),invalidBroadcastStart,"MP-C21 invalid target must not fan out a false presentation or event");
    assert.equal(state.pendingRemoteAction,null,"MP-C21 invalid target must not leave a pending remote action");

    const beforeValid=await host.getSnapshot();
    const targetId="combatant.goblin-a";
    const targetBefore=beforeValid.scene.entities.find((entity)=>entity.id===targetId);
    assert.ok(targetBefore,"duplicate-request fixture requires goblin A");
    const durabilityBefore=targetBefore.hp+targetBefore.tempHp;
    const request={
      sessionId:state.sessionId,
      requestId:"mp-c23.duplicate-attack",
      actorId:p1.characterId,
      actionId:p1Attack.id,
      targetIds:[targetId],
      knownEventCursor:state.ledger.cursor,
      character:p1Character!,
      capabilities:[...CONNECTED_CAPABILITIES],
    };
    await host.setQueuedD20(19);
    const validBroadcastStart=transport.broadcastCount();
    transport.emitFrom("peer.mp-c.once-p1",{type:"action-request",request});
    const completed=await finishResolution(host,p1.characterId);
    const firstMessages=transport.broadcastsAfter(validBroadcastStart);
    const firstBatch=firstMessages.find((message):message is Extract<ConnectedWireMessage,{type:"event-batch"}>=>message.type==="event-batch");
    assert.ok(firstBatch,"first MP-C23 request must commit one shared event batch");
    const terminal=firstBatch.events.find((event)=>event.payload.kind==="resolution");
    assert.ok(terminal,"first MP-C23 request must produce one terminal resolution event");
    const targetAfterFirst=completed.scene.entities.find((entity)=>entity.id===targetId);
    assert.ok(targetAfterFirst&&targetAfterFirst.hp+targetAfterFirst.tempHp<durabilityBefore,"first MP-C23 request must apply damage once");

    const cursorAfterFirst=state.ledger.cursor;
    const broadcastAfterFirst=transport.broadcastCount();
    const directedAfterFirst=transport.directed().length;
    const durabilityAfterFirst=targetAfterFirst.hp+targetAfterFirst.tempHp;
    transport.emitFrom("peer.mp-c.once-p1",{type:"action-request",request});
    await eventually(
      ()=>transport.directed().slice(directedAfterFirst).some((entry)=>
        entry.peer==="peer.mp-c.once-p1"
        &&entry.message.type==="event-batch"
        &&entry.message.events.some((event)=>event.id===terminal.id)
      ),
      "MP-C23 duplicate request must return the previously committed event to the requester",
    );
    assert.equal(state.ledger.cursor,cursorAfterFirst,"MP-C23 duplicate request must not advance the canonical cursor");
    assert.equal(transport.broadcastCount(),broadcastAfterFirst,"MP-C23 duplicate request must not replay a live cinematic or broadcast a second commit");
    const afterDuplicate=await host.getSnapshot();
    const targetAfterDuplicate=afterDuplicate.scene.entities.find((entity)=>entity.id===targetId);
    assert.equal((targetAfterDuplicate?.hp??0)+(targetAfterDuplicate?.tempHp??0),durabilityAfterFirst,"MP-C23 duplicate request must not apply damage twice");
    assert.equal(state.pendingRemoteAction,null,"MP-C23 duplicate request must not create a new pending resolution");

    await host.stopSession();
    stopped=true;
  }finally{
    if(!stopped)await host.stopSession().catch(()=>undefined);
    transport.restore();
  }
});
