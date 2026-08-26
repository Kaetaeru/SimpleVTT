import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import "../../src/app/progressionContracts";
import type { ActionVm, CatalogEntry, CharacterSheet, CharacterSummary, SceneVm } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";
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
import { snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";
import { DIVINE_SMITE_ID, PALADIN_ID } from "../../src/domain/classFeatureSpellResources";
import { DEVOTION_SMITE_OF_PROTECTION_TAG } from "../../src/domain/paladinDevotion";
import { PALADIN_DEVOTION_SUBCLASS_ID } from "../../src/domain/srdSubclassCatalog";

const PEER="peer.r2.remote-smite-protection";
const RECONNECT_PEER="peer.r2.remote-smite-protection.reconnect";
const CHARACTER_ID="char.r2.remote-smite-protection";
type ResolvedCatalogEntry=CatalogEntry & {contentId?:string};
type MutableAdapterState={activeCharacter:CharacterSheet;characters:CharacterSummary[];scene:SceneVm};

function entry(catalog:CatalogEntry[],contentId:string) {
  const found=(catalog as ResolvedCatalogEntry[]).find((item)=>item.contentId===contentId);
  assert.ok(found,`production catalog must contain ${contentId}`);
  return found;
}

function remotePaladin(catalog:CatalogEntry[]):CharacterSheet {
  const paladin=entry(catalog,PALADIN_ID);
  const devotion=entry(catalog,PALADIN_DEVOTION_SUBCLASS_ID);
  const human=entry(catalog,"dnd.srd521.species.human");
  const soldier=entry(catalog,"dnd.srd521.background.soldier");
  return {
    id:CHARACTER_ID,name:"Remote Devotion Paladin",className:paladin.nameKo||paladin.nameEn,subclassName:devotion.nameKo||devotion.nameEn,level:15,
    species:human.nameKo||human.nameEn,background:soldier.nameKo||soldier.nameEn,hp:120,maxHp:120,tempHp:0,ac:20,speed:30,proficiencyBonus:5,saveState:"saved",
    abilities:{str:18,dex:10,con:16,int:8,wis:12,cha:18},saves:[],skills:[],features:["보호의 강타"],equipment:[],items:[],attacks:[],resources:[],
    preparedSpells:[DIVINE_SMITE_ID],spellSlotMaximums:{1:4},
    rulesProfileId:"dnd.srd-5.2.1",rulesProfileVersion:"0.1-draft",sourceRevision:2,runtimeRevision:3,
    classLevels:[{classId:PALADIN_ID,className:paladin.nameKo||paladin.nameEn,level:15,subclassName:devotion.nameKo||devotion.nameEn}],subclassIds:{[PALADIN_ID]:PALADIN_DEVOTION_SUBCLASS_ID},
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

function protectionActive(adapter:MockAdapter,scene:SceneVm,actorId:string) {
  return snapshotAdapterTurnRuntimeState(adapter,scene)?.effects.some((effect)=>effect.sourceActorId===actorId&&effect.tags.includes(DEVOTION_SMITE_OF_PROTECTION_TAG))??false;
}

function divineSmite(actions:ActionVm[]) {
  return actions.find((action)=>action.spellCast?.spellId===DIVINE_SMITE_ID);
}

function targetIds(action:ActionVm,snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>,actorId:string) {
  if(action.target==="none")return [];
  if(action.target==="self")return [actorId];
  const targetId=action.eligibleTargetIds[0]??snapshot.scene.entities.find((entity)=>entity.id!==actorId&&entity.side!=="ally")?.id;
  return targetId?[targetId]:[];
}

test("host-unknown Devotion Divine Smite appends Smite of Protection and converges exactly once with Undo",async()=>{
  const host=new MockAdapter();await host.setReferenceRole("dm");
  const before=await host.getSnapshot();const catalog=structuredClone(before.catalog);const remote=remotePaladin(catalog);const remoteManifest=manifest(remote);const projection=buildCharacterSessionProjectionV1(remote,catalog);
  const accepted=acceptHostCharacterSessionProjection(host,PEER,remoteManifest,projection);assert.equal(accepted.status,"accepted",accepted.status==="rejected"?accepted.error:undefined);
  await host.startInitiative();await host.setCurrentActor(remote.id);
  let snapshot=await host.getSnapshot();const smite=divineSmite(snapshot.scene.actionsByActor[remote.id]??[]);assert.ok(smite,"projected Devotion Paladin must expose Divine Smite");
  const economyBefore=structuredClone(snapshot.scene.economyByActor[remote.id]);assert.ok(economyBefore);

  const state=connectedStateFor(host);state.mode="host";state.sessionId="session.r2.remote-smite-protection";state.ledger=new HostSessionLedger(state.sessionId,connectedManifest(host));state.peerManifests.set(PEER,structuredClone(remoteManifest));
  const broadcasts:string[]=[],sentToPeer:string[]=[];const originalSend=tauriSessionTransport.send,originalSendTo=tauriSessionTransport.sendTo;
  tauriSessionTransport.send=async(message:string)=>{broadcasts.push(message);return 1;};tauriSessionTransport.sendTo=async(_peer:string,message:string)=>{sentToPeer.push(message);return 1;};
  try {
    const request:ConnectedActionRequest={sessionId:state.sessionId,requestId:"request.r2.remote-smite-protection",actorId:remote.id,actionId:smite!.id,targetIds:targetIds(smite!,snapshot,remote.id),knownEventCursor:0,character:remoteManifest.character,capabilities:[...CONNECTED_CAPABILITIES]};
    assert.equal(await routeConnectedActionRequest(host,{peer:PEER,message:""},request),true);
    for(let step=0;step<10&&state.ledger.cursor===0;step++)await host.advanceResolution();

    snapshot=await host.getSnapshot();assert.equal(state.pendingRemoteAction,null);assert.equal(state.ledger.cursor,1);assert.equal(snapshot.activeCharacter.id,before.activeCharacter.id);assert.deepEqual(snapshot.characters,before.characters);assert.equal(protectionActive(host,snapshot.scene,remote.id),true);
    const batches=broadcasts.map((message)=>JSON.parse(message) as {type:string;events?:ConnectedSessionEvent[]}).filter((message)=>message.type==="event-batch");assert.equal(batches.length,1);
    const hostEvent=batches[0].events?.[0];assert.ok(hostEvent);assert.equal(hostEvent!.actorId,remote.id);assert.equal(hostEvent!.payload.kind,"resolution");
    if(hostEvent!.payload.kind!=="resolution")throw new Error("expected Host Smite resolution event");
    const changes=hostEvent!.payload.resolutionEvents.flatMap((event)=>event.stateChanges);
    assert.ok(changes.some((change)=>change.kind==="effect"&&change.targetId===remote.id&&change.operation==="added"),"same Host resolution must include Smite of Protection effect");
    assert.equal(snapshot.activity.some((activity)=>activity.detail.some((detail)=>detail.includes("Smite of Protection"))),true);

    const client=new MockAdapter();setCharacterLibraryStoreForTests(client,new MemoryCharacterLibraryStore());prepareOwningClient(client,remote,projection,catalog);await client.setSessionMode("initiative");await client.setCurrentActor(remote.id);
    const clientState=connectedStateFor(client);clientState.mode="client";clientState.sessionId=state.sessionId;clientState.replica=new ClientSessionReplica(state.sessionId);
    const persistenceBefore=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;
    const applied=await applyConnectedClientEvents(client,[hostEvent!]);assert.equal(applied.status,"applied");assert.equal(applied.cursor,1);
    let clientAfter=await client.getSnapshot();assert.equal(protectionActive(client,clientAfter.scene,remote.id),true);
    const persistenceAfter=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;assert.ok(persistenceAfter>=persistenceBefore);
    assert.equal((await applyConnectedClientEvents(client,[hostEvent!])).status,"duplicate");assert.equal(getCharacterLibraryPersistenceStateForTests(client)?.storageRevision,persistenceAfter);

    assert.equal(await routeConnectedActionRequest(host,{peer:PEER,message:""},request),true);assert.equal(broadcasts.filter((message)=>JSON.parse(message).type==="event-batch").length,1);assert.equal(sentToPeer.length,1);
    const rebound=acceptHostCharacterSessionProjection(host,RECONNECT_PEER,remoteManifest,projection);assert.equal(rebound.status,"accepted",rebound.status==="rejected"?rebound.error:undefined);assert.equal(rebound.status==="accepted"?rebound.mode:undefined,"rebound");
    snapshot=await host.getSnapshot();assert.equal(protectionActive(host,snapshot.scene,remote.id),true);assert.equal(projectedCharacterById(host,remote.id)?.peerId,RECONNECT_PEER);

    await host.undoLastResolution();snapshot=await host.getSnapshot();assert.equal(protectionActive(host,snapshot.scene,remote.id),false);assert.equal(snapshot.scene.economyByActor[remote.id]?.bonusAction,economyBefore!.bonusAction);assert.deepEqual(snapshot.characters,before.characters);
    const afterUndo=broadcasts.map((message)=>JSON.parse(message) as {type:string;events?:ConnectedSessionEvent[]}).filter((message)=>message.type==="event-batch");assert.equal(afterUndo.length,2);const undoEvent=afterUndo[1].events?.[0];assert.ok(undoEvent);assert.equal(undoEvent!.payload.kind,"resolution-undo");
    assert.equal((await applyConnectedClientEvents(client,[undoEvent!])).status,"applied");clientAfter=await client.getSnapshot();assert.equal(protectionActive(client,clientAfter.scene,remote.id),false);assert.equal(clientAfter.scene.economyByActor[remote.id]?.bonusAction,economyBefore!.bonusAction);assert.equal((await applyConnectedClientEvents(client,[undoEvent!])).status,"duplicate");
  } finally {tauriSessionTransport.send=originalSend;tauriSessionTransport.sendTo=originalSendTo;}
});
