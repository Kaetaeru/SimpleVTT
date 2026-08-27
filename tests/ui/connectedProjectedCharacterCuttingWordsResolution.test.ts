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
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent, type SessionCompatibilityManifest } from "../../src/app/connectedSessionProtocol";
import { routeConnectedInterruptResponse } from "../../src/app/connectedInterruptResponsePort";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { getCharacterLibraryPersistenceStateForTests, setCharacterLibraryStoreForTests } from "../../src/app/characterLibraryRuntimeAdapter";
import { BARDIC_INSPIRATION_RESOURCE_ID } from "../../src/domain/bardicInspiration";
import { BARD_COLLEGE_LORE_SUBCLASS_ID } from "../../src/domain/bardCollegeLore";
import { BARD_LORE_CLASS_ID } from "../../src/domain/bardLoreProgression";

const PEER="peer.r2.remote-cutting-words";
const RECONNECT_PEER="peer.r2.remote-cutting-words.reconnect";
const CHARACTER_ID="char.r2.remote-cutting-words";
const INTERRUPT_ID="follow-up.bard.college-of-lore.cutting-words";
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
    id:CHARACTER_ID,
    name:"Remote Cutting Words Bard",
    className:bard.nameKo||bard.nameEn,
    subclassName:lore.nameKo||lore.nameEn,
    level:5,
    species:human.nameKo||human.nameEn,
    background:soldier.nameKo||soldier.nameEn,
    hp:38,
    maxHp:38,
    tempHp:0,
    ac:15,
    speed:30,
    proficiencyBonus:3,
    saveState:"saved",
    abilities:{str:10,dex:16,con:14,int:12,wis:12,cha:18},
    saves:[],
    skills:[],
    features:["도발의 말"],
    equipment:[],
    items:[],
    attacks:[],
    resources:[{id:BARDIC_INSPIRATION_RESOURCE_ID,label:"바드의 영감",current:4,max:4,source:"바드 클래스 기능",recovery:{shortRest:"all",longRest:"all"}}],
    rulesProfileId:"dnd.srd-5.2.1",
    rulesProfileVersion:"0.1-draft",
    sourceRevision:5,
    runtimeRevision:7,
    classLevels:[{classId:BARD_LORE_CLASS_ID,className:bard.nameKo||bard.nameEn,level:5,subclassName:lore.nameKo||lore.nameEn}],
    subclassIds:{[BARD_LORE_CLASS_ID]:BARD_COLLEGE_LORE_SUBCLASS_ID},
  } as CharacterSheet;
}

function manifest(sheet:CharacterSheet):SessionCompatibilityManifest {
  return {
    protocolVersion:1,
    rulesProfileId:"dnd.srd-5.2.1",
    capabilities:[...CONNECTED_CAPABILITIES],
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

function inspirationCurrent(sheet:CharacterSheet) {
  return sheet.resources.find((resource)=>resource.id===BARDIC_INSPIRATION_RESOURCE_ID)?.current;
}

function reactionAvailable(scene:SceneVm,id:string) {
  return scene.economyByActor[id]?.reaction;
}

function entityHp(scene:SceneVm,id:string) {
  return scene.entities.find((entity)=>entity.id===id)?.hp;
}

async function waitForInterrupt(adapter:MockAdapter,maximum=6) {
  for(let step=0;step<maximum;step++) {
    const snapshot=await adapter.getSnapshot();
    if(snapshot.resolution?.interrupt?.id===INTERRUPT_ID)return snapshot;
    if(snapshot.resolution?.stage==="complete")return snapshot;
    await adapter.advanceResolution();
  }
  return adapter.getSnapshot();
}

async function finish(adapter:MockAdapter) {
  for(let step=0;step<8;step++) {
    const snapshot=await adapter.getSnapshot();
    if(snapshot.resolution?.stage==="complete")return snapshot;
    await adapter.advanceResolution();
  }
  throw new Error("resolution did not complete");
}

test("host-unknown Lore Bard Cutting Words reacts to another actor, persists owner costs exactly once, reconnects, and Undo compensates",async()=>{
  const host=new MockAdapter();
  await host.setReferenceRole("dm");
  const before=await host.getSnapshot();
  const catalog=structuredClone(before.catalog);
  const remote=remoteLoreBard(catalog);
  const remoteManifest=manifest(remote);
  const projection=buildCharacterSessionProjectionV1(remote,catalog);
  const accepted=acceptHostCharacterSessionProjection(host,PEER,remoteManifest,projection);
  assert.equal(accepted.status,"accepted",accepted.status==="rejected"?accepted.error:undefined);

  const mounted=projectedCharacterById(host,remote.id);
  assert.ok(mounted,"Host must mount the remote Lore Bard from trusted projection data");
  const beforeUses=inspirationCurrent(mounted!.sheet);
  assert.equal(beforeUses,4);

  const state=connectedStateFor(host);
  state.mode="host";
  state.sessionId="session.r2.remote-cutting-words";
  state.ledger=new HostSessionLedger(state.sessionId,connectedManifest(host));
  state.peerManifests.set(PEER,structuredClone(remoteManifest));

  const broadcasts:string[]=[];
  const sentToPeer:Array<{peer:string;message:string}>=[];
  const originalSend=tauriSessionTransport.send;
  const originalSendTo=tauriSessionTransport.sendTo;
  tauriSessionTransport.send=async(message:string)=>{broadcasts.push(message);return 1;};
  tauriSessionTransport.sendTo=async(peer:string,message:string)=>{sentToPeer.push({peer,message});return 1;};
  try {
    await host.startInitiative();
    await host.setCurrentActor("combatant.goblin-a");
    let snapshot=await host.getSnapshot();
    assert.equal(reactionAvailable(snapshot.scene,remote.id),true,"projected Lore Bard must start with an available Reaction");
    const hpBefore=entityHp(snapshot.scene,remote.id);
    assert.equal(hpBefore,remote.hp);

    await host.setQueuedD20(18);
    await host.resolveAction("action.scimitar",[remote.id]);
    snapshot=await waitForInterrupt(host);
    assert.equal(snapshot.resolution?.interrupt?.id,INTERRUPT_ID,JSON.stringify(snapshot.resolution));
    assert.equal(snapshot.resolution?.interrupt?.responderId,remote.id,"Cutting Words must belong to the remote Lore Bard, not the Host's local Character");

    const prompt=sentToPeer
      .filter((entry)=>entry.peer===PEER)
      .map((entry)=>JSON.parse(entry.message) as {type:string;resolutionId?:string;interrupt?:{id:string;responderId?:string}})
      .find((message)=>message.type==="resolution-interrupt-prompt");
    assert.ok(prompt,"Host must send the Cutting Words prompt only to the owning peer");
    assert.equal(prompt!.interrupt?.id,INTERRUPT_ID);
    assert.equal(prompt!.interrupt?.responderId,remote.id);

    await host.setQueuedD20(8);
    const response={sessionId:state.sessionId,resolutionId:snapshot.resolution!.id,promptId:INTERRUPT_ID,accept:true};
    assert.equal(await routeConnectedInterruptResponse(host,{peer:PEER,message:""},response),true);
    snapshot=await host.getSnapshot();
    assert.equal(snapshot.resolution?.stage,"attack-result");
    assert.equal(snapshot.resolution?.attackOutcome,"빗나감",JSON.stringify(snapshot.resolution));
    assert.equal(inspirationCurrent(projectedCharacterById(host,remote.id)!.sheet),beforeUses!-1,"Host ephemeral projection must own the Inspiration spend");
    assert.equal(reactionAvailable(snapshot.scene,remote.id),false,"Host authoritative runtime must spend the remote Bard's Reaction");

    assert.equal(await routeConnectedInterruptResponse(host,{peer:PEER,message:""},response),true);
    const afterDuplicateInterrupt=await host.getSnapshot();
    assert.equal(afterDuplicateInterrupt.resolution?.stage,"attack-result","duplicate owner response must not advance the resolution twice");
    assert.equal(inspirationCurrent(projectedCharacterById(host,remote.id)!.sheet),beforeUses!-1,"duplicate owner response must not spend Inspiration twice");
    assert.equal(reactionAvailable(afterDuplicateInterrupt.scene,remote.id),false,"duplicate owner response must not spend Reaction twice");

    snapshot=await finish(host);
    assert.equal(snapshot.resolution?.attackOutcome,"빗나감",JSON.stringify(snapshot.resolution));
    assert.equal(entityHp(snapshot.scene,remote.id),hpBefore,"successful Cutting Words attack reduction must prevent damage when it turns the hit into a miss");
    assert.equal(snapshot.activity.some((activity)=>activity.detail.some((detail)=>detail.includes("도발의 말"))),true);
    assert.deepEqual(snapshot.characters,before.characters,"Host permanent Character library must remain unchanged");

    const batches=broadcasts
      .map((message)=>JSON.parse(message) as {type:string;events?:ConnectedSessionEvent[]})
      .filter((message)=>message.type==="event-batch");
    assert.equal(batches.length,1,"incoming attack + accepted Cutting Words must commit one ordered Host event batch");
    const hostEvent=batches[0].events?.[0];
    assert.ok(hostEvent);
    assert.equal(hostEvent!.sequence,1);
    assert.equal(hostEvent!.payload.kind,"resolution");
    if(hostEvent!.payload.kind!=="resolution")throw new Error("expected Host Cutting Words resolution event");
    const changes=hostEvent!.payload.resolutionEvents.flatMap((event)=>event.stateChanges);
    assert.ok(changes.some((change)=>change.kind==="resource"&&change.targetId===remote.id&&change.resourceId===BARDIC_INSPIRATION_RESOURCE_ID&&change.before===beforeUses&&change.after===beforeUses!-1));
    assert.ok(changes.some((change)=>change.kind==="economy"&&change.targetId===remote.id&&change.field==="reaction"&&change.before===true&&change.after===false));

    const client=new MockAdapter();
    setCharacterLibraryStoreForTests(client,new MemoryCharacterLibraryStore());
    prepareOwningClient(client,remote,projection,catalog);
    const clientState=connectedStateFor(client);
    clientState.mode="client";
    clientState.sessionId=state.sessionId;
    clientState.replica=new ClientSessionReplica(state.sessionId);
    const persistenceBefore=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;

    const applied=await applyConnectedClientEvents(client,[hostEvent!]);
    assert.equal(applied.status,"applied");
    assert.equal(applied.cursor,1);
    let clientAfter=await client.getSnapshot();
    assert.equal(inspirationCurrent(clientAfter.activeCharacter),beforeUses!-1);
    assert.equal(reactionAvailable(clientAfter.scene,remote.id),false);
    const persistenceAfter=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;
    assert.ok(persistenceAfter>persistenceBefore,"owning Client must persist the Host-confirmed Inspiration spend before cursor advancement");

    assert.equal((await applyConnectedClientEvents(client,[hostEvent!])).status,"duplicate");
    assert.equal(getCharacterLibraryPersistenceStateForTests(client)?.storageRevision,persistenceAfter,"duplicate Host event must not create another Character generation");

    const rebound=acceptHostCharacterSessionProjection(host,RECONNECT_PEER,remoteManifest,projection);
    assert.equal(rebound.status,"accepted",rebound.status==="rejected"?rebound.error:undefined);
    assert.equal(rebound.status==="accepted"?rebound.mode:undefined,"rebound");
    snapshot=await host.getSnapshot();
    assert.equal(inspirationCurrent(projectedCharacterById(host,remote.id)!.sheet),beforeUses!-1,"stale reconnect projection must not restore spent Inspiration");
    assert.equal(reactionAvailable(snapshot.scene,remote.id),false,"reconnect must preserve the Host-authoritative Reaction state");
    assert.equal(projectedCharacterById(host,remote.id)?.peerId,RECONNECT_PEER);
    assert.deepEqual(snapshot.characters,before.characters);

    const persistenceBeforeUndo=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;
    await host.undoLastResolution();
    const hostAfterUndo=await host.getSnapshot();
    assert.equal(inspirationCurrent(projectedCharacterById(host,remote.id)!.sheet),beforeUses);
    assert.equal(reactionAvailable(hostAfterUndo.scene,remote.id),true);
    assert.equal(entityHp(hostAfterUndo.scene,remote.id),hpBefore);
    assert.deepEqual(hostAfterUndo.characters,before.characters,"Host permanent Character library must remain unchanged by Undo");

    const batchesAfterUndo=broadcasts
      .map((message)=>JSON.parse(message) as {type:string;events?:ConnectedSessionEvent[]})
      .filter((message)=>message.type==="event-batch");
    assert.equal(batchesAfterUndo.length,2,"Undo must publish one compensating ordered event batch");
    const undoEvent=batchesAfterUndo[1].events?.[0];
    assert.ok(undoEvent);
    assert.equal(undoEvent!.sequence,2);
    assert.equal(undoEvent!.payload.kind,"resolution-undo");

    const undoApplied=await applyConnectedClientEvents(client,[undoEvent!]);
    assert.equal(undoApplied.status,"applied");
    assert.equal(undoApplied.cursor,2);
    clientAfter=await client.getSnapshot();
    assert.equal(inspirationCurrent(clientAfter.activeCharacter),beforeUses);
    assert.equal(reactionAvailable(clientAfter.scene,remote.id),true);
    const persistenceAfterUndo=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;
    assert.ok(persistenceAfterUndo>persistenceBeforeUndo,"owning Client must persist the compensating Inspiration restore before cursor advancement");

    assert.equal((await applyConnectedClientEvents(client,[undoEvent!])).status,"duplicate");
    assert.equal(getCharacterLibraryPersistenceStateForTests(client)?.storageRevision,persistenceAfterUndo,"duplicate Undo must not create another Character generation");
  } finally {
    tauriSessionTransport.send=originalSend;
    tauriSessionTransport.sendTo=originalSendTo;
  }
});
