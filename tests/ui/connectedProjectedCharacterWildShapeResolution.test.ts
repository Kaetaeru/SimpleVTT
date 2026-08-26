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
import { DRUID_ID, DRUID_WILD_SHAPE_RESOURCE_ID } from "../../src/domain/coreClassResources";
import type { DruidWildShapeForm } from "../../src/domain/druidWildShape";

const PEER="peer.r2.remote-wild-shape";
const CHARACTER_ID="char.r2.remote-druid";
const ACTION_ID="action.druid.wild-shape.form.dnd.srd521.beast.wolf";
type ResolvedCatalogEntry=CatalogEntry & {contentId?:string};
type MutableAdapterState={activeCharacter:CharacterSheet;characters:CharacterSummary[];scene:SceneVm};

const wolf:DruidWildShapeForm={
  id:"dnd.srd521.beast.wolf",
  name:"늑대",
  challengeRating:0.25,
  hasFlySpeed:false,
  armorClass:12,
  speedFeet:40,
};

function contentEntry(catalog:CatalogEntry[],contentId:string) {
  const found=(catalog as ResolvedCatalogEntry[]).find((entry)=>entry.contentId===contentId);
  assert.ok(found,`production catalog must contain ${contentId}`);
  return found;
}

function remoteDruid(catalog:CatalogEntry[]):CharacterSheet {
  const druid=contentEntry(catalog,DRUID_ID);
  const human=contentEntry(catalog,"dnd.srd521.species.human");
  const soldier=contentEntry(catalog,"dnd.srd521.background.soldier");
  return {
    id:CHARACTER_ID,
    name:"Remote Wild Shape Druid",
    className:druid.nameKo||druid.nameEn,
    level:5,
    species:human.nameKo||human.nameEn,
    background:soldier.nameKo||soldier.nameEn,
    hp:28,maxHp:28,tempHp:0,ac:13,speed:30,proficiencyBonus:3,saveState:"saved",
    abilities:{str:10,dex:14,con:14,int:10,wis:16,cha:8},
    saves:[],skills:["자연","지각"],features:["야생 변신"],equipment:[],items:[],attacks:[],
    resources:[{
      id:DRUID_WILD_SHAPE_RESOURCE_ID,label:"야생 변신",current:2,max:2,source:"SRD Druid",
      recovery:{shortRest:1,longRest:"all"},
    }],
    wildShapeKnownForms:[wolf],
    rulesProfileId:"dnd.srd-5.2.1",rulesProfileVersion:"0.1-draft",sourceRevision:2,runtimeRevision:3,
    classLevels:[{classId:DRUID_ID,level:5}],
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
  assert.deepEqual(reconstructed.sheet.wildShapeKnownForms,[wolf],"SessionProjection must preserve the owner's known Wild Shape forms");
  const state=client as unknown as MutableAdapterState;
  state.activeCharacter=structuredClone(sheet);
  state.characters=[structuredClone(sheet)];
  state.scene.entities=[...state.scene.entities.filter((entity)=>entity.id!==sheet.id&&entity.kind!=="character"),structuredClone(reconstructed.entity)];
  state.scene.actionsByActor={...state.scene.actionsByActor,[sheet.id]:structuredClone(reconstructed.actions)};
  state.scene.economyByActor={...state.scene.economyByActor,[sheet.id]:structuredClone(reconstructed.economy)};
  state.scene.selectedActorId=sheet.id;
  state.scene.currentActorId=sheet.id;
}

function wildShapeCurrent(sheet:CharacterSheet) {
  return sheet.resources.find((entry)=>entry.id===DRUID_WILD_SHAPE_RESOURCE_ID)?.current;
}

test("host-unknown Druid Wild Shape preserves known form facts and commits through Host authority exactly once",async()=>{
  const host=new MockAdapter();
  await host.setReferenceRole("dm");
  const before=await host.getSnapshot();
  const catalog=structuredClone(before.catalog);
  const remote=remoteDruid(catalog);
  const remoteManifest=manifest(remote);
  const projection=buildCharacterSessionProjectionV1(remote,catalog);
  const reconstructed=reconstructCharacterSessionProjectionV1(projection,catalog);
  assert.equal(reconstructed.status,"accepted",reconstructed.status==="rejected"?reconstructed.error:undefined);
  if(reconstructed.status!=="accepted")throw new Error(reconstructed.error);
  assert.deepEqual(reconstructed.sheet.wildShapeKnownForms,[wolf]);
  const accepted=acceptHostCharacterSessionProjection(host,PEER,remoteManifest,projection);
  assert.equal(accepted.status,"accepted",accepted.status==="rejected"?accepted.error:undefined);

  const state=connectedStateFor(host);
  state.mode="host";
  state.sessionId="session.r2.remote-wild-shape";
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
      sessionId:state.sessionId,requestId:"request.r2.remote-wild-shape",actorId:remote.id,actionId:ACTION_ID,targetIds:[remote.id],knownEventCursor:0,
      character:remoteManifest.character,capabilities:[...CONNECTED_CAPABILITIES],
    };
    assert.equal(await routeConnectedActionRequest(host,{peer:PEER,message:""},request),true);
    const completed=await host.getSnapshot();
    assert.equal(completed.activeCharacter.id,before.activeCharacter.id,"Host local Character context must restore after remote Wild Shape commit");
    assert.deepEqual(completed.characters,before.characters,"Host permanent Character library must remain unchanged");
    assert.equal(state.pendingRemoteAction,null);
    assert.equal(state.ledger.cursor,1);
    const mounted=projectedCharacterById(host,remote.id);
    assert.ok(mounted);
    assert.equal(wildShapeCurrent(mounted!.sheet),1,"Host ephemeral projection must spend one Wild Shape use");
    assert.equal(mounted!.sheet.tempHp,5,"Host ephemeral projection must receive Druid-level temporary HP");

    const batches=broadcasts.map((message)=>JSON.parse(message) as {type:string;events?:ConnectedSessionEvent[]}).filter((message)=>message.type==="event-batch");
    assert.equal(batches.length,1,"remote Wild Shape must commit exactly one ordered event batch");
    const hostEvent=batches[0].events?.[0];
    assert.ok(hostEvent);
    assert.equal(hostEvent!.sequence,1);
    assert.equal(hostEvent!.actorId,remote.id);
    assert.equal(hostEvent!.payload.kind,"resolution");
    if(hostEvent!.payload.kind!=="resolution")throw new Error("expected Host resolution event");
    const changes=hostEvent!.payload.resolutionEvents.flatMap((event)=>event.stateChanges);
    assert.ok(changes.some((change)=>change.kind==="resource"&&change.targetId===remote.id&&change.resourceId===DRUID_WILD_SHAPE_RESOURCE_ID&&change.before===2&&change.after===1));
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
    assert.equal(wildShapeCurrent(clientAfter.activeCharacter),1);
    assert.equal(clientAfter.activeCharacter.tempHp,5);
    const persistenceAfter=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;
    assert.ok(persistenceAfter>persistenceBefore,"owning client must persist Host-confirmed Wild Shape changes before cursor advancement");

    const duplicate=await applyConnectedClientEvents(client,[hostEvent!]);
    assert.equal(duplicate.status,"duplicate");
    assert.equal(wildShapeCurrent((await client.getSnapshot()).activeCharacter),1);
    assert.equal(getCharacterLibraryPersistenceStateForTests(client)?.storageRevision,persistenceAfter,"duplicate Host event must not create another Character generation");

    assert.equal(await routeConnectedActionRequest(host,{peer:PEER,message:""},request),true);
    assert.equal(broadcasts.map((message)=>JSON.parse(message) as {type:string}).filter((message)=>message.type==="event-batch").length,1,"duplicate request must not create a second Host state broadcast");
    assert.equal(sentToPeer.length,1,"duplicate request must return the committed event to the acting peer");
    const replay=JSON.parse(sentToPeer[0]) as {type:string;events:Array<{sequence:number}>};
    assert.equal(replay.type,"event-batch");
    assert.equal(replay.events[0].sequence,1);

    const persistenceBeforeUndo=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;
    await host.undoLastResolution();
    const hostAfterUndo=await host.getSnapshot();
    assert.equal(hostAfterUndo.activeCharacter.id,before.activeCharacter.id,"Host local Character context must remain restored after remote Wild Shape Undo");
    assert.deepEqual(hostAfterUndo.characters,before.characters,"Host permanent Character library must remain unchanged by remote Wild Shape Undo");
    const mountedAfterUndo=projectedCharacterById(host,remote.id);
    assert.ok(mountedAfterUndo);
    assert.equal(wildShapeCurrent(mountedAfterUndo!.sheet),2,"Host ephemeral projection must restore the remote owner's Wild Shape use on Undo");
    assert.equal(mountedAfterUndo!.sheet.tempHp,0,"Host ephemeral projection must restore pre-Wild-Shape temporary HP on Undo");

    const batchesAfterUndo=broadcasts.map((message)=>JSON.parse(message) as {type:string;events?:ConnectedSessionEvent[]}).filter((message)=>message.type==="event-batch");
    assert.equal(batchesAfterUndo.length,2,"remote Wild Shape Undo must publish one compensating ordered event batch");
    const undoEvent=batchesAfterUndo[1].events?.[0];
    assert.ok(undoEvent);
    assert.equal(undoEvent!.sequence,2);
    assert.equal(undoEvent!.payload.kind,"resolution-undo");

    const undoApplied=await applyConnectedClientEvents(client,[undoEvent!]);
    assert.equal(undoApplied.status,"applied");
    assert.equal(undoApplied.cursor,2);
    const clientAfterUndo=await client.getSnapshot();
    assert.equal(wildShapeCurrent(clientAfterUndo.activeCharacter),2,"owning Client must converge the compensating Wild Shape resource restore");
    assert.equal(clientAfterUndo.activeCharacter.tempHp,0,"owning Client must converge the compensating temporary HP restore");
    const persistenceAfterUndo=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;
    assert.ok(persistenceAfterUndo>persistenceBeforeUndo,"owning Client must durably persist the compensating Wild Shape restore before cursor advancement");

    const duplicateUndo=await applyConnectedClientEvents(client,[undoEvent!]);
    assert.equal(duplicateUndo.status,"duplicate");
    assert.equal(wildShapeCurrent((await client.getSnapshot()).activeCharacter),2);
    assert.equal(getCharacterLibraryPersistenceStateForTests(client)?.storageRevision,persistenceAfterUndo,"duplicate Undo event must not create another Character generation");
  } finally {
    tauriSessionTransport.send=originalSend;
    tauriSessionTransport.sendTo=originalSendTo;
  }
});
