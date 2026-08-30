import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/installedContentRuntimeAdapter";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";
import { snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";

const TARGET_ID="combatant.goblin-a";

function packagePayload(prefix:string) {
  const moduleId=`${prefix}.module`;
  const contentId=`${prefix}.condition`;
  const mechanicId=`${prefix}.mechanic`;
  return {
    moduleId,contentId,mechanicId,
    json:JSON.stringify({
      schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
      rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
      source:{document:"Family M connected condition probe",version:"1",license:"CC0",srdDerived:false},
      dependencies:[],conflicts:[],capabilities:[],
      content:[{
        id:contentId,category:"condition",
        presentation:{defaultLocale:"en",originalName:"Connected Condition Probe",locales:{en:{name:"Connected Condition Probe"}}},
        mechanics:[{kind:"common-play",config:{
          schemaVersion:"0.2-draft",id:mechanicId,
          entryPoints:[
            {id:"poison",invocation:"manual",targeting:{from:"targets",min:1,max:1},operations:[{kind:"condition.apply",condition:"poisoned",target:"target"}]},
            {id:"clear",invocation:"manual",targeting:{from:"targets",min:1,max:1},operations:[{kind:"condition.remove",condition:"poisoned",target:"target"}]},
          ],
        }}],
      }],
    }),
  };
}

async function install(adapter:MockAdapter,prefix:string) {
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const pack=packagePayload(prefix);
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const action=(entryPointId:string)=>installedCommonPlayActionId({
    catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId,
  });
  return {poison:action("poison"),clear:action("clear")};
}

function connectClient(adapter:MockAdapter,sessionId:string) {
  const state=connectedStateFor(adapter);
  state.mode="client";
  state.sessionId=sessionId;
  state.replica=new ClientSessionReplica(sessionId);
}

function batches(wires:string[]) {
  return wires
    .map((wire)=>JSON.parse(wire) as {type:string;events?:ConnectedSessionEvent[]})
    .filter((wire):wire is {type:"event-batch";events:ConnectedSessionEvent[]}=>wire.type==="event-batch"&&Array.isArray(wire.events));
}

async function captureHostBatch(operation:()=>Promise<unknown>) {
  const wires:string[]=[];
  const originalSend=tauriSessionTransport.send;
  tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
  try { await operation(); }
  finally { tauriSessionTransport.send=originalSend; }
  const batch=batches(wires).at(-1);
  assert.ok(batch,JSON.stringify(wires));
  return batch;
}

async function poisonedEffects(adapter:MockAdapter) {
  const snapshot=await adapter.getSnapshot();
  return snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.effects.filter((effect)=>effect.targetId===TARGET_ID&&effect.conditionId==="poisoned")??[];
}

test("unknown portable condition apply/remove survives connected replay, duplicate delivery, reconnect, and Undo",async()=>{
  const prefix="external-family-m-connected";
  const sessionId="session.external-family-m-connected";
  const host=new MockAdapter();
  const actions=await install(host,prefix);
  const hostConnected=connectedStateFor(host);
  hostConnected.mode="host";
  hostConnected.sessionId=sessionId;
  hostConnected.ledger=new HostSessionLedger(sessionId,connectedManifest(host));

  const client=new MockAdapter();
  await install(client,prefix);
  connectClient(client,sessionId);

  const applyBatch=await captureHostBatch(()=>host.resolveAction(actions.poison,[TARGET_ID]));
  assert.equal((await applyConnectedClientEvents(client,applyBatch.events)).status,"applied");
  assert.equal((await poisonedEffects(host)).length,1);
  assert.equal((await poisonedEffects(client)).length,1);
  assert.equal((await applyConnectedClientEvents(client,applyBatch.events)).status,"duplicate");
  assert.equal((await poisonedEffects(client)).length,1,"duplicate replay must not duplicate the condition Effect");

  const reconnect=new MockAdapter();
  await install(reconnect,prefix);
  connectClient(reconnect,sessionId);
  assert.equal((await applyConnectedClientEvents(reconnect,hostConnected.ledger!.eventsAfter(0))).status,"applied");
  assert.equal((await poisonedEffects(reconnect)).length,1,"fresh reconnect must reconstruct the portable condition");

  const removeBatch=await captureHostBatch(()=>host.resolveAction(actions.clear,[TARGET_ID]));
  assert.equal((await applyConnectedClientEvents(client,removeBatch.events)).status,"applied");
  assert.equal((await poisonedEffects(host)).length,0);
  assert.equal((await poisonedEffects(client)).length,0);

  const reconnectAfterRemove=new MockAdapter();
  await install(reconnectAfterRemove,prefix);
  connectClient(reconnectAfterRemove,sessionId);
  assert.equal((await applyConnectedClientEvents(reconnectAfterRemove,hostConnected.ledger!.eventsAfter(0))).status,"applied");
  assert.equal((await poisonedEffects(reconnectAfterRemove)).length,0,"reconnect after remove must not resurrect the condition");

  const undoBatch=await captureHostBatch(()=>host.undoLastResolution());
  assert.equal((await applyConnectedClientEvents(client,undoBatch.events)).status,"applied");
  assert.equal((await poisonedEffects(host)).length,1);
  assert.equal((await poisonedEffects(client)).length,1);

  const reconnectAfterUndo=new MockAdapter();
  await install(reconnectAfterUndo,prefix);
  connectClient(reconnectAfterUndo,sessionId);
  assert.equal((await applyConnectedClientEvents(reconnectAfterUndo,hostConnected.ledger!.eventsAfter(0))).status,"applied");
  assert.equal((await poisonedEffects(reconnectAfterUndo)).length,1,"reconnect after Undo must restore the authoritative condition state");
});
