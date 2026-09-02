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
    if(snapshot.resolution?.rollKind==="check"&&snapshot.resolution.stage==="effect-preview"&&snapshot.resolution.checkTarget===undefined){
      await host.applyDmAdjudication({type:"ability-check-dc",value:15,scope:"resolution"});
      continue;
    }
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
    assert.ok(acting.resolution&&observing.resolution,"both remote consumers must retain a public live presentation");
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
  assert.deepEqual(observingStages,actingStages,"acting peer and P2 spectator must consume the same ordered public live presentation");
}

async function assertTwoRemoteNoTargetCheckConsumers(messages:ConnectedWireMessage[],actorId:string,actionId:string,d20:number){
  const live=messages.filter((message):message is Extract<ConnectedWireMessage,{type:"resolution-presentation"}>=>message.type==="resolution-presentation");
  const batches=messages.filter((message):message is Extract<ConnectedWireMessage,{type:"event-batch"}>=>message.type==="event-batch");
  assert.ok(live.length>=1,"remote ability check must publish a live presentation before terminal commit");
  assert.equal(batches.length,1,"remote ability check must commit exactly one event batch");
  assert.ok(live.every((message)=>message.presentation.actor.id===actorId));
  assert.ok(live.every((message)=>message.presentation.targets.length===0),"no-target ability check must not invent a phantom target");
  assert.ok(live.some((message)=>message.presentation.resolution.actionId===actionId&&message.presentation.resolution.authoritativeDice.includes(d20)),"live presentation must carry the Host-authoritative check die");
  const terminal=batches[0].events.find((event)=>event.payload.kind==="resolution");
  assert.ok(terminal&&terminal.actorId===actorId,"terminal ability-check event must belong to P1");
  if(!terminal||terminal.payload.kind!=="resolution")throw new Error("missing terminal ability-check resolution event");
  assert.equal(terminal.payload.presentation.actor.id,actorId);
  assert.equal(terminal.payload.presentation.targets.length,0);
  assert.equal(terminal.payload.presentation.resolution.actionId,actionId);
  assert.ok(terminal.payload.presentation.resolution.authoritativeDice.includes(d20));

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

async function runFreshRemoteAttackCase(kind:"npc"|"p2"){
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

    const beforeSnapshot=await host.getSnapshot();
    const p1Attack=beforeSnapshot.scene.actionsByActor[p1.characterId]?.find((action)=>action.resolutionKind==="attack"&&(action.name.includes("롱소드")||action.name.toLowerCase().includes("longsword")));
    assert.ok(p1Attack,"Host projection must expose P1 canonical longsword attack");
    assert.ok(beforeSnapshot.scene.entities.some((entity)=>entity.id===p2.characterId),"P2 projection must exist as a legal remote target");

    const targetId=kind==="npc"?"combatant.goblin-a":p2.characterId;
    const targetBefore=beforeSnapshot.scene.entities.find((entity)=>entity.id===targetId);
    assert.ok(targetBefore,`target ${targetId} must exist before the remote attack`);
    const durabilityBefore=targetBefore.hp+targetBefore.tempHp;
    await host.setQueuedD20(19);
    const broadcastStart=transport.broadcastCount();
    transport.emitFrom("peer.mp-c.p1",{
      type:"action-request",
      request:{
        sessionId:state.sessionId,
        requestId:kind==="npc"?"mp-c01.remote-attack":"mp-c03.remote-target-owner",
        actorId:p1.characterId,
        actionId:p1Attack.id,
        targetIds:[targetId],
        knownEventCursor:state.ledger.cursor,
        character:p1Character!,
        capabilities:[...CONNECTED_CAPABILITIES],
      },
    });
    const completed=await finishResolution(host,p1.characterId);
    assert.equal(completed.resolution?.stage,"complete");
    const messages=transport.broadcastsAfter(broadcastStart);
    await assertTwoRemotePresentationConsumers(messages,p1.characterId,targetId);
    const targetAfter=completed.scene.entities.find((entity)=>entity.id===targetId);
    assert.ok(targetAfter,`target ${targetId} must remain in the Host Scene after the remote attack`);
    const durabilityAfter=targetAfter.hp+targetAfter.tempHp;
    assert.ok(
      durabilityAfter<durabilityBefore,
      kind==="npc"
        ?"MP-C01 Host-authoritative remote attack must damage the NPC exactly through the canonical resolution"
        :"MP-C03 Host-authoritative remote attack must damage the mounted P2 Character without substituting local ownership",
    );

    await host.stopSession();
    stopped=true;
  }finally{
    if(!stopped)await host.stopSession().catch(()=>undefined);
    transport.restore();
  }
}

test("MP-C01/C03 core · remote P1 attacks resolve once on Host and fan out the same live presentation to P2",async()=>{
  await runFreshRemoteAttackCase("npc");
  await runFreshRemoteAttackCase("p2");
});

test("MP-C08/C11 core · remote P1 no-target ability check resolves once on Host and fans out the same die to P2",async()=>{
  const transport=installThreePeerHostTransport();
  const host=new MockAdapter();
  let stopped=false;
  try{
    await host.hostSession();
    const state=connectedStateFor(host);
    assert.ok(state.ledger&&state.sessionId,"Host session must establish one authoritative ledger");

    const p1=await createPlayerFixture(host,"char.mp-c.check-p1","MP-C Check P1",303);
    const p2=await createPlayerFixture(host,"char.mp-c.check-p2","MP-C Check P2",404);
    const p1Character=await connectPlayer(host,transport,"peer.mp-c.check-p1","MP-C Check P1",p1);
    await connectPlayer(host,transport,"peer.mp-c.check-p2","MP-C Check P2",p2);
    assert.equal(state.peerParticipants.size,2,"Host must retain P1 and P2 for the shared check fan-out");

    const beforeSnapshot=await host.getSnapshot();
    const checkAction=beforeSnapshot.scene.actionsByActor[p1.characterId]?.find((action)=>action.id==="action.skill.athletics"&&action.resolutionKind==="ability-check");
    assert.ok(checkAction,"Host projection must expose P1 Athletics as a no-target production ability check");
    assert.equal(checkAction.target,"none");

    const authoritativeD20=14;
    await host.setQueuedD20(authoritativeD20);
    const broadcastStart=transport.broadcastCount();
    transport.emitFrom("peer.mp-c.check-p1",{
      type:"action-request",
      request:{
        sessionId:state.sessionId,
        requestId:"mp-c08.remote-no-target-check",
        actorId:p1.characterId,
        actionId:checkAction.id,
        targetIds:[],
        knownEventCursor:state.ledger.cursor,
        character:p1Character!,
        capabilities:[...CONNECTED_CAPABILITIES],
      },
    });

    const completed=await finishResolution(host,p1.characterId);
    assert.equal(completed.resolution?.stage,"complete");
    assert.equal(completed.resolution?.actionId,checkAction.id);
    assert.deepEqual(completed.resolution?.targetIds,[]);
    assert.equal(completed.resolution?.naturalD20,authoritativeD20);
    await assertTwoRemoteNoTargetCheckConsumers(
      transport.broadcastsAfter(broadcastStart),
      p1.characterId,
      checkAction.id,
      authoritativeD20,
    );

    await host.stopSession();
    stopped=true;
  }finally{
    if(!stopped)await host.stopSession().catch(()=>undefined);
    transport.restore();
  }
});
