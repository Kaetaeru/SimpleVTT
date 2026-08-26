import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import "../../src/app/progressionContracts";
import type { CatalogEntry, CharacterSheet, CharacterSummary, SceneVm } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import { OPEN_HAND_WHOLENESS_ACTION_ID } from "../../src/app/monkOpenHandWholenessRuntimeAdapter";
import { OPEN_HAND_FLEET_STEP_ACTION_ID, OPEN_HAND_FLEET_STEP_FOCUS_ACTION_ID } from "../../src/app/monkOpenHandFleetStepRuntimeAdapter";
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
import { MONK_FOCUS_RESOURCE_ID, MONK_OPEN_HAND_CLASS_ID, OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID } from "../../src/domain/monkOpenHand";
import { MONK_OPEN_HAND_SUBCLASS_ID } from "../../src/domain/srdSubclassCatalog";

const PEER="peer.r2.remote-fleet-step";
const RECONNECT_PEER="peer.r2.remote-fleet-step.reconnect";
const CHARACTER_ID="char.r2.remote-fleet-step";
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
    id:CHARACTER_ID,name:"Remote Fleet Step Monk",className:monk.nameKo||monk.nameEn,subclassName:openHand.nameKo||openHand.nameEn,level:11,
    species:human.nameKo||human.nameEn,background:soldier.nameKo||soldier.nameEn,hp:10,maxHp:30,tempHp:0,ac:17,speed:50,proficiencyBonus:4,saveState:"saved",
    abilities:{str:10,dex:20,con:14,int:10,wis:16,cha:8},saves:[],skills:[],features:["신체 완성","날랜 발걸음"],equipment:[],items:[],attacks:[],
    resources:[
      {id:OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID,label:"신체 완성",current:3,max:3,source:"SRD Open Hand",recovery:{longRest:"all"}},
      {id:MONK_FOCUS_RESOURCE_ID,label:"기 점수",current:11,max:11,source:"SRD Monk",recovery:{shortRest:"all",longRest:"all"}},
    ],
    rulesProfileId:"dnd.srd-5.2.1",rulesProfileVersion:"0.1-draft",sourceRevision:2,runtimeRevision:3,
    classLevels:[{classId:MONK_OPEN_HAND_CLASS_ID,className:monk.nameKo||monk.nameEn,level:11,subclassName:openHand.nameKo||openHand.nameEn}],subclassIds:{[MONK_OPEN_HAND_CLASS_ID]:MONK_OPEN_HAND_SUBCLASS_ID},
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

function resourceCurrent(sheet:CharacterSheet,resourceId:string) {
  return sheet.resources.find((resource)=>resource.id===resourceId)?.current;
}

function action(scene:SceneVm,actorId:string,actionId:string) {
  return scene.actionsByActor[actorId]?.find((entry)=>entry.id===actionId);
}

test("host-unknown Open Hand Fleet Step follows an authoritative Bonus Action and converges exactly once with Undo",async()=>{
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
  state.mode="host";state.sessionId="session.r2.remote-fleet-step";state.ledger=new HostSessionLedger(state.sessionId,connectedManifest(host));state.peerManifests.set(PEER,structuredClone(remoteManifest));
  const broadcasts:string[]=[],sentToPeer:string[]=[];
  const originalSend=tauriSessionTransport.send,originalSendTo=tauriSessionTransport.sendTo;
  tauriSessionTransport.send=async(message:string)=>{broadcasts.push(message);return 1;};
  tauriSessionTransport.sendTo=async(_peer:string,message:string)=>{sentToPeer.push(message);return 1;};
  try {
    await host.setQueuedD20(8);
    const triggerRequest:ConnectedActionRequest={sessionId:state.sessionId,requestId:"request.r2.remote-fleet-step.trigger",actorId:remote.id,actionId:OPEN_HAND_WHOLENESS_ACTION_ID,targetIds:[remote.id],knownEventCursor:0,character:remoteManifest.character,capabilities:[...CONNECTED_CAPABILITIES]};
    assert.equal(await routeConnectedActionRequest(host,{peer:PEER,message:""},triggerRequest),true);

    let snapshot=await host.getSnapshot();
    assert.equal(snapshot.activeCharacter.id,before.activeCharacter.id,"Host local Character context must restore after remote trigger");
    assert.deepEqual(snapshot.characters,before.characters,"Host permanent Character library must remain unchanged");
    assert.equal(state.ledger.cursor,1);
    assert.equal(resourceCurrent(projectedCharacterById(host,remote.id)!.sheet,OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID),2);
    assert.equal(resourceCurrent(projectedCharacterById(host,remote.id)!.sheet,MONK_FOCUS_RESOURCE_ID),11);
    assert.equal(snapshot.scene.economyByActor[remote.id]?.bonusAction,false);
    assert.ok(action(snapshot.scene,remote.id,OPEN_HAND_FLEET_STEP_ACTION_ID),"free Fleet Step must project after the authoritative non-Step Bonus Action");
    assert.ok(action(snapshot.scene,remote.id,OPEN_HAND_FLEET_STEP_FOCUS_ACTION_ID),"focused Fleet Step must project after the authoritative non-Step Bonus Action");

    const fleetRequest:ConnectedActionRequest={sessionId:state.sessionId,requestId:"request.r2.remote-fleet-step.focus",actorId:remote.id,actionId:OPEN_HAND_FLEET_STEP_FOCUS_ACTION_ID,targetIds:[remote.id],knownEventCursor:1,character:remoteManifest.character,capabilities:[...CONNECTED_CAPABILITIES]};
    assert.equal(await routeConnectedActionRequest(host,{peer:PEER,message:""},fleetRequest),true);

    snapshot=await host.getSnapshot();
    assert.equal(snapshot.activeCharacter.id,before.activeCharacter.id);
    assert.deepEqual(snapshot.characters,before.characters);
    assert.equal(state.pendingRemoteAction,null);assert.equal(state.ledger.cursor,2);
    assert.equal(resourceCurrent(projectedCharacterById(host,remote.id)!.sheet,MONK_FOCUS_RESOURCE_ID),10);
    assert.equal(resourceCurrent(projectedCharacterById(host,remote.id)!.sheet,OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID),2);
    assert.equal(snapshot.scene.economyByActor[remote.id]?.bonusAction,false);
    assert.equal(snapshot.activity.some((activity)=>activity.title.includes("날랜 발걸음")),true);
    assert.equal(action(snapshot.scene,remote.id,OPEN_HAND_FLEET_STEP_ACTION_ID),undefined,"Fleet Step trigger must be single-use");

    const batches=broadcasts.map((message)=>JSON.parse(message) as {type:string;events?:ConnectedSessionEvent[]}).filter((message)=>message.type==="event-batch");
    assert.equal(batches.length,2,"trigger and Fleet Step must each commit one ordered Host event batch");
    const triggerEvent=batches[0].events?.[0];const fleetEvent=batches[1].events?.[0];assert.ok(triggerEvent);assert.ok(fleetEvent);
    assert.equal(fleetEvent!.sequence,2);assert.equal(fleetEvent!.actorId,remote.id);assert.equal(fleetEvent!.payload.kind,"resolution");
    if(fleetEvent!.payload.kind!=="resolution")throw new Error("expected Host Fleet Step resolution event");
    assert.ok(fleetEvent!.payload.resolutionEvents.some((event)=>event.kind==="free-move"));
    assert.ok(fleetEvent!.payload.resolutionEvents.some((event)=>event.kind==="apply-effect"));
    const changes=fleetEvent!.payload.resolutionEvents.flatMap((event)=>event.stateChanges);
    assert.ok(changes.some((change)=>change.kind==="resource"&&change.targetId===remote.id&&change.resourceId===MONK_FOCUS_RESOURCE_ID&&change.before===11&&change.after===10));
    assert.ok(changes.some((change)=>change.kind==="effect"&&change.targetId===remote.id&&change.operation==="added"));

    const client=new MockAdapter();setCharacterLibraryStoreForTests(client,new MemoryCharacterLibraryStore());prepareOwningClient(client,remote,projection,catalog);
    const clientState=connectedStateFor(client);clientState.mode="client";clientState.sessionId=state.sessionId;clientState.replica=new ClientSessionReplica(state.sessionId);
    assert.equal((await applyConnectedClientEvents(client,[triggerEvent!])).status,"applied");
    const persistenceBeforeFleet=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;
    const applied=await applyConnectedClientEvents(client,[fleetEvent!]);assert.equal(applied.status,"applied");assert.equal(applied.cursor,2);
    let clientAfter=await client.getSnapshot();
    assert.equal(resourceCurrent(clientAfter.activeCharacter,OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID),2);
    assert.equal(resourceCurrent(clientAfter.activeCharacter,MONK_FOCUS_RESOURCE_ID),10);
    assert.equal(clientAfter.scene.economyByActor[remote.id]?.bonusAction,false);
    const persistenceAfterFleet=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;assert.ok(persistenceAfterFleet>persistenceBeforeFleet,"owning Client must persist Host-confirmed Focus spend before cursor advancement");
    assert.equal((await applyConnectedClientEvents(client,[fleetEvent!])).status,"duplicate");assert.equal(getCharacterLibraryPersistenceStateForTests(client)?.storageRevision,persistenceAfterFleet);

    assert.equal(await routeConnectedActionRequest(host,{peer:PEER,message:""},fleetRequest),true);
    assert.equal(broadcasts.filter((message)=>JSON.parse(message).type==="event-batch").length,2,"duplicate Fleet Step request must not create a second Host event");
    assert.equal(sentToPeer.length,1,"duplicate Fleet Step request must replay the committed event to the owner");

    const rebound=acceptHostCharacterSessionProjection(host,RECONNECT_PEER,remoteManifest,projection);
    assert.equal(rebound.status,"accepted",rebound.status==="rejected"?rebound.error:undefined);assert.equal(rebound.status==="accepted"?rebound.mode:undefined,"rebound");
    snapshot=await host.getSnapshot();
    assert.equal(resourceCurrent(projectedCharacterById(host,remote.id)!.sheet,MONK_FOCUS_RESOURCE_ID),10);
    assert.equal(resourceCurrent(projectedCharacterById(host,remote.id)!.sheet,OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID),2);
    assert.equal(snapshot.scene.economyByActor[remote.id]?.bonusAction,false);assert.equal(projectedCharacterById(host,remote.id)?.peerId,RECONNECT_PEER);

    const persistenceBeforeUndo=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;
    await host.undoLastResolution();
    snapshot=await host.getSnapshot();
    assert.equal(resourceCurrent(projectedCharacterById(host,remote.id)!.sheet,MONK_FOCUS_RESOURCE_ID),11);
    assert.equal(resourceCurrent(projectedCharacterById(host,remote.id)!.sheet,OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID),2);
    assert.equal(snapshot.scene.economyByActor[remote.id]?.bonusAction,false);assert.deepEqual(snapshot.characters,before.characters);
    const afterUndo=broadcasts.map((message)=>JSON.parse(message) as {type:string;events?:ConnectedSessionEvent[]}).filter((message)=>message.type==="event-batch");assert.equal(afterUndo.length,3);
    const undoEvent=afterUndo[2].events?.[0];assert.ok(undoEvent);assert.equal(undoEvent!.sequence,3);assert.equal(undoEvent!.payload.kind,"resolution-undo");
    const undoApplied=await applyConnectedClientEvents(client,[undoEvent!]);assert.equal(undoApplied.status,"applied");assert.equal(undoApplied.cursor,3);
    clientAfter=await client.getSnapshot();
    assert.equal(resourceCurrent(clientAfter.activeCharacter,MONK_FOCUS_RESOURCE_ID),11);
    assert.equal(resourceCurrent(clientAfter.activeCharacter,OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID),2);
    assert.equal(clientAfter.scene.economyByActor[remote.id]?.bonusAction,false);
    const persistenceAfterUndo=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;assert.ok(persistenceAfterUndo>persistenceBeforeUndo,"owning Client must persist compensating Focus restore before cursor advancement");
    assert.equal((await applyConnectedClientEvents(client,[undoEvent!])).status,"duplicate");assert.equal(getCharacterLibraryPersistenceStateForTests(client)?.storageRevision,persistenceAfterUndo);
  } finally {tauriSessionTransport.send=originalSend;tauriSessionTransport.sendTo=originalSendTo;}
});
