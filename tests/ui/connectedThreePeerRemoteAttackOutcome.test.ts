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
  assert.ok(fighter?.contentId&&human?.contentId&&soldier?.contentId,"remote attack outcome fixture requires canonical Fighter/Human/Soldier identities");
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
  assert.equal(sheet.items.length,1,"remote attack outcome fixture requires the canonical longsword item");
  sheet.equipment=sheet.items.map((item)=>item.name);
  sheet.attacks=materializeCreatedWeaponAttacks(sheet);
  assert.ok(sheet.attacks.some((attack)=>attack.name.includes("롱소드")||attack.name.toLowerCase().includes("longsword")),"remote attack outcome fixture requires a materialized longsword attack");
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

async function assertTwoRemoteConsumers(messages:ConnectedWireMessage[],actorId:string,targetId:string){
  const live=messages.filter((message):message is Extract<ConnectedWireMessage,{type:"resolution-presentation"}>=>message.type==="resolution-presentation");
  const batches=messages.filter((message):message is Extract<ConnectedWireMessage,{type:"event-batch"}>=>message.type==="event-batch");
  assert.ok(live.length>=2,"remote attack outcome must publish multiple live presentation stages before terminal commit");
  assert.equal(batches.length,1,"remote attack outcome must commit exactly one terminal event batch");
  assert.ok(live.every((message)=>message.presentation.actor.id===actorId));
  assert.ok(live.every((message)=>message.presentation.targets.some((target)=>target.id===targetId)));
  const terminal=batches[0].events.find((event)=>event.payload.kind==="resolution");
  assert.ok(terminal&&terminal.actorId===actorId,"terminal attack outcome event must belong to P1");
  if(!terminal||terminal.payload.kind!=="resolution")throw new Error("missing terminal attack outcome resolution event");
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
  return {live,terminal};
}

async function runRemoteAttackOutcomeCase(mode:"miss"|"critical"){
  const transport=installThreePeerHostTransport();
  const host=new MockAdapter();
  let stopped=false;
  try{
    await host.hostSession();
    const state=connectedStateFor(host);
    assert.ok(state.ledger&&state.sessionId,"Host session must establish one authoritative ledger");

    const p1=await createPlayerFixture(host,`char.mp-c.${mode}-p1`,`MP-C ${mode} P1`,mode==="miss"?1101:1201);
    const p2=await createPlayerFixture(host,`char.mp-c.${mode}-p2`,`MP-C ${mode} P2`,mode==="miss"?1102:1202);
    const p1Character=await connectPlayer(host,transport,`peer.mp-c.${mode}-p1`,`MP-C ${mode} P1`,p1);
    await connectPlayer(host,transport,`peer.mp-c.${mode}-p2`,`MP-C ${mode} P2`,p2);
    assert.equal(state.peerParticipants.size,2,"Host must retain both remote peers for attack outcome spectator fan-out");

    const before=await host.getSnapshot();
    const attack=before.scene.actionsByActor[p1.characterId]?.find((action)=>action.resolutionKind==="attack"&&(action.name.includes("롱소드")||action.name.toLowerCase().includes("longsword")));
    assert.ok(attack,"Host projection must expose P1 canonical longsword attack");
    const targetId="combatant.goblin-a";
    const targetBefore=before.scene.entities.find((entity)=>entity.id===targetId);
    assert.ok(targetBefore,"MP-C04/C05 target must exist before the remote attack");
    const durabilityBefore=targetBefore.hp+targetBefore.tempHp;
    const authoritativeD20=mode==="miss"?1:20;
    await host.setQueuedD20(authoritativeD20);
    const cursorBefore=state.ledger.cursor;
    const broadcastStart=transport.broadcastCount();

    transport.emitFrom(`peer.mp-c.${mode}-p1`,{
      type:"action-request",
      request:{
        sessionId:state.sessionId,
        requestId:mode==="miss"?"mp-c04.remote-miss":"mp-c05.remote-critical",
        actorId:p1.characterId,
        actionId:attack.id,
        targetIds:[targetId],
        knownEventCursor:cursorBefore,
        character:p1Character!,
        capabilities:[...CONNECTED_CAPABILITIES],
      },
    });

    const completed=await finishResolution(host,p1.characterId);
    assert.equal(completed.resolution?.stage,"complete");
    assert.equal(completed.resolution?.actionId,attack.id);
    assert.equal(completed.resolution?.naturalD20,authoritativeD20);
    assert.equal(state.ledger.cursor,cursorBefore+1,"remote attack outcome must commit exactly one Host ledger event");
    const targetAfter=completed.scene.entities.find((entity)=>entity.id===targetId);
    assert.ok(targetAfter,"target must remain in the Host Scene after the remote attack outcome");
    const durabilityAfter=targetAfter.hp+targetAfter.tempHp;
    const {live,terminal}=await assertTwoRemoteConsumers(transport.broadcastsAfter(broadcastStart),p1.characterId,targetId);

    if(mode==="miss"){
      assert.equal(completed.resolution?.critical,false);
      assert.equal(completed.resolution?.attackOutcome,"빗나감");
      assert.equal(durabilityAfter,durabilityBefore,"MP-C04 miss must not apply any target damage");
      assert.equal(completed.resolution?.damageComponents.length,0,"MP-C04 miss must not materialize damage components");
      assert.ok(live.some((message)=>message.presentation.resolution.stage==="attack-result"&&message.presentation.resolution.attackOutcome==="빗나감"),"P1/P2 must receive the shared miss result presentation");
      assert.equal(live.some((message)=>message.presentation.resolution.stage==="damage-animation"),false,"MP-C04 miss must not publish a false damage animation");
      assert.equal(terminal.payload.presentation.resolution.attackOutcome,"빗나감");
      assert.equal(terminal.payload.presentation.resolution.damageComponents.length,0);
    }else{
      assert.equal(completed.resolution?.critical,true);
      assert.equal(completed.resolution?.attackOutcome,"명중");
      assert.ok(durabilityAfter<durabilityBefore,"MP-C05 critical must apply Host-authoritative damage");
      assert.ok(completed.resolution?.damageComponents.length,"MP-C05 critical must retain terminal damage semantics");
      const criticalResult=live.find((message)=>message.presentation.resolution.stage==="attack-result"&&message.presentation.resolution.critical===true);
      assert.ok(criticalResult,"P1/P2 must receive the shared critical result tier");
      assert.equal(criticalResult.presentation.resolution.naturalD20,20);
      const damageAnimation=live.find((message)=>message.presentation.resolution.stage==="damage-animation");
      assert.ok(damageAnimation,"MP-C05 critical must publish a shared damage animation");
      assert.equal(damageAnimation.presentation.resolution.critical,true);
      assert.equal(damageAnimation.presentation.resolution.authoritativeDice.length,2,"critical damage presentation must expose the doubled damage-die shape");
      assert.equal(terminal.payload.presentation.resolution.critical,true);
      assert.equal(terminal.payload.presentation.resolution.naturalD20,20);
      assert.ok(terminal.payload.presentation.resolution.damageComponents.length);
    }

    await host.stopSession();
    stopped=true;
  }finally{
    if(!stopped)await host.stopSession().catch(()=>undefined);
    transport.restore();
  }
}

test("MP-C04 core · remote P1 attack miss applies no damage and P1/P2 share the same miss presentation",async()=>{
  await runRemoteAttackOutcomeCase("miss");
});

test("MP-C05 core · remote P1 critical preserves the selected natural 20 tier and critical damage-die presentation for P2",async()=>{
  await runRemoteAttackOutcomeCase("critical");
});
