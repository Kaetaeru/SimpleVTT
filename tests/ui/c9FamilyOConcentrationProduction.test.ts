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
import { installedCommonPlayActionId, storedInvocationCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";
import { snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";

function concentrationConfig(prefix:string) {
  return {
    schemaVersion:"0.2-draft",
    id:`${prefix}.concentration`,
    entryPoints:[{
      id:"activate",
      invocation:"manual",
      operations:[{kind:"effect.apply",template:"focus",target:"actor"}],
    }],
    artifactTemplates:[{
      id:"focus",
      artifactKind:"effect",
      duration:{kind:"maintained",policy:"concentration"},
      rules:[{
        id:"retaliate",
        event:"damage.taken",
        frequency:"once",
        operations:[{kind:"damage.apply",amount:{value:1},damageType:"force",target:"event.actor"}],
      }],
      lifetime:{kind:"until-event",event:"damage.taken",onEnd:"destroy"},
      instancePolicy:"stack",
    }],
  };
}

function readySpellConfig(prefix:string) {
  return {
    schemaVersion:"0.2-draft",
    id:`${prefix}.ready-spell`,
    entryPoints:[{
      id:"release",
      invocation:"manual",
      operations:[{kind:"damage.apply",amount:{value:1},damageType:"force",target:"actor"}],
    }],
  };
}

async function install(adapter:MockAdapter,prefix:string) {
  const moduleId=`${prefix}.module`;
  const contentId=`${prefix}.content`;
  const config=concentrationConfig(prefix);
  const json=JSON.stringify({
    schemaVersion:"0.1-draft",
    moduleId,
    moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
    defaultLocale:"en",
    source:{document:"Unknown concentration module",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:contentId,
      category:"spell",
      presentation:{defaultLocale:"en",originalName:"Unknown Focus",locales:{en:{name:"Unknown Focus"}}},
      mechanics:[{kind:"common-play",config}],
    }],
  });
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  return {
    action:installedCommonPlayActionId({
      catalogId:catalogQualifiedId(contentId,moduleId,"1"),
      mechanicId:config.id,
      entryPointId:"activate",
    }),
    mechanicId:config.id,
  };
}

async function installReadySpell(adapter:MockAdapter,prefix:string) {
  const moduleId=`${prefix}.module`;
  const contentId=`${prefix}.content`;
  const config=readySpellConfig(prefix);
  const json=JSON.stringify({
    schemaVersion:"0.1-draft",
    moduleId,
    moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
    defaultLocale:"en",
    source:{document:"Unknown readied spell module",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:contentId,
      category:"spell",
      presentation:{defaultLocale:"en",originalName:"Unknown Readied Spell",locales:{en:{name:"Unknown Readied Spell"}}},
      mechanics:[{kind:"common-play",config}],
    }],
  });
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  return {
    action:installedCommonPlayActionId({
      catalogId:catalogQualifiedId(contentId,moduleId,"1"),
      mechanicId:config.id,
      entryPointId:"release",
    }),
    mechanicId:config.id,
  };
}

function concentrationShape(adapter:MockAdapter,snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  const runtime=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  const concentration=runtime.concentration["char.aelar"];
  const effect=runtime.effects.find((candidate)=>candidate.sourceId===concentration?.sourceId);
  return {
    active:Boolean(concentration),
    sourceId:concentration?.sourceId,
    bound:Boolean(concentration&&effect?.concentrationGroupId===concentration.groupId),
    effectCount:runtime.effects.filter((candidate)=>candidate.concentrationGroupId===concentration?.groupId).length,
  };
}

function readySpellShape(adapter:MockAdapter,snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  const runtime=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  const concentration=runtime.concentration["char.aelar"];
  const stored=runtime.artifacts?.find((candidate)=>candidate.artifactKind==="stored-invocation")?.storedInvocation;
  return {
    active:Boolean(concentration),
    stored:Boolean(stored),
    bound:Boolean(concentration&&stored?.concentrationGroupId===concentration.groupId),
  };
}

async function captureHostBatch(operation:()=>Promise<unknown>) {
  const wires:string[]=[];
  const originalSend=tauriSessionTransport.send;
  tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
  try { await operation(); } finally { tauriSessionTransport.send=originalSend; }
  const batch=wires.map((wire)=>JSON.parse(wire)).find((wire)=>wire.type==="event-batch") as {events:ConnectedSessionEvent[]}|undefined;
  assert.ok(batch,JSON.stringify(wires));
  return batch;
}

test("unknown installed maintained concentration converges through Host replay, Undo, and fresh reconnect",async()=>{
  const prefix="unknown-family-o",sessionId="session.family-o-concentration";
  const host=new MockAdapter();
  const {action,mechanicId}=await install(host,prefix);
  const hostConnected=connectedStateFor(host);
  hostConnected.mode="host";
  hostConnected.sessionId=sessionId;
  hostConnected.ledger=new HostSessionLedger(sessionId,connectedManifest(host));

  const activationBatch=await captureHostBatch(()=>host.resolveAction(action,["char.aelar"]));
  let hostSnapshot=await host.getSnapshot();
  assert.deepEqual(concentrationShape(host,hostSnapshot),{active:true,sourceId:mechanicId,bound:true,effectCount:1});

  const client=new MockAdapter();
  await install(client,prefix);
  const clientConnected=connectedStateFor(client);
  clientConnected.mode="client";
  clientConnected.sessionId=sessionId;
  clientConnected.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(client,activationBatch.events)).status,"applied");
  assert.equal((await applyConnectedClientEvents(client,activationBatch.events)).status,"duplicate");
  let clientSnapshot=await client.getSnapshot();
  assert.deepEqual(concentrationShape(client,clientSnapshot),concentrationShape(host,hostSnapshot));

  const undoBatch=await captureHostBatch(()=>host.undoLastResolution());
  assert.equal((await applyConnectedClientEvents(client,undoBatch.events)).status,"applied");
  hostSnapshot=await host.getSnapshot();
  clientSnapshot=await client.getSnapshot();
  assert.equal(concentrationShape(host,hostSnapshot).active,false);
  assert.deepEqual(concentrationShape(client,clientSnapshot),concentrationShape(host,hostSnapshot));

  const reconnect=new MockAdapter();
  await install(reconnect,prefix);
  const reconnectConnected=connectedStateFor(reconnect);
  reconnectConnected.mode="client";
  reconnectConnected.sessionId=sessionId;
  reconnectConnected.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(reconnect,hostConnected.ledger!.eventsAfter(0))).status,"applied");
  const reconnectSnapshot=await reconnect.getSnapshot();
  assert.deepEqual(concentrationShape(reconnect,reconnectSnapshot),concentrationShape(host,hostSnapshot));
});

test("renaming unknown installed concentration identities preserves production semantics",async()=>{
  const run=async(prefix:string)=>{
    const adapter=new MockAdapter();
    const {action}=await install(adapter,prefix);
    await adapter.resolveAction(action,["char.aelar"]);
    const shape=concentrationShape(adapter,await adapter.getSnapshot());
    return {active:shape.active,bound:shape.bound,effectCount:shape.effectCount};
  };
  assert.deepEqual(await run("external-family-o-a"),await run("completely-renamed-family-o-b"));
});

test("unknown installed readied spell owns concentration until trigger and restores it through Undo",async()=>{
  const run=async(prefix:string)=>{
    const adapter=new MockAdapter();
    const {action}=await installReadySpell(adapter,prefix);
    await adapter.configureReadyAction({actorId:"char.aelar",actionId:action,trigger:"declared external trigger"});
    const captured=readySpellShape(adapter,await adapter.getSnapshot());
    assert.deepEqual(captured,{active:true,stored:true,bound:true});

    const runtime=snapshotAdapterTurnRuntimeState(adapter,(await adapter.getSnapshot()).scene)!;
    const artifact=runtime.artifacts?.find((candidate)=>candidate.artifactKind==="stored-invocation");
    assert.ok(artifact?.storedInvocation);
    await adapter.resolveAction(storedInvocationCommonPlayActionId(artifact.id,action),["char.aelar"]);
    const triggered=readySpellShape(adapter,await adapter.getSnapshot());
    assert.deepEqual(triggered,{active:false,stored:false,bound:false});

    await adapter.undoLastResolution();
    const undone=readySpellShape(adapter,await adapter.getSnapshot());
    assert.deepEqual(undone,{active:true,stored:true,bound:true});
    return {captured,triggered,undone};
  };

  assert.deepEqual(await run("unknown-family-o-ready-a"),await run("renamed-family-o-ready-b"));
});
