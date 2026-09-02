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
  applyConnectedResolutionPresentation,
  connectedManifest,
} from "../../src/app/connectedSessionRuntimeAdapter";
import { encodeConnectedWireMessage, type ConnectedWireMessage } from "../../src/app/connectedSessionWire";
import {
  tauriSessionTransport,
  type SessionTransportMessage,
  type SessionTransportStatus,
} from "../../src/app/tauriSessionTransport";

const FIRE_BOLT="dnd.srd521.spell.fire-bolt";
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
  contentEntry(snapshot.catalog,FIRE_BOLT);
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
    cantrips:[FIRE_BOLT],
    preparedSpells:[],
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

async function assertTwoRemoteSpellConsumers(messages:ConnectedWireMessage[],actorId:string,actionId:string,targetId:string){
  const live=messages.filter((message):message is Extract<ConnectedWireMessage,{type:"resolution-presentation"}>=>message.type==="resolution-presentation");
  const batches=messages.filter((message):message is Extract<ConnectedWireMessage,{type:"event-batch"}>=>message.type==="event-batch");
  assert.ok(live.length>=1,"remote spell attack must publish a live presentation before terminal commit");
  assert.equal(batches.length,1,"remote spell attack must commit exactly one terminal event batch");
  assert.ok(live.every((message)=>message.presentation.actor.id===actorId));
  assert.ok(live.every((message)=>message.presentation.targets.some((target)=>target.id===targetId)));
  assert.ok(live.some((message)=>message.presentation.resolution.actionId===actionId&&message.presentation.resolution.authoritativeDice.length>0),"live spell presentation must carry Host-authoritative dice");

  const terminal=batches[0].events.find((event)=>event.payload.kind==="resolution");
  assert.ok(terminal&&terminal.actorId===actorId,"terminal spell event must belong to P1");
  if(!terminal||terminal.payload.kind!=="resolution")throw new Error("missing terminal spell resolution event");
  assert.equal(terminal.payload.presentation.resolution.actionId,actionId);
  assert.equal(terminal.payload.presentation.actor.id,actorId);
  assert.ok(terminal.payload.presentation.targets.some((target)=>target.id===targetId));
  const stateChanges=terminal.payload.resolutionEvents.flatMap((event)=>event.stateChanges);
  assert.equal(stateChanges.some((change)=>change.kind==="resource"),false,"MP-C15 cantrip must not consume a spell-slot/resource change");

  const actingClient=new MockAdapter();
  const observingClient=new MockAdapter();
  for(const consumer of [actingClient,observingClient]){
    const state=connectedStateFor(consumer);
    state.mode="client";
    state.sessionId=terminal.sessionId;
  }
  for(const message of live){
    const actingApplied=applyConnectedResolutionPresentation(actingClient,message.presentation);
    const observingApplied=applyConnectedResolutionPresentation(observingClient,message.presentation);
    assert.equal(actingApplied.status,observingApplied.status);
    assert.notEqual(actingApplied.status,"rejected");
    const [acting,observing]=await Promise.all([actingClient.getSnapshot(),observingClient.getSnapshot()]);
    assert.deepEqual(acting.resolution,observing.resolution);
    assert.deepEqual(acting.resolutionPresentation,observing.resolutionPresentation);
  }

  const actingStages:string[]=[];
  const observingStages:string[]=[];
  while(true){
    const [acting,observing]=await Promise.all([actingClient.getSnapshot(),observingClient.getSnapshot()]);
    assert.ok(acting.resolution&&observing.resolution,"both remote consumers must retain the shared live spell presentation");
    actingStages.push(acting.resolution.stage);
    observingStages.push(observing.resolution.stage);
    const actingAdvance=advanceConnectedResolutionPresentation(actingClient);
    const observingAdvance=advanceConnectedResolutionPresentation(observingClient);
    assert.equal(actingAdvance.status,observingAdvance.status);
    if(actingAdvance.status==="empty")break;
  }
  const latestDiceIndex=live.findLastIndex((message)=>
    ["roll-animation","save-animation","damage-animation"].includes(message.presentation.resolution.stage)
    &&message.presentation.resolution.authoritativeDice.length>0
  );
  assert.deepEqual(actingStages,live.slice(Math.max(0,latestDiceIndex)).map((message)=>message.presentation.resolution.stage));
  assert.deepEqual(observingStages,actingStages,"P1 and P2 must consume the same ordered public spell presentation");
}

test("MP-C12/C15 core · remote P1 Fire Bolt resolves once on Host and fans out the same live cantrip presentation to P2",async()=>{
  const transport=installThreePeerHostTransport();
  const host=new MockAdapter();
  let stopped=false;
  try{
    await host.hostSession();
    const state=connectedStateFor(host);
    assert.ok(state.ledger&&state.sessionId,"Host session must establish one authoritative ledger");

    const p1=await createSpellcasterFixture(host,"char.mp-c.spell-p1","MP-C Spell P1",505);
    const p2=await createSpellcasterFixture(host,"char.mp-c.spell-p2","MP-C Spell P2",606);
    const p1Character=await connectPlayer(host,transport,"peer.mp-c.spell-p1","MP-C Spell P1",p1);
    await connectPlayer(host,transport,"peer.mp-c.spell-p2","MP-C Spell P2",p2);
    assert.equal(state.peerParticipants.size,2,"Host must retain P1 and P2 for spell spectator fan-out");

    const before=await host.getSnapshot();
    const fireBolt=before.scene.actionsByActor[p1.characterId]?.find((action)=>action.id==="action.fire-bolt");
    assert.ok(fireBolt,"Host projection must expose P1 canonical Fire Bolt");
    assert.equal(fireBolt.resolutionKind,"attack");
    assert.equal(fireBolt.target,"enemy");
    const target=before.scene.entities.find((entity)=>entity.side==="enemy"&&fireBolt.eligibleTargetIds.includes(entity.id));
    assert.ok(target,"remote Fire Bolt requires a canonical eligible Host Scene enemy");
    const durabilityBefore=target.hp+target.tempHp;

    await host.setQueuedD20(19);
    const broadcastStart=transport.broadcastCount();
    transport.emitFrom("peer.mp-c.spell-p1",{
      type:"action-request",
      request:{
        sessionId:state.sessionId,
        requestId:"mp-c12-c15.remote-fire-bolt",
        actorId:p1.characterId,
        actionId:fireBolt.id,
        targetIds:[target.id],
        knownEventCursor:state.ledger.cursor,
        character:p1Character!,
        capabilities:[...CONNECTED_CAPABILITIES],
      },
    });

    const completed=await finishResolution(host,p1.characterId);
    assert.equal(completed.resolution?.stage,"complete");
    assert.equal(completed.resolution?.actionId,fireBolt.id);
    const targetAfter=completed.scene.entities.find((entity)=>entity.id===target.id);
    assert.ok(targetAfter,"Fire Bolt target must remain in the Host Scene after resolution");
    assert.ok(targetAfter.hp+targetAfter.tempHp<durabilityBefore,"MP-C12 Host-authoritative Fire Bolt must apply its hit damage once");
    await assertTwoRemoteSpellConsumers(transport.broadcastsAfter(broadcastStart),p1.characterId,fireBolt.id,target.id);

    await host.stopSession();
    stopped=true;
  }finally{
    if(!stopped)await host.stopSession().catch(()=>undefined);
    transport.restore();
  }
});
