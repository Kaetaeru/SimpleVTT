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
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent, type SessionCompatibilityManifest } from "../../src/app/connectedSessionProtocol";
import { routeConnectedInterruptResponse } from "../../src/app/connectedInterruptResponsePort";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { getCharacterLibraryPersistenceStateForTests, setCharacterLibraryStoreForTests } from "../../src/app/characterLibraryRuntimeAdapter";
import { ROGUE_CLASS_ID, UNCANNY_DODGE_REACTION_ID } from "../../src/app/rogueCoreRuntimeAdapter";

const PEER="peer.r2.remote-uncanny";
const RECONNECT_PEER="peer.r2.remote-uncanny.reconnect";
const CHARACTER_ID="char.r2.remote-rogue-uncanny";
type ResolvedCatalogEntry=CatalogEntry & {contentId?:string};
type MutableAdapterState={activeCharacter:CharacterSheet;characters:CharacterSummary[];scene:SceneVm};

function entry(catalog:CatalogEntry[],contentId:string) {
  const found=(catalog as ResolvedCatalogEntry[]).find((item)=>item.contentId===contentId);
  assert.ok(found,`production catalog must contain ${contentId}`);
  return found;
}

function remoteRogue(catalog:CatalogEntry[]):CharacterSheet {
  const rogue=entry(catalog,ROGUE_CLASS_ID);
  const human=entry(catalog,"dnd.srd521.species.human");
  const soldier=entry(catalog,"dnd.srd521.background.soldier");
  return {
    id:CHARACTER_ID,name:"Remote Uncanny Rogue",className:rogue.nameKo||rogue.nameEn,level:5,species:human.nameKo||human.nameEn,background:soldier.nameKo||soldier.nameEn,
    hp:32,maxHp:32,tempHp:0,ac:13,speed:30,proficiencyBonus:3,saveState:"saved",abilities:{str:10,dex:16,con:14,int:12,wis:12,cha:10},
    saves:[],skills:["은신 +6"],features:["교활한 행동","기묘한 회피"],equipment:[],items:[],attacks:[],resources:[],
    rulesProfileId:"dnd.srd-5.2.1",rulesProfileVersion:"0.1-draft",sourceRevision:5,runtimeRevision:7,
    classLevels:[{classId:ROGUE_CLASS_ID,level:5}],
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

async function finish(adapter:MockAdapter) {
  for(let step=0;step<6;step++) {
    const snapshot=await adapter.getSnapshot();
    if(snapshot.resolution?.stage==="complete")return snapshot;
    await adapter.advanceResolution();
  }
  throw new Error("resolution did not complete");
}

function entityHp(scene:SceneVm,id:string) {
  return scene.entities.find((entity)=>entity.id===id)?.hp;
}

function reactionAvailable(scene:SceneVm,id:string) {
  return scene.economyByActor[id]?.reaction;
}

test("host-unknown Rogue Uncanny Dodge accepts owner interrupt, halves damage exactly once, reconnects, and Undo compensates",async()=>{
  const host=new MockAdapter();
  await host.setReferenceRole("dm");
  const before=await host.getSnapshot();
  const catalog=structuredClone(before.catalog);
  const remote=remoteRogue(catalog);
  const remoteManifest=manifest(remote);
  const projection=buildCharacterSessionProjectionV1(remote,catalog);
  const accepted=acceptHostCharacterSessionProjection(host,PEER,remoteManifest,projection);
  assert.equal(accepted.status,"accepted",accepted.status==="rejected"?accepted.error:undefined);

  const mountedBefore=projectedCharacterById(host,remote.id);
  assert.ok(mountedBefore);
  assert.equal(mountedBefore!.entity.reactions.some((reaction)=>reaction.id===UNCANNY_DODGE_REACTION_ID),true,"Host must reconstruct the Rogue 5+ reaction from trusted projection data");

  const state=connectedStateFor(host);
  state.mode="host";
  state.sessionId="session.r2.remote-uncanny";
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
    await host.setQueuedD20(13);
    const hpBefore=entityHp((await host.getSnapshot()).scene,remote.id);
    assert.equal(hpBefore,remote.hp);

    let snapshot=await host.resolveAction("action.scimitar",[remote.id]);
    assert.equal(snapshot.resolution?.stage,"roll-animation");
    snapshot=await host.advanceResolution();
    assert.equal(snapshot.resolution?.stage,"interrupt");
    assert.equal(snapshot.resolution?.interrupt?.id,UNCANNY_DODGE_REACTION_ID);
    assert.equal(snapshot.resolution?.interrupt?.responderId,remote.id);

    const prompt=sentToPeer
      .filter((entry)=>entry.peer===PEER)
      .map((entry)=>JSON.parse(entry.message) as {type:string;sessionId?:string;resolutionId?:string;interrupt?:{id:string}})
      .find((message)=>message.type==="resolution-interrupt-prompt");
    assert.ok(prompt,"Host must send the private interrupt prompt to the owning peer");
    assert.equal(prompt!.interrupt?.id,UNCANNY_DODGE_REACTION_ID);

    assert.equal(await routeConnectedInterruptResponse(host,{peer:PEER,message:""},{
      sessionId:state.sessionId,
      resolutionId:snapshot.resolution!.id,
      promptId:UNCANNY_DODGE_REACTION_ID,
      accept:true,
    }),true);
    snapshot=await host.getSnapshot();
    assert.equal(snapshot.resolution?.stage,"attack-result");
    assert.equal(reactionAvailable(snapshot.scene,remote.id),false,"Host authoritative turn runtime must spend Reaction");

    snapshot=await finish(host);
    const damage=snapshot.resolution?.damageComponents[0];
    assert.ok(damage);
    assert.equal(damage!.adjusted,Math.floor(damage!.raw/2),"Uncanny Dodge must use the existing atomic floor-half damage rule");
    assert.equal(entityHp(snapshot.scene,remote.id),hpBefore!-damage!.adjusted);
    assert.equal(snapshot.activity.some((activity)=>activity.detail.some((detail)=>detail.includes("기묘한 회피"))),true);
    assert.deepEqual(snapshot.characters,before.characters,"Host permanent Character library must remain unchanged");
    assert.equal(projectedCharacterById(host,remote.id)?.sheet.hp,entityHp(snapshot.scene,remote.id),"Host ephemeral projection must own the remote HP change");

    const batches=broadcasts
      .map((message)=>JSON.parse(message) as {type:string;events?:ConnectedSessionEvent[]})
      .filter((message)=>message.type==="event-batch");
    assert.equal(batches.length,1,"incoming attack + accepted reaction must commit one ordered Host event batch");
    const hostEvent=batches[0].events?.[0];
    assert.ok(hostEvent);
    assert.equal(hostEvent!.sequence,1);
    assert.equal(hostEvent!.payload.kind,"resolution");
    if(hostEvent!.payload.kind!=="resolution")throw new Error("expected Host resolution event");
    const changes=hostEvent!.payload.resolutionEvents.flatMap((event)=>event.stateChanges);
    assert.ok(changes.some((change)=>change.kind==="economy"&&change.targetId===remote.id&&change.field==="reaction"&&change.before===true&&change.after===false));
    assert.ok(changes.some((change)=>change.kind==="hp"&&change.targetId===remote.id&&change.before===hpBefore&&change.after===entityHp(snapshot.scene,remote.id)));

    const client=new MockAdapter();
    setCharacterLibraryStoreForTests(client,new MemoryCharacterLibraryStore());
    prepareOwningClient(client,remote,projection,catalog);
    const persistenceBefore=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;
    const clientState=connectedStateFor(client);
    clientState.mode="client";
    clientState.sessionId=state.sessionId;
    clientState.replica=new ClientSessionReplica(state.sessionId);

    const applied=await applyConnectedClientEvents(client,[hostEvent!]);
    assert.equal(applied.status,"applied");
    assert.equal(applied.cursor,1);
    let clientAfter=await client.getSnapshot();
    assert.equal(clientAfter.activeCharacter.hp,entityHp(snapshot.scene,remote.id));
    assert.equal(reactionAvailable(clientAfter.scene,remote.id),false);
    const persistenceAfter=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;
    assert.ok(persistenceAfter>persistenceBefore,"owning Client must durably persist Host-confirmed HP before cursor advancement");

    assert.equal((await applyConnectedClientEvents(client,[hostEvent!])).status,"duplicate");
    assert.equal(getCharacterLibraryPersistenceStateForTests(client)?.storageRevision,persistenceAfter,"duplicate Host event must not create another Character generation");

    const rebound=acceptHostCharacterSessionProjection(host,RECONNECT_PEER,remoteManifest,projection);
    assert.equal(rebound.status,"accepted",rebound.status==="rejected"?rebound.error:undefined);
    assert.equal(rebound.status==="accepted"?rebound.mode:undefined,"rebound");
    const afterReconnect=await host.getSnapshot();
    assert.equal(entityHp(afterReconnect.scene,remote.id),entityHp(snapshot.scene,remote.id),"stale reconnect projection must not overwrite Host-authoritative HP");
    assert.equal(reactionAvailable(afterReconnect.scene,remote.id),false,"reconnect must preserve Host-authoritative Reaction economy");
    assert.equal(projectedCharacterById(host,remote.id)?.peerId,RECONNECT_PEER);

    const persistenceBeforeUndo=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;
    await host.undoLastResolution();
    const hostAfterUndo=await host.getSnapshot();
    assert.equal(entityHp(hostAfterUndo.scene,remote.id),hpBefore);
    assert.equal(reactionAvailable(hostAfterUndo.scene,remote.id),true);
    assert.equal(projectedCharacterById(host,remote.id)?.sheet.hp,hpBefore);
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
    assert.equal(clientAfter.activeCharacter.hp,hpBefore);
    assert.equal(reactionAvailable(clientAfter.scene,remote.id),true);
    const persistenceAfterUndo=getCharacterLibraryPersistenceStateForTests(client)?.storageRevision??0;
    assert.ok(persistenceAfterUndo>persistenceBeforeUndo,"owning Client must durably persist compensating HP restore");

    assert.equal((await applyConnectedClientEvents(client,[undoEvent!])).status,"duplicate");
    assert.equal(getCharacterLibraryPersistenceStateForTests(client)?.storageRevision,persistenceAfterUndo,"duplicate Undo must not create another Character generation");
  } finally {
    tauriSessionTransport.send=originalSend;
    tauriSessionTransport.sendTo=originalSendTo;
  }
});
