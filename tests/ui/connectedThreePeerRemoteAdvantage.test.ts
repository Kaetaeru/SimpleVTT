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
import {
  CONNECTED_CAPABILITIES,
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
  assert.ok(fighter?.contentId&&human?.contentId&&soldier?.contentId,"MP-C06 fixture requires canonical Fighter/Human/Soldier identities");
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
  assert.equal(sheet.items.length,1,"MP-C06 fixture requires the canonical longsword item");
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
  for(let step=0;step<12;step+=1){
    const snapshot=await host.getSnapshot();
    if(snapshot.resolution?.stage==="complete")return snapshot;
    assert.equal(snapshot.resolution?.actorId,actorId,"Host must retain the remote P1 resolution while advancing MP-C06");
    assert.ok(snapshot.resolution?.canAdvance,`resolution ${snapshot.resolution?.id??"<missing>"} stopped before complete`);
    await host.advanceResolution();
  }
  assert.fail(`resolution for ${actorId} did not complete within 12 presentation advances`);
}

test("MP-C06 core · remote P1 advantage keeps rolled, selected, and discarded dice identical for P1/P2",async()=>{
  const transport=installThreePeerHostTransport();
  const host=new MockAdapter();
  let stopped=false;
  try{
    await host.hostSession();
    const state=connectedStateFor(host);
    assert.ok(state.ledger&&state.sessionId,"Host session must establish one authoritative ledger");

    const p1=await createPlayerFixture(host,"char.mp-c06.p1","MP-C06 P1",1601);
    const p2=await createPlayerFixture(host,"char.mp-c06.p2","MP-C06 P2",1602);
    const p1Character=await connectPlayer(host,transport,"peer.mp-c06.p1","MP-C06 P1",p1);
    await connectPlayer(host,transport,"peer.mp-c06.p2","MP-C06 P2",p2);
    assert.equal(state.peerParticipants.size,2,"Host must retain P1 and P2 for advantage spectator parity");

    const before=await host.getSnapshot();
    const attack=before.scene.actionsByActor[p1.characterId]?.find((action)=>action.resolutionKind==="attack"&&(action.name.includes("롱소드")||action.name.toLowerCase().includes("longsword")));
    assert.ok(attack&&attack.attackBonus===7,"MP-C06 requires the projected +7 canonical longsword attack");
    const targetId="combatant.goblin-a";
    await host.setQueuedD20(10);
    const cursorBefore=state.ledger.cursor;
    const broadcastStart=transport.broadcastCount();

    transport.emitFrom("peer.mp-c06.p1",{
      type:"action-request",
      request:{
        sessionId:state.sessionId,
        requestId:"mp-c06.remote-advantage",
        actorId:p1.characterId,
        actionId:attack.id,
        targetIds:[targetId],
        knownEventCursor:cursorBefore,
        character:p1Character!,
        capabilities:[...CONNECTED_CAPABILITIES],
      },
    });

    await eventually(async()=>{
      const resolution=(await host.getSnapshot()).resolution;
      return resolution?.actorId===p1.characterId&&resolution.stage==="roll-animation";
    },"MP-C06 remote attack must start on Host before advantage adjudication");
    const rolled=await host.getSnapshot();
    assert.deepEqual(rolled.resolution?.authoritativeDice,[10]);
    assert.equal(rolled.resolution?.attackTotal,17);

    const adjudicated=await host.applyDmAdjudication({type:"advantage",scope:"resolution"});
    assert.equal(adjudicated.resolution?.adjudicated,true);
    assert.deepEqual(adjudicated.resolution?.authoritativeDice,[10,18]);
    assert.equal(adjudicated.resolution?.attackTotal,25,"Host must select the higher advantage face for the +7 attack total");
    assert.equal(adjudicated.resolution?.finalOutcome,"DM 유리점 적용");

    const completed=await finishResolution(host,p1.characterId);
    assert.equal(completed.resolution?.stage,"complete");
    assert.equal(state.ledger.cursor,cursorBefore+1,"MP-C06 must commit exactly one terminal Host event");

    const messages=transport.broadcastsAfter(broadcastStart);
    const live=messages.filter((message):message is Extract<ConnectedWireMessage,{type:"resolution-presentation"}>=>message.type==="resolution-presentation");
    const batches=messages.filter((message):message is Extract<ConnectedWireMessage,{type:"event-batch"}>=>message.type==="event-batch");
    assert.equal(batches.length,1,"MP-C06 must commit exactly one shared terminal event batch");
    const advantagePresentation=live.find((message)=>message.presentation.dice.selection==="highest"&&message.presentation.dice.faces.length===2);
    assert.ok(advantagePresentation,"MP-C06 must publish one live advantage presentation with both rolled faces");
    assert.deepEqual(advantagePresentation.presentation.dice.faces,[10,18]);
    assert.deepEqual(advantagePresentation.presentation.dice.selectedIndices,[1]);
    assert.deepEqual(advantagePresentation.presentation.dice.discardedIndices,[0]);
    assert.equal(advantagePresentation.presentation.dice.total,25);
    assert.equal(advantagePresentation.presentation.dice.modifier,7);
    assert.equal(advantagePresentation.presentation.resolution.actorId,p1.characterId);
    assert.deepEqual(advantagePresentation.presentation.resolution.targetIds,[targetId]);

    const actingClient=new MockAdapter();
    const observingClient=new MockAdapter();
    for(const consumer of [actingClient,observingClient]){
      const consumerState=connectedStateFor(consumer);
      consumerState.mode="client";
      consumerState.sessionId=state.sessionId;
      const applied=applyConnectedResolutionPresentation(consumer,advantagePresentation.presentation);
      assert.notEqual(applied.status,"rejected");
    }
    const [acting,observing]=await Promise.all([actingClient.getSnapshot(),observingClient.getSnapshot()]);
    assert.deepEqual(acting.resolution,observing.resolution,"P1 and P2 must install the same advantage resolution state");
    assert.deepEqual(acting.resolutionPresentation,observing.resolutionPresentation,"P1 and P2 must install the same advantage presentation metadata");
    assert.deepEqual(acting.resolution?.authoritativeDice,[10,18]);
    assert.equal(acting.resolution?.attackTotal,25);

    const terminal=batches[0].events.find((event)=>event.payload.kind==="resolution");
    assert.ok(terminal&&terminal.actorId===p1.characterId,"MP-C06 terminal event must remain owned by P1");

    await host.stopSession();
    stopped=true;
  }finally{
    if(!stopped)await host.stopSession().catch(()=>undefined);
    transport.restore();
  }
});
