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

const PEER="peer.phase13.remote";
type ResolvedCatalogEntry=CatalogEntry & {contentId?:string;sourceId?:string};
type MutableAdapterState={
  activeCharacter:CharacterSheet;
  characters:CharacterSummary[];
  scene:SceneVm;
};

function contentEntry(catalog:CatalogEntry[],contentId:string) {
  const found=(catalog as ResolvedCatalogEntry[]).find((entry)=>entry.contentId===contentId);
  assert.ok(found,`production catalog must contain ${contentId}`);
  return found;
}

function remoteCharacter(catalog:CatalogEntry[]):CharacterSheet {
  const fighter=contentEntry(catalog,"dnd.srd521.class.fighter");
  const human=contentEntry(catalog,"dnd.srd521.species.human");
  const soldier=contentEntry(catalog,"dnd.srd521.background.soldier");
  return {
    id:"char.phase13.remote-fighter",
    name:"Remote Fighter",
    className:fighter.nameKo || fighter.nameEn,
    level:1,
    species:human.nameKo || human.nameEn,
    background:soldier.nameKo || soldier.nameEn,
    hp:4,
    maxHp:12,
    tempHp:0,
    ac:12,
    speed:30,
    proficiencyBonus:2,
    saveState:"saved",
    abilities:{str:16,dex:14,con:14,int:10,wis:12,cha:8},
    saves:[],
    skills:["운동"],
    features:["Second Wind"],
    equipment:[],
    items:[],
    resources:[{id:"resource.second-wind",label:"재기의 바람",current:2,max:2,source:"SRD Fighter"}],
    attacks:[],
    rulesProfileId:"dnd.srd-5.2.1",
    rulesProfileVersion:"0.1-draft",
    sourceRevision:2,
    runtimeRevision:3,
    classLevels:[{classId:"dnd.srd521.class.fighter",level:1}],
  };
}

function manifest(sheet:CharacterSheet):SessionCompatibilityManifest {
  return {
    protocolVersion:1,
    rulesProfileId:"dnd.srd-5.2.1",
    capabilities:[...CONNECTED_CAPABILITIES],
    character:{characterId:sheet.id,sourceRevision:sheet.sourceRevision??0,runtimeRevision:sheet.runtimeRevision??0},
  };
}

function prepareOwningClient(
  client:MockAdapter,
  sheet:CharacterSheet,
  projection:ReturnType<typeof buildCharacterSessionProjectionV1>,
  catalog:CatalogEntry[],
) {
  const reconstructed=reconstructCharacterSessionProjectionV1(projection,catalog);
  assert.equal(reconstructed.status,"accepted",reconstructed.status==="rejected"?reconstructed.error:undefined);
  if (reconstructed.status!=="accepted") throw new Error(reconstructed.error);
  const state=client as unknown as MutableAdapterState;
  state.activeCharacter=structuredClone(sheet);
  state.characters=[structuredClone(sheet)];
  state.scene.entities=[
    ...state.scene.entities.filter((entity)=>entity.id!==sheet.id && entity.kind!=="character"),
    structuredClone(reconstructed.entity),
  ];
  state.scene.actionsByActor={...state.scene.actionsByActor,[sheet.id]:structuredClone(reconstructed.actions)};
  state.scene.economyByActor={...state.scene.economyByActor,[sheet.id]:structuredClone(reconstructed.economy)};
  state.scene.selectedActorId=sheet.id;
  state.scene.currentActorId=sheet.id;
}

async function finishResolution(adapter:MockAdapter) {
  let snapshot=await adapter.getSnapshot();
  for (let step=0;step<8&&snapshot.resolution?.stage!=="complete";step+=1) {
    assert.equal(snapshot.resolution?.canAdvance,true,`projected resolution stalled at ${snapshot.resolution?.stage}`);
    snapshot=await adapter.advanceResolution();
  }
  assert.equal(snapshot.resolution?.stage,"complete");
  return snapshot;
}

test("host-unknown projected Fighter resolves through host authority and converges once into the owning client Character library", async () => {
  const host=new MockAdapter();
  await host.setReferenceRole("dm");
  const before=await host.getSnapshot();
  const hostCatalog=structuredClone(before.catalog);
  const remote=remoteCharacter(hostCatalog);
  const remoteManifest=manifest(remote);
  const projection=buildCharacterSessionProjectionV1(remote,hostCatalog);
  const accepted=acceptHostCharacterSessionProjection(host,PEER,remoteManifest,projection);
  assert.equal(accepted.status,"accepted",accepted.status==="rejected"?accepted.error:undefined);

  const state=connectedStateFor(host);
  state.mode="host";
  state.sessionId="session.phase13.projected";
  state.ledger=new HostSessionLedger(state.sessionId,connectedManifest(host));
  state.peerManifests.set(PEER,structuredClone(remoteManifest));

  const sentToPeer:string[]=[];
  const broadcasts:string[]=[];
  const originalSend=tauriSessionTransport.send;
  const originalSendTo=tauriSessionTransport.sendTo;
  tauriSessionTransport.send=async (message:string)=>{broadcasts.push(message);return 1;};
  tauriSessionTransport.sendTo=async (_peer:string,message:string)=>{sentToPeer.push(message);return 1;};

  try {
    const request:ConnectedActionRequest={
      sessionId:state.sessionId,
      requestId:"request.phase13.second-wind",
      actorId:remote.id,
      actionId:"action.second-wind",
      targetIds:[remote.id],
      knownEventCursor:0,
      character:remoteManifest.character,
      capabilities:[...CONNECTED_CAPABILITIES],
    };
    assert.equal(await routeConnectedActionRequest(host,{peer:PEER,message:""},request),true);
    const afterRoute=await host.getSnapshot();
    if (afterRoute.resolution?.stage!=="complete") {
      assert.equal(afterRoute.activeCharacter.id,remote.id,"staged remote resolution must run in the projected Character context");
      assert.equal(connectedStateFor(host).pendingRemoteAction?.request.requestId,request.requestId);
    } else {
      assert.equal(afterRoute.activeCharacter.id,before.activeCharacter.id,"immediate canonical commit must already restore the host local Character context");
      assert.equal(connectedStateFor(host).pendingRemoteAction,null);
    }

    const completed=await finishResolution(host);
    assert.equal(completed.activeCharacter.id,before.activeCharacter.id,"host local Character context must be restored after canonical commit");
    assert.equal(connectedStateFor(host).pendingRemoteAction,null);
    assert.equal(connectedStateFor(host).ledger?.cursor,1);
    assert.equal(completed.characters.some((entry)=>entry.id===remote.id),false,"host permanent Character library must not gain a SessionProjection record");
    assert.deepEqual(completed.characters,before.characters);

    const mounted=projectedCharacterById(host,remote.id);
    assert.ok(mounted);
    assert.equal(mounted?.sheet.resources.find((resource)=>resource.id==="resource.second-wind")?.current,1);
    assert.ok((mounted?.sheet.hp??0)>remote.hp,"host ephemeral projected HP must receive the committed healing event");
    assert.ok((mounted?.sheet.hp??0)<=remote.maxHp);

    assert.equal(broadcasts.length,1,"canonical remote commit must broadcast exactly one ordered event batch");
    const batch=JSON.parse(broadcasts[0]) as {type:string;events:ConnectedSessionEvent[]};
    assert.equal(batch.type,"event-batch");
    assert.equal(batch.events.length,1);
    const hostEvent=batch.events[0];
    assert.equal(hostEvent.sequence,1);
    assert.equal(hostEvent.actorId,remote.id);
    assert.equal(hostEvent.payload.kind,"resolution");
    if (hostEvent.payload.kind!=="resolution") throw new Error("expected host resolution event");
    assert.ok(hostEvent.payload.resolutionEvents.length>0);
    assert.equal(sentToPeer.length,0);

    const clientStore=new MemoryCharacterLibraryStore();
    const client=new MockAdapter();
    setCharacterLibraryStoreForTests(client,clientStore);
    prepareOwningClient(client,remote,projection,hostCatalog);
    const clientBaseline=await client.getSnapshot();
    assert.equal(clientBaseline.activeCharacter.id,remote.id);
    const persistenceBefore=getCharacterLibraryPersistenceStateForTests(client);
    const clientState=connectedStateFor(client);
    clientState.mode="client";
    clientState.sessionId=state.sessionId;
    clientState.replica=new ClientSessionReplica(state.sessionId);

    const applied=await applyConnectedClientEvents(client,[hostEvent]);
    assert.equal(applied.status,"applied");
    assert.equal(applied.cursor,1);
    const clientAfter=await client.getSnapshot();
    assert.equal(clientAfter.activeCharacter.hp,mounted?.sheet.hp);
    assert.equal(clientAfter.activeCharacter.resources.find((resource)=>resource.id==="resource.second-wind")?.current,1);
    const persistenceAfter=getCharacterLibraryPersistenceStateForTests(client);
    assert.ok((persistenceAfter?.storageRevision??0)>(persistenceBefore?.storageRevision??0),"owning client must persist the host-confirmed durable mutation before cursor advancement");

    const storageRevisionAfterFirstApply=persistenceAfter?.storageRevision;
    const duplicateApply=await applyConnectedClientEvents(client,[hostEvent]);
    assert.equal(duplicateApply.status,"duplicate");
    assert.equal(duplicateApply.cursor,1);
    const clientAfterDuplicate=await client.getSnapshot();
    assert.equal(clientAfterDuplicate.activeCharacter.hp,clientAfter.activeCharacter.hp);
    assert.equal(clientAfterDuplicate.activeCharacter.resources.find((resource)=>resource.id==="resource.second-wind")?.current,1);
    assert.equal(getCharacterLibraryPersistenceStateForTests(client)?.storageRevision,storageRevisionAfterFirstApply,"duplicate host event must not create another Character generation");

    const reloadedClient=new MockAdapter();
    setCharacterLibraryStoreForTests(reloadedClient,clientStore);
    const reloaded=await reloadedClient.getSnapshot();
    assert.equal(reloaded.activeCharacter.id,remote.id,"persisted player-owned Character must remain the library active Character after restart");
    assert.equal(reloaded.activeCharacter.hp,clientAfter.activeCharacter.hp);
    assert.equal(reloaded.activeCharacter.resources.find((resource)=>resource.id==="resource.second-wind")?.current,1);

    assert.equal(await routeConnectedActionRequest(host,{peer:PEER,message:""},request),true);
    assert.equal(broadcasts.length,1,"duplicate request must not create a second host broadcast");
    assert.equal(sentToPeer.length,1,"duplicate request should return the already committed event directly to the peer");
    const duplicate=JSON.parse(sentToPeer[0]) as {type:string;events:Array<{sequence:number}>};
    assert.equal(duplicate.type,"event-batch");
    assert.equal(duplicate.events[0].sequence,1);
  } finally {
    tauriSessionTransport.send=originalSend;
    tauriSessionTransport.sendTo=originalSendTo;
  }
});
