import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import "../../src/app/connectedTurnRoutingAdapter";
import "../../src/app/installedContentRuntimeAdapter";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";
import { MemoryTurnRuntimeStateStore, setTurnRuntimeStateStoreForTests, snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";

const ACTOR_ID="char.aelar";
const TARGET_ID="combatant.goblin-a";

function packagePayload(prefix:string) {
  const moduleId=`${prefix}.module`;
  const contentId=`${prefix}.mastery-option`;
  const mechanicId=`${prefix}.mastery`;
  const config={schemaVersion:"0.2-draft",id:mechanicId,entryPoints:[
    {
      id:"graze",invocation:"manual",targeting:{from:"targets",min:1,max:1},
      test:{kind:"attack-roll",roller:"actor",dc:{value:10}},
      operations:[{kind:"damage.apply",amount:{value:3},damageType:"slashing",target:"target",when:{op:"eq",left:{ref:"test.outcome"},right:{value:"failure"}}}],
    },
    {
      id:"slow",invocation:"manual",targeting:{from:"targets",min:1,max:1},
      operations:[{
        kind:"property.modify",property:"movement.walk",operation:"subtract",value:{value:10},target:"target",
        owner:"effect",source:"definition",duration:{kind:"elapsed",amount:{value:1},unit:"minutes"},
        lifetime:{kind:"until-duration",onEnd:"destroy"},instancePolicy:"stack",
      }],
    },
  ]};
  return {moduleId,contentId,mechanicId,json:JSON.stringify({
    schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Unknown Family K connected mastery module",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{id:contentId,category:"option",presentation:{defaultLocale:"en",originalName:"Unknown Mastery Shapes",locales:{en:{name:"Unknown Mastery Shapes"}}},mechanics:[{kind:"common-play",config}]}],
  })};
}

async function install(adapter:MockAdapter,prefix:string,installedStore=new MemoryInstalledContentStore()) {
  setInstalledContentStoreForTests(adapter,installedStore);
  const pack=packagePayload(prefix);
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor(ACTOR_ID);
  const action=(entryPointId:string)=>installedCommonPlayActionId({
    catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId,
  });
  return {pack,action};
}

function targetHp(adapter:MockAdapter,snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  const target=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.combatants[TARGET_ID];
  assert.ok(target);
  return target.life.hp.current;
}

function slowEffects(adapter:MockAdapter,snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  return snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.effects.filter((effect)=>
    effect.targetId===TARGET_ID&&effect.propertyModifier?.property==="movement.walk"
  )??[];
}

function connectClient(adapter:MockAdapter,sessionId:string) {
  const state=connectedStateFor(adapter);
  state.mode="client";
  state.sessionId=sessionId;
  state.replica=new ClientSessionReplica(sessionId);
}

function eventBatches(wires:string[]) {
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
  const batch=eventBatches(wires).at(-1);
  assert.ok(batch,JSON.stringify(wires));
  return batch;
}

async function exerciseShapes(prefix:string) {
  const adapter=new MockAdapter();
  const {action}=await install(adapter,prefix);
  let snapshot=await adapter.getSnapshot();
  const before=targetHp(adapter,snapshot);
  await adapter.setQueuedD20(1);
  snapshot=await adapter.resolveAction(action("graze"),[TARGET_ID]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  const grazeDamage=before-targetHp(adapter,snapshot);
  snapshot=await adapter.resolveAction(action("slow"),[TARGET_ID]);
  const slow=slowEffects(adapter,snapshot).at(-1);
  assert.ok(slow?.propertyModifier);
  return {
    grazeDamage,
    slow:{targetId:slow.targetId,property:slow.propertyModifier.property,operation:slow.propertyModifier.operation,value:slow.propertyModifier.value},
  };
}

test("renamed unknown RuleModules preserve two distinct portable Weapon Mastery shapes",async()=>{
  const first=await exerciseShapes("external-family-k-shapes-a");
  const renamed=await exerciseShapes("completely-renamed-family-k-shapes-b");
  assert.deepEqual(first,{grazeDamage:3,slow:{targetId:TARGET_ID,property:"movement.walk",operation:"subtract",value:{value:10}}});
  assert.deepEqual(renamed,first);
});

test("Slow-like mastery state survives a fresh runtime restart and remains source-bound",async()=>{
  const prefix="external-family-k-restart";
  const installedStore=new MemoryInstalledContentStore();
  const runtimeStore=new MemoryTurnRuntimeStateStore();
  const first=new MockAdapter();
  setTurnRuntimeStateStoreForTests(first,runtimeStore);
  const {action}=await install(first,prefix,installedStore);
  await first.resolveAction(action("slow"),[TARGET_ID]);
  let snapshot=await first.getSnapshot();
  assert.equal(slowEffects(first,snapshot).length,1);

  const restarted=new MockAdapter();
  setInstalledContentStoreForTests(restarted,installedStore);
  setTurnRuntimeStateStoreForTests(restarted,runtimeStore);
  await restarted.startInitiative();
  await restarted.setCurrentActor(ACTOR_ID);
  snapshot=await restarted.getSnapshot();
  const restored=slowEffects(restarted,snapshot);
  assert.equal(restored.length,1);
  assert.deepEqual(restored[0]?.propertyModifier,{property:"movement.walk",operation:"subtract",value:{value:10},source:"definition",instancePolicy:"stack"});
  assert.match(restored[0]?.sourceId??"",new RegExp(prefix));
});

test("Graze-like damage and Slow-like state converge through connected replay, reconnect, duplicate replay, and Undo",async()=>{
  const prefix="external-family-k-connected";
  const sessionId="session.external-family-k-connected";
  const host=new MockAdapter();
  const {action}=await install(host,prefix);
  const hostConnected=connectedStateFor(host);
  hostConnected.mode="host";
  hostConnected.sessionId=sessionId;
  hostConnected.ledger=new HostSessionLedger(sessionId,connectedManifest(host));

  const client=new MockAdapter();
  await install(client,prefix);
  connectClient(client,sessionId);

  const before=targetHp(host,await host.getSnapshot());
  await host.setQueuedD20(1);
  const grazeBatch=await captureHostBatch(()=>host.resolveAction(action("graze"),[TARGET_ID]));
  assert.equal((await applyConnectedClientEvents(client,grazeBatch.events)).status,"applied");
  assert.equal(targetHp(host,await host.getSnapshot()),before-3);
  assert.equal(targetHp(client,await client.getSnapshot()),before-3);

  const slowBatch=await captureHostBatch(()=>host.resolveAction(action("slow"),[TARGET_ID]));
  assert.equal((await applyConnectedClientEvents(client,slowBatch.events)).status,"applied");
  assert.equal(slowEffects(host,await host.getSnapshot()).length,1);
  assert.equal(slowEffects(client,await client.getSnapshot()).length,1);
  assert.equal((await applyConnectedClientEvents(client,slowBatch.events)).status,"duplicate");
  assert.equal(slowEffects(client,await client.getSnapshot()).length,1,"duplicate replay must not duplicate Slow-like state");

  const reconnect=new MockAdapter();
  await install(reconnect,prefix);
  connectClient(reconnect,sessionId);
  assert.equal((await applyConnectedClientEvents(reconnect,hostConnected.ledger!.eventsAfter(0))).status,"applied");
  assert.equal(targetHp(reconnect,await reconnect.getSnapshot()),before-3);
  assert.equal(slowEffects(reconnect,await reconnect.getSnapshot()).length,1);

  const undoBatch=await captureHostBatch(()=>host.undoLastResolution());
  assert.equal((await applyConnectedClientEvents(client,undoBatch.events)).status,"applied");
  assert.equal(slowEffects(host,await host.getSnapshot()).length,0);
  assert.equal(slowEffects(client,await client.getSnapshot()).length,0);
  assert.equal(targetHp(host,await host.getSnapshot()),before-3,"Undo of the latest Slow-like resolution must not undo the prior Graze-like damage");

  const reconnectAfterUndo=new MockAdapter();
  await install(reconnectAfterUndo,prefix);
  connectClient(reconnectAfterUndo,sessionId);
  assert.equal((await applyConnectedClientEvents(reconnectAfterUndo,hostConnected.ledger!.eventsAfter(0))).status,"applied");
  assert.equal(targetHp(reconnectAfterUndo,await reconnectAfterUndo.getSnapshot()),before-3);
  assert.equal(slowEffects(reconnectAfterUndo,await reconnectAfterUndo.getSnapshot()).length,0,"reconnect replay after Undo must not resurrect Slow-like state");
});
