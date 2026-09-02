import assert from "node:assert/strict";
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

async function createFighterFixture(host:MockAdapter,characterId:string,name:string,revision:number):Promise<PlayerFixture>{
  const snapshot=await host.getSnapshot();
  const fighter=snapshot.catalog.find((entry)=>entry.category==="class"&&/fighter/i.test(`${entry.id} ${entry.nameEn}`));
  const human=snapshot.catalog.find((entry)=>entry.category==="species"&&/human/i.test(`${entry.id} ${entry.nameEn}`));
  const soldier=snapshot.catalog.find((entry)=>entry.category==="background"&&/soldier/i.test(`${entry.id} ${entry.nameEn}`));
  assert.ok(fighter?.contentId&&human?.contentId&&soldier?.contentId,"remote feature fixture requires canonical Fighter/Human/Soldier identities");
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
  assert.equal(sheet.items.length,1,"remote feature fixture requires the canonical longsword item");
  sheet.equipment=sheet.items.map((item)=>item.name);
  sheet.attacks=materializeCreatedWeaponAttacks(sheet);
  assert.ok(sheet.attacks.some((attack)=>attack.name.includes("롱소드")||attack.name.toLowerCase().includes("longsword")),"remote feature fixture requires a materialized longsword attack");
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

async function assertTwoRemoteHealingConsumers(messages:ConnectedWireMessage[],actorId:string,actionId:string){
  const live=messages.filter((message):message is Extract<ConnectedWireMessage,{type:"resolution-presentation"}>=>message.type==="resolution-presentation");
  const batches=messages.filter((message):message is Extract<ConnectedWireMessage,{type:"event-batch"}>=>message.type==="event-batch");
  assert.ok(live.length>=1,"remote Second Wind must publish a live presentation before terminal commit");
  assert.equal(batches.length,1,"remote Second Wind must commit exactly one terminal event batch");
  assert.ok(live.every((message)=>message.presentation.actor.id===actorId));
  assert.ok(live.every((message)=>message.presentation.targets.some((target)=>target.id===actorId)),"self healing must retain P1 as its public target");
  assert.ok(live.some((message)=>message.presentation.resolution.actionId===actionId&&message.presentation.resolution.authoritativeDice.length>0),"live healing presentation must carry Host-authoritative healing dice");

  const terminal=batches[0].events.find((event)=>event.payload.kind==="resolution");
  assert.ok(terminal&&terminal.actorId===actorId,"terminal Second Wind event must belong to P1");
  if(!terminal||terminal.payload.kind!=="resolution")throw new Error("missing terminal Second Wind resolution event");
  assert.equal(terminal.payload.presentation.resolution.actionId,actionId);
  assert.ok(terminal.payload.presentation.targets.some((target)=>target.id===actorId));
  const resourceChanges=terminal.payload.resolutionEvents.flatMap((event)=>event.stateChanges).filter((change)=>change.kind==="resource"&&change.targetId===actorId);
  assert.equal(resourceChanges.length,1,"Second Wind must debit exactly one P1 resource state change");

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
}

export async function runRemoteSecondWindCase(){
  const transport=installThreePeerHostTransport();
  const host=new MockAdapter();
  let stopped=false;
  try{
    await host.hostSession();
    const state=connectedStateFor(host);
    assert.ok(state.ledger&&state.sessionId,"Host session must establish one authoritative ledger");

    const p1=await createFighterFixture(host,"char.mp-c.feature-p1","MP-C Feature P1",909);
    const p2=await createFighterFixture(host,"char.mp-c.feature-p2","MP-C Feature P2",1001);
    const p1Character=await connectPlayer(host,transport,"peer.mp-c.feature-p1","MP-C Feature P1",p1);
    await connectPlayer(host,transport,"peer.mp-c.feature-p2","MP-C Feature P2",p2);
    assert.equal(state.peerParticipants.size,2,"Host must retain P1 and P2 for feature/resource spectator fan-out");

    const before=await host.getSnapshot();
    const secondWind=before.scene.actionsByActor[p1.characterId]?.find((action)=>action.id==="action.second-wind");
    assert.ok(secondWind,"Host projection must expose P1 Second Wind");
    assert.equal(secondWind.resolutionKind,"healing");
    assert.equal(secondWind.target,"self");
    assert.equal(secondWind.available,true);
    assert.ok(secondWind.resourceCost,"Second Wind must declare one feature resource cost");
    const actorBefore=before.scene.entities.find((entity)=>entity.id===p1.characterId);
    assert.ok(actorBefore,"P1 Scene entity must exist before Second Wind");
    assert.ok(actorBefore.hp<actorBefore.maxHp,"P1 fixture must begin damaged so healing is observable");
    const mountedBefore=projectedCharacterById(host,p1.characterId);
    const resourceBefore=mountedBefore?.sheet.resources.find((resource)=>resource.id===secondWind.resourceCost!.resourceId);
    assert.ok(resourceBefore&&resourceBefore.current>0,"P1 mounted sheet must expose an available Second Wind resource");

    const actionCursor=state.ledger.cursor;
    const broadcastStart=transport.broadcastCount();
    transport.emitFrom("peer.mp-c.feature-p1",{
      type:"action-request",
      request:{
        sessionId:state.sessionId,
        requestId:"mp-c17-c19.remote-second-wind",
        actorId:p1.characterId,
        actionId:secondWind.id,
        targetIds:[p1.characterId],
        knownEventCursor:actionCursor,
        character:p1Character!,
        capabilities:[...CONNECTED_CAPABILITIES],
      },
    });

    const completed=await finishResolution(host,p1.characterId);
    assert.equal(completed.resolution?.stage,"complete");
    assert.equal(completed.resolution?.actionId,secondWind.id);
    assert.equal(completed.resolution?.rollKind,"healing");
    assert.ok(completed.resolution?.authoritativeDice.length,"Second Wind terminal resolution must retain its authoritative healing die");
    const actorAfter=completed.scene.entities.find((entity)=>entity.id===p1.characterId);
    assert.ok(actorAfter,"P1 Scene entity must remain after Second Wind");
    assert.ok(actorAfter.hp>actorBefore.hp,"Host-authoritative Second Wind must increase P1 HP");
    assert.ok(actorAfter.hp<=actorAfter.maxHp,"Second Wind healing must respect the HP cap");
    const mountedAfter=projectedCharacterById(host,p1.characterId);
    const resourceAfter=mountedAfter?.sheet.resources.find((resource)=>resource.id===secondWind.resourceCost!.resourceId);
    assert.ok(resourceAfter,"P1 mounted sheet must retain the Second Wind resource after use");
    assert.equal(resourceAfter.current,resourceBefore.current-secondWind.resourceCost.amount,"Second Wind must debit the owner resource exactly once");
    assert.equal(state.ledger.cursor,actionCursor+1,"remote Second Wind must commit exactly one Host ledger event");

    await assertTwoRemoteHealingConsumers(transport.broadcastsAfter(broadcastStart),p1.characterId,secondWind.id);

    await host.stopSession();
    stopped=true;
  }finally{
    if(!stopped)await host.stopSession().catch(()=>undefined);
    transport.restore();
  }
}
