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

const PEER="peer.phase14.remote-spell";
const CHARACTER_ID="char.phase14.remote-spell-sorcerer";
const FIRE_BOLT="dnd.srd521.spell.fire-bolt";
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

function remoteSpellcaster(catalog:CatalogEntry[]):CharacterSheet {
  const sorcerer=contentEntry(catalog,"dnd.srd521.class.sorcerer");
  const human=contentEntry(catalog,"dnd.srd521.species.human");
  const soldier=contentEntry(catalog,"dnd.srd521.background.soldier");
  contentEntry(catalog,FIRE_BOLT);
  return {
    id:CHARACTER_ID,
    name:"Remote Spell Sorcerer",
    className:sorcerer.nameKo || sorcerer.nameEn,
    level:1,
    species:human.nameKo || human.nameEn,
    background:soldier.nameKo || soldier.nameEn,
    hp:8,
    maxHp:8,
    tempHp:0,
    ac:12,
    speed:30,
    proficiencyBonus:2,
    saveState:"saved",
    abilities:{str:8,dex:14,con:14,int:12,wis:10,cha:16},
    saves:[],
    skills:["비전"],
    features:["주문 시전"],
    equipment:[],
    items:[],
    resources:[],
    attacks:[],
    rulesProfileId:"dnd.srd-5.2.1",
    rulesProfileVersion:"0.1-draft",
    sourceRevision:6,
    runtimeRevision:7,
    classLevels:[{classId:"dnd.srd521.class.sorcerer",level:1}],
    cantrips:[FIRE_BOLT],
    preparedSpells:[],
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

test("host-unknown projected spellcaster resolves freeform Fire Bolt through Host authority and Client applies the committed event once",async()=>{
  const host=new MockAdapter();
  await host.setReferenceRole("dm");
  const before=await host.getSnapshot();
  const hostCatalog=structuredClone(before.catalog);
  const remote=remoteSpellcaster(hostCatalog);
  const remoteManifest=manifest(remote);
  const projection=buildCharacterSessionProjectionV1(remote,hostCatalog);
  assert.ok(projection.contentIdentities.some((identity)=>identity.category==="spell"&&identity.contentId===FIRE_BOLT));

  const accepted=acceptHostCharacterSessionProjection(host,PEER,remoteManifest,projection);
  assert.equal(accepted.status,"accepted",accepted.status==="rejected"?accepted.error:undefined);
  const mountedBefore=projectedCharacterById(host,remote.id);
  assert.ok(mountedBefore);
  assert.deepEqual(mountedBefore!.sheet.cantrips,[FIRE_BOLT]);
  assert.equal(mountedBefore!.sheet.rulesProfileId,"dnd.srd-5.2.1");

  await host.setSessionMode("freeform");
  await host.setQueuedD20(18);
  const initiativeBaseline=await host.getSnapshot();
  const fireBolt=(initiativeBaseline.scene.actionsByActor[remote.id]??[]).find((action)=>action.id==="action.fire-bolt");
  assert.equal(fireBolt?.target,"enemy");
  const target=initiativeBaseline.scene.entities.find((entity)=>entity.side==="enemy");
  assert.ok(target,"remote Fire Bolt requires a Host Scene enemy within 120 feet");
  assert.ok(fireBolt?.eligibleTargetIds.includes(target.id));
  const targetHpBefore=target.hp;

  const state=connectedStateFor(host);
  state.mode="host";
  state.sessionId="session.phase14.remote-spell";
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
      requestId:"request.phase14.remote-fire-bolt",
      actorId:remote.id,
      actionId:"action.fire-bolt",
      targetIds:[target.id],
      knownEventCursor:0,
      character:remoteManifest.character,
      capabilities:[...CONNECTED_CAPABILITIES],
    };
    assert.equal(await routeConnectedActionRequest(host,{peer:PEER,message:""},request),true);
    const completed=await host.getSnapshot();
    assert.equal(completed.activeCharacter.id,before.activeCharacter.id,"Host local Character context must restore after remote spell commit");
    assert.equal(connectedStateFor(host).pendingRemoteAction,null);
    assert.equal(connectedStateFor(host).ledger?.cursor,1);
    assert.equal(completed.resolution?.stage,"complete");
    assert.notEqual(completed.resolution?.finalOutcome,"적용 예정");
    assert.deepEqual(completed.characters,before.characters,"Host permanent Character library must remain unchanged");
    assert.ok((completed.scene.entities.find((entity)=>entity.id===target.id)?.hp??targetHpBefore)<targetHpBefore,"Host authoritative Fire Bolt must commit damage");

    assert.equal(broadcasts.length,1,"remote spell commit must broadcast exactly one ordered event batch");
    const batch=JSON.parse(broadcasts[0]) as {type:string;events:ConnectedSessionEvent[]};
    assert.equal(batch.type,"event-batch");
    assert.equal(batch.events.length,1);
    const hostEvent=batch.events[0];
    assert.equal(hostEvent.sequence,1);
    assert.equal(hostEvent.actorId,remote.id);
    assert.equal(hostEvent.payload.kind,"resolution");
    if (hostEvent.payload.kind!=="resolution") throw new Error("expected Host resolution event");
    assert.ok(hostEvent.payload.provenance.some((entry)=>entry.includes(FIRE_BOLT)),"Host event provenance must identify canonical Fire Bolt authority");
    const changes=hostEvent.payload.resolutionEvents.flatMap((event)=>event.stateChanges);
    assert.ok(changes.some((change)=>change.kind==="hp"&&change.targetId===target.id&&change.before===targetHpBefore&&change.after<targetHpBefore));
    assert.equal(sentToPeer.length,0);

    const clientStore=new MemoryCharacterLibraryStore();
    const client=new MockAdapter();
    setCharacterLibraryStoreForTests(client,clientStore);
    prepareOwningClient(client,remote,projection,hostCatalog);
    const clientBaseline=await client.getSnapshot();
    const clientTargetBefore=clientBaseline.scene.entities.find((entity)=>entity.id===target.id)?.hp;
    assert.equal(clientTargetBefore,targetHpBefore);
    const persistenceBefore=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision;
    const clientState=connectedStateFor(client);
    clientState.mode="client";
    clientState.sessionId=state.sessionId;
    clientState.replica=new ClientSessionReplica(state.sessionId);

    const applied=await applyConnectedClientEvents(client,[hostEvent]);
    assert.equal(applied.status,"applied");
    assert.equal(applied.cursor,1);
    const clientAfter=await client.getSnapshot();
    const hostTargetAfter=completed.scene.entities.find((entity)=>entity.id===target.id)?.hp;
    assert.equal(clientAfter.scene.entities.find((entity)=>entity.id===target.id)?.hp,hostTargetAfter,"Client Scene must converge to the Host-confirmed target HP");
    assert.equal(clientAfter.activeCharacter.id,remote.id);
    assert.deepEqual(clientAfter.activeCharacter.cantrips,[FIRE_BOLT]);
    assert.equal(getCharacterLibraryPersistenceStateForTests(client)?.storageRevision,persistenceBefore,"session-only enemy damage must not create a Character-library generation");

    const duplicateApply=await applyConnectedClientEvents(client,[hostEvent]);
    assert.equal(duplicateApply.status,"duplicate");
    assert.equal(duplicateApply.cursor,1);
    const clientAfterDuplicate=await client.getSnapshot();
    assert.equal(clientAfterDuplicate.scene.entities.find((entity)=>entity.id===target.id)?.hp,hostTargetAfter,"duplicate Host event must not apply Fire Bolt damage twice");
    assert.equal(getCharacterLibraryPersistenceStateForTests(client)?.storageRevision,persistenceBefore);

    assert.equal(await routeConnectedActionRequest(host,{peer:PEER,message:""},request),true);
    assert.equal(broadcasts.length,1,"duplicate request must not create a second Host broadcast");
    assert.equal(sentToPeer.length,1,"duplicate request should return the committed event directly to the peer");
    const duplicate=JSON.parse(sentToPeer[0]) as {type:string;events:Array<{sequence:number}>};
    assert.equal(duplicate.type,"event-batch");
    assert.equal(duplicate.events[0].sequence,1);
  } finally {
    tauriSessionTransport.send=originalSend;
    tauriSessionTransport.sendTo=originalSendTo;
  }
});
