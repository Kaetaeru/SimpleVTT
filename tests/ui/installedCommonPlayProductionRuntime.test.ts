import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
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
import { FIGHTER_SECOND_WIND_RESOURCE_ID } from "../../src/domain/coreClassResources";

const MODULE_ID="homebrew.production-probe";
const MODULE_VERSION="1";
const CONTENT_ID="option.external-production-probe";
const MECHANIC_ID="external.unknown.production-probe";
const ENTRY_POINT_ID="activate";

interface D20Identity {
  moduleId:string;
  contentId:string;
  mechanicId:string;
  entryPointId:string;
  displayName:string;
}

const D20_IDENTITY:D20Identity={
  moduleId:"homebrew.d20-production-probe",
  contentId:"option.external-d20-production-probe",
  mechanicId:"external.unknown.generic-d20-production-probe",
  entryPointId:"attempt",
  displayName:"External d20 Production Probe",
};

function packagePayload() {
  return JSON.stringify({
    schemaVersion:"0.1-draft",
    moduleId:MODULE_ID,
    moduleVersion:MODULE_VERSION,
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
    defaultLocale:"en",
    source:{document:"External Production Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:CONTENT_ID,
      category:"option",
      presentation:{defaultLocale:"en",originalName:"External Production Probe",locales:{en:{name:"External Production Probe",description:"Portable production dispatch probe"}}},
      mechanics:[{
        kind:"common-play",
        config:{
          schemaVersion:"0.2-draft",
          id:MECHANIC_ID,
          payments:[
            {kind:"resource",resource:FIGHTER_SECOND_WIND_RESOURCE_ID,amount:{value:1},consumeAt:"commit"},
          ],
          entryPoints:[{
            id:ENTRY_POINT_ID,
            invocation:"manual",
            operations:[{kind:"economy.modify",bucket:"action.extra.non-magic",amount:{value:1}}],
          }],
        },
      }],
    }],
  });
}

function d20PackagePayload(identity=D20_IDENTITY) {
  return JSON.stringify({
    schemaVersion:"0.1-draft",
    moduleId:identity.moduleId,
    moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
    defaultLocale:"en",
    source:{document:"External d20 Production Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:identity.contentId,
      category:"option",
      presentation:{defaultLocale:"en",originalName:identity.displayName,locales:{en:{name:identity.displayName,description:"Portable generic d20 production dispatch probe"}}},
      mechanics:[{
        kind:"common-play",
        config:{
          schemaVersion:"0.2-draft",
          id:identity.mechanicId,
          entryPoints:[{
            id:identity.entryPointId,
            invocation:"manual",
            test:{kind:"ability-check",roller:"actor",dc:{value:15}},
            operations:[],
          }],
        },
      }],
    }],
  });
}

async function installD20(adapter:MockAdapter,identity=D20_IDENTITY) {
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(d20PackagePayload(identity));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  return installedCommonPlayActionId({
    catalogId:catalogQualifiedId(identity.contentId,identity.moduleId,"1"),
    mechanicId:identity.mechanicId,
    entryPointId:identity.entryPointId,
  });
}

test("installed portable Common Play executes through the production resolveAction authority path without Action Surge identities", async () => {
  const store=new MemoryInstalledContentStore();
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,store);

  const preview=await adapter.previewContentImport(packagePayload());
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");

  let snapshot=await adapter.getSnapshot();
  const resourceBefore=snapshot.activeCharacter.resources.find((resource)=>resource.id===FIGHTER_SECOND_WIND_RESOURCE_ID)?.current;
  assert.ok(resourceBefore !== undefined && resourceBefore > 0);

  const actionId=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(CONTENT_ID,MODULE_ID,MODULE_VERSION),
    mechanicId:MECHANIC_ID,
    entryPointId:ENTRY_POINT_ID,
  });
  await adapter.resolveAction(actionId,["char.aelar"]);

  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.resolution?.actionId,actionId);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions?.length,1);
  assert.equal(snapshot.activeCharacter.resources.find((resource)=>resource.id===FIGHTER_SECOND_WIND_RESOURCE_ID)?.current,resourceBefore-1);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions,undefined);
  assert.equal(snapshot.activeCharacter.resources.find((resource)=>resource.id===FIGHTER_SECOND_WIND_RESOURCE_ID)?.current,resourceBefore);
});

test("installed Common Play d20 uses production authority and is invariant under content, definition, action, and display rename",async()=>{
  const execute=async(identity:D20Identity)=>{
    const adapter=new MockAdapter();
    const actionId=await installD20(adapter,identity);
    await adapter.startInitiative();
    await adapter.setCurrentActor("char.aelar");
    await adapter.setQueuedD20(17);
    await adapter.resolveAction(actionId,["char.aelar"]);
    const resolution=(await adapter.getSnapshot()).resolution;
    assert.equal(resolution?.stage,"complete");
    return {actionId,resolution};
  };

  const original=await execute(D20_IDENTITY);
  const renamed=await execute({
    moduleId:"homebrew.renamed-d20-probe",
    contentId:"option.previously-unseen.renamed-d20",
    mechanicId:"external.previously-unseen.renamed-d20-definition",
    entryPointId:"renamed-attempt",
    displayName:"Completely Renamed Roll",
  });
  assert.notEqual(original.actionId,renamed.actionId);
  const mechanics=(resolution:NonNullable<typeof original.resolution>)=>({
    rollKind:resolution.rollKind,
    authoritativeDice:resolution.authoritativeDice,
    rollTotal:resolution.rollTotal,
    calculatedOutcome:resolution.calculatedOutcome,
    finalOutcome:resolution.finalOutcome,
  });
  assert.deepEqual(mechanics(renamed.resolution!),mechanics(original.resolution!));
  assert.deepEqual(mechanics(original.resolution!),{
    rollKind:"check",
    authoritativeDice:[17],
    rollTotal:17,
    calculatedOutcome:"success",
    finalOutcome:"success",
  });
});

test("connected Common Play d20 preserves the Host-authoritative faces and outcome on the Client",async()=>{
  const sessionId="session.common-play-d20";
  const host=new MockAdapter();
  const actionId=await installD20(host);
  await host.startInitiative();
  await host.setCurrentActor("char.aelar");
  await host.setQueuedD20(18);
  const hostState=connectedStateFor(host);
  hostState.mode="host";
  hostState.sessionId=sessionId;
  hostState.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  const wires:string[]=[];
  const originalSend=tauriSessionTransport.send;
  tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
  try {
    await host.resolveAction(actionId,["char.aelar"]);
  } finally {
    tauriSessionTransport.send=originalSend;
  }
  const batch=wires.map((wire)=>JSON.parse(wire)).find((wire)=>wire.type==="event-batch") as {events:ConnectedSessionEvent[]}|undefined;
  assert.ok(batch);

  const client=new MockAdapter();
  await client.startInitiative();
  await client.setCurrentActor("char.aelar");
  const clientState=connectedStateFor(client);
  clientState.mode="client";
  clientState.sessionId=sessionId;
  clientState.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(client,batch.events)).status,"applied");
  const resolution=(await client.getSnapshot()).resolution;
  assert.equal(resolution?.actionId,actionId);
  assert.deepEqual(resolution?.authoritativeDice,[18]);
  assert.equal(resolution?.rollTotal,18);
  assert.equal(resolution?.finalOutcome,"success");
});
