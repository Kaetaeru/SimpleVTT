import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import "../../src/app/connectedTurnRoutingAdapter";
import "../../src/app/installedContentRuntimeAdapter";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { resolveRuntimeProfileProperty } from "../../src/app/realResolutionService";
import type { EffectInstance } from "../../src/domain/effects";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";
import { MemoryTurnRuntimeStateStore, setTurnRuntimeStateStoreForTests, snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";

const wireShape=(value:unknown)=>JSON.parse(JSON.stringify(value));

function moduleJson(prefix:string) {
  const moduleId=`${prefix}.module`;
  const contentId=`${prefix}.option`;
  const mechanicId=`${prefix}.property-movement`;
  const config={schemaVersion:"0.2-draft",id:mechanicId,entryPoints:[
    {id:"slow",invocation:"manual",operations:[{kind:"property.modify",property:"movement.walk",operation:"set",value:{value:5},target:"actor",owner:"effect",source:"definition",duration:{kind:"elapsed",amount:{value:1},unit:"minutes"},lifetime:{kind:"until-duration",onEnd:"destroy"},instancePolicy:"stack"}]},
    {id:"guard",invocation:"manual",operations:[{kind:"property.modify",property:"defense.ac",operation:"add",value:{value:2},target:"actor",owner:"effect",source:"definition",duration:{kind:"elapsed",amount:{value:1},unit:"minutes"},lifetime:{kind:"until-duration",onEnd:"destroy"},instancePolicy:"stack"}]},
    {id:"move",invocation:"manual",operations:[{kind:"movement.relocate",mode:"move",movementType:"walk",target:"actor",distance:{ref:"movement.walk"},destinationFact:{id:"property-move-destination",fact:"spatial.legal-destination",subject:"actor",authority:"actor-owner",visibility:"actor-and-dm",unknownPolicy:"request-authority"}}]},
    {id:"strength",invocation:"manual",operations:[{kind:"property.modify",property:"ability.str.score",operation:"set",value:{value:14},target:"actor",owner:"effect",source:"definition",duration:{kind:"elapsed",amount:{value:1},unit:"minutes"},lifetime:{kind:"until-duration",onEnd:"destroy"},instancePolicy:"stack"}]},
    {id:"move-strength",invocation:"manual",operations:[{kind:"movement.relocate",mode:"move",movementType:"walk",target:"actor",distance:{ref:"ability.str.modifier"},destinationFact:{id:"property-strength-move-destination",fact:"spatial.legal-destination",subject:"actor",authority:"actor-owner",visibility:"actor-and-dm",unknownPolicy:"request-authority"}}]},
  ]};
  return {moduleId,contentId,mechanicId,json:JSON.stringify({schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",source:{document:"Unknown property module",version:"1",license:"CC0",srdDerived:false},dependencies:[],conflicts:[],capabilities:[],content:[{id:contentId,category:"option",presentation:{defaultLocale:"en",originalName:"Unknown Property Movement",locales:{en:{name:"Unknown Property Movement"}}},mechanics:[{kind:"common-play",config}]}]})};
}

async function install(adapter:MockAdapter,prefix:string,store=new MemoryInstalledContentStore()) {
  setInstalledContentStoreForTests(adapter,store);
  const pack=moduleJson(prefix);
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const action=(entryPointId:string)=>installedCommonPlayActionId({catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId});
  return {pack,action};
}

async function run(prefix:string) {
  const adapter=new MockAdapter();
  const {action}=await install(adapter,prefix);
  const before=await adapter.getSnapshot();
  const initialRemaining=before.scene.economyByActor["char.aelar"]!.movement;
  await adapter.resolveAction(action("slow"),["char.aelar"]);
  const modified=await adapter.getSnapshot();
  const modifiedState=snapshotAdapterTurnRuntimeState(adapter,modified.scene)!;
  assert.deepEqual(modifiedState.effects.at(-1)?.propertyModifier,{property:"movement.walk",operation:"set",value:{value:5},source:"definition",instancePolicy:"stack"});
  await adapter.resolveAction(action("move"),["char.aelar"]);
  const moved=await adapter.getSnapshot();
  return {spent:initialRemaining-moved.scene.economyByActor["char.aelar"]!.movement,resolution:moved.resolution};
}

test("production property owner composes profile-derived values with active Effect modifiers",()=>{
  const effect:EffectInstance={
    id:"effect.external.str-modifier",sourceId:"external.unseen.property-owner",targetId:"char.aelar",kind:"modifier",tags:[],expiry:{kind:"permanent"},
    propertyModifier:{property:"ability.str.score",operation:"add",value:{value:2},source:"definition",instancePolicy:"stack"},
  };
  const resolved=resolveRuntimeProfileProperty([effect],"char.aelar","ability.str.modifier",{"ability.str.score":14});
  assert.equal(resolved.value,3);
  assert.ok(resolved.provenance.some((entry)=>entry.source.startsWith("profile:dnd.srd-5.2.1/")));
  assert.ok(resolved.provenance.some((entry)=>entry.source==="effect:effect.external.str-modifier"));
});

test("unknown Common Play property modifier projects through Effect state into production movement",async()=>{
  const result=await run("external-property-a");
  assert.equal(result.spent,5,JSON.stringify(result.resolution));
  assert.equal(result.resolution?.stage,"complete");
});

test("unknown Common Play property modifier projects a non-movement profile property and Undo restores its base",async()=>{
  const adapter=new MockAdapter();
  const {action}=await install(adapter,"external-property-ac");
  const before=await adapter.getSnapshot();
  const baseAc=before.scene.entities.find((entity)=>entity.id==="char.aelar")!.ac;
  await adapter.resolveAction(action("guard"),["char.aelar"]);
  const modified=await adapter.getSnapshot();
  const modifiedState=snapshotAdapterTurnRuntimeState(adapter,modified.scene)!;
  assert.deepEqual(modifiedState.effects.at(-1)?.propertyModifier,{property:"defense.ac",operation:"add",value:{value:2},source:"definition",instancePolicy:"stack"});
  assert.equal(modified.scene.entities.find((entity)=>entity.id==="char.aelar")!.ac,baseAc+2);
  await adapter.undoLastResolution();
  const undone=await adapter.getSnapshot();
  assert.equal(undone.scene.entities.find((entity)=>entity.id==="char.aelar")!.ac,baseAc);
});

test("source-bound property modifier survives a fresh local adapter restart",async()=>{
  const prefix="external-property-local-restart";
  const installedStore=new MemoryInstalledContentStore();
  const runtimeStore=new MemoryTurnRuntimeStateStore();
  const first=new MockAdapter();
  setTurnRuntimeStateStoreForTests(first,runtimeStore);
  const {action}=await install(first,prefix,installedStore);
  await first.resolveAction(action("slow"),["char.aelar"]);
  const committed=await first.getSnapshot();
  assert.equal(snapshotAdapterTurnRuntimeState(first,committed.scene)?.effects.length,1);

  const restarted=new MockAdapter();
  setInstalledContentStoreForTests(restarted,installedStore);
  setTurnRuntimeStateStoreForTests(restarted,runtimeStore);
  await restarted.startInitiative();
  await restarted.setCurrentActor("char.aelar");
  const restored=await restarted.getSnapshot();
  const restoredState=snapshotAdapterTurnRuntimeState(restarted,restored.scene)!;
  assert.deepEqual(restoredState.effects.at(-1)?.propertyModifier,{property:"movement.walk",operation:"set",value:{value:5},source:"definition",instancePolicy:"stack"});
  const beforeMove=restored.scene.economyByActor["char.aelar"]!.movement;
  await restarted.resolveAction(action("move"),["char.aelar"]);
  const moved=await restarted.getSnapshot();
  assert.equal(beforeMove-moved.scene.economyByActor["char.aelar"]!.movement,5,JSON.stringify(moved.resolution));
  assert.equal(moved.resolution?.stage,"complete");

  await restarted.endInitiative();
  const cleared=new MockAdapter();
  setInstalledContentStoreForTests(cleared,installedStore);
  setTurnRuntimeStateStoreForTests(cleared,runtimeStore);
  await cleared.startInitiative();
  const clearedSnapshot=await cleared.getSnapshot();
  assert.equal(snapshotAdapterTurnRuntimeState(cleared,clearedSnapshot.scene)?.effects.length,0);
});

test("renaming the external module preserves property-modified production movement",async()=>{
  const first=await run("external-property-a");
  const renamed=await run("renamed-property-b");
  assert.equal(first.spent,5);
  assert.equal(renamed.spent,5);
});

test("source-bound non-movement property modifier converges through connected replay, reconnect, and Undo",async()=>{
  const prefix="external-property-reconnect",sessionId="session.property-modifier";
  const host=new MockAdapter();
  const {pack,action}=await install(host,prefix);
  const initialHost=await host.getSnapshot();
  const baseAc=initialHost.scene.entities.find((entity)=>entity.id==="char.aelar")!.ac;
  const hostConnected=connectedStateFor(host);
  hostConnected.mode="host";hostConnected.sessionId=sessionId;hostConnected.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  const originalSend=tauriSessionTransport.send;
  const runHost=async(operation:()=>Promise<unknown>)=>{
    const wires:string[]=[];tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
    try { await operation(); } finally { tauriSessionTransport.send=originalSend; }
    const batch=wires.map((wire)=>JSON.parse(wire)).find((wire)=>wire.type==="event-batch") as {events:ConnectedSessionEvent[]}|undefined;
    assert.ok(batch,JSON.stringify(wires));return batch;
  };

  const applyBatch=await runHost(()=>host.resolveAction(action("guard"),["char.aelar"]));
  let hostSnapshot=await host.getSnapshot();
  const hostEffect=snapshotAdapterTurnRuntimeState(host,hostSnapshot.scene)?.effects.at(-1);
  assert.equal(hostEffect?.sourceId,`common-play:${pack.mechanicId}:guard:operation:0`);
  assert.deepEqual(hostEffect?.propertyModifier,{property:"defense.ac",operation:"add",value:{value:2},source:"definition",instancePolicy:"stack"});
  assert.equal(hostSnapshot.scene.entities.find((entity)=>entity.id==="char.aelar")!.ac,baseAc+2);

  const client=new MockAdapter();await install(client,prefix);
  const clientConnected=connectedStateFor(client);clientConnected.mode="client";clientConnected.sessionId=sessionId;clientConnected.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(client,applyBatch.events)).status,"applied");
  let clientSnapshot=await client.getSnapshot();
  assert.deepEqual(wireShape(snapshotAdapterTurnRuntimeState(client,clientSnapshot.scene)?.effects),wireShape(snapshotAdapterTurnRuntimeState(host,hostSnapshot.scene)?.effects));
  assert.equal(clientSnapshot.scene.entities.find((entity)=>entity.id==="char.aelar")!.ac,baseAc+2);

  const reconnect=new MockAdapter();await install(reconnect,prefix);
  const reconnectState=connectedStateFor(reconnect);reconnectState.mode="client";reconnectState.sessionId=sessionId;reconnectState.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(reconnect,hostConnected.ledger!.eventsAfter(0))).status,"applied");
  let reconnectSnapshot=await reconnect.getSnapshot();
  assert.deepEqual(wireShape(snapshotAdapterTurnRuntimeState(reconnect,reconnectSnapshot.scene)?.effects),wireShape(snapshotAdapterTurnRuntimeState(host,hostSnapshot.scene)?.effects));
  assert.equal(reconnectSnapshot.scene.entities.find((entity)=>entity.id==="char.aelar")!.ac,baseAc+2);

  const undoBatch=await runHost(()=>host.undoLastResolution());
  assert.equal((await applyConnectedClientEvents(client,undoBatch.events)).status,"applied");
  assert.equal((await applyConnectedClientEvents(reconnect,undoBatch.events)).status,"applied");
  hostSnapshot=await host.getSnapshot();clientSnapshot=await client.getSnapshot();reconnectSnapshot=await reconnect.getSnapshot();
  assert.equal(snapshotAdapterTurnRuntimeState(host,hostSnapshot.scene)?.effects.length,0);
  assert.deepEqual(wireShape(snapshotAdapterTurnRuntimeState(client,clientSnapshot.scene)?.effects),wireShape(snapshotAdapterTurnRuntimeState(host,hostSnapshot.scene)?.effects));
  assert.deepEqual(wireShape(snapshotAdapterTurnRuntimeState(reconnect,reconnectSnapshot.scene)?.effects),wireShape(snapshotAdapterTurnRuntimeState(host,hostSnapshot.scene)?.effects));
  assert.equal(hostSnapshot.scene.entities.find((entity)=>entity.id==="char.aelar")!.ac,baseAc);
  assert.equal(clientSnapshot.scene.entities.find((entity)=>entity.id==="char.aelar")!.ac,baseAc);
  assert.equal(reconnectSnapshot.scene.entities.find((entity)=>entity.id==="char.aelar")!.ac,baseAc);
});


test("unknown Common Play consumes an effect-modified derived profile property",async()=>{
  const adapter=new MockAdapter();
  const {action}=await install(adapter,"external-property-derived");
  const before=await adapter.getSnapshot();
  const initialRemaining=before.scene.economyByActor["char.aelar"]!.movement;
  await adapter.resolveAction(action("strength"),["char.aelar"]);
  await adapter.resolveAction(action("move-strength"),["char.aelar"]);
  const after=await adapter.getSnapshot();
  assert.equal(initialRemaining-after.scene.economyByActor["char.aelar"]!.movement,2,JSON.stringify(after.resolution));
  assert.equal(after.resolution?.stage,"complete");
});