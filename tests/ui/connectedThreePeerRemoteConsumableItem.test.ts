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
const POTION_OF_HEALING_ID="dnd.srd521.item.gear.potion-of-healing";

type PlayerFixture={
  characterId:string;
  sourceRevision:number;
  runtimeRevision:number;
  projection:ReturnType<typeof buildCharacterSessionProjectionV1>;
  itemId?:string;
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

async function createPlayerFixture(host:MockAdapter,characterId:string,name:string,revision:number,withPotion=false):Promise<PlayerFixture>{
  const snapshot=await host.getSnapshot();
  const fighter=snapshot.catalog.find((entry)=>entry.category==="class"&&/fighter/i.test(`${entry.id} ${entry.nameEn}`));
  const human=snapshot.catalog.find((entry)=>entry.category==="species"&&/human/i.test(`${entry.id} ${entry.nameEn}`));
  const soldier=snapshot.catalog.find((entry)=>entry.category==="background"&&/soldier/i.test(`${entry.id} ${entry.nameEn}`));
  assert.ok(fighter?.contentId&&human?.contentId&&soldier?.contentId,"MP-C18 fixture requires canonical Fighter/Human/Soldier identities");
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

  let itemId:string|undefined;
  if(withPotion){
    assert.ok(snapshot.catalog.some((entry)=>entry.category==="item"&&entry.contentId===POTION_OF_HEALING_ID),"MP-C18 requires the canonical Potion of Healing catalog identity");
    const shell=sheet.items.find((item)=>/potion of healing/i.test(item.nameEn??item.name));
    assert.ok(shell,"MP-C18 fixture requires a persisted consumable ItemInstance shell");
    const potion=structuredClone(shell);
    itemId=`item.mp-c18.potion.${characterId}`;
    potion.id=itemId;
    potion.definitionId=POTION_OF_HEALING_ID;
    potion.quantity=2;
    potion.equipped=false;
    potion.grantedActionIds=[];
    sheet.items=[potion];
    sheet.equipment=[`${potion.name} ×2`];
    sheet.attacks=[];
  }else{
    sheet.items=sheet.items.filter((item)=>item.definitionId==="dnd.srd521.item.weapon.longsword");
    assert.equal(sheet.items.length,1,"MP-C18 observer fixture requires the canonical longsword item");
    sheet.equipment=sheet.items.map((item)=>item.name);
    sheet.attacks=materializeCreatedWeaponAttacks(sheet);
  }
  return {characterId,sourceRevision:revision,runtimeRevision:revision,projection:buildCharacterSessionProjectionV1(sheet,snapshot.catalog),itemId};
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

test("MP-C18 core · remote P1 healing potion debits one owner quantity and fans out the same public healing resolution to P2",async()=>{
  const transport=installThreePeerHostTransport();
  const host=new MockAdapter();
  let stopped=false;
  try{
    await host.hostSession();
    const state=connectedStateFor(host);
    assert.ok(state.ledger&&state.sessionId,"Host session must establish one authoritative ledger");

    const p1=await createPlayerFixture(host,"char.mp-c18.p1","MP-C18 P1",1801,true);
    const p2=await createPlayerFixture(host,"char.mp-c18.p2","MP-C18 P2",1802);
    assert.ok(p1.itemId,"MP-C18 P1 fixture must expose its persisted potion ItemInstance id");
    const p1Character=await connectPlayer(host,transport,"peer.mp-c18.p1","MP-C18 P1",p1);
    await connectPlayer(host,transport,"peer.mp-c18.p2","MP-C18 P2",p2);
    assert.equal(state.peerParticipants.size,2,"Host must retain P1 and P2 for consumable spectator fan-out");

    const before=await host.getSnapshot();
    const potionAction=before.scene.actionsByActor[p1.characterId]?.find((action)=>action.resolutionKind==="healing"&&action.itemCost?.itemId===p1.itemId);
    assert.ok(potionAction,"Host must reconstruct a canonical healing action from P1 Potion of Healing ItemInstance");
    assert.equal(potionAction.target,"self");
    assert.equal(potionAction.healing?.dice,"2d4");
    assert.equal(potionAction.healing?.flat,2);
    assert.equal(potionAction.itemCost?.quantity,1);
    const actorBefore=before.scene.entities.find((entity)=>entity.id===p1.characterId);
    assert.ok(actorBefore&&actorBefore.hp<actorBefore.maxHp,"MP-C18 P1 must begin damaged so healing is observable");
    const itemBefore=projectedCharacterById(host,p1.characterId)?.sheet.items.find((item)=>item.id===p1.itemId);
    assert.equal(itemBefore?.quantity,2,"MP-C18 owner must begin with exactly two potions");

    const cursorBefore=state.ledger.cursor;
    const broadcastStart=transport.broadcastCount();
    transport.emitFrom("peer.mp-c18.p1",{
      type:"action-request",
      request:{
        sessionId:state.sessionId,
        requestId:"mp-c18.remote-healing-potion",
        actorId:p1.characterId,
        actionId:potionAction.id,
        targetIds:[p1.characterId],
        knownEventCursor:cursorBefore,
        character:p1Character!,
        capabilities:[...CONNECTED_CAPABILITIES],
      },
    });

    const completed=await finishResolution(host,p1.characterId);
    assert.equal(completed.resolution?.stage,"complete");
    assert.equal(completed.resolution?.actionId,potionAction.id);
    assert.equal(completed.resolution?.rollKind,"healing");
    assert.equal(completed.resolution?.authoritativeDice.length,2,"2d4 healing must retain exactly two Host-authoritative faces");
    const actorAfter=completed.scene.entities.find((entity)=>entity.id===p1.characterId);
    assert.ok(actorAfter&&actorAfter.hp>actorBefore.hp,"Host-authoritative potion use must heal P1");
    assert.ok(actorAfter.hp<=actorAfter.maxHp,"potion healing must respect the HP cap");
    const itemAfter=projectedCharacterById(host,p1.characterId)?.sheet.items.find((item)=>item.id===p1.itemId);
    assert.equal(itemAfter?.quantity,1,"MP-C18 must debit exactly one owner potion quantity");
    assert.equal(state.ledger.cursor,cursorBefore+1,"MP-C18 must commit exactly one Host ledger event");

    const messages=transport.broadcastsAfter(broadcastStart);
    const live=messages.filter((message):message is Extract<ConnectedWireMessage,{type:"resolution-presentation"}>=>message.type==="resolution-presentation");
    const batches=messages.filter((message):message is Extract<ConnectedWireMessage,{type:"event-batch"}>=>message.type==="event-batch");
    assert.ok(live.length>=1,"MP-C18 must publish live healing presentation before terminal commit");
    assert.equal(batches.length,1,"MP-C18 must publish exactly one terminal event batch");
    assert.ok(live.every((message)=>message.presentation.actor.id===p1.characterId));
    assert.ok(live.every((message)=>message.presentation.targets.some((target)=>target.id===p1.characterId)),"public potion presentation must retain P1 as self target");
    assert.ok(live.some((message)=>message.presentation.resolution.actionId===potionAction.id&&message.presentation.resolution.authoritativeDice.length===2),"public potion presentation must carry the same Host 2d4 healing faces");
    const terminal=batches[0].events.find((event)=>event.payload.kind==="resolution");
    assert.ok(terminal&&terminal.actorId===p1.characterId,"terminal potion event must remain owned by P1");
    if(!terminal||terminal.payload.kind!=="resolution")throw new Error("missing MP-C18 terminal resolution event");
    assert.equal(terminal.payload.presentation.resolution.actionId,potionAction.id);
    assert.deepEqual(terminal.payload.presentation.resolution.authoritativeDice,completed.resolution?.authoritativeDice,"terminal public resolution must retain the Host-authoritative healing faces");

    const actingClient=new MockAdapter();
    const observingClient=new MockAdapter();
    for(const consumer of [actingClient,observingClient]){
      const clientState=connectedStateFor(consumer);
      clientState.mode="client";
      clientState.sessionId=state.sessionId;
    }
    for(const message of live){
      const actingApplied=applyConnectedResolutionPresentation(actingClient,message.presentation);
      const observingApplied=applyConnectedResolutionPresentation(observingClient,message.presentation);
      assert.equal(actingApplied.status,observingApplied.status);
      assert.notEqual(actingApplied.status,"rejected");
      const [acting,observing]=await Promise.all([actingClient.getSnapshot(),observingClient.getSnapshot()]);
      assert.deepEqual(acting.resolution,observing.resolution,"P1/P2 must expose the same public potion resolution");
      assert.deepEqual(acting.resolutionPresentation,observing.resolutionPresentation,"P1/P2 must expose the same public potion presentation");
    }

    await host.stopSession();
    stopped=true;
  }finally{
    if(!stopped)await host.stopSession().catch(()=>undefined);
    transport.restore();
  }
});