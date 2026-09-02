import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import "../../src/app/productionSessionLifecycleAdapter";
import type { CatalogEntry, CharacterSheet } from "../../src/app/contracts";
import { buildCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { projectedCharacterById } from "../../src/app/characterSessionProjectionRegistry";
import { MockAdapter } from "../../src/app/mockAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import {
  CONNECTED_CAPABILITIES,
  advanceConnectedResolutionPresentation,
  applyConnectedClientEvents,
  applyConnectedResolutionPresentation,
  connectedManifest,
} from "../../src/app/connectedSessionRuntimeAdapter";
import { ClientSessionReplica } from "../../src/app/connectedSessionProtocol";
import { encodeConnectedWireMessage, type ConnectedWireMessage } from "../../src/app/connectedSessionWire";
import {
  tauriSessionTransport,
  type SessionTransportMessage,
  type SessionTransportStatus,
} from "../../src/app/tauriSessionTransport";

const MAGIC_MISSILE="dnd.srd521.spell.magic-missile";
const HOST_STATUS:SessionTransportStatus={role:"host",state:"connected",address:"127.0.0.1:3210",peerCount:0};
const STOPPED_STATUS:SessionTransportStatus={role:null,state:"disconnected",address:"",peerCount:0};
type ResolvedCatalogEntry=CatalogEntry & {contentId?:string};
type PlayerFixture={
  characterId:string;
  sourceRevision:number;
  runtimeRevision:number;
  projection:ReturnType<typeof buildCharacterSessionProjectionV1>;
};

function contentEntry(catalog:CatalogEntry[],contentId:string){
  const found=(catalog as ResolvedCatalogEntry[]).find((entry)=>entry.contentId===contentId);
  assert.ok(found,`production catalog must contain ${contentId}`);
  return found;
}

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

async function createSpellcasterFixture(host:MockAdapter,characterId:string,name:string,revision:number):Promise<PlayerFixture>{
  const snapshot=await host.getSnapshot();
  const sorcerer=contentEntry(snapshot.catalog,"dnd.srd521.class.sorcerer");
  const human=contentEntry(snapshot.catalog,"dnd.srd521.species.human");
  const soldier=contentEntry(snapshot.catalog,"dnd.srd521.background.soldier");
  contentEntry(snapshot.catalog,MAGIC_MISSILE);
  const sheet:CharacterSheet={
    id:characterId,
    name,
    className:sorcerer.nameKo||sorcerer.nameEn,
    level:1,
    species:human.nameKo||human.nameEn,
    background:soldier.nameKo||soldier.nameEn,
    hp:8,
    maxHp:8,
    tempHp:0,
    ac:12,
    speed:30,
    proficiencyBonus:2,
    saveState:"saved",
    abilities:{str:8,dex:14,con:14,int:12,wis:10,cha:16},
    saves:[],
    skills:["비전"],
    features:["주문 시전"],
    equipment:[],
    items:[],
    resources:[],
    attacks:[],
    rulesProfileId:"dnd.srd-5.2.1",
    rulesProfileVersion:"0.1-draft",
    sourceRevision:revision,
    runtimeRevision:revision,
    classLevels:[{classId:"dnd.srd521.class.sorcerer",level:1}],
    cantrips:[],
    preparedSpells:[MAGIC_MISSILE],
  };
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

function prepareClient(adapter:MockAdapter,sessionId:string){
  const state=connectedStateFor(adapter);
  state.mode="client";
  state.sessionId=sessionId;
  state.replica=new ClientSessionReplica(sessionId);
}

async function consumeSamePublicResolution(
  messages:ConnectedWireMessage[],
  sessionId:string,
  actorId:string,
  actionId:string,
  targetIds:string[],
){
  const live=messages.filter((message):message is Extract<ConnectedWireMessage,{type:"resolution-presentation"}>=>message.type==="resolution-presentation");
  const batches=messages.filter((message):message is Extract<ConnectedWireMessage,{type:"event-batch"}>=>message.type==="event-batch");
  assert.ok(live.length>=1,"remote slotted spell must publish live presentation before terminal commit");
  assert.equal(batches.length,1,"remote slotted spell must commit exactly one terminal event batch");
  assert.ok(live.every((message)=>message.presentation.actor.id===actorId));
  assert.ok(live.some((message)=>
    message.presentation.resolution.actionId===actionId
    &&JSON.stringify(message.presentation.targets.map((target)=>target.id))===JSON.stringify(targetIds)
    &&message.presentation.resolution.authoritativeDice.length===3
  ),"P1/P2 live presentation must retain Host target order and all three authoritative projectile dice");

  const terminal=batches[0].events.find((event)=>event.payload.kind==="resolution");
  assert.ok(terminal&&terminal.actorId===actorId,"terminal slotted spell event must belong to P1");
  if(!terminal||terminal.payload.kind!=="resolution")throw new Error("missing terminal slotted spell resolution event");
  assert.equal(terminal.payload.presentation.resolution.actionId,actionId);
  assert.deepEqual(terminal.payload.presentation.targets.map((target)=>target.id),targetIds,"terminal target order must match the Host-authoritative allocation");

  const stateChanges=terminal.payload.resolutionEvents.flatMap((event)=>event.stateChanges);
  const slotChanges=stateChanges.filter((change)=>change.kind==="resource"&&change.targetId===actorId&&change.resourceId==="spell-slot-1");
  assert.equal(slotChanges.length,1,"one committed level-1 spell cast must debit exactly one authoritative slot resource");
  const slotChange=slotChanges[0];
  if(slotChange.kind!=="resource")throw new Error("missing spell-slot resource change");
  assert.equal(slotChange.after,slotChange.before-1,"the authoritative level-1 slot debit must be exactly one");

  const actingClient=new MockAdapter();
  const observingClient=new MockAdapter();
  prepareClient(actingClient,sessionId);
  prepareClient(observingClient,sessionId);
  for(const message of live){
    const actingApplied=applyConnectedResolutionPresentation(actingClient,message.presentation);
    const observingApplied=applyConnectedResolutionPresentation(observingClient,message.presentation);
    assert.equal(actingApplied.status,observingApplied.status);
    assert.notEqual(actingApplied.status,"rejected");
    const [acting,observing]=await Promise.all([actingClient.getSnapshot(),observingClient.getSnapshot()]);
    assert.deepEqual(acting.resolution,observing.resolution);
    assert.deepEqual(acting.resolutionPresentation,observing.resolutionPresentation);
  }
  while(advanceConnectedResolutionPresentation(actingClient).status!=="empty"){}
  while(advanceConnectedResolutionPresentation(observingClient).status!=="empty"){}

  const [actingBatch,observingBatch]=await Promise.all([
    applyConnectedClientEvents(actingClient,batches[0].events),
    applyConnectedClientEvents(observingClient,batches[0].events),
  ]);
  assert.equal(actingBatch.status,"applied");
  assert.equal(observingBatch.status,"applied");
  advanceConnectedResolutionPresentation(actingClient);
  advanceConnectedResolutionPresentation(observingClient);
  const [actingFinal,observingFinal]=await Promise.all([actingClient.getSnapshot(),observingClient.getSnapshot()]);
  assert.deepEqual(
    targetIds.map((id)=>actingFinal.scene.entities.find((entity)=>entity.id===id)?.hp),
    targetIds.map((id)=>observingFinal.scene.entities.find((entity)=>entity.id===id)?.hp),
    "P1 and P2 must apply identical terminal HP outcomes for every Host-selected Magic Missile target",
  );
}

test("MP-C14/C16 core · remote P1 Magic Missile keeps Host multi-target order and debits exactly one spell slot while P2 sees the same outcome",async()=>{
  const transport=installThreePeerHostTransport();
  const host=new MockAdapter();
  let stopped=false;
  try{
    await host.hostSession();
    const state=connectedStateFor(host);
    assert.ok(state.ledger&&state.sessionId,"Host session must establish one authoritative ledger");

    const p1=await createSpellcasterFixture(host,"char.mp-c.magic-p1","MP-C Magic P1",909);
    const p2=await createSpellcasterFixture(host,"char.mp-c.magic-p2","MP-C Magic P2",1001);
    const p1Character=await connectPlayer(host,transport,"peer.mp-c.magic-p1","MP-C Magic P1",p1);
    await connectPlayer(host,transport,"peer.mp-c.magic-p2","MP-C Magic P2",p2);
    assert.equal(state.peerParticipants.size,2,"Host must retain P1 and P2 for slotted-spell spectator fan-out");

    const before=await host.getSnapshot();
    const magicMissile=before.scene.actionsByActor[p1.characterId]?.find((action)=>action.id==="action.magic-missile");
    assert.ok(magicMissile,"Host projection must expose P1 canonical Magic Missile");
    assert.equal(magicMissile.target,"multi-enemy");
    assert.equal(magicMissile.maxTargets,3);
    assert.equal(magicMissile.spellCast?.baseLevel,1);
    const slot=before.scene.spellcastingByActor?.[p1.characterId]?.slots.find((entry)=>entry.level===1);
    assert.ok(slot&&slot.current>0,"projected level-1 spellcaster must expose an available level-1 slot");

    const targets=magicMissile.eligibleTargetIds
      .map((id)=>before.scene.entities.find((entity)=>entity.id===id))
      .filter((entity):entity is NonNullable<typeof entity>=>Boolean(entity&&entity.side==="enemy"))
      .slice(0,3);
    assert.equal(targets.length,3,"MP-C14 requires three eligible Host Scene targets for the three Magic Missile projectiles");
    const targetIds=targets.map((target)=>target.id);
    const durabilityBefore=new Map(targets.map((target)=>[target.id,target.hp+target.tempHp]));

    const actionCursor=state.ledger.cursor;
    const broadcastStart=transport.broadcastCount();
    transport.emitFrom("peer.mp-c.magic-p1",{
      type:"action-request",
      request:{
        sessionId:state.sessionId,
        requestId:"mp-c14-c16.remote-magic-missile",
        actorId:p1.characterId,
        actionId:magicMissile.id,
        targetIds,
        knownEventCursor:actionCursor,
        character:p1Character!,
        capabilities:[...CONNECTED_CAPABILITIES],
      },
    });

    const completed=await finishResolution(host,p1.characterId);
    assert.equal(completed.resolution?.stage,"complete");
    assert.equal(completed.resolution?.actionId,magicMissile.id);
    assert.deepEqual(completed.resolution?.targetIds,targetIds,"Host resolution must retain the authoritative multi-target order");
    for(const targetId of targetIds){
      const targetAfter=completed.scene.entities.find((entity)=>entity.id===targetId);
      assert.ok(targetAfter,`Magic Missile target ${targetId} must remain in the Host Scene`);
      assert.ok(targetAfter.hp+targetAfter.tempHp<(durabilityBefore.get(targetId)??0),`Host-authoritative Magic Missile must damage ${targetId} exactly through the committed cast`);
    }
    assert.equal(state.ledger.cursor,actionCursor+1,"remote slotted multi-target spell must commit exactly one Host ledger event");
    await consumeSamePublicResolution(transport.broadcastsAfter(broadcastStart),state.sessionId,p1.characterId,magicMissile.id,targetIds);

    await host.stopSession();
    stopped=true;
  }finally{
    if(!stopped)await host.stopSession().catch(()=>undefined);
    transport.restore();
  }
});
