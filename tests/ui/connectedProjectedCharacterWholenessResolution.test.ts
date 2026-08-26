import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import "../../src/app/progressionContracts";
import type { CatalogEntry, CharacterSheet, CharacterSummary, SceneVm } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import { OPEN_HAND_WHOLENESS_ACTION_ID } from "../../src/app/monkOpenHandWholenessRuntimeAdapter";
import { buildCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { reconstructCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjectionReconstruction";
import { acceptHostCharacterSessionProjection } from "../../src/app/connectedCharacterProjectionHandshake";
import { projectedCharacterById } from "../../src/app/characterSessionProjectionRegistry";
import { applyConnectedClientEvents, connectedManifest, CONNECTED_CAPABILITIES } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { ClientSessionReplica, HostSessionLedger, type ConnectedActionRequest, type ConnectedSessionEvent, type SessionCompatibilityManifest } from "../../src/app/connectedSessionProtocol";
import { routeConnectedActionRequest } from "../../src/app/connectedActionRequestPort";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { getCharacterLibraryPersistenceStateForTests, setCharacterLibraryStoreForTests } from "../../src/app/characterLibraryRuntimeAdapter";
import { MONK_OPEN_HAND_CLASS_ID, OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID } from "../../src/domain/monkOpenHand";
import { MONK_OPEN_HAND_SUBCLASS_ID } from "../../src/domain/srdSubclassCatalog";

const PEER="peer.r2.remote-wholeness";
const RECONNECT_PEER="peer.r2.remote-wholeness.reconnect";
const CHARACTER_ID="char.r2.remote-wholeness";
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
    id:CHARACTER_ID,name:"Remote Open Hand Monk",className:monk.nameKo||monk.nameEn,subclassName:openHand.nameKo||openHand.nameEn,level:6,
    species:human.nameKo||human.nameEn,background:soldier.nameKo||soldier.nameEn,hp:10,maxHp:30,tempHp:0,ac:16,speed:45,proficiencyBonus:3,saveState:"saved",
    abilities:{str:10,dex:18,con:14,int:10,wis:16,cha:8},saves:[],skills:[],features:["신체 완성"],equipment:[],items:[],attacks:[],
    resources:[{id:OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID,label:"신체 완성",current:3,max:3,source:"SRD Open Hand",recovery:{longRest:"all"}}],
    rulesProfileId:"dnd.srd-5.2.1",rulesProfileVersion:"0.1-draft",sourceRevision:2,runtimeRevision:3,
    classLevels:[{classId:MONK_OPEN_HAND_CLASS_ID,className:monk.nameKo||monk.nameEn,level:6,subclassName:openHand.nameKo||openHand.nameEn}],subclassIds:{[MONK_OPEN_HAND_CLASS_ID]:MONK_OPEN_HAND_SUBCLASS_ID},
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

function wholenessCurrent(sheet:CharacterSheet) {
  return sheet.resources.find((resource)=>resource.id===OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID)?.current;
}

function hp(scene:SceneVm,actorId:string) {
  return scene.entities.find((entity)=>entity.id===actorId)?.hp;
}

test("host-unknown Open Hand Wholeness converges healing/resource/economy exactly once and Undo compensates",async()=>{
  const host=new MockAdapter();
  await host.setReferenceRole("dm");
  const before=await host.getSnapshot();
  const catalog=structuredClone(before.catalog);
  const remote=remoteMonk(catalog);
  const remoteManifest=manifest(remote);
  const projection=buildCharacterSessionProjectionV1(remote,catalog);
  const accepted=acceptHostCharacterSessionProjection(host,PEER,remoteManifest,projection);
  assert.equal(accepted.status,"accepted",accepted.status==="rejected"?accepted.error:undefined);

  await host.startInitiative();
  const economyBefore=structuredClone((await host.getSnapshot()).scene.economyByActor[remote.id]);
  assert.ok(economyBefore);

  const state=connectedStateFor(host);
  state.mode="host";state.sessionId="session.r2.remote-wholeness";state.ledger=new HostSessionLedger(state.sessionId,connectedManifest(host));state.peerManifests.set(PEER,structuredClone(remoteManifest));
  const broadcasts:string[]=[],sentToPeer:string[]=[];
  const originalSend=tauriSessionTransport.send,originalSendTo=tauriSessionTransport.sendTo;
  tauriSessionTransport.send=async(message:string)=>{broadcasts.push(message);return 1;};
  tauriSessionTransport.sendTo=async(_peer:string,message:string)=>{sentToPeer.push(message);return 1;};
  try {
    await host.setQueuedD20(8);
    const request:ConnectedActionRequest={sessionId:state.sessionId,requestId:"request.r2.remote-wholeness",actorId:remote.id,actionId:OPEN_HAND_WHOLENESS_ACTION_ID,targetIds:[remote.id],knownEventCursor:0,character:remoteManifest.character,capabilities:[...CONNECTED_CAPABILITIES]};
    assert.equal(await routeConnectedActionRequest(host,{peer:PEER,message:""},request),true);

    let snapshot=await host.getSnapshot();
    assert.equal(snapshot.activeCharacter.id,before.activeCharacter.id,"Host local Character context must restore after remote Wholeness");
    assert.deepEqual(snapshot.characters,before.characters,"Host permanent Character library must remain unchanged");
    assert.equal(state.pendingRemoteAction,null);assert.equal(state.ledger.cursor,1);
    assert.equal(wholenessCurrent(projectedCharacterById(host,remote.id)!.sheet),2);
    assert.equal(hp(snapshot.scene,remote.id),21);
    assert.equal(snapshot.scene.economyByActor[remote.id]?.bonusAction,false);
    assert.equal(snapshot.activity.some((activity)=>activity.title.includes("신체 완성")),true);

    const batches=broadcasts.map((message)=>JSON.parse(message) as {type:string;events?:ConnectedSessionEvent[]}).filter((message)=>message.type==="event-batch");
    assert.equal(batches.length,1,"remote Wholeness must commit one ordered Host event batch");
    const hostEvent=batches[0].events?.[0];assert.ok(hostEvent);assert.equal(hostEvent!.sequence,1);assert.equal(hostEvent!.actorId,remote.id);assert.equal(hostEvent!.payload.kind,"resolution");
    if(hostEvent!.payload.kind!=="resolution")throw new Error("expected Host resolution event");
    const changes=hostEvent!.payload.resolutionEvents.flatMap((event)=>event.stateChanges);
    assert.ok(changes.some((change)=>change.kind==="resource"&&change.targetId===remote.id&&change.resourceId===OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID&&change.before===3&&change.after===2));
    assert.ok(changes.some((change)=>change.kind==="economy"&&change.targetId===remote.id&&change.field==="bonusAction"&&change.before===true&&change.after===false));
    assert.ok(changes.some((change)=>change.kind==="hp"&&change.targetId===remote.id&&change.field==="current"&&change.before===10&&change.after===21));

    const client=new MockAdapter();setCharacterLibraryStoreForTests(client,new MemoryCharacterLibraryStore());prepareOwningClient(client,remote,projection,catalog);
    const clientState=connectedStateFor(client);clientState.mode="client";clientState.sessionId=state.sessionId;clientState.replica=new ClientSessionReplica(state.sessionId);
    const persistenceBefore=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;
    const applied=await applyConnectedClientEvents(client,[hostEvent!]);assert.equal(applied.status,"applied");assert.equal(applied.cursor,1);
    let clientAfter=await client.getSnapshot();assert.equal(wholenessCurrent(clientAfter.activeCharacter),2);assert.equal(clientAfter.activeCharacter.hp,21);assert.equal(clientAfter.scene.economyByActor[remote.id]?.bonusAction,false);
    const persistenceAfter=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;assert.ok(persistenceAfter>persistenceBefore,"owning Client must persist Host-confirmed healing/resource spend before cursor advancement");
    assert.equal((await applyConnectedClientEvents(client,[hostEvent!])).status,"duplicate");assert.equal(getCharacterLibraryPersistenceStateForTests(client)?.storageRevision,persistenceAfter);

    assert.equal(await routeConnectedActionRequest(host,{peer:PEER,message:""},request),true);
    assert.equal(broadcasts.filter((message)=>JSON.parse(message).type==="event-batch").length,1,"duplicate request must not create a second Host event");
    assert.equal(sentToPeer.length,1,"duplicate request must replay the committed event to the owner");

    const rebound=acceptHostCharacterSessionProjection(host,RECONNECT_PEER,remoteManifest,projection);
    assert.equal(rebound.status,"accepted",rebound.status==="rejected"?rebound.error:undefined);assert.equal(rebound.status==="accepted"?rebound.mode:undefined,"rebound");
    snapshot=await host.getSnapshot();assert.equal(wholenessCurrent(projectedCharacterById(host,remote.id)!.sheet),2);assert.equal(hp(snapshot.scene,remote.id),21);assert.equal(snapshot.scene.economyByActor[remote.id]?.bonusAction,false);assert.equal(projectedCharacterById(host,remote.id)?.peerId,RECONNECT_PEER);

    const persistenceBeforeUndo=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;
    await host.undoLastResolution();
    snapshot=await host.getSnapshot();assert.equal(wholenessCurrent(projectedCharacterById(host,remote.id)!.sheet),3);assert.equal(hp(snapshot.scene,remote.id),10);assert.equal(snapshot.scene.economyByActor[remote.id]?.bonusAction,economyBefore!.bonusAction);assert.deepEqual(snapshot.characters,before.characters);
    const afterUndo=broadcasts.map((message)=>JSON.parse(message) as {type:string;events?:ConnectedSessionEvent[]}).filter((message)=>message.type==="event-batch");assert.equal(afterUndo.length,2);
    const undoEvent=afterUndo[1].events?.[0];assert.ok(undoEvent);assert.equal(undoEvent!.sequence,2);assert.equal(undoEvent!.payload.kind,"resolution-undo");
    const undoApplied=await applyConnectedClientEvents(client,[undoEvent!]);assert.equal(undoApplied.status,"applied");assert.equal(undoApplied.cursor,2);
    clientAfter=await client.getSnapshot();assert.equal(wholenessCurrent(clientAfter.activeCharacter),3);assert.equal(clientAfter.activeCharacter.hp,10);assert.equal(clientAfter.scene.economyByActor[remote.id]?.bonusAction,economyBefore!.bonusAction);
    const persistenceAfterUndo=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;assert.ok(persistenceAfterUndo>persistenceBeforeUndo,"owning Client must persist compensating heal/resource restore before cursor advancement");
    assert.equal((await applyConnectedClientEvents(client,[undoEvent!])).status,"duplicate");assert.equal(getCharacterLibraryPersistenceStateForTests(client)?.storageRevision,persistenceAfterUndo);
  } finally {tauriSessionTransport.send=originalSend;tauriSessionTransport.sendTo=originalSendTo;}
});
