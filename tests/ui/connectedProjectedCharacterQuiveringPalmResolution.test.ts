import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import "../../src/app/progressionContracts";
import type { CatalogEntry, CharacterSheet, CharacterSummary, SceneVm } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import { OPEN_HAND_QUIVERING_PALM_DETONATE_ACTION_ID } from "../../src/app/monkOpenHandQuiveringPalmRuntimeAdapter";
import { buildCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { reconstructCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjectionReconstruction";
import { acceptHostCharacterSessionProjection } from "../../src/app/connectedCharacterProjectionHandshake";
import { projectedCharacterById } from "../../src/app/characterSessionProjectionRegistry";
import { applyConnectedClientEvents, connectedManifest, CONNECTED_CAPABILITIES } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { ClientSessionReplica, HostSessionLedger, type ConnectedActionRequest, type ConnectedSessionEvent, type SessionCompatibilityManifest } from "../../src/app/connectedSessionProtocol";
import { routeConnectedActionRequest } from "../../src/app/connectedActionRequestPort";
import { routeConnectedInterruptResponse } from "../../src/app/connectedInterruptResponsePort";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { getCharacterLibraryPersistenceStateForTests, setCharacterLibraryStoreForTests } from "../../src/app/characterLibraryRuntimeAdapter";
import { snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";
import { MONK_FOCUS_RESOURCE_ID, MONK_OPEN_HAND_CLASS_ID, OPEN_HAND_QUIVERING_PALM_TAG } from "../../src/domain/monkOpenHand";
import { MONK_OPEN_HAND_SUBCLASS_ID } from "../../src/domain/srdSubclassCatalog";

const PEER="peer.r2.remote-quivering-palm";
const RECONNECT_PEER="peer.r2.remote-quivering-palm.reconnect";
const CHARACTER_ID="char.r2.remote-quivering-palm";
const TARGET_A="combatant.goblin-a";
const TARGET_B="combatant.goblin-b";
const UNARMED_DAMAGE_ACTION_ID="action.unarmed-strike.damage";
type ResolvedCatalogEntry=CatalogEntry & {contentId?:string};
type MutableAdapterState={activeCharacter:CharacterSheet;characters:CharacterSummary[];scene:SceneVm};

function entry(catalog:CatalogEntry[],contentId:string) {
  const found=(catalog as ResolvedCatalogEntry[]).find((item)=>item.contentId===contentId);
  assert.ok(found,`production catalog must contain ${contentId}`);
  return found;
}

function remoteMonk(catalog:CatalogEntry[]):CharacterSheet {
  const monk=entry(catalog,MONK_OPEN_HAND_CLASS_ID);
  const openHand=entry(catalog,MONK_OPEN_HAND_SUBCLASS_ID);
  const human=entry(catalog,"dnd.srd521.species.human");
  const soldier=entry(catalog,"dnd.srd521.background.soldier");
  return {
    id:CHARACTER_ID,name:"Remote Open Hand Monk",className:monk.nameKo||monk.nameEn,subclassName:openHand.nameKo||openHand.nameEn,level:17,
    species:human.nameKo||human.nameEn,background:soldier.nameKo||soldier.nameEn,hp:100,maxHp:100,tempHp:0,ac:18,speed:60,proficiencyBonus:6,saveState:"saved",
    abilities:{str:18,dex:20,con:16,int:10,wis:18,cha:8},saves:[],skills:[],features:["진동장"],equipment:[],items:[],attacks:[],
    resources:[{id:MONK_FOCUS_RESOURCE_ID,label:"기 점수",current:17,max:17,source:"Monk 17",recovery:{shortRest:"all",longRest:"all"}}],
    rulesProfileId:"dnd.srd-5.2.1",rulesProfileVersion:"0.1-draft",sourceRevision:2,runtimeRevision:3,
    classLevels:[{classId:MONK_OPEN_HAND_CLASS_ID,className:monk.nameKo||monk.nameEn,level:17,subclassName:openHand.nameKo||openHand.nameEn}],subclassIds:{[MONK_OPEN_HAND_CLASS_ID]:MONK_OPEN_HAND_SUBCLASS_ID},
  };
}

function manifest(sheet:CharacterSheet):SessionCompatibilityManifest {
  return {protocolVersion:1,rulesProfileId:"dnd.srd-5.2.1",capabilities:[...CONNECTED_CAPABILITIES],character:{characterId:sheet.id,sourceRevision:sheet.sourceRevision??0,runtimeRevision:sheet.runtimeRevision??0}};
}

function prepareOwningClient(client:MockAdapter,sheet:CharacterSheet,projection:ReturnType<typeof buildCharacterSessionProjectionV1>,catalog:CatalogEntry[]) {
  const reconstructed=reconstructCharacterSessionProjectionV1(projection,catalog);
  assert.equal(reconstructed.status,"accepted",reconstructed.status==="rejected"?reconstructed.error:undefined);
  if(reconstructed.status!=="accepted")throw new Error(reconstructed.error);
  const state=client as unknown as MutableAdapterState;
  state.activeCharacter=structuredClone(sheet);state.characters=[structuredClone(sheet)];
  state.scene.entities=[...state.scene.entities.filter((entity)=>entity.id!==sheet.id&&entity.kind!=="character"),structuredClone(reconstructed.entity)];
  state.scene.actionsByActor={...state.scene.actionsByActor,[sheet.id]:structuredClone(reconstructed.actions)};
  state.scene.economyByActor={...state.scene.economyByActor,[sheet.id]:structuredClone(reconstructed.economy)};
  state.scene.selectedActorId=sheet.id;state.scene.currentActorId=sheet.id;
}

function focus(sheet:CharacterSheet) {
  return sheet.resources.find((resource)=>resource.id===MONK_FOCUS_RESOURCE_ID)?.current;
}

function markers(adapter:MockAdapter,actorId:string) {
  const scene=(adapter as unknown as {scene:SceneVm}).scene;
  return snapshotAdapterTurnRuntimeState(adapter,scene)?.effects.filter((effect)=>effect.sourceActorId===actorId&&effect.tags.includes(OPEN_HAND_QUIVERING_PALM_TAG)).map((effect)=>effect.targetId)??[];
}

function hp(scene:SceneVm,targetId:string) {
  return scene.entities.find((entity)=>entity.id===targetId)?.hp??0;
}

function request(sessionId:string,requestId:string,remoteManifest:SessionCompatibilityManifest,actionId:string,targetId:string,cursor:number):ConnectedActionRequest {
  return {sessionId,requestId,actorId:CHARACTER_ID,actionId,targetIds:[targetId],knownEventCursor:cursor,character:remoteManifest.character,capabilities:[...CONNECTED_CAPABILITIES]};
}

function batches(messages:string[]) {
  return messages.map((message)=>JSON.parse(message) as {type:string;events?:ConnectedSessionEvent[]}).filter((message)=>message.type==="event-batch");
}

async function seed(host:MockAdapter,peer:string,sessionId:string,remoteManifest:SessionCompatibilityManifest,targetId:string,requestId:string,cursor:number) {
  await host.setQueuedD20(20);
  const routed=await routeConnectedActionRequest(host,{peer,message:""},request(sessionId,requestId,remoteManifest,UNARMED_DAMAGE_ACTION_ID,targetId,cursor));
  assert.equal(routed,true);
  let snapshot=await host.getSnapshot();
  for(let step=0;step<8&&snapshot.resolution?.stage!=="interrupt";step++)snapshot=await host.advanceResolution();
  assert.equal(snapshot.resolution?.stage,"interrupt");
  assert.equal(snapshot.resolution?.interrupt?.optionName,"진동장 주입");
  const resolutionId=snapshot.resolution!.id,promptId=snapshot.resolution!.interrupt!.id;
  assert.equal(await routeConnectedInterruptResponse(host,{peer,message:""},{sessionId,resolutionId,promptId,accept:true}),true);
  snapshot=await host.getSnapshot();
  for(let step=0;step<8&&snapshot.resolution?.id===resolutionId;step++)snapshot=await host.advanceResolution();
}

test("host-unknown Open Hand Quivering Palm seed/detonation converges exactly once across reconnect and Undo",async()=>{
  const host=new MockAdapter();
  await host.setReferenceRole("dm");
  await host.setSessionMode("freeform");
  const hostInternal=host as unknown as MutableAdapterState;
  for(const targetId of [TARGET_A,TARGET_B]){
    const target=hostInternal.scene.entities.find((entity)=>entity.id===targetId);
    if(target){target.hp=200;target.maxHp=200;target.tempHp=0;target.ac=1;target.distance="5피트";}
  }
  const before=await host.getSnapshot();
  const catalog=structuredClone(before.catalog);
  const remote=remoteMonk(catalog);
  const remoteManifest=manifest(remote);
  const projection=buildCharacterSessionProjectionV1(remote,catalog);
  const accepted=acceptHostCharacterSessionProjection(host,PEER,remoteManifest,projection);
  assert.equal(accepted.status,"accepted",accepted.status==="rejected"?accepted.error:undefined);

  const state=connectedStateFor(host);
  state.mode="host";state.sessionId="session.r2.remote-quivering-palm";state.ledger=new HostSessionLedger(state.sessionId,connectedManifest(host));state.peerManifests.set(PEER,structuredClone(remoteManifest));
  const broadcasts:string[]=[],sentToPeer:string[]=[];
  const originalSend=tauriSessionTransport.send,originalSendTo=tauriSessionTransport.sendTo;
  tauriSessionTransport.send=async(message:string)=>{broadcasts.push(message);return 1;};
  tauriSessionTransport.sendTo=async(_peer:string,message:string)=>{sentToPeer.push(message);return 1;};
  try {
    await seed(host,PEER,state.sessionId,remoteManifest,TARGET_A,"request.r2.quivering.seed-a",0);
    let snapshot=await host.getSnapshot();
    assert.equal(snapshot.activeCharacter.id,before.activeCharacter.id);assert.deepEqual(snapshot.characters,before.characters);
    assert.equal(state.ledger.cursor,1);assert.equal(focus(projectedCharacterById(host,remote.id)!.sheet),13);assert.deepEqual(markers(host,remote.id),[TARGET_A]);
    let hostBatches=batches(broadcasts);assert.equal(hostBatches.length,1);const seedAEvent=hostBatches[0].events?.[0];assert.ok(seedAEvent);assert.equal(seedAEvent!.payload.kind,"resolution");
    if(seedAEvent!.payload.kind!=="resolution")throw new Error("expected seed resolution event");
    const seedAChanges=seedAEvent!.payload.resolutionEvents.flatMap((event)=>event.stateChanges);
    assert.ok(seedAChanges.some((change)=>change.kind==="resource"&&change.targetId===remote.id&&change.resourceId===MONK_FOCUS_RESOURCE_ID&&change.before===17&&change.after===13));
    assert.ok(seedAChanges.some((change)=>change.kind==="effect"&&change.targetId===TARGET_A&&change.operation==="added"));

    const client=new MockAdapter();setCharacterLibraryStoreForTests(client,new MemoryCharacterLibraryStore());prepareOwningClient(client,remote,projection,catalog);
    const clientState=connectedStateFor(client);clientState.mode="client";clientState.sessionId=state.sessionId;clientState.replica=new ClientSessionReplica(state.sessionId);
    const persistenceBefore=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;
    assert.equal((await applyConnectedClientEvents(client,[seedAEvent!])).status,"applied");
    let clientAfter=await client.getSnapshot();assert.equal(focus(clientAfter.activeCharacter),13);assert.deepEqual(markers(client,remote.id),[TARGET_A]);
    const persistenceAfterSeedA=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;assert.ok(persistenceAfterSeedA>persistenceBefore);
    assert.equal((await applyConnectedClientEvents(client,[seedAEvent!])).status,"duplicate");assert.equal(getCharacterLibraryPersistenceStateForTests(client)?.storageRevision,persistenceAfterSeedA);

    assert.equal(await routeConnectedActionRequest(host,{peer:PEER,message:""},request(state.sessionId,"request.r2.quivering.seed-a",remoteManifest,UNARMED_DAMAGE_ACTION_ID,TARGET_A,1)),true);
    assert.equal(batches(broadcasts).length,1,"duplicate seed request must not create a second Host event");
    assert.equal(sentToPeer.map((message)=>JSON.parse(message) as {type:string}).some((message)=>message.type==="event-batch"),true,"duplicate seed request must replay committed event");

    await seed(host,PEER,state.sessionId,remoteManifest,TARGET_B,"request.r2.quivering.seed-b",1);
    snapshot=await host.getSnapshot();assert.equal(state.ledger.cursor,2);assert.equal(focus(projectedCharacterById(host,remote.id)!.sheet),9);assert.deepEqual(markers(host,remote.id),[TARGET_B]);
    hostBatches=batches(broadcasts);assert.equal(hostBatches.length,2);const seedBEvent=hostBatches[1].events?.[0];assert.ok(seedBEvent);
    assert.equal((await applyConnectedClientEvents(client,[seedBEvent!])).status,"applied");clientAfter=await client.getSnapshot();assert.equal(focus(clientAfter.activeCharacter),9);assert.deepEqual(markers(client,remote.id),[TARGET_B]);

    const rebound=acceptHostCharacterSessionProjection(host,RECONNECT_PEER,remoteManifest,projection);
    assert.equal(rebound.status,"accepted",rebound.status==="rejected"?rebound.error:undefined);assert.equal(rebound.status==="accepted"?rebound.mode:undefined,"rebound");
    state.peerManifests.set(RECONNECT_PEER,structuredClone(remoteManifest));
    snapshot=await host.getSnapshot();assert.equal(focus(projectedCharacterById(host,remote.id)!.sheet),9);assert.deepEqual(markers(host,remote.id),[TARGET_B]);assert.equal(projectedCharacterById(host,remote.id)?.peerId,RECONNECT_PEER);

    const hpBeforeDetonate=hp(snapshot.scene,TARGET_B);
    const detonateRequest=request(state.sessionId,"request.r2.quivering.detonate",remoteManifest,OPEN_HAND_QUIVERING_PALM_DETONATE_ACTION_ID,TARGET_B,2);
    assert.equal(await routeConnectedActionRequest(host,{peer:RECONNECT_PEER,message:""},detonateRequest),true);
    snapshot=await host.getSnapshot();assert.equal(state.ledger.cursor,3);assert.deepEqual(markers(host,remote.id),[]);assert.equal(focus(projectedCharacterById(host,remote.id)!.sheet),9);assert.ok(hp(snapshot.scene,TARGET_B)<hpBeforeDetonate);assert.equal(snapshot.scene.economyByActor[remote.id]?.action,true,"freeform detonation must not spend initiative Action");assert.deepEqual(snapshot.characters,before.characters);
    hostBatches=batches(broadcasts);assert.equal(hostBatches.length,3);const detonateEvent=hostBatches[2].events?.[0];assert.ok(detonateEvent);assert.equal(detonateEvent!.payload.kind,"resolution");
    if(detonateEvent!.payload.kind!=="resolution")throw new Error("expected detonation resolution event");
    const detonateChanges=detonateEvent!.payload.resolutionEvents.flatMap((event)=>event.stateChanges);
    assert.ok(detonateChanges.some((change)=>change.kind==="hp"&&change.targetId===TARGET_B));assert.ok(detonateChanges.some((change)=>change.kind==="effect"&&change.targetId===TARGET_B&&change.operation==="removed"));
    assert.equal(snapshot.activity.some((activity)=>activity.title.includes("진동장")),true);

    const targetHpBeforeClientDetonate=hp((await client.getSnapshot()).scene,TARGET_B);
    const persistenceBeforeDetonate=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;
    assert.equal((await applyConnectedClientEvents(client,[detonateEvent!])).status,"applied");clientAfter=await client.getSnapshot();assert.deepEqual(markers(client,remote.id),[]);assert.ok(hp(clientAfter.scene,TARGET_B)<targetHpBeforeClientDetonate);
    const persistenceAfterDetonate=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;assert.ok(persistenceAfterDetonate>=persistenceBeforeDetonate);
    assert.equal((await applyConnectedClientEvents(client,[detonateEvent!])).status,"duplicate");

    assert.equal(await routeConnectedActionRequest(host,{peer:RECONNECT_PEER,message:""},detonateRequest),true);assert.equal(batches(broadcasts).length,3,"duplicate detonation request must not create a second Host event");

    const persistenceBeforeUndo=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;
    await host.undoLastResolution();
    snapshot=await host.getSnapshot();assert.equal(state.ledger.cursor,4);assert.equal(hp(snapshot.scene,TARGET_B),hpBeforeDetonate);assert.deepEqual(markers(host,remote.id),[TARGET_B]);assert.equal(focus(projectedCharacterById(host,remote.id)!.sheet),9);assert.deepEqual(snapshot.characters,before.characters);
    hostBatches=batches(broadcasts);assert.equal(hostBatches.length,4);const undoEvent=hostBatches[3].events?.[0];assert.ok(undoEvent);assert.equal(undoEvent!.payload.kind,"resolution-undo");
    assert.equal((await applyConnectedClientEvents(client,[undoEvent!])).status,"applied");clientAfter=await client.getSnapshot();assert.equal(hp(clientAfter.scene,TARGET_B),hpBeforeDetonate);assert.deepEqual(markers(client,remote.id),[TARGET_B]);assert.equal(focus(clientAfter.activeCharacter),9);
    const persistenceAfterUndo=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;assert.ok(persistenceAfterUndo>=persistenceBeforeUndo);assert.equal((await applyConnectedClientEvents(client,[undoEvent!])).status,"duplicate");
  } finally {tauriSessionTransport.send=originalSend;tauriSessionTransport.sendTo=originalSendTo;}
});
