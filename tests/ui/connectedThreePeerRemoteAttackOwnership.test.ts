import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import { buildCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { materializeCreatedWeaponAttacks } from "../../src/app/characterCreationWeaponAttackAdapter";
import { projectedCharacterById } from "../../src/app/characterSessionProjectionRegistry";
import { MockAdapter } from "../../src/app/mockAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import {
  CONNECTED_CAPABILITIES,
  advanceConnectedResolutionPresentation,
  applyConnectedResolutionPresentation,
  connectedManifest,
} from "../../src/app/connectedSessionRuntimeAdapter";
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
  const classEntry=snapshot.catalog.find((entry)=>entry.scope==="builtin"&&entry.category==="class");
  const speciesEntry=snapshot.catalog.find((entry)=>entry.scope==="builtin"&&entry.category==="species");
  const backgroundEntry=snapshot.catalog.find((entry)=>entry.scope==="builtin"&&entry.category==="background");
  assert.ok(classEntry?.contentId&&speciesEntry?.contentId&&backgroundEntry?.contentId,"three-peer fixture requires canonical Character build identities");
  const sheet=structuredClone(snapshot.activeCharacter);
  sheet.id=characterId;
  sheet.name=name;
  sheet.className=classEntry.contentId;
  sheet.subclassName="";
  sheet.species=speciesEntry.contentId;
  sheet.background=backgroundEntry.contentId;
  sheet.classLevels=undefined;
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
  assert.ok(sheet.attacks.some((attack)=>attack.name.includes("롱소드")||attack.name.toLowerCase().includes("longsword")),"three-peer fixture requires a materialized longsword attack");
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
  const ack=transport.directed().find((entry)=>entry.peer===peer&&entry.message.type==="hello-ack")?.message;
  assert.equal(ack?.type,"hello-ack");
  if(ack?.type!=="hello-ack")throw new Error(`missing hello-ack for ${name}`);
  assert.notEqual(ack.compatibility.status,"incompatible");
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

async function assertTwoRemotePresentationConsumers(messages:ConnectedWireMessage[],actorId:string,targetId:string){
  const live=messages.filter((message):message is Extract<ConnectedWireMessage,{type:"resolution-presentation"}>=>message.type==="resolution-presentation");
  const batches=messages.filter((message):message is Extract<ConnectedWireMessage,{type:"event-batch"}>=>message.type==="event-batch");
  assert.ok(live.length>=2,"shared action must publish multiple live presentation stages before terminal commit");
  assert.equal(batches.length,1,"shared action must commit exactly one terminal event batch");
  assert.ok(live.every((message)=>message.presentation.actor.id===actorId));
  assert.ok(live.every((message)=>message.presentation.targets.some((target)=>target.id===targetId)));
  const terminal=batches[0].events.find((event)=>event.payload.kind==="resolution");
  assert.ok(terminal&&terminal.actorId===actorId,"terminal Host event must belong to the requested remote actor");
  if(!terminal||terminal.payload.kind!=="resolution")throw new Error("missing terminal resolution event");
  assert.equal(terminal.payload.presentation.actor.id,actorId);
  assert.ok(terminal.payload.presentation.targets.some((target)=>target.id===targetId));

  const consumers=[new MockAdapter(),new MockAdapter()];
  const stageHistory:string[][]=[];
  for(const consumer of consumers){
    const state=connectedStateFor(consumer);
    state.mode="client";
    state.sessionId=terminal.sessionId;
    for(const message of live){
      const applied=applyConnectedResolutionPresentation(consumer,message.presentation);
      assert.notEqual(applied.status,"rejected");
    }
    const observed:string[]=[];
    const initial=(await consumer.getSnapshot()).resolution?.stage;
    if(initial)observed.push(initial);
    for(let step=0;step<20;step+=1){
      const advanced=advanceConnectedResolutionPresentation(consumer);
      if(advanced.status==="empty")break;
      const stage=(await consumer.getSnapshot()).resolution?.stage;
      if(stage)observed.push(stage);
    }
    stageHistory.push(observed);
  }
  assert.deepEqual(stageHistory[0],stageHistory[1],"acting peer and P2 spectator must consume the same ordered public live presentation");
  assert.ok(stageHistory[0].length>=2,"remote consumers must observe more than the first live stage");
}

test("MP-C01/C03 core · remote P1 attacks resolve once on Host and fan out the same live presentation to P2",async()=>{
  const transport=installThreePeerHostTransport();
  const host=new MockAdapter();
  let stopped=false;
  try{
    await host.hostSession();
    const state=connectedStateFor(host);
    assert.ok(state.ledger&&state.sessionId,"Host session must establish one authoritative ledger");

    const p1=await createPlayerFixture(host,"char.mp-c.p1","MP-C P1",101);
    const p2=await createPlayerFixture(host,"char.mp-c.p2","MP-C P2",202);
    const p1Character=await connectPlayer(host,transport,"peer.mp-c.p1","MP-C P1",p1);
    await connectPlayer(host,transport,"peer.mp-c.p2","MP-C P2",p2);
    assert.equal(state.peerParticipants.size,2,"Host must retain both remote peers for spectator fan-out");

    const hostWithPlayers=await host.getSnapshot();
    assert.ok(hostWithPlayers.scene.actionsByActor[p1.characterId]?.some((action)=>action.id==="action.longsword"),"Host projection must expose P1 canonical longsword action");
    assert.ok(hostWithPlayers.scene.entities.some((entity)=>entity.id===p2.characterId),"P2 projection must exist as a legal remote target");

    const runRemoteAttack=async(requestId:string,targetId:string)=>{
      await host.setQueuedD20(19);
      const broadcastStart=transport.broadcastCount();
      transport.emitFrom("peer.mp-c.p1",{
        type:"action-request",
        request:{
          sessionId:state.sessionId!,
          requestId,
          actorId:p1.characterId,
          actionId:"action.longsword",
          targetIds:[targetId],
          knownEventCursor:state.ledger!.cursor,
          character:p1Character!,
          capabilities:[...CONNECTED_CAPABILITIES],
        },
      });
      const completed=await finishResolution(host,p1.characterId);
      assert.equal(completed.resolution?.stage,"complete");
      const messages=transport.broadcastsAfter(broadcastStart);
      await assertTwoRemotePresentationConsumers(messages,p1.characterId,targetId);
      return {completed,messages};
    };

    const goblinBefore=hostWithPlayers.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.hp;
    const c01=await runRemoteAttack("mp-c01.remote-attack","combatant.goblin-a");
    const goblinAfter=c01.completed.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.hp;
    assert.ok(typeof goblinBefore==="number"&&typeof goblinAfter==="number"&&goblinAfter<goblinBefore,"MP-C01 Host-authoritative remote attack must damage the NPC exactly through the canonical resolution");

    await host.dismissResolution();
    const p2Before=(await host.getSnapshot()).scene.entities.find((entity)=>entity.id===p2.characterId)?.hp;
    const c03=await runRemoteAttack("mp-c03.remote-target-owner",p2.characterId);
    const p2After=c03.completed.scene.entities.find((entity)=>entity.id===p2.characterId)?.hp;
    assert.ok(typeof p2Before==="number"&&typeof p2After==="number"&&p2After<p2Before,"MP-C03 Host-authoritative remote attack must target the mounted P2 Character without substituting local ownership");

    await host.stopSession();
    stopped=true;
  }finally{
    if(!stopped)await host.stopSession().catch(()=>undefined);
    transport.restore();
  }
});
