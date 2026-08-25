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
import { BARBARIAN_CLASS_ID, BARBARIAN_RAGE_RESOURCE_ID } from "../../src/domain/barbarianBerserker";

const PEER="peer.rage.remote";
type ResolvedCatalogEntry=CatalogEntry & {contentId?:string;sourceId?:string};
type MutableAdapterState={activeCharacter:CharacterSheet;characters:CharacterSummary[];scene:SceneVm};
type BatchWire={type:string;events?:ConnectedSessionEvent[]};

function contentEntry(catalog:CatalogEntry[],contentId:string) {
  const found=(catalog as ResolvedCatalogEntry[]).find((entry)=>entry.contentId===contentId);
  assert.ok(found,`production catalog must contain ${contentId}`);
  return found;
}

function remoteBarbarian(catalog:CatalogEntry[]):CharacterSheet {
  const barbarian=contentEntry(catalog,BARBARIAN_CLASS_ID);
  const human=contentEntry(catalog,"dnd.srd521.species.human");
  const soldier=contentEntry(catalog,"dnd.srd521.background.soldier");
  return {
    id:"char.rage.remote-barbarian",
    name:"Remote Barbarian",
    className:barbarian.nameKo || barbarian.nameEn,
    level:1,
    species:human.nameKo || human.nameEn,
    background:soldier.nameKo || soldier.nameEn,
    hp:14,
    maxHp:14,
    tempHp:0,
    ac:14,
    speed:30,
    proficiencyBonus:2,
    saveState:"saved",
    abilities:{str:16,dex:14,con:16,int:8,wis:12,cha:10},
    saves:[],
    skills:["운동"],
    features:["Rage"],
    equipment:[],
    items:[],
    resources:[{id:BARBARIAN_RAGE_RESOURCE_ID,label:"격노",current:2,max:2,source:"SRD Barbarian"}],
    attacks:[],
    rulesProfileId:"dnd.srd-5.2.1",
    rulesProfileVersion:"0.1-draft",
    sourceRevision:2,
    runtimeRevision:3,
    classLevels:[{classId:BARBARIAN_CLASS_ID,level:1}],
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

test("remote owner Rage commits once, reconnects from the event cursor, and Undo restores the authoritative start",async()=>{
  const host=new MockAdapter();
  await host.setReferenceRole("dm");
  await host.endInitiative();
  const before=await host.getSnapshot();
  const catalog=structuredClone(before.catalog);
  const remote=remoteBarbarian(catalog);
  const remoteManifest=manifest(remote);
  const projection=buildCharacterSessionProjectionV1(remote,catalog);
  const accepted=acceptHostCharacterSessionProjection(host,PEER,remoteManifest,projection);
  assert.equal(accepted.status,"accepted",accepted.status==="rejected"?accepted.error:undefined);

  const state=connectedStateFor(host);
  state.mode="host";
  state.sessionId="session.rage.connected";
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
      sessionId:state.sessionId,
      requestId:"request.rage.start",
      actorId:remote.id,
      actionId:"action.barbarian.rage",
      targetIds:[remote.id],
      knownEventCursor:0,
      character:remoteManifest.character,
      capabilities:[...CONNECTED_CAPABILITIES],
    };
    assert.equal(await routeConnectedActionRequest(host,{peer:PEER,message:""},request),true);
    const completed=await finishResolution(host);
    assert.equal(completed.activeCharacter.id,before.activeCharacter.id,"host local Character context must be restored after remote Rage");
    const mounted=projectedCharacterById(host,remote.id);
    assert.ok(mounted);
    assert.equal(mounted?.sheet.resources.find((resource)=>resource.id===BARBARIAN_RAGE_RESOURCE_ID)?.current,1);

    const batches=broadcasts.map((message)=>JSON.parse(message) as BatchWire).filter((message)=>message.type==="event-batch");
    assert.equal(batches.length,1,"remote Rage must broadcast exactly one canonical event batch");
    assert.equal(batches[0].events?.length,1);
    const rageEvent=batches[0].events![0];
    assert.equal(rageEvent.sequence,1);
    assert.equal(rageEvent.actorId,remote.id);
    assert.equal(rageEvent.payload.kind,"resolution");
    if(rageEvent.payload.kind!=="resolution")throw new Error("expected Rage resolution event");
    const resolutionId=rageEvent.payload.resolutionId;

    const client=new MockAdapter();
    prepareOwningClient(client,remote,projection,catalog);
    const clientState=connectedStateFor(client);
    clientState.mode="client";
    clientState.sessionId=state.sessionId;
    clientState.replica=new ClientSessionReplica(state.sessionId);
    assert.equal((await applyConnectedClientEvents(client,[rageEvent])).status,"applied");
    let clientSnapshot=await client.getSnapshot();
    assert.equal(clientSnapshot.activeCharacter.resources.find((resource)=>resource.id===BARBARIAN_RAGE_RESOURCE_ID)?.current,1);
    assert.equal(clientSnapshot.scene.actionsByActor[remote.id]?.find((action)=>action.id==="action.barbarian.rage")?.available,false,"connected owner must see active Rage as unavailable to start again");

    const duplicateApply=await applyConnectedClientEvents(client,[rageEvent]);
    assert.equal(duplicateApply.status,"duplicate");
    assert.equal(clientState.replica.cursor,1);
    assert.equal(state.ledger.eventsAfter(clientState.replica.cursor).length,0,"reconnect from the acknowledged cursor must not replay Rage");
    clientSnapshot=await client.getSnapshot();
    assert.equal(clientSnapshot.activeCharacter.resources.find((resource)=>resource.id===BARBARIAN_RAGE_RESOURCE_ID)?.current,1);

    assert.equal(await routeConnectedActionRequest(host,{peer:PEER,message:""},request),true);
    assert.equal(broadcasts.map((message)=>JSON.parse(message) as BatchWire).filter((message)=>message.type==="event-batch").length,1,"duplicate ActionRequest must not spend a second Rage use");
    assert.equal(sentToPeer.length,1,"duplicate ActionRequest must replay the committed host event directly to its owner");
    assert.equal(projectedCharacterById(host,remote.id)?.sheet.resources.find((resource)=>resource.id===BARBARIAN_RAGE_RESOURCE_ID)?.current,1);

    await host.undoLastResolution();
    const committedBatches=broadcasts.map((message)=>JSON.parse(message) as BatchWire).filter((message)=>message.type==="event-batch");
    assert.equal(committedBatches.length,2);
    const undoEvent=committedBatches[1].events?.[0];
    assert.ok(undoEvent);
    assert.equal(undoEvent.sequence,2);
    assert.equal(undoEvent.payload.kind,"resolution-undo");
    if(undoEvent.payload.kind!=="resolution-undo")throw new Error("expected Rage resolution-undo event");
    assert.equal(undoEvent.payload.undoOf,resolutionId);
    assert.equal(projectedCharacterById(host,remote.id)?.sheet.resources.find((resource)=>resource.id===BARBARIAN_RAGE_RESOURCE_ID)?.current,2);

    assert.equal((await applyConnectedClientEvents(client,[undoEvent])).status,"applied");
    clientSnapshot=await client.getSnapshot();
    assert.equal(clientSnapshot.activeCharacter.resources.find((resource)=>resource.id===BARBARIAN_RAGE_RESOURCE_ID)?.current,2);
    assert.equal(clientSnapshot.scene.actionsByActor[remote.id]?.find((action)=>action.id==="action.barbarian.rage")?.available,true);
    assert.equal(clientSnapshot.activity.find((entry)=>entry.id===resolutionId)?.reversed,true);
    assert.equal((await applyConnectedClientEvents(client,[undoEvent])).status,"duplicate");
    assert.equal((await client.getSnapshot()).activeCharacter.resources.find((resource)=>resource.id===BARBARIAN_RAGE_RESOURCE_ID)?.current,2);
  } finally {
    tauriSessionTransport.send=originalSend;
    tauriSessionTransport.sendTo=originalSendTo;
  }
});
