import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import "../../src/app/progressionContracts";
import type { CatalogEntry, CharacterSheet, CharacterSummary, SceneVm } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import { buildCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { reconstructCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjectionReconstruction";
import { acceptHostCharacterSessionProjection } from "../../src/app/connectedCharacterProjectionHandshake";
import { applyConnectedClientEvents, connectedManifest, CONNECTED_CAPABILITIES } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { ClientSessionReplica, HostSessionLedger, type ConnectedActionRequest, type ConnectedSessionEvent, type SessionCompatibilityManifest } from "../../src/app/connectedSessionProtocol";
import { routeConnectedActionRequest } from "../../src/app/connectedActionRequestPort";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { getCharacterLibraryPersistenceStateForTests, setCharacterLibraryStoreForTests } from "../../src/app/characterLibraryRuntimeAdapter";
import { CUNNING_DISENGAGE_ACTION_ID, ROGUE_CLASS_ID } from "../../src/app/rogueCoreRuntimeAdapter";

const PEER="peer.r2.remote-cunning-disengage";
const CHARACTER_ID="char.r2.remote-rogue-disengage";
type ResolvedCatalogEntry=CatalogEntry & {contentId?:string};
type MutableAdapterState={activeCharacter:CharacterSheet;characters:CharacterSummary[];scene:SceneVm};

function entry(catalog:CatalogEntry[],contentId:string){
  const found=(catalog as ResolvedCatalogEntry[]).find((item)=>item.contentId===contentId);
  assert.ok(found,`production catalog must contain ${contentId}`);
  return found;
}

function remoteRogue(catalog:CatalogEntry[]):CharacterSheet {
  const rogue=entry(catalog,ROGUE_CLASS_ID),human=entry(catalog,"dnd.srd521.species.human"),soldier=entry(catalog,"dnd.srd521.background.soldier");
  return {
    id:CHARACTER_ID,name:"Remote Disengage Rogue",className:rogue.nameKo||rogue.nameEn,level:2,species:human.nameKo||human.nameEn,background:soldier.nameKo||soldier.nameEn,
    hp:18,maxHp:18,tempHp:0,ac:14,speed:30,proficiencyBonus:2,saveState:"saved",abilities:{str:10,dex:16,con:14,int:12,wis:12,cha:10},
    saves:[],skills:["은신"],features:["교활한 행동"],equipment:[],items:[],attacks:[],resources:[],rulesProfileId:"dnd.srd-5.2.1",rulesProfileVersion:"0.1-draft",sourceRevision:2,runtimeRevision:3,
    classLevels:[{classId:ROGUE_CLASS_ID,level:2}],
  };
}

function manifest(sheet:CharacterSheet):SessionCompatibilityManifest {
  return {protocolVersion:1,rulesProfileId:"dnd.srd-5.2.1",capabilities:[...CONNECTED_CAPABILITIES],character:{characterId:sheet.id,sourceRevision:sheet.sourceRevision??0,runtimeRevision:sheet.runtimeRevision??0}};
}

function prepareClient(client:MockAdapter,sheet:CharacterSheet,projection:ReturnType<typeof buildCharacterSessionProjectionV1>,catalog:CatalogEntry[]) {
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

const disengaged=(scene:SceneVm,id:string)=>scene.entities.find((entity)=>entity.id===id)?.status.some((status)=>status.endsWith("이탈"))??false;

test("host-unknown Rogue Cunning Disengage converges effect/economy exactly once and Undo compensates",async()=>{
  const host=new MockAdapter();await host.setReferenceRole("dm");
  const before=await host.getSnapshot(),catalog=structuredClone(before.catalog),remote=remoteRogue(catalog),remoteManifest=manifest(remote),projection=buildCharacterSessionProjectionV1(remote,catalog);
  const accepted=acceptHostCharacterSessionProjection(host,PEER,remoteManifest,projection);assert.equal(accepted.status,"accepted",accepted.status==="rejected"?accepted.error:undefined);
  const hostBefore=await host.getSnapshot(),economyBefore=structuredClone(hostBefore.scene.economyByActor[remote.id]);assert.ok(economyBefore);
  const state=connectedStateFor(host);state.mode="host";state.sessionId="session.r2.remote-cunning-disengage";state.ledger=new HostSessionLedger(state.sessionId,connectedManifest(host));state.peerManifests.set(PEER,structuredClone(remoteManifest));
  const broadcasts:string[]=[],sentToPeer:string[]=[];const originalSend=tauriSessionTransport.send,originalSendTo=tauriSessionTransport.sendTo;
  tauriSessionTransport.send=async(message:string)=>{broadcasts.push(message);return 1;};tauriSessionTransport.sendTo=async(_peer:string,message:string)=>{sentToPeer.push(message);return 1;};
  try {
    const request:ConnectedActionRequest={sessionId:state.sessionId,requestId:"request.r2.remote-cunning-disengage",actorId:remote.id,actionId:CUNNING_DISENGAGE_ACTION_ID,targetIds:[remote.id],knownEventCursor:0,character:remoteManifest.character,capabilities:[...CONNECTED_CAPABILITIES]};
    assert.equal(await routeConnectedActionRequest(host,{peer:PEER,message:""},request),true);
    assert.equal(state.pendingRemoteAction?.request.requestId,request.requestId,"Host must keep staged Cunning Disengage pending until resolution completion");
    await host.advanceResolution();
    const completed=await host.getSnapshot();assert.equal(completed.activeCharacter.id,before.activeCharacter.id);assert.deepEqual(completed.characters,before.characters);assert.equal(state.pendingRemoteAction,null);assert.equal(state.ledger.cursor,1);
    assert.equal(disengaged(completed.scene,remote.id),true);assert.equal(completed.scene.economyByActor[remote.id]?.bonusAction,false);
    const batches=broadcasts.map((message)=>JSON.parse(message) as {type:string;events?:ConnectedSessionEvent[]}).filter((message)=>message.type==="event-batch");assert.equal(batches.length,1);
    const hostEvent=batches[0].events?.[0];assert.ok(hostEvent);assert.equal(hostEvent!.sequence,1);assert.equal(hostEvent!.actorId,remote.id);assert.equal(hostEvent!.payload.kind,"resolution");
    if(hostEvent!.payload.kind!=="resolution")throw new Error("expected Host resolution event");
    const changes=hostEvent!.payload.resolutionEvents.flatMap((event)=>event.stateChanges);
    assert.ok(changes.some((change)=>change.kind==="economy"&&change.targetId===remote.id&&change.field==="bonusAction"&&change.before===true&&change.after===false));
    assert.ok(changes.some((change)=>change.kind==="effect"&&change.targetId===remote.id&&Boolean(change.after)));

    const client=new MockAdapter();setCharacterLibraryStoreForTests(client,new MemoryCharacterLibraryStore());prepareClient(client,remote,projection,catalog);
    const persistenceBefore=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;const clientState=connectedStateFor(client);clientState.mode="client";clientState.sessionId=state.sessionId;clientState.replica=new ClientSessionReplica(state.sessionId);
    const applied=await applyConnectedClientEvents(client,[hostEvent!]);assert.equal(applied.status,"applied");assert.equal(applied.cursor,1);
    let clientAfter=await client.getSnapshot();assert.equal(disengaged(clientAfter.scene,remote.id),true);assert.equal(clientAfter.scene.economyByActor[remote.id]?.bonusAction,false);assert.equal(getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0,persistenceBefore);
    assert.equal((await applyConnectedClientEvents(client,[hostEvent!])).status,"duplicate");assert.equal(getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0,persistenceBefore);
    assert.equal(await routeConnectedActionRequest(host,{peer:PEER,message:""},request),true);assert.equal(sentToPeer.length,1);assert.equal(broadcasts.filter((message)=>JSON.parse(message).type==="event-batch").length,1);

    await host.undoLastResolution();const hostUndo=await host.getSnapshot();assert.equal(disengaged(hostUndo.scene,remote.id),false);assert.equal(hostUndo.scene.economyByActor[remote.id]?.bonusAction,economyBefore!.bonusAction);
    const afterUndo=broadcasts.map((message)=>JSON.parse(message) as {type:string;events?:ConnectedSessionEvent[]}).filter((message)=>message.type==="event-batch");assert.equal(afterUndo.length,2);
    const undoEvent=afterUndo[1].events?.[0];assert.ok(undoEvent);assert.equal(undoEvent!.sequence,2);assert.equal(undoEvent!.payload.kind,"resolution-undo");
    const undoApplied=await applyConnectedClientEvents(client,[undoEvent!]);assert.equal(undoApplied.status,"applied");assert.equal(undoApplied.cursor,2);
    clientAfter=await client.getSnapshot();assert.equal(disengaged(clientAfter.scene,remote.id),false);assert.equal(clientAfter.scene.economyByActor[remote.id]?.bonusAction,economyBefore!.bonusAction);assert.equal(getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0,persistenceBefore);
    assert.equal((await applyConnectedClientEvents(client,[undoEvent!])).status,"duplicate");
  } finally {tauriSessionTransport.send=originalSend;tauriSessionTransport.sendTo=originalSendTo;}
});
