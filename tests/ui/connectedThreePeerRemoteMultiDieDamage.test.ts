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
  CONNECTED_CAPABILITIES,
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
const GREATSWORD_ID="dnd.srd521.item.weapon.greatsword";

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

async function createPlayerFixture(host:MockAdapter,characterId:string,name:string,revision:number,useGreatsword=false):Promise<PlayerFixture>{
  const snapshot=await host.getSnapshot();
  const fighter=snapshot.catalog.find((entry)=>entry.category==="class"&&/fighter/i.test(`${entry.id} ${entry.nameEn}`));
  const human=snapshot.catalog.find((entry)=>entry.category==="species"&&/human/i.test(`${entry.id} ${entry.nameEn}`));
  const soldier=snapshot.catalog.find((entry)=>entry.category==="background"&&/soldier/i.test(`${entry.id} ${entry.nameEn}`));
  assert.ok(fighter?.contentId&&human?.contentId&&soldier?.contentId,"MP-C07 fixture requires canonical Fighter/Human/Soldier identities");
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
  const longsword=sheet.items.find((item)=>item.definitionId==="dnd.srd521.item.weapon.longsword");
  assert.ok(longsword,"MP-C07 fixture requires the canonical starter longsword ItemInstance shell");
  const weapon=structuredClone(longsword);
  if(useGreatsword){
    weapon.definitionId=GREATSWORD_ID;
    weapon.name="대검";
    weapon.nameEn="Greatsword";
    weapon.passiveEffects=["2d6 참격"];
  }
  sheet.items=[weapon];
  sheet.equipment=[weapon.name];
  sheet.attacks=materializeCreatedWeaponAttacks(sheet);
  assert.equal(sheet.attacks.length,1,"MP-C07 fixture must materialize exactly one weapon attack");
  if(useGreatsword)assert.match(sheet.attacks[0].damage,/^2d6\b/,"MP-C07 owner source must materialize canonical 2d6 greatsword damage");
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

function prepareClient(adapter:MockAdapter,sessionId:string){
  const state=connectedStateFor(adapter);
  state.mode="client";
  state.sessionId=sessionId;
  state.replica=new ClientSessionReplica(sessionId);
}

test("MP-C07 core · remote P1 2d6 damage keeps die shape, group/type, flat arithmetic, total, and target HP identical for P1/P2",async()=>{
  const transport=installThreePeerHostTransport();
  const host=new MockAdapter();
  let stopped=false;
  try{
    await host.hostSession();
    const state=connectedStateFor(host);
    assert.ok(state.ledger&&state.sessionId,"Host session must establish one authoritative ledger");

    const p1=await createPlayerFixture(host,"char.mp-c07.p1","MP-C07 P1",1701,true);
    const p2=await createPlayerFixture(host,"char.mp-c07.p2","MP-C07 P2",1702);
    const p1Character=await connectPlayer(host,transport,"peer.mp-c07.p1","MP-C07 P1",p1);
    await connectPlayer(host,transport,"peer.mp-c07.p2","MP-C07 P2",p2);
    assert.equal(state.peerParticipants.size,2,"Host must retain P1 and P2 for multi-die spectator parity");

    const before=await host.getSnapshot();
    const attack=before.scene.actionsByActor[p1.characterId]?.find((action)=>action.resolutionKind==="attack"&&action.damage?.[0]?.dice==="2d6");
    assert.ok(attack,"Host must reconstruct P1 canonical 2d6 greatsword attack from the trusted projection");
    const damageSpec=attack.damage?.[0];
    assert.ok(damageSpec&&damageSpec.dice==="2d6","MP-C07 requires the authoritative 2d6 damage group");
    const targetId="combatant.goblin-a";
    const targetBefore=before.scene.entities.find((entity)=>entity.id===targetId);
    assert.ok(targetBefore,"MP-C07 target must exist before the remote attack");
    await host.setQueuedD20(18);
    const cursorBefore=state.ledger.cursor;
    const broadcastStart=transport.broadcastCount();

    transport.emitFrom("peer.mp-c07.p1",{
      type:"action-request",
      request:{
        sessionId:state.sessionId,
        requestId:"mp-c07.remote-multi-die-damage",
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
    assert.equal(completed.resolution?.attackOutcome,"명중");
    assert.equal(state.ledger.cursor,cursorBefore+1,"MP-C07 must commit exactly one Host ledger event");
    const targetAfter=completed.scene.entities.find((entity)=>entity.id===targetId);
    assert.ok(targetAfter,"MP-C07 target must remain in the Host Scene after damage");

    const messages=transport.broadcastsAfter(broadcastStart);
    const live=messages.filter((message):message is Extract<ConnectedWireMessage,{type:"resolution-presentation"}>=>message.type==="resolution-presentation");
    const batches=messages.filter((message):message is Extract<ConnectedWireMessage,{type:"event-batch"}>=>message.type==="event-batch");
    assert.equal(batches.length,1,"MP-C07 must publish exactly one terminal event batch");
    const damageAnimation=live.find((message)=>message.presentation.resolution.stage==="damage-animation");
    assert.ok(damageAnimation,"MP-C07 must publish a shared damage-animation presentation");
    assert.equal(damageAnimation.presentation.action?.damage?.length,1,"greatsword must retain one typed damage group");
    assert.deepEqual(damageAnimation.presentation.action?.damage?.[0],damageSpec,"shared action metadata must retain authoritative dice/type/flat fields");
    assert.equal(damageAnimation.presentation.resolution.authoritativeDice.length,2,"2d6 must expose exactly two authoritative damage faces");
    assert.deepEqual(damageAnimation.presentation.dice.faces,damageAnimation.presentation.resolution.authoritativeDice,"presentation dice must use the Host damage faces verbatim");

    const terminal=batches[0].events.find((event)=>event.payload.kind==="resolution");
    assert.ok(terminal&&terminal.actorId===p1.characterId,"MP-C07 terminal event must remain owned by P1");
    if(!terminal||terminal.payload.kind!=="resolution")throw new Error("missing MP-C07 terminal resolution event");
    const terminalDamage=terminal.payload.presentation.resolution.damageComponents[0];
    assert.ok(terminalDamage,"MP-C07 terminal presentation must retain one damage component");
    assert.equal(terminalDamage.type,damageSpec.type,"terminal damage type must match the authoritative action group");
    const rolledTotal=damageAnimation.presentation.dice.faces.reduce((sum,face)=>sum+face,0)+damageSpec.flat;
    assert.equal(terminalDamage.raw,rolledTotal,"damage component raw total must equal both authoritative dice plus the declared flat modifier");
    assert.equal(completed.resolution?.damageComponents[0]?.raw,terminalDamage.raw,"Host terminal damage total must match the committed presentation");
    assert.equal(completed.resolution?.damageComponents[0]?.adjusted,terminalDamage.adjusted,"Host adjusted damage must match the committed presentation");

    const actingClient=new MockAdapter();
    const observingClient=new MockAdapter();
    prepareClient(actingClient,state.sessionId);
    prepareClient(observingClient,state.sessionId);
    for(const message of live){
      const actingApplied=applyConnectedResolutionPresentation(actingClient,message.presentation);
      const observingApplied=applyConnectedResolutionPresentation(observingClient,message.presentation);
      assert.equal(actingApplied.status,observingApplied.status);
      assert.notEqual(actingApplied.status,"rejected");
    }
    const actingEvents=await applyConnectedClientEvents(actingClient,batches[0].events);
    const observingEvents=await applyConnectedClientEvents(observingClient,batches[0].events);
    assert.equal(actingEvents.status,"applied");
    assert.equal(observingEvents.status,"applied");
    assert.equal(advanceConnectedResolutionPresentation(actingClient).status,"applied");
    assert.equal(advanceConnectedResolutionPresentation(observingClient).status,"applied");
    const [acting,observing]=await Promise.all([actingClient.getSnapshot(),observingClient.getSnapshot()]);
    assert.deepEqual(acting.resolution,observing.resolution,"P1/P2 must converge on the same terminal multi-die resolution");
    assert.equal(acting.resolution?.damageComponents[0]?.raw,terminalDamage.raw);
    assert.equal(acting.resolution?.damageComponents[0]?.type,damageSpec.type);
    const actingTarget=acting.scene.entities.find((entity)=>entity.id===targetId);
    const observingTarget=observing.scene.entities.find((entity)=>entity.id===targetId);
    assert.ok(actingTarget&&observingTarget,"P1/P2 must retain the damaged target in their Scene projection");
    assert.deepEqual({hp:actingTarget.hp,tempHp:actingTarget.tempHp},{hp:targetAfter.hp,tempHp:targetAfter.tempHp},"P1 target HP must converge with Host");
    assert.deepEqual({hp:observingTarget.hp,tempHp:observingTarget.tempHp},{hp:targetAfter.hp,tempHp:targetAfter.tempHp},"P2 target HP must converge with Host");
    assert.notDeepEqual({hp:targetAfter.hp,tempHp:targetAfter.tempHp},{hp:targetBefore.hp,tempHp:targetBefore.tempHp},"MP-C07 must apply authoritative damage to the target");

    await host.stopSession();
    stopped=true;
  }finally{
    if(!stopped)await host.stopSession().catch(()=>undefined);
    transport.restore();
  }
});
