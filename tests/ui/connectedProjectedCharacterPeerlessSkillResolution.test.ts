import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import "../../src/app/connectedCorrectionRoutingAdapter";
import "../../src/app/progressionContracts";
import type { CatalogEntry, CharacterSheet, CharacterSummary, SceneVm } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";
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
import { BARDIC_INSPIRATION_RESOURCE_ID } from "../../src/domain/bardicInspiration";
import { BARD_COLLEGE_LORE_SUBCLASS_ID } from "../../src/domain/bardCollegeLore";
import { BARD_LORE_CLASS_ID } from "../../src/domain/bardLoreProgression";

const PEER="peer.r2.remote-peerless-skill";
const RECONNECT_PEER="peer.r2.remote-peerless-skill.reconnect";
const CHARACTER_ID="char.r2.remote-peerless-skill";
const INTERRUPT_ID="follow-up.bard.college-of-lore.peerless-skill";
type ResolvedCatalogEntry=CatalogEntry & {contentId?:string};
type MutableAdapterState={activeCharacter:CharacterSheet;characters:CharacterSummary[];scene:SceneVm};

function entry(catalog:CatalogEntry[],contentId:string) {
  const found=(catalog as ResolvedCatalogEntry[]).find((item)=>item.contentId===contentId);
  assert.ok(found,`production catalog must contain ${contentId}`);
  return found;
}

function remoteLoreBard(catalog:CatalogEntry[]):CharacterSheet {
  const bard=entry(catalog,BARD_LORE_CLASS_ID);
  const lore=entry(catalog,BARD_COLLEGE_LORE_SUBCLASS_ID);
  const human=entry(catalog,"dnd.srd521.species.human");
  const soldier=entry(catalog,"dnd.srd521.background.soldier");
  return {
    id:CHARACTER_ID,name:"Remote Lore Bard",className:bard.nameKo||bard.nameEn,subclassName:lore.nameKo||lore.nameEn,level:14,
    species:human.nameKo||human.nameEn,background:soldier.nameKo||soldier.nameEn,hp:87,maxHp:87,tempHp:0,ac:15,speed:30,proficiencyBonus:5,saveState:"saved",
    abilities:{str:10,dex:16,con:14,int:12,wis:12,cha:18},saves:[],skills:[],features:["비할 데 없는 기술"],equipment:[],items:[],attacks:[],
    resources:[{id:BARDIC_INSPIRATION_RESOURCE_ID,label:"바드의 영감",current:4,max:4,source:"바드 클래스 기능",recovery:{shortRest:"all",longRest:"all"}}],
    rulesProfileId:"dnd.srd-5.2.1",rulesProfileVersion:"0.1-draft",sourceRevision:2,runtimeRevision:3,
    classLevels:[{classId:BARD_LORE_CLASS_ID,className:bard.nameKo||bard.nameEn,level:14,subclassName:lore.nameKo||lore.nameEn}],subclassIds:{[BARD_LORE_CLASS_ID]:BARD_COLLEGE_LORE_SUBCLASS_ID},
  } as CharacterSheet;
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

function inspirationCurrent(sheet:CharacterSheet) {
  return sheet.resources.find((resource)=>resource.id===BARDIC_INSPIRATION_RESOURCE_ID)?.current;
}

test("host-unknown Lore Peerless Skill accepts owner interrupt, spends Inspiration on success, reconnects, and Undo compensates",async()=>{
  const host=new MockAdapter();await host.setReferenceRole("dm");
  const before=await host.getSnapshot();const catalog=structuredClone(before.catalog);const remote=remoteLoreBard(catalog);const remoteManifest=manifest(remote);const projection=buildCharacterSessionProjectionV1(remote,catalog);
  const accepted=acceptHostCharacterSessionProjection(host,PEER,remoteManifest,projection);assert.equal(accepted.status,"accepted",accepted.status==="rejected"?accepted.error:undefined);
  await host.startInitiative();await host.setCurrentActor(remote.id);
  let snapshot=await host.getSnapshot();
  const check=(snapshot.scene.actionsByActor[remote.id]??[]).find((action)=>action.resolutionKind==="ability-check");assert.ok(check,"projected Lore Bard must expose a canonical ability check");
  const beforeUses=inspirationCurrent(projectedCharacterById(host,remote.id)!.sheet);assert.equal(beforeUses,4);

  const state=connectedStateFor(host);state.mode="host";state.sessionId="session.r2.remote-peerless-skill";state.ledger=new HostSessionLedger(state.sessionId,connectedManifest(host));state.peerManifests.set(PEER,structuredClone(remoteManifest));
  const broadcasts:string[]=[],sentToPeer:Array<{peer:string;message:string}>=[];const originalSend=tauriSessionTransport.send,originalSendTo=tauriSessionTransport.sendTo;
  tauriSessionTransport.send=async(message:string)=>{broadcasts.push(message);return 1;};tauriSessionTransport.sendTo=async(peer:string,message:string)=>{sentToPeer.push({peer,message});return 1;};
  try {
    await host.setQueuedD20(4);
    const request:ConnectedActionRequest={sessionId:state.sessionId,requestId:"request.r2.remote-peerless-skill",actorId:remote.id,actionId:check!.id,targetIds:[],knownEventCursor:0,character:remoteManifest.character,capabilities:[...CONNECTED_CAPABILITIES]};
    assert.equal(await routeConnectedActionRequest(host,{peer:PEER,message:""},request),true);
    snapshot=await host.advanceResolution();assert.equal(snapshot.resolution?.stage,"effect-preview");assert.equal(state.ledger.cursor,0);
    const failedTotal=snapshot.resolution?.rollTotal;assert.equal(typeof failedTotal,"number");
    snapshot=await host.applyDmAdjudication({type:"ability-check-dc",scope:"resolution",value:failedTotal!+6});
    assert.equal(snapshot.resolution?.stage,"interrupt",JSON.stringify(snapshot.resolution));assert.equal(snapshot.resolution?.checkOutcome,"실패");assert.equal(snapshot.resolution?.checkTarget,failedTotal!+6);assert.equal(snapshot.resolution?.interrupt?.id,INTERRUPT_ID);assert.equal(snapshot.resolution?.interrupt?.responderId,remote.id);assert.equal(state.ledger.cursor,0);
    assert.ok(failedTotal!<snapshot.resolution!.checkTarget!);
    const prompt=sentToPeer.filter((entry)=>entry.peer===PEER).map((entry)=>JSON.parse(entry.message) as {type:string;interrupt?:{id:string}}).find((message)=>message.type==="resolution-interrupt-prompt");assert.ok(prompt,"Host must send Peerless Skill only to the owning peer");assert.equal(prompt!.interrupt?.id,INTERRUPT_ID);

    await host.setQueuedD20(10);
    const response={sessionId:state.sessionId,resolutionId:snapshot.resolution!.id,promptId:INTERRUPT_ID,accept:true};
    assert.equal(await routeConnectedInterruptResponse(host,{peer:PEER,message:""},response),true);
    snapshot=await host.getSnapshot();assert.equal(state.pendingRemoteAction,null);assert.equal(state.ledger.cursor,1);assert.equal(snapshot.activeCharacter.id,before.activeCharacter.id);assert.deepEqual(snapshot.characters,before.characters);
    assert.equal(snapshot.resolution?.stage,"complete");assert.deepEqual(snapshot.resolution?.authoritativeDice,[4,10]);assert.equal(snapshot.resolution?.rollTotal,failedTotal!+10);assert.equal(snapshot.resolution?.checkOutcome,"성공");
    assert.equal(inspirationCurrent(projectedCharacterById(host,remote.id)!.sheet),beforeUses!-1);assert.equal(snapshot.activity.some((activity)=>activity.detail.some((detail)=>detail.includes("비할 데 없는 기술"))),true);

    const batches=broadcasts.map((message)=>JSON.parse(message) as {type:string;events?:ConnectedSessionEvent[]}).filter((message)=>message.type==="event-batch");assert.equal(batches.length,1,"accepted owner follow-up must commit one ordered Host event batch");
    const hostEvent=batches[0].events?.[0];assert.ok(hostEvent);assert.equal(hostEvent!.sequence,1);assert.equal(hostEvent!.actorId,remote.id);assert.equal(hostEvent!.payload.kind,"resolution");
    if(hostEvent!.payload.kind!=="resolution")throw new Error("expected Host Peerless Skill resolution event");
    const changes=hostEvent!.payload.resolutionEvents.flatMap((event)=>event.stateChanges);assert.ok(changes.some((change)=>change.kind==="resource"&&change.targetId===remote.id&&change.resourceId===BARDIC_INSPIRATION_RESOURCE_ID&&change.before===beforeUses&&change.after===beforeUses!-1));

    const client=new MockAdapter();setCharacterLibraryStoreForTests(client,new MemoryCharacterLibraryStore());prepareOwningClient(client,remote,projection,catalog);
    const clientState=connectedStateFor(client);clientState.mode="client";clientState.sessionId=state.sessionId;clientState.replica=new ClientSessionReplica(state.sessionId);
    const persistenceBefore=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;
    const applied=await applyConnectedClientEvents(client,[hostEvent!]);assert.equal(applied.status,"applied");assert.equal(applied.cursor,1);
    let clientAfter=await client.getSnapshot();assert.equal(inspirationCurrent(clientAfter.activeCharacter),beforeUses!-1);
    const persistenceAfter=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;assert.ok(persistenceAfter>persistenceBefore,"owning Client must persist the Host-confirmed Peerless Skill resource spend before cursor advancement");
    assert.equal((await applyConnectedClientEvents(client,[hostEvent!])).status,"duplicate");assert.equal(getCharacterLibraryPersistenceStateForTests(client)?.storageRevision,persistenceAfter);

    assert.equal(await routeConnectedActionRequest(host,{peer:PEER,message:""},request),true);assert.equal(broadcasts.filter((message)=>JSON.parse(message).type==="event-batch").length,1,"duplicate request must not create a second Host event");
    const duplicateReplay=sentToPeer.map((entry)=>JSON.parse(entry.message) as {type:string;events?:ConnectedSessionEvent[]}).filter((message)=>message.type==="event-batch");assert.equal(duplicateReplay.length,1);assert.equal(duplicateReplay[0].events?.[0]?.sequence,1);

    const rebound=acceptHostCharacterSessionProjection(host,RECONNECT_PEER,remoteManifest,projection);assert.equal(rebound.status,"accepted",rebound.status==="rejected"?rebound.error:undefined);assert.equal(rebound.status==="accepted"?rebound.mode:undefined,"rebound");
    snapshot=await host.getSnapshot();assert.equal(inspirationCurrent(projectedCharacterById(host,remote.id)!.sheet),beforeUses!-1,"stale reconnect projection must not restore spent Inspiration");assert.equal(projectedCharacterById(host,remote.id)?.peerId,RECONNECT_PEER);assert.deepEqual(snapshot.characters,before.characters);

    const persistenceBeforeUndo=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;
    await host.undoLastResolution();snapshot=await host.getSnapshot();assert.equal(inspirationCurrent(projectedCharacterById(host,remote.id)!.sheet),beforeUses);assert.deepEqual(snapshot.characters,before.characters);
    const afterUndo=broadcasts.map((message)=>JSON.parse(message) as {type:string;events?:ConnectedSessionEvent[]}).filter((message)=>message.type==="event-batch");assert.equal(afterUndo.length,2);
    const undoEvent=afterUndo[1].events?.[0];assert.ok(undoEvent);assert.equal(undoEvent!.sequence,2);assert.equal(undoEvent!.payload.kind,"resolution-undo");
    const undoApplied=await applyConnectedClientEvents(client,[undoEvent!]);assert.equal(undoApplied.status,"applied");assert.equal(undoApplied.cursor,2);
    clientAfter=await client.getSnapshot();assert.equal(inspirationCurrent(clientAfter.activeCharacter),beforeUses);
    const persistenceAfterUndo=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;assert.ok(persistenceAfterUndo>persistenceBeforeUndo,"owning Client must persist the compensating Peerless Skill resource restore before cursor advancement");
    assert.equal((await applyConnectedClientEvents(client,[undoEvent!])).status,"duplicate");assert.equal(getCharacterLibraryPersistenceStateForTests(client)?.storageRevision,persistenceAfterUndo);
  } finally {tauriSessionTransport.send=originalSend;tauriSessionTransport.sendTo=originalSendTo;}
});
