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

const PEER="peer.phase14.remote-inventory";
const CHARACTER_ID="char.phase14.remote-inventory-fighter";
const POTION_ID="item.phase14.remote-inventory-fighter.healing-potion";
const POTION_DEFINITION_ID="dnd.srd521.item.gear.potion-of-healing";
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

function remoteInventoryCharacter(catalog:CatalogEntry[]):CharacterSheet {
  const fighter=contentEntry(catalog,"dnd.srd521.class.fighter");
  const human=contentEntry(catalog,"dnd.srd521.species.human");
  const soldier=contentEntry(catalog,"dnd.srd521.background.soldier");
  contentEntry(catalog,POTION_DEFINITION_ID);
  return {
    id:CHARACTER_ID,
    name:"Remote Inventory Fighter",
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
    equipment:["치유 물약 ×2"],
    items:[{
      id:POTION_ID,
      definitionId:POTION_DEFINITION_ID,
      name:"치유 물약",
      nameEn:"Potion of Healing",
      kind:"consumable",
      quantity:2,
      equipped:false,
      passiveEffects:[],
      grantedActionIds:["action.healing-potion"],
      provenance:["SRD 5.2.1 · Potion of Healing","Phase 14 remote persisted ItemInstance"],
    }],
    resources:[{id:"resource.second-wind",label:"재기의 바람",current:2,max:2,source:"SRD Fighter"}],
    attacks:[],
    rulesProfileId:"dnd.srd-5.2.1",
    rulesProfileVersion:"0.1-draft",
    sourceRevision:4,
    runtimeRevision:5,
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
    assert.equal(snapshot.resolution?.canAdvance,true,`projected inventory resolution stalled at ${snapshot.resolution?.stage}`);
    snapshot=await adapter.advanceResolution();
  }
  assert.equal(snapshot.resolution?.stage,"complete");
  return snapshot;
}

function potionQuantity(sheet:CharacterSheet) {
  return sheet.items.find((item)=>item.id===POTION_ID)?.quantity;
}

test("host-unknown projected Character uses its persisted potion through Host authority and owning-client durable apply exactly once",async()=>{
  const host=new MockAdapter();
  await host.setReferenceRole("dm");
  const before=await host.getSnapshot();
  const hostCatalog=structuredClone(before.catalog);
  const remote=remoteInventoryCharacter(hostCatalog);
  const remoteManifest=manifest(remote);
  const projection=buildCharacterSessionProjectionV1(remote,hostCatalog);
  const accepted=acceptHostCharacterSessionProjection(host,PEER,remoteManifest,projection);
  assert.equal(accepted.status,"accepted",accepted.status==="rejected"?accepted.error:undefined);

  const mountedBefore=projectedCharacterById(host,remote.id);
  assert.ok(mountedBefore);
  assert.equal(potionQuantity(mountedBefore!.sheet),2);
  const projectedPotion=mountedBefore!.sheet.items.find((item)=>item.id===POTION_ID);
  assert.ok(projectedPotion);
  assert.equal(projectedPotion?.definitionId,POTION_DEFINITION_ID);
  assert.equal(projectedPotion?.kind,"consumable");
  const projectedAction=mountedBefore!.actions.find((action)=>action.id==="action.healing-potion");
  assert.ok(projectedAction,"host must reconstruct the supported persisted potion as an executable projected action");
  assert.equal(projectedAction?.actorId,remote.id);
  assert.equal(projectedAction?.itemCost?.itemId,POTION_ID);
  assert.equal(projectedAction?.itemCost?.quantity,1);

  const state=connectedStateFor(host);
  state.mode="host";
  state.sessionId="session.phase14.remote-inventory";
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
      requestId:"request.phase14.remote-healing-potion",
      actorId:remote.id,
      actionId:"action.healing-potion",
      targetIds:[remote.id],
      knownEventCursor:0,
      character:remoteManifest.character,
      capabilities:[...CONNECTED_CAPABILITIES],
    };
    assert.equal(await routeConnectedActionRequest(host,{peer:PEER,message:""},request),true);
    const routed=await host.getSnapshot();
    assert.equal(routed.activeCharacter.id,remote.id,"staged potion resolution must execute in projected Character context");
    assert.equal(connectedStateFor(host).pendingRemoteAction?.request.requestId,request.requestId);
    assert.equal(potionQuantity(routed.activeCharacter),2,"remote item quantity must not be spent during roll preview");

    const completed=await finishResolution(host);
    assert.equal(completed.activeCharacter.id,before.activeCharacter.id,"host local Character context must restore after remote item commit");
    assert.equal(connectedStateFor(host).pendingRemoteAction,null);
    assert.equal(connectedStateFor(host).ledger?.cursor,1);
    assert.deepEqual(completed.characters,before.characters,"host permanent Character library must remain unchanged");

    const mountedAfter=projectedCharacterById(host,remote.id);
    assert.ok(mountedAfter);
    assert.equal(potionQuantity(mountedAfter!.sheet),1,"host ephemeral projection must receive committed item quantity");
    assert.ok(mountedAfter!.sheet.hp>remote.hp,"host ephemeral projection must receive committed healing");
    assert.ok(mountedAfter!.sheet.hp<=remote.maxHp);

    assert.equal(broadcasts.length,1,"remote item commit must broadcast exactly one ordered event batch");
    const batch=JSON.parse(broadcasts[0]) as {type:string;events:ConnectedSessionEvent[]};
    assert.equal(batch.type,"event-batch");
    assert.equal(batch.events.length,1);
    const hostEvent=batch.events[0];
    assert.equal(hostEvent.sequence,1);
    assert.equal(hostEvent.actorId,remote.id);
    assert.equal(hostEvent.payload.kind,"resolution");
    if (hostEvent.payload.kind!=="resolution") throw new Error("expected host resolution event");
    const changes=hostEvent.payload.resolutionEvents.flatMap((event)=>event.stateChanges);
    assert.ok(changes.some((change)=>change.kind==="hp"&&change.targetId===remote.id&&change.before===4&&change.after>4));
    assert.ok(changes.some((change)=>change.kind==="resource"&&change.targetId===remote.id&&change.resourceId===`phase09:item:${POTION_ID}:quantity`&&change.before===2&&change.after===1));
    assert.equal(sentToPeer.length,0);

    const clientStore=new MemoryCharacterLibraryStore();
    const client=new MockAdapter();
    setCharacterLibraryStoreForTests(client,clientStore);
    prepareOwningClient(client,remote,projection,hostCatalog);
    const clientBaseline=await client.getSnapshot();
    assert.equal(clientBaseline.activeCharacter.id,remote.id);
    assert.equal(potionQuantity(clientBaseline.activeCharacter),2);
    const persistenceBefore=getCharacterLibraryPersistenceStateForTests(client);
    const clientState=connectedStateFor(client);
    clientState.mode="client";
    clientState.sessionId=state.sessionId;
    clientState.replica=new ClientSessionReplica(state.sessionId);

    const applied=await applyConnectedClientEvents(client,[hostEvent]);
    assert.equal(applied.status,"applied");
    assert.equal(applied.cursor,1);
    const clientAfter=await client.getSnapshot();
    assert.equal(clientAfter.activeCharacter.hp,mountedAfter!.sheet.hp);
    assert.equal(potionQuantity(clientAfter.activeCharacter),1);
    const persistenceAfter=getCharacterLibraryPersistenceStateForTests(client);
    assert.ok((persistenceAfter?.storageRevision??0)>(persistenceBefore?.storageRevision??0),"owning client must persist Host-confirmed HP and item quantity before cursor advancement");

    const storageRevisionAfterFirstApply=persistenceAfter?.storageRevision;
    const duplicateApply=await applyConnectedClientEvents(client,[hostEvent]);
    assert.equal(duplicateApply.status,"duplicate");
    assert.equal(duplicateApply.cursor,1);
    const clientAfterDuplicate=await client.getSnapshot();
    assert.equal(clientAfterDuplicate.activeCharacter.hp,clientAfter.activeCharacter.hp);
    assert.equal(potionQuantity(clientAfterDuplicate.activeCharacter),1);
    assert.equal(getCharacterLibraryPersistenceStateForTests(client)?.storageRevision,storageRevisionAfterFirstApply,"duplicate Host event must not create another Character generation");

    const reloadedClient=new MockAdapter();
    setCharacterLibraryStoreForTests(reloadedClient,clientStore);
    const reloaded=await reloadedClient.getSnapshot();
    assert.equal(reloaded.activeCharacter.id,remote.id);
    assert.equal(reloaded.activeCharacter.hp,clientAfter.activeCharacter.hp);
    assert.equal(potionQuantity(reloaded.activeCharacter),1);

    assert.equal(await routeConnectedActionRequest(host,{peer:PEER,message:""},request),true);
    assert.equal(broadcasts.length,1,"duplicate request must not create a second Host broadcast");
    assert.equal(sentToPeer.length,1,"duplicate request should return the already committed event directly to the peer");
    const duplicate=JSON.parse(sentToPeer[0]) as {type:string;events:Array<{sequence:number}>};
    assert.equal(duplicate.type,"event-batch");
    assert.equal(duplicate.events[0].sequence,1);
  } finally {
    tauriSessionTransport.send=originalSend;
    tauriSessionTransport.sendTo=originalSendTo;
  }
});
