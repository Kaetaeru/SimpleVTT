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

const PEER="peer.phase14.remote-skill";
const CHARACTER_ID="char.phase14.remote-skill-sorcerer";
const ARCANA_ACTION="action.skill.arcana";
type ResolvedCatalogEntry=CatalogEntry & {contentId?:string;sourceId?:string};
type MutableAdapterState={
  activeCharacter:CharacterSheet;
  characters:CharacterSummary[];
  scene:SceneVm;
};

type D20EventResult={natural?:number;modifier?:number;total?:number};

function contentEntry(catalog:CatalogEntry[],contentId:string) {
  const found=(catalog as ResolvedCatalogEntry[]).find((entry)=>entry.contentId===contentId);
  assert.ok(found,`production catalog must contain ${contentId}`);
  return found;
}

function remoteSkillCharacter(catalog:CatalogEntry[]):CharacterSheet {
  const sorcerer=contentEntry(catalog,"dnd.srd521.class.sorcerer");
  const human=contentEntry(catalog,"dnd.srd521.species.human");
  const soldier=contentEntry(catalog,"dnd.srd521.background.soldier");
  return {
    id:CHARACTER_ID,
    name:"Remote Skill Sorcerer",
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
    abilities:{str:18,dex:12,con:14,int:16,wis:10,cha:14},
    saves:[],
    skills:["비전"],
    features:[],
    equipment:[],
    items:[],
    resources:[],
    attacks:[],
    rulesProfileId:"dnd.srd-5.2.1",
    rulesProfileVersion:"0.1-draft",
    sourceRevision:7,
    runtimeRevision:8,
    classLevels:[{classId:"dnd.srd521.class.sorcerer",level:1}],
    cantrips:[],
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

test("host-unknown projected Character resolves Arcana with canonical proficiency through Host authority and Client applies the committed event once",async()=>{
  const host=new MockAdapter();
  await host.setReferenceRole("dm");
  await host.setSessionMode("freeform");
  const before=await host.getSnapshot();
  const hostCatalog=structuredClone(before.catalog);
  const remote=remoteSkillCharacter(hostCatalog);
  const remoteManifest=manifest(remote);
  const projection=buildCharacterSessionProjectionV1(remote,hostCatalog);
  const reconstruction=reconstructCharacterSessionProjectionV1(projection,hostCatalog);
  assert.equal(reconstruction.status,"accepted",reconstruction.status==="rejected"?reconstruction.error:undefined);
  if (reconstruction.status!=="accepted") throw new Error(reconstruction.error);
  const freeformEconomy=structuredClone(reconstruction.economy);

  const accepted=acceptHostCharacterSessionProjection(host,PEER,remoteManifest,projection);
  assert.equal(accepted.status,"accepted",accepted.status==="rejected"?accepted.error:undefined);
  const mountedBefore=projectedCharacterById(host,remote.id);
  assert.ok(mountedBefore);
  assert.deepEqual(mountedBefore!.sheet.skills,["비전"]);
  assert.equal(mountedBefore!.sheet.abilities.int,16);
  assert.equal(mountedBefore!.sheet.abilities.str,18);
  const mountedSnapshot=await host.getSnapshot();
  const arcana=(mountedSnapshot.scene.actionsByActor[remote.id]??[]).find((action)=>action.id===ARCANA_ACTION);
  assert.ok(arcana,"Host mount must derive canonical Arcana from the projected Character sheet");
  assert.equal(arcana.resolutionKind,"ability-check");
  assert.equal(arcana.checkBonus,5,"Arcana must use INT +3 plus level-1 proficiency +2, not STR +4");
  assert.ok((arcana.details.find((detail)=>detail.label==="판정")?.value??"").includes("지능"));
  assert.equal(arcana.details.find((detail)=>detail.label==="숙련")?.value,"+2");

  await host.setQueuedD20(13);
  const state=connectedStateFor(host);
  state.mode="host";
  state.sessionId="session.phase14.remote-skill";
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
      requestId:"request.phase14.remote-arcana",
      actorId:remote.id,
      actionId:ARCANA_ACTION,
      targetIds:[],
      knownEventCursor:0,
      character:remoteManifest.character,
      capabilities:[...CONNECTED_CAPABILITIES],
    };
    assert.equal(await routeConnectedActionRequest(host,{peer:PEER,message:""},request),true);
    const preview=await host.getSnapshot();
    assert.equal(state.ledger.cursor,0,"skill preview must not commit before Host advances the resolution");
    assert.equal(broadcasts.length,0,"skill preview must not broadcast an uncommitted result");
    assert.ok(state.pendingRemoteAction);
    assert.equal(preview.activeCharacter.id,remote.id,"remote projection must be the temporary Host resolution context");
    assert.equal(preview.resolution?.rollKind,"check");
    assert.deepEqual(preview.resolution?.authoritativeDice,[13],"Host queued d20 must be authoritative");
    assert.equal(preview.resolution?.rollTotal,18,"Host must apply canonical Arcana INT + proficiency bonus");
    assert.ok(preview.resolution?.provenance.some((entry)=>entry.includes(`action:${ARCANA_ACTION}:check-bonus`)));
    assert.deepEqual(preview.scene.economyByActor[remote.id],freeformEconomy,"Freeform skill preview must not spend Initiative action economy");

    await host.advanceResolution();
    const completed=await host.getSnapshot();
    assert.equal(completed.activeCharacter.id,before.activeCharacter.id,"Host local Character context must restore after remote skill commit");
    assert.equal(connectedStateFor(host).pendingRemoteAction,null);
    assert.equal(connectedStateFor(host).ledger?.cursor,1);
    assert.deepEqual(completed.characters,before.characters,"Host permanent Character library must remain unchanged");

    assert.equal(broadcasts.length,1,"remote skill commit must broadcast exactly one ordered event batch");
    const batch=JSON.parse(broadcasts[0]) as {type:string;events:ConnectedSessionEvent[]};
    assert.equal(batch.type,"event-batch");
    assert.equal(batch.events.length,1);
    const hostEvent=batch.events[0];
    assert.equal(hostEvent.sequence,1);
    assert.equal(hostEvent.actorId,remote.id);
    assert.equal(hostEvent.payload.kind,"resolution");
    if (hostEvent.payload.kind!=="resolution") throw new Error("expected Host resolution event");
    assert.ok(hostEvent.payload.provenance.some((entry)=>entry.includes(`action:${ARCANA_ACTION}:check-bonus`)),"Host event provenance must preserve the canonical Arcana bonus authority");
    assert.equal(hostEvent.payload.stateChanges.length,0,"Freeform skill commit must not spend shared action economy");
    const d20Event=hostEvent.payload.resolutionEvents.find((event)=>event.kind==="d20");
    assert.ok(d20Event,"committed skill resolution must include the canonical d20 ResolutionEvent");
    const d20Result=d20Event!.result as D20EventResult;
    assert.equal(d20Result.natural,13);
    assert.equal(d20Result.modifier,5);
    assert.equal(d20Result.total,18);
    assert.equal(d20Event!.stateChanges.length,0);
    assert.equal(sentToPeer.length,0);

    const clientStore=new MemoryCharacterLibraryStore();
    const client=new MockAdapter();
    setCharacterLibraryStoreForTests(client,clientStore);
    prepareOwningClient(client,remote,projection,hostCatalog);
    const clientBaseline=await client.getSnapshot();
    const clientEconomyBefore=structuredClone(clientBaseline.scene.economyByActor[remote.id]);
    const clientActivityBefore=clientBaseline.activity.length;
    const persistenceBefore=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision;
    const clientState=connectedStateFor(client);
    clientState.mode="client";
    clientState.sessionId=state.sessionId;
    clientState.replica=new ClientSessionReplica(state.sessionId);

    const applied=await applyConnectedClientEvents(client,[hostEvent]);
    assert.equal(applied.status,"applied");
    assert.equal(applied.cursor,1);
    const clientAfter=await client.getSnapshot();
    assert.equal(clientAfter.activity.length,clientActivityBefore+1,"Client must converge the Host skill event exactly once into session activity");
    assert.deepEqual(clientAfter.scene.economyByActor[remote.id],clientEconomyBefore,"Freeform skill event must not spend Client Initiative economy");
    assert.ok(clientAfter.activeCharacter.skills.includes("비전"));
    assert.equal(getCharacterLibraryPersistenceStateForTests(client)?.storageRevision,persistenceBefore,"session-only skill check must not create a Character-library generation");

    const duplicateApply=await applyConnectedClientEvents(client,[hostEvent]);
    assert.equal(duplicateApply.status,"duplicate");
    assert.equal(duplicateApply.cursor,1);
    const clientAfterDuplicate=await client.getSnapshot();
    assert.equal(clientAfterDuplicate.activity.length,clientActivityBefore+1,"duplicate Host event must not append skill activity twice");
    assert.deepEqual(clientAfterDuplicate.scene.economyByActor[remote.id],clientEconomyBefore);
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
