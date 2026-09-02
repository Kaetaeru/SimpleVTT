import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import "../../src/app/productionSessionLifecycleAdapter";
import { buildCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { materializeCreatedWeaponAttacks } from "../../src/app/characterCreationWeaponAttackAdapter";
import { projectedCharacterById } from "../../src/app/characterSessionProjectionRegistry";
import { ClientSessionReplica } from "../../src/app/connectedSessionProtocol";
import { MockAdapter } from "../../src/app/mockAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import {
  advanceConnectedResolutionPresentation,
  applyConnectedClientEvents,
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

  tauriSessionTransport.available=()=>true;
  tauriSessionTransport.startHost=async()=>structuredClone(HOST_STATUS);
  tauriSessionTransport.send=async(message)=>{broadcasts.push(message);return 2;};
  tauriSessionTransport.sendTo=async()=>1;
  tauriSessionTransport.stop=async()=>structuredClone(STOPPED_STATUS);
  tauriSessionTransport.onMessage=async(handler)=>{listener=handler;return()=>{};};
  tauriSessionTransport.onState=async()=>()=>{};
  tauriSessionTransport.onPeerLifecycle=async()=>()=>{};

  return {
    broadcastCount:()=>broadcasts.length,
    broadcastsAfter:(index:number)=>broadcasts.slice(index).map((entry)=>JSON.parse(entry) as ConnectedWireMessage),
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
  assert.ok(fighter?.contentId&&human?.contentId&&soldier?.contentId,"MP-C02 fixture requires canonical Fighter/Human/Soldier identities");
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
  assert.equal(sheet.items.length,1,"MP-C02 fixture requires the canonical longsword item shell");
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
}

async function finishResolution(host:MockAdapter,actorId:string){
  for(let step=0;step<12;step+=1){
    const snapshot=await host.getSnapshot();
    if(snapshot.resolution?.actorId===actorId&&snapshot.resolution.stage==="complete")return snapshot;
    assert.equal(snapshot.resolution?.actorId,actorId,"Host NPC must remain the authoritative resolution actor");
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

async function drainClient(adapter:MockAdapter){
  const stages:string[]=[];
  while(true){
    const snapshot=await adapter.getSnapshot();
    if(snapshot.resolution)stages.push(snapshot.resolution.stage);
    if(advanceConnectedResolutionPresentation(adapter).status==="empty")return stages;
  }
}

test("MP-C02 core · Host NPC attack damages P1 once and fans out identical live/terminal state to P1 and P2",async()=>{
  const transport=installThreePeerHostTransport();
  const host=new MockAdapter();
  let stopped=false;
  try{
    await host.hostSession();
    const state=connectedStateFor(host);
    assert.ok(state.ledger&&state.sessionId,"Host session must establish one authoritative ledger");

    const p1=await createPlayerFixture(host,"char.mp-c02.p1","MP-C02 P1",1801);
    const p2=await createPlayerFixture(host,"char.mp-c02.p2","MP-C02 P2",1802);
    await connectPlayer(host,transport,"peer.mp-c02.p1","MP-C02 P1",p1);
    await connectPlayer(host,transport,"peer.mp-c02.p2","MP-C02 P2",p2);
    assert.equal(state.peerParticipants.size,2,"Host must retain P1 and P2 for NPC attack spectator parity");

    const before=await host.getSnapshot();
    const npcId="combatant.goblin-a";
    const attack=before.scene.actionsByActor[npcId]?.find((action)=>action.id==="action.scimitar"&&action.resolutionKind==="attack");
    assert.ok(attack,"MP-C02 requires the canonical Host-controlled goblin scimitar attack");
    const targetBefore=before.scene.entities.find((entity)=>entity.id===p1.characterId);
    assert.ok(targetBefore,"P1 projected Character must exist as the NPC attack target");
    const durabilityBefore=targetBefore.hp+targetBefore.tempHp;

    await host.setQueuedD20(18);
    const cursorBefore=state.ledger.cursor;
    const historyBeforeAction=state.ledger.eventsAfter(0);
    assert.equal(historyBeforeAction.at(-1)?.sequence,cursorBefore,"P1/P2 replicas must replay the same pre-action Host history");
    const broadcastStart=transport.broadcastCount();

    const started=await host.resolveAction(attack.id,[p1.characterId]);
    assert.equal(started.resolution?.actorId,npcId,"Host must retain NPC ownership of the attack resolution");
    assert.equal(started.resolution?.actionId,attack.id);
    assert.ok(started.resolution?.targetIds.includes(p1.characterId));

    const completed=await finishResolution(host,npcId);
    assert.equal(completed.resolution?.stage,"complete");
    assert.equal(completed.resolution?.attackOutcome,"명중");
    assert.equal(state.ledger.cursor,cursorBefore+1,"MP-C02 must commit exactly one Host terminal event");
    const targetAfter=completed.scene.entities.find((entity)=>entity.id===p1.characterId);
    assert.ok(targetAfter,"P1 target must remain mounted after the NPC attack");
    assert.ok(targetAfter.hp+targetAfter.tempHp<durabilityBefore,"Host-authoritative NPC attack must reduce P1 durability exactly once");

    const messages=transport.broadcastsAfter(broadcastStart);
    const live=messages.filter((message):message is Extract<ConnectedWireMessage,{type:"resolution-presentation"}>=>message.type==="resolution-presentation");
    const batches=messages.filter((message):message is Extract<ConnectedWireMessage,{type:"event-batch"}>=>message.type==="event-batch");
    assert.ok(live.length>=2,"MP-C02 must publish multiple live shared presentation stages before terminal commit");
    assert.equal(batches.length,1,"MP-C02 must publish exactly one terminal event batch");
    assert.ok(live.every((message)=>message.presentation.actor.id===npcId),"every live stage must retain Host NPC actor identity");
    assert.ok(live.every((message)=>message.presentation.targets.some((target)=>target.id===p1.characterId)),"every live stage must retain P1 as target");
    const terminal=batches[0].events.find((event)=>event.payload.kind==="resolution");
    assert.ok(terminal&&terminal.actorId===npcId,"terminal event must remain owned by the Host NPC");
    if(!terminal||terminal.payload.kind!=="resolution")throw new Error("missing MP-C02 terminal resolution event");
    assert.equal(terminal.payload.presentation.actor.id,npcId);
    assert.ok(terminal.payload.presentation.targets.some((target)=>target.id===p1.characterId));

    const actingClient=new MockAdapter();
    const observingClient=new MockAdapter();
    prepareClient(actingClient,state.sessionId);
    prepareClient(observingClient,state.sessionId);
    const actingHistory=await applyConnectedClientEvents(actingClient,historyBeforeAction);
    const observingHistory=await applyConnectedClientEvents(observingClient,historyBeforeAction);
    assert.equal(actingHistory.status,"applied");
    assert.equal(observingHistory.status,"applied");
    assert.equal(connectedStateFor(actingClient).replica?.cursor,cursorBefore);
    assert.equal(connectedStateFor(observingClient).replica?.cursor,cursorBefore);

    for(const message of live){
      const actingApplied=applyConnectedResolutionPresentation(actingClient,message.presentation);
      const observingApplied=applyConnectedResolutionPresentation(observingClient,message.presentation);
      assert.equal(actingApplied.status,observingApplied.status);
      assert.notEqual(actingApplied.status,"rejected");
    }
    const actingStages=await drainClient(actingClient);
    const observingStages=await drainClient(observingClient);
    assert.deepEqual(actingStages,observingStages,"P1 and P2 must consume the same ordered live NPC attack presentation");

    const actingEvents=await applyConnectedClientEvents(actingClient,batches[0].events);
    const observingEvents=await applyConnectedClientEvents(observingClient,batches[0].events);
    assert.equal(actingEvents.status,"applied");
    assert.equal(observingEvents.status,"applied");
    assert.equal(advanceConnectedResolutionPresentation(actingClient).status,"applied");
    assert.equal(advanceConnectedResolutionPresentation(observingClient).status,"applied");

    const [acting,observing]=await Promise.all([actingClient.getSnapshot(),observingClient.getSnapshot()]);
    assert.deepEqual(acting.resolution,observing.resolution,"P1/P2 terminal resolution must converge");
    const actingTarget=acting.scene.entities.find((entity)=>entity.id===p1.characterId);
    const observingTarget=observing.scene.entities.find((entity)=>entity.id===p1.characterId);
    assert.ok(actingTarget&&observingTarget,"both remote consumers must retain P1 after terminal apply");
    assert.deepEqual({hp:actingTarget.hp,tempHp:actingTarget.tempHp},{hp:targetAfter.hp,tempHp:targetAfter.tempHp},"P1 target state must converge with Host");
    assert.deepEqual({hp:observingTarget.hp,tempHp:observingTarget.tempHp},{hp:targetAfter.hp,tempHp:targetAfter.tempHp},"P2 observed target state must converge with Host");

    await host.stopSession();
    stopped=true;
  }finally{
    if(!stopped)await host.stopSession().catch(()=>undefined);
    transport.restore();
  }
});