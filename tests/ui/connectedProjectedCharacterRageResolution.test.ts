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
import { projectedCharacterById } from "../../src/app/characterSessionProjectionRegistry";
import { applyConnectedClientEvents, connectedManifest, CONNECTED_CAPABILITIES } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import {
  ClientSessionReplica,
  HostSessionLedger,
  type ConnectedActionRequest,
  type ConnectedSessionEvent,
  type SessionCompatibilityManifest,
} from "../../src/app/connectedSessionProtocol";
import { routeConnectedActionRequest } from "../../src/app/connectedActionRequestPort";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import {
  getCharacterLibraryPersistenceStateForTests,
  setCharacterLibraryStoreForTests,
} from "../../src/app/characterLibraryRuntimeAdapter";
import { BARBARIAN_RAGE_RESOURCE_ID } from "../../src/domain/barbarianBerserker";

const PEER="peer.r2.remote-rage";
const CHARACTER_ID="char.r2.remote-barbarian";
const ACTION_ID="action.barbarian.rage";
type ResolvedCatalogEntry=CatalogEntry & {contentId?:string};
type MutableAdapterState={activeCharacter:CharacterSheet;characters:CharacterSummary[];scene:SceneVm};

function contentEntry(catalog:CatalogEntry[],contentId:string) {
  const found=(catalog as ResolvedCatalogEntry[]).find((entry)=>entry.contentId===contentId);
  assert.ok(found,`production catalog must contain ${contentId}`);
  return found;
}

function remoteBarbarian(catalog:CatalogEntry[]):CharacterSheet {
  const barbarian=contentEntry(catalog,"dnd.srd521.class.barbarian");
  const human=contentEntry(catalog,"dnd.srd521.species.human");
  const soldier=contentEntry(catalog,"dnd.srd521.background.soldier");
  return {
    id:CHARACTER_ID,
    name:"Remote Rage Barbarian",
    className:barbarian.nameKo||barbarian.nameEn,
    level:1,
    species:human.nameKo||human.nameEn,
    background:soldier.nameKo||soldier.nameEn,
    hp:14,maxHp:14,tempHp:0,ac:13,speed:30,proficiencyBonus:2,saveState:"saved",
    abilities:{str:16,dex:14,con:14,int:8,wis:12,cha:10},
    saves:[],skills:["운동"],features:["격노"],equipment:[],items:[],attacks:[],
    resources:[{id:BARBARIAN_RAGE_RESOURCE_ID,label:"격노",current:2,max:2,source:"SRD Barbarian"}],
    rulesProfileId:"dnd.srd-5.2.1",rulesProfileVersion:"0.1-draft",sourceRevision:2,runtimeRevision:3,
    classLevels:[{classId:"dnd.srd521.class.barbarian",level:1}],
  };
}

function manifest(sheet:CharacterSheet):SessionCompatibilityManifest {
  return {
    protocolVersion:1,rulesProfileId:"dnd.srd-5.2.1",capabilities:[...CONNECTED_CAPABILITIES],
    character:{characterId:sheet.id,sourceRevision:sheet.sourceRevision??0,runtimeRevision:sheet.runtimeRevision??0},
  };
}

function prepareOwningClient(client:MockAdapter,sheet:CharacterSheet,projection:ReturnType<typeof buildCharacterSessionProjectionV1>,catalog:CatalogEntry[]) {
  const reconstructed=reconstructCharacterSessionProjectionV1(projection,catalog);
  assert.equal(reconstructed.status,"accepted",reconstructed.status==="rejected"?reconstructed.error:undefined);
  if(reconstructed.status!=="accepted")throw new Error(reconstructed.error);
  const state=client as unknown as MutableAdapterState;
  state.activeCharacter=structuredClone(sheet);
  state.characters=[structuredClone(sheet)];
  state.scene.entities=[...state.scene.entities.filter((entity)=>entity.id!==sheet.id&&entity.kind!=="character"),structuredClone(reconstructed.entity)];
  state.scene.actionsByActor={...state.scene.actionsByActor,[sheet.id]:structuredClone(reconstructed.actions)};
  state.scene.economyByActor={...state.scene.economyByActor,[sheet.id]:structuredClone(reconstructed.economy)};
  state.scene.selectedActorId=sheet.id;
  state.scene.currentActorId=sheet.id;
}

function rageCurrent(sheet:CharacterSheet) {
  return sheet.resources.find((entry)=>entry.id===BARBARIAN_RAGE_RESOURCE_ID)?.current;
}

test("host-unknown Barbarian Rage commits through Host authority and owning-client durable apply exactly once",async()=>{
  const host=new MockAdapter();
  await host.setReferenceRole("dm");
  const before=await host.getSnapshot();
  const catalog=structuredClone(before.catalog);
  const remote=remoteBarbarian(catalog);
  const remoteManifest=manifest(remote);
  const projection=buildCharacterSessionProjectionV1(remote,catalog);
  const accepted=acceptHostCharacterSessionProjection(host,PEER,remoteManifest,projection);
  assert.equal(accepted.status,"accepted",accepted.status==="rejected"?accepted.error:undefined);

  const state=connectedStateFor(host);
  state.mode="host";
  state.sessionId="session.r2.remote-rage";
  state.ledger=new HostSessionLedger(state.sessionId,connectedManifest(host));
  state.peerManifests.set(PEER,structuredClone(remoteManifest));

  const broadcasts:string[]=[];
  const sentToPeer:string[]=[];
  const originalSend=tauriSessionTransport.send;
  const originalSendTo=tauriSessionTransport.sendTo;
  tauriSessionTransport.send=async(message:string)=>{broadcasts.push(message);return 1;};
  tauriSessionTransport.sendTo=async(_peer:string,message:string)=>{sentToPeer.push(message);return 1;};
  try {
    const request:ConnectedActionRequest={
      sessionId:state.sessionId,requestId:"request.r2.remote-rage",actorId:remote.id,actionId:ACTION_ID,targetIds:[remote.id],knownEventCursor:0,
      character:remoteManifest.character,capabilities:[...CONNECTED_CAPABILITIES],
    };
    assert.equal(await routeConnectedActionRequest(host,{peer:PEER,message:""},request),true);
    const completed=await host.getSnapshot();
    assert.equal(completed.activeCharacter.id,before.activeCharacter.id,"Host local Character context must restore after remote Rage commit");
    assert.deepEqual(completed.characters,before.characters,"Host permanent Character library must remain unchanged");
    assert.equal(state.pendingRemoteAction,null);
    assert.equal(state.ledger.cursor,1);
    const mounted=projectedCharacterById(host,remote.id);
    assert.ok(mounted);
    assert.equal(rageCurrent(mounted!.sheet),1,"Host ephemeral projection must spend one Rage use");

    const batches=broadcasts.map((message)=>JSON.parse(message) as {type:string;events?:ConnectedSessionEvent[]}).filter((message)=>message.type==="event-batch");
    assert.equal(batches.length,1,"remote Rage must commit exactly one ordered event batch");
    const hostEvent=batches[0].events?.[0];
    assert.ok(hostEvent);
    assert.equal(hostEvent!.sequence,1);
    assert.equal(hostEvent!.actorId,remote.id);
    assert.equal(hostEvent!.payload.kind,"resolution");
    if(hostEvent!.payload.kind!=="resolution")throw new Error("expected Host resolution event");
    const changes=hostEvent!.payload.resolutionEvents.flatMap((event)=>event.stateChanges);
    assert.ok(changes.some((change)=>change.kind==="resource"&&change.targetId===remote.id&&change.resourceId===BARBARIAN_RAGE_RESOURCE_ID&&change.before===2&&change.after===1));
    assert.ok(changes.some((change)=>change.kind==="effect"&&change.targetId===remote.id&&change.operation==="added"));

    const clientStore=new MemoryCharacterLibraryStore();
    const client=new MockAdapter();
    setCharacterLibraryStoreForTests(client,clientStore);
    prepareOwningClient(client,remote,projection,catalog);
    const persistenceBefore=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;
    const clientState=connectedStateFor(client);
    clientState.mode="client";
    clientState.sessionId=state.sessionId;
    clientState.replica=new ClientSessionReplica(state.sessionId);

    const applied=await applyConnectedClientEvents(client,[hostEvent!]);
    assert.equal(applied.status,"applied");
    assert.equal(applied.cursor,1);
    const clientAfter=await client.getSnapshot();
    assert.equal(rageCurrent(clientAfter.activeCharacter),1);
    const persistenceAfter=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;
    assert.ok(persistenceAfter>persistenceBefore,"owning client must persist Host-confirmed Rage resource spend before cursor advancement");

    const duplicate=await applyConnectedClientEvents(client,[hostEvent!]);
    assert.equal(duplicate.status,"duplicate");
    assert.equal(rageCurrent((await client.getSnapshot()).activeCharacter),1);
    assert.equal(getCharacterLibraryPersistenceStateForTests(client)?.storageRevision,persistenceAfter,"duplicate Host event must not create another Character generation");

    assert.equal(await routeConnectedActionRequest(host,{peer:PEER,message:""},request),true);
    assert.equal(broadcasts.map((message)=>JSON.parse(message) as {type:string}).filter((message)=>message.type==="event-batch").length,1,"duplicate request must not create a second Host state broadcast");
    assert.equal(sentToPeer.length,1,"duplicate request must return the committed event to the acting peer");
    const replay=JSON.parse(sentToPeer[0]) as {type:string;events:Array<{sequence:number}>};
    assert.equal(replay.type,"event-batch");
    assert.equal(replay.events[0].sequence,1);
  } finally {
    tauriSessionTransport.send=originalSend;
    tauriSessionTransport.sendTo=originalSendTo;
  }
});
