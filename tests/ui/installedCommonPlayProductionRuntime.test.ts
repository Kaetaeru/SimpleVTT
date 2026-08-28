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

type HpIdentity=D20Identity;
type TargetingIdentity=D20Identity;

const D20_IDENTITY:D20Identity={
  moduleId:"homebrew.d20-production-probe",
  contentId:"option.external-d20-production-probe",
  mechanicId:"external.unknown.generic-d20-production-probe",
  entryPointId:"attempt",
  displayName:"External d20 Production Probe",
};

const HP_IDENTITY:HpIdentity={
  moduleId:"homebrew.hp-production-probe",
  contentId:"option.external-hp-production-probe",
  mechanicId:"external.unknown.generic-hp-production-probe",
  entryPointId:"harm",
  displayName:"External HP Production Probe",
};

const TARGETING_IDENTITY:TargetingIdentity={
  moduleId:"homebrew.targeting-production-probe",
  contentId:"option.external-targeting-production-probe",
  mechanicId:"external.unknown.generic-targeting-production-probe",
  entryPointId:"mend-other",
  displayName:"External Targeting Production Probe",
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

function hpPackagePayload(identity=HP_IDENTITY) {
  return JSON.stringify({
    schemaVersion:"0.1-draft",
    moduleId:identity.moduleId,
    moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
    defaultLocale:"en",
    source:{document:"External HP Production Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:identity.contentId,
      category:"option",
      presentation:{defaultLocale:"en",originalName:identity.displayName,locales:{en:{name:identity.displayName,description:"Portable generic HP production dispatch probe"}}},
      mechanics:[{
        kind:"common-play",
        config:{
          schemaVersion:"0.2-draft",
          id:identity.mechanicId,
          entryPoints:[
            {id:identity.entryPointId,invocation:"manual",operations:[{kind:"damage.apply",amount:"1d6+2",damageType:"force",target:"target"}]},
            {id:"mend",invocation:"manual",operations:[{kind:"healing.apply",amount:{value:5},target:"self"}]},
          ],
        },
      }],
    }],
  });
}

function targetingPackagePayload(identity=TARGETING_IDENTITY) {
  return JSON.stringify({
    schemaVersion:"0.1-draft",
    moduleId:identity.moduleId,
    moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
    defaultLocale:"en",
    source:{document:"External Targeting Production Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:identity.contentId,
      category:"option",
      presentation:{defaultLocale:"en",originalName:identity.displayName,locales:{en:{name:identity.displayName,description:"Portable single pre-resolved target production probe"}}},
      mechanics:[{
        kind:"common-play",
        config:{
          schemaVersion:"0.2-draft",
          id:identity.mechanicId,
          entryPoints:[{
            id:identity.entryPointId,
            invocation:"manual",
            targeting:{from:"targets",min:1,max:1},
            operations:[{kind:"healing.apply",amount:{value:5},target:"target"}],
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

async function installHp(adapter:MockAdapter,identity=HP_IDENTITY) {
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(hpPackagePayload(identity));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  const catalogId=catalogQualifiedId(identity.contentId,identity.moduleId,"1");
  return {
    damage:installedCommonPlayActionId({catalogId,mechanicId:identity.mechanicId,entryPointId:identity.entryPointId}),
    healing:installedCommonPlayActionId({catalogId,mechanicId:identity.mechanicId,entryPointId:"mend"}),
  };
}

async function installTargeting(adapter:MockAdapter,identity=TARGETING_IDENTITY) {
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(targetingPackagePayload(identity));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  return installedCommonPlayActionId({
    catalogId:catalogQualifiedId(identity.contentId,identity.moduleId,"1"),
    mechanicId:identity.mechanicId,
    entryPointId:identity.entryPointId,
  });
}

function injureActiveCharacter(adapter:MockAdapter,amount:number) {
  const internal=adapter as unknown as {activeCharacter:{id:string;hp:number;maxHp:number};scene:{entities:Array<{id:string;hp:number}>}};
  const hp=Math.max(0,internal.activeCharacter.maxHp-amount);
  internal.activeCharacter.hp=hp;
  internal.scene.entities.find((entity)=>entity.id===internal.activeCharacter.id)!.hp=hp;
}

function injureSceneEntity(adapter:MockAdapter,id:string,amount:number) {
  const internal=adapter as unknown as {scene:{entities:Array<{id:string;hp:number;maxHp:number}>}};
  const entity=internal.scene.entities.find((candidate)=>candidate.id===id)!;
  entity.hp=Math.max(0,entity.maxHp-amount);
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

test("installed Common Play damage and healing use production authority, validate one runtime target, and Undo",async()=>{
  const damageAdapter=new MockAdapter();
  const damageActions=await installHp(damageAdapter);
  await damageAdapter.startInitiative();
  await damageAdapter.setCurrentActor("char.aelar");
  const before=(await damageAdapter.getSnapshot()).scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp;

  await damageAdapter.resolveAction(damageActions.damage,["combatant.missing"]);
  assert.equal((await damageAdapter.getSnapshot()).scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp,before,"missing runtime combatant must be rejected");

  await damageAdapter.setQueuedD20(5);
  await damageAdapter.resolveAction(damageActions.damage,["combatant.goblin-a"]);
  let snapshot=await damageAdapter.getSnapshot();
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp,before-7);
  assert.equal(snapshot.resolution?.rollKind,"damage");
  assert.deepEqual(snapshot.resolution?.authoritativeDice,[5]);
  assert.equal(snapshot.resolution?.rollTotal,7);
  assert.equal(snapshot.resolution?.damageComponents[0]?.adjusted,7);
  assert.ok(snapshot.resolution?.stateChanges.some((change)=>/HP/.test(change)));
  await damageAdapter.undoLastResolution();
  assert.equal((await damageAdapter.getSnapshot()).scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp,before);

  const healingAdapter=new MockAdapter();
  const healingActions=await installHp(healingAdapter);
  injureActiveCharacter(healingAdapter,10);
  await healingAdapter.startInitiative();
  await healingAdapter.setCurrentActor("char.aelar");
  const healingBefore=(await healingAdapter.getSnapshot()).activeCharacter.hp;
  await healingAdapter.resolveAction(healingActions.healing,["char.aelar"]);
  snapshot=await healingAdapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.hp,healingBefore+5);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="char.aelar")?.hp,healingBefore+5);
  assert.equal(snapshot.resolution?.rollKind,"healing");
  assert.equal(snapshot.resolution?.rollTotal,5);
  await healingAdapter.undoLastResolution();
  snapshot=await healingAdapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.hp,healingBefore);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="char.aelar")?.hp,healingBefore);
});

test("installed Common Play HP is invariant under content, definition, action, and display rename",async()=>{
  const execute=async(identity:HpIdentity)=>{
    const adapter=new MockAdapter();
    const actions=await installHp(adapter,identity);
    await adapter.startInitiative();
    await adapter.setCurrentActor("char.aelar");
    await adapter.setQueuedD20(4);
    await adapter.resolveAction(actions.damage,["combatant.goblin-a"]);
    const resolution=(await adapter.getSnapshot()).resolution!;
    return {actionId:actions.damage,mechanics:{
      rollKind:resolution.rollKind,
      authoritativeDice:resolution.authoritativeDice,
      rollTotal:resolution.rollTotal,
      damage:resolution.damageComponents.map((component)=>({type:component.type,raw:component.raw,adjusted:component.adjusted})),
    }};
  };
  const original=await execute(HP_IDENTITY);
  const renamed=await execute({
    moduleId:"homebrew.renamed-hp-probe",
    contentId:"option.previously-unseen.renamed-hp",
    mechanicId:"external.previously-unseen.renamed-hp-definition",
    entryPointId:"renamed-harm",
    displayName:"Completely Renamed HP Action",
  });
  assert.notEqual(original.actionId,renamed.actionId);
  assert.deepEqual(renamed.mechanics,original.mechanics);
});

test("connected Common Play HP converges Host-authoritative damage and healing on the Client",async()=>{
  const sessionId="session.common-play-hp";
  const host=new MockAdapter();
  const hostActions=await installHp(host);
  injureActiveCharacter(host,10);
  await host.startInitiative();
  await host.setCurrentActor("char.aelar");
  const hostState=connectedStateFor(host);
  hostState.mode="host";
  hostState.sessionId=sessionId;
  hostState.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  const wires:string[]=[];
  const originalSend=tauriSessionTransport.send;
  tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
  try {
    await host.setQueuedD20(4);
    await host.resolveAction(hostActions.damage,["combatant.goblin-a"]);
    await host.resolveAction(hostActions.healing,["char.aelar"]);
  } finally {
    tauriSessionTransport.send=originalSend;
  }
  const batches=wires.map((wire)=>JSON.parse(wire)).filter((wire)=>wire.type==="event-batch") as Array<{events:ConnectedSessionEvent[]}>;
  assert.equal(batches.length,2,JSON.stringify(wires));
  const resolutionKinds=batches.flatMap((batch)=>batch.events.flatMap((event)=>event.payload.kind==="resolution"?event.payload.resolutionEvents.map((resolutionEvent)=>resolutionEvent.kind):[]));
  assert.deepEqual(resolutionKinds,["damage-roll","damage","healing"]);

  const client=new MockAdapter();
  await installHp(client);
  injureActiveCharacter(client,10);
  await client.startInitiative();
  await client.setCurrentActor("char.aelar");
  const clientState=connectedStateFor(client);
  clientState.mode="client";
  clientState.sessionId=sessionId;
  clientState.replica=new ClientSessionReplica(sessionId);
  for(const batch of batches) assert.equal((await applyConnectedClientEvents(client,batch.events)).status,"applied");
  const hostSnapshot=await host.getSnapshot();
  const clientSnapshot=await client.getSnapshot();
  assert.equal(clientSnapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.hp,hostSnapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.hp);
  assert.equal(clientSnapshot.activeCharacter.hp,hostSnapshot.activeCharacter.hp);
  assert.equal(clientSnapshot.resolution?.actionId,hostActions.damage,"connected damage presentation remains Host-authored while both HP event batches converge");
});

test("installed Common Play targeting validates one existing target before healing and supports Undo",async()=>{
  const adapter=new MockAdapter();
  const actionId=await installTargeting(adapter);
  injureSceneEntity(adapter,"combatant.goblin-a",10);
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const before=(await adapter.getSnapshot()).scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp;

  await adapter.resolveAction(actionId,[]);
  await adapter.resolveAction(actionId,["combatant.goblin-a","combatant.goblin-b"]);
  await adapter.resolveAction(actionId,["combatant.missing"]);
  assert.equal((await adapter.getSnapshot()).scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp,before,"invalid selection must not reach healing");

  await adapter.resolveAction(actionId,["combatant.goblin-a"]);
  let snapshot=await adapter.getSnapshot();
  assert.ok(snapshot.catalog.some((entry)=>entry.contentId===TARGETING_IDENTITY.contentId));
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp,before+5);
  assert.equal(snapshot.resolution?.actionId,actionId);
  assert.deepEqual(snapshot.resolution?.targetIds,["combatant.goblin-a"]);
  assert.ok(snapshot.resolution?.stateChanges.some((change)=>/HP/.test(change)));
  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp,before);

  const self=new MockAdapter();
  const selfActionId=await installTargeting(self);
  injureActiveCharacter(self,10);
  await self.startInitiative();
  await self.setCurrentActor("char.aelar");
  const selfBefore=(await self.getSnapshot()).activeCharacter.hp;
  await self.resolveAction(selfActionId,["char.aelar"]);
  assert.equal((await self.getSnapshot()).activeCharacter.hp,selfBefore+5);
});

test("installed Common Play targeting is invariant under external identity and display rename",async()=>{
  const execute=async(identity:TargetingIdentity)=>{
    const adapter=new MockAdapter();
    const actionId=await installTargeting(adapter,identity);
    injureSceneEntity(adapter,"combatant.goblin-a",10);
    await adapter.startInitiative();
    await adapter.setCurrentActor("char.aelar");
    const before=(await adapter.getSnapshot()).scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp;
    await adapter.resolveAction(actionId,["combatant.goblin-a"]);
    const snapshot=await adapter.getSnapshot();
    return {actionId,healed:snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp-before,targetIds:snapshot.resolution?.targetIds};
  };
  const original=await execute(TARGETING_IDENTITY);
  const renamed=await execute({
    moduleId:"homebrew.renamed-targeting-probe",
    contentId:"option.previously-unseen.renamed-targeting",
    mechanicId:"external.previously-unseen.renamed-targeting-definition",
    entryPointId:"renamed-mend-other",
    displayName:"Completely Renamed Targeting Action",
  });
  assert.notEqual(original.actionId,renamed.actionId);
  assert.deepEqual({healed:renamed.healed,targetIds:renamed.targetIds},{healed:original.healed,targetIds:original.targetIds});
});

test("connected Common Play targeting remains Host-authoritative and converges through existing events",async()=>{
  const sessionId="session.common-play-targeting";
  const host=new MockAdapter();
  const actionId=await installTargeting(host);
  injureSceneEntity(host,"combatant.goblin-a",10);
  await host.startInitiative();
  await host.setCurrentActor("char.aelar");
  const hostState=connectedStateFor(host);
  hostState.mode="host";
  hostState.sessionId=sessionId;
  hostState.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  const wires:string[]=[];
  const originalSend=tauriSessionTransport.send;
  tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
  try {
    await host.resolveAction(actionId,["combatant.goblin-a"]);
  } finally {
    tauriSessionTransport.send=originalSend;
  }
  const batch=wires.map((wire)=>JSON.parse(wire)).find((wire)=>wire.type==="event-batch") as {events:ConnectedSessionEvent[]}|undefined;
  assert.ok(batch);
  const kinds=batch.events.flatMap((event)=>event.payload.kind==="resolution"?event.payload.resolutionEvents.map((resolutionEvent)=>resolutionEvent.kind):[]);
  assert.deepEqual(kinds,["targeting","healing"]);

  const client=new MockAdapter();
  await installTargeting(client);
  injureSceneEntity(client,"combatant.goblin-a",10);
  await client.startInitiative();
  await client.setCurrentActor("char.aelar");
  const clientState=connectedStateFor(client);
  clientState.mode="client";
  clientState.sessionId=sessionId;
  clientState.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(client,batch.events)).status,"applied");
  const hostHp=(await host.getSnapshot()).scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp;
  const clientSnapshot=await client.getSnapshot();
  assert.equal(clientSnapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp,hostHp);
  assert.equal(clientSnapshot.resolution?.actionId,actionId);
  assert.deepEqual(clientSnapshot.resolution?.targetIds,["combatant.goblin-a"]);
});
