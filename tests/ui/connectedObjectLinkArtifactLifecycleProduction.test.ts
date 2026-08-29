import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import "../../src/app/connectedTurnRoutingAdapter";
import "../../src/app/installedContentRuntimeAdapter";
import { artifactLifecycleCommonPlayActionId } from "../../src/app/installedCommonPlayArtifactLifecycleAdapter";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { ClientSessionReplica, HostSessionLedger } from "../../src/app/connectedSessionProtocol";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";
import { snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";

function packagePayload(prefix:string) {
  const moduleId=`${prefix}.module`;
  const contentId=`${prefix}.artifact-content`;
  const mechanicId=`${prefix}.artifacts`;
  const config={
    schemaVersion:"0.2-draft",id:mechanicId,
    entryPoints:[{id:"create",invocation:"manual",operations:[
      {kind:"artifact.spawn",template:"wall"},
      {kind:"artifact.spawn",template:"tether"},
      {kind:"artifact.spawn",template:"portal"},
    ]}],
    artifactTemplates:[
      {
        id:"wall",artifactKind:"object",duration:{kind:"durable"},lifetime:{kind:"durable"},
        initialState:{size:"large",armorClass:15,hp:{current:20,maximum:20},damageThreshold:5,damageDefenses:[{source:"stone",kind:"resistance",damageType:"slashing"}],repairable:true},
        grantedEntryPoints:[
          {id:"chip",invocation:"granted",operations:[{kind:"damage.apply",amount:{value:7},damageType:"force",target:"artifact"}]},
          {id:"repair",invocation:"granted",operations:[{kind:"healing.apply",amount:{value:3},target:"artifact"}]},
          {id:"relocate",invocation:"granted",operations:[{kind:"artifact.relocate",artifact:"wall",placementRef:"provider:wall-b"}]},
          {id:"destroy",invocation:"granted",operations:[{kind:"damage.apply",amount:{value:30},damageType:"force",target:"artifact"}]},
        ],
      },
      {
        id:"tether",artifactKind:"link",duration:{kind:"elapsed",amount:{value:6},unit:"seconds"},lifetime:{kind:"durable"},
        initialState:{endpointIds:["actor","combatant.goblin-a"],relation:"tether",maximumLengthFeet:30},
      },
      {
        id:"portal",artifactKind:"link",duration:{kind:"durable"},lifetime:{kind:"durable"},
        initialState:{endpointIds:["actor","combatant.goblin-a"],relation:"portal"},
        grantedEntryPoints:[
          {id:"close",invocation:"granted",operations:[{kind:"artifact.remove",artifact:"portal"}]},
        ],
      },
    ],
  };
  return {
    json:JSON.stringify({
      schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
      rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
      source:{document:"Unknown object link lifecycle proof",version:"1",license:"CC0",srdDerived:false},
      dependencies:[],conflicts:[],capabilities:[],
      content:[{
        id:contentId,category:"option",
        presentation:{defaultLocale:"en",originalName:"Unknown Artifact Family",locales:{en:{name:"Unknown Artifact Family"}}},
        mechanics:[{kind:"common-play",config}],
      }],
    }),
    createAction:installedCommonPlayActionId({catalogId:catalogQualifiedId(contentId,moduleId,"1"),mechanicId,entryPointId:"create"}),
  };
}

async function install(adapter:MockAdapter,prefix:string) {
  const pack=packagePayload(prefix);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  return pack;
}

function artifacts(adapter:MockAdapter,snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  return snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.artifacts??[];
}

async function applyFullLedger(host:MockAdapter,client:MockAdapter) {
  const ledger=connectedStateFor(host).ledger!;
  return applyConnectedClientEvents(client,ledger.eventsAfter(0));
}

async function withoutDesktopTransport<T>(operation:()=>Promise<T>) {
  const originalSend=tauriSessionTransport.send;
  tauriSessionTransport.send=async()=>1;
  try { return await operation(); }
  finally { tauriSessionTransport.send=originalSend; }
}

async function runRenamedObject(prefix:string) {
  const adapter=new MockAdapter();
  const pack=await install(adapter,prefix);
  await adapter.resolveAction(pack.createAction,["char.aelar"]);
  let snapshot=await adapter.getSnapshot();
  const wall=artifacts(adapter,snapshot).find((artifact)=>artifact.templateId==="wall")!;
  await adapter.resolveAction(artifactLifecycleCommonPlayActionId(wall.id,"chip"),["char.aelar"]);
  await adapter.resolveAction(artifactLifecycleCommonPlayActionId(wall.id,"relocate"),["char.aelar"]);
  snapshot=await adapter.getSnapshot();
  const after=artifacts(adapter,snapshot).find((artifact)=>artifact.templateId==="wall")!;
  return {hp:after.object?.hp.current,armorClass:after.object?.armorClass,size:after.object?.size,placementRef:after.placementRef};
}

test("unknown object/link artifacts execute granted lifecycle actions through connected replay, reconnect, and Undo",async()=>{
  const prefix="unknown-object-link",sessionId="session.object-link-lifecycle";
  const host=new MockAdapter();
  const client=new MockAdapter();
  const pack=await install(host,prefix);
  await install(client,prefix);
  const hostConnected=connectedStateFor(host);
  hostConnected.mode="host";hostConnected.sessionId=sessionId;hostConnected.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  const clientConnected=connectedStateFor(client);
  clientConnected.mode="client";clientConnected.sessionId=sessionId;clientConnected.replica=new ClientSessionReplica(sessionId);

  await withoutDesktopTransport(()=>host.resolveAction(pack.createAction,["char.aelar"]));
  assert.equal((await applyFullLedger(host,client)).status,"applied");
  let hostSnapshot=await host.getSnapshot();
  let clientSnapshot=await client.getSnapshot();
  const wall=artifacts(host,hostSnapshot).find((artifact)=>artifact.templateId==="wall")!;
  const tether=artifacts(host,hostSnapshot).find((artifact)=>artifact.templateId==="tether")!;
  const portal=artifacts(host,hostSnapshot).find((artifact)=>artifact.templateId==="portal")!;
  assert.equal(wall.object?.hp.current,20);
  assert.equal(tether.link?.relation,"tether");
  assert.equal(portal.link?.relation,"portal");
  assert.deepEqual(artifacts(client,clientSnapshot).map((artifact)=>artifact.templateId),["wall","tether","portal"]);
  assert.ok(hostSnapshot.scene.actionsByActor["char.aelar"]?.some((action)=>action.id===artifactLifecycleCommonPlayActionId(wall.id,"chip")));
  assert.ok(hostSnapshot.scene.actionsByActor["char.aelar"]?.some((action)=>action.id===artifactLifecycleCommonPlayActionId(portal.id,"close")));

  await withoutDesktopTransport(()=>host.resolveAction(artifactLifecycleCommonPlayActionId(wall.id,"chip"),["char.aelar"]));
  assert.equal((await applyFullLedger(host,client)).status,"applied");
  hostSnapshot=await host.getSnapshot();clientSnapshot=await client.getSnapshot();
  assert.equal(artifacts(host,hostSnapshot).find((artifact)=>artifact.id===wall.id)?.object?.hp.current,13);
  assert.equal(artifacts(client,clientSnapshot).find((artifact)=>artifact.id===wall.id)?.object?.hp.current,13);

  await withoutDesktopTransport(()=>host.resolveAction(artifactLifecycleCommonPlayActionId(wall.id,"repair"),["char.aelar"]));
  assert.equal((await applyFullLedger(host,client)).status,"applied");
  assert.equal(artifacts(host,await host.getSnapshot()).find((artifact)=>artifact.id===wall.id)?.object?.hp.current,16);

  await withoutDesktopTransport(()=>host.resolveAction(artifactLifecycleCommonPlayActionId(wall.id,"relocate"),["char.aelar"]));
  assert.equal((await applyFullLedger(host,client)).status,"applied");
  hostSnapshot=await host.getSnapshot();clientSnapshot=await client.getSnapshot();
  assert.equal(artifacts(host,hostSnapshot).find((artifact)=>artifact.id===wall.id)?.placementRef,"provider:wall-b");
  assert.equal(artifacts(client,clientSnapshot).find((artifact)=>artifact.id===wall.id)?.placementRef,"provider:wall-b");

  await withoutDesktopTransport(()=>host.resolveAction(artifactLifecycleCommonPlayActionId(portal.id,"close"),["char.aelar"]));
  assert.equal((await applyFullLedger(host,client)).status,"applied");
  hostSnapshot=await host.getSnapshot();clientSnapshot=await client.getSnapshot();
  assert.equal(artifacts(host,hostSnapshot).some((artifact)=>artifact.id===portal.id),false);
  assert.equal(artifacts(client,clientSnapshot).some((artifact)=>artifact.id===portal.id),false);

  await withoutDesktopTransport(()=>host.resolveAction(artifactLifecycleCommonPlayActionId(wall.id,"destroy"),["char.aelar"]));
  assert.equal((await applyFullLedger(host,client)).status,"applied");
  hostSnapshot=await host.getSnapshot();clientSnapshot=await client.getSnapshot();
  assert.equal(artifacts(host,hostSnapshot).some((artifact)=>artifact.id===wall.id),false);
  assert.equal(artifacts(client,clientSnapshot).some((artifact)=>artifact.id===wall.id),false);
  assert.equal(hostSnapshot.scene.actionsByActor["char.aelar"]?.some((action)=>action.id.includes(encodeURIComponent(wall.id))),false);
  assert.equal((await applyFullLedger(host,client)).status,"duplicate");

  for(let guard=0;guard<12&&artifacts(host,await host.getSnapshot()).some((artifact)=>artifact.id===tether.id);guard+=1) await withoutDesktopTransport(()=>host.endTurn());
  assert.equal((await applyFullLedger(host,client)).status,"applied");
  hostSnapshot=await host.getSnapshot();clientSnapshot=await client.getSnapshot();
  assert.equal(artifacts(host,hostSnapshot).some((artifact)=>artifact.id===tether.id),false);
  assert.equal(artifacts(client,clientSnapshot).some((artifact)=>artifact.id===tether.id),false);

  const reconnect=new MockAdapter();
  await install(reconnect,prefix);
  const reconnectState=connectedStateFor(reconnect);
  reconnectState.mode="client";reconnectState.sessionId=sessionId;reconnectState.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(reconnect,hostConnected.ledger.eventsAfter(0))).status,"applied");
  assert.equal(artifacts(reconnect,await reconnect.getSnapshot()).some((artifact)=>artifact.id===wall.id||artifact.id===tether.id||artifact.id===portal.id),false);

  await withoutDesktopTransport(()=>host.undoLastResolution());
  assert.equal((await applyFullLedger(host,client)).status,"applied");
  hostSnapshot=await host.getSnapshot();clientSnapshot=await client.getSnapshot();
  assert.equal(artifacts(host,hostSnapshot).some((artifact)=>artifact.id===tether.id),true);
  assert.equal(artifacts(client,clientSnapshot).some((artifact)=>artifact.id===tether.id),true);
});

test("renaming the external object module preserves granted lifecycle semantics",async()=>{
  assert.deepEqual(await runRenamedObject("unknown-object-a"),await runRenamedObject("fully-renamed-object-b"));
});