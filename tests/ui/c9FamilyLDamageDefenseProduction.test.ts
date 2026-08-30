import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";
import { turnRuntimeSessions } from "../../src/app/turnRuntimeSessionRegistry";
import type { DamageDefenseKind } from "../../src/domain/damage";

const TARGET_ID="combatant.goblin-a";
const CHARACTER_TARGET_ID="char.aelar";

function packagePayload(prefix:string,multiplier?:number,amount=4,target:"target"|"self"="target",reduction?:number) {
  const moduleId=`${prefix}.module`,contentId=`${prefix}.option`,mechanicId=`${prefix}.damage`;
  return {moduleId,contentId,mechanicId,json:JSON.stringify({
    schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Portable Damage Defense Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],content:[{
      id:contentId,category:"option",
      presentation:{defaultLocale:"en",originalName:"Portable Damage Probe",locales:{en:{name:"Portable Damage Probe"}}},
      mechanics:[{kind:"common-play",config:{schemaVersion:"0.2-draft",id:mechanicId,entryPoints:[{
        id:"apply",invocation:"manual",...(target==="target"?{targeting:{from:"targets",min:1,max:1}}:{}),
        operations:[{kind:"damage.apply",amount:{value:amount},damageType:"fire",...(multiplier===undefined?{}:{multiplier}),...(reduction===undefined?{}:{reduction:{value:reduction}}),target}],
      }]}}],
    }],
  })};
}

function criticalPackagePayload(prefix:string) {
  const moduleId=`${prefix}.module`,contentId=`${prefix}.option`,mechanicId=`${prefix}.damage`;
  return {moduleId,contentId,mechanicId,json:JSON.stringify({
    schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Portable Critical Damage Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],content:[{
      id:contentId,category:"option",
      presentation:{defaultLocale:"en",originalName:"Portable Critical Damage Probe",locales:{en:{name:"Portable Critical Damage Probe"}}},
      mechanics:[{kind:"common-play",config:{schemaVersion:"0.2-draft",id:mechanicId,entryPoints:[{
        id:"attack",invocation:"manual",targeting:{from:"targets",min:1,max:1},
        test:{kind:"attack-roll",roller:"actor",dc:{value:10}},
        operations:[{kind:"damage.apply",amount:"1d6+2",damageType:"fire",target:"target",when:{op:"eq",left:{ref:"test.outcome"},right:{value:"success"}}}],
      }]}}],
    }],
  })};
}

function hp(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>,actorId:string) {
  const value=snapshot.scene.entities.find((entity)=>entity.id===actorId)?.hp;
  assert.equal(typeof value,"number");
  return value as number;
}

async function execute(prefix:string,kind?:DamageDefenseKind,multiplier?:number,reduction?:number) {
  const adapter=new MockAdapter();
  const pack=packagePayload(prefix,multiplier,4,"target",reduction);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");

  const runtime=turnRuntimeSessions.get(adapter);
  assert.ok(runtime,"turn runtime must exist after initiative starts");
  runtime.state.combatants[TARGET_ID].damageDefenses=kind?[{source:`${prefix}.runtime-defense`,kind,damageType:"fire"}]:[];

  const action=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),
    mechanicId:pack.mechanicId,
    entryPointId:"apply",
  });
  let snapshot=await adapter.getSnapshot();
  const before=hp(snapshot,TARGET_ID);
  snapshot=await adapter.resolveAction(action,[TARGET_ID]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  const after=hp(snapshot,TARGET_ID);
  await adapter.undoLastResolution();
  assert.equal(hp(await adapter.getSnapshot(),TARGET_ID),before,"Undo must restore HP");
  return before-after;
}

async function executeCritical(prefix:string) {
  const adapter=new MockAdapter();
  const pack=criticalPackagePayload(prefix);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");

  const action=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),
    mechanicId:pack.mechanicId,
    entryPointId:"attack",
  });
  const before=hp(await adapter.getSnapshot(),TARGET_ID);
  (adapter as unknown as {queuedD20:number|null}).queuedD20=20;
  const snapshot=await adapter.resolveAction(action,[TARGET_ID]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  const component=snapshot.resolution?.damageComponents[0];
  assert.equal(component?.raw,14,"critical must roll 2d6 but add the +2 flat contribution only once");
  assert.equal(component?.adjusted,14);
  await adapter.undoLastResolution();
  assert.equal(hp(await adapter.getSnapshot(),TARGET_ID),before,"Undo must restore HP after portable critical damage");
  return component?.raw;
}

async function executeInstantDeath(prefix:string) {
  const adapter=new MockAdapter();
  const pack=packagePayload(prefix,undefined,100,"self");
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor(CHARACTER_TARGET_ID);

  const runtime=turnRuntimeSessions.get(adapter);
  assert.ok(runtime,"turn runtime must exist after initiative starts");
  const before=structuredClone(runtime.state.combatants[CHARACTER_TARGET_ID].life);
  assert.equal(before.hp.current,31);
  assert.equal(before.hp.maximum,42);
  assert.equal(before.hp.temporary,5);

  const action=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),
    mechanicId:pack.mechanicId,
    entryPointId:"apply",
  });
  const snapshot=await adapter.resolveAction(action,[CHARACTER_TARGET_ID]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));

  const after=turnRuntimeSessions.get(adapter)!.state.combatants[CHARACTER_TARGET_ID].life;
  assert.equal(after.hp.current,0);
  assert.equal(after.dead,true,"64 overflow damage must meet the 42 max-HP instant-death threshold");
  assert.equal(after.unconscious,false,"instant death must not leave the character merely unconscious");

  await adapter.undoLastResolution();
  assert.deepEqual(turnRuntimeSessions.get(adapter)!.state.combatants[CHARACTER_TARGET_ID].life,before,"Undo must restore the complete pre-damage life state");
  return {current:after.hp.current,dead:after.dead,unconscious:after.unconscious};
}

async function prepareConnectedDamageAdapter(adapter:MockAdapter,pack:ReturnType<typeof packagePayload>) {
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor(CHARACTER_TARGET_ID);
}

async function executeConnectedDefense(prefix:string,kind:"resistance"|"vulnerability") {
  const sessionId=`session.${prefix}`;
  const pack=packagePayload(prefix);
  const host=new MockAdapter();
  await prepareConnectedDamageAdapter(host,pack);
  const hostRuntime=turnRuntimeSessions.get(host);
  assert.ok(hostRuntime,"host turn runtime must exist after initiative starts");
  hostRuntime.state.combatants[TARGET_ID].damageDefenses=[{source:`${prefix}.runtime-defense`,kind,damageType:"fire"}];
  const before=hp(await host.getSnapshot(),TARGET_ID);
  const expectedDamage=kind==="resistance"?2:8;

  const action=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),
    mechanicId:pack.mechanicId,
    entryPointId:"apply",
  });
  const hostState=connectedStateFor(host);
  hostState.mode="host";
  hostState.sessionId=sessionId;
  hostState.ledger=new HostSessionLedger(sessionId,connectedManifest(host));

  const originalSend=tauriSessionTransport.send;
  const runHost=async(operation:()=>Promise<unknown>)=>{
    const wires:string[]=[];
    tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
    try { await operation(); } finally { tauriSessionTransport.send=originalSend; }
    const batch=wires.map((wire)=>JSON.parse(wire)).find((wire)=>wire.type==="event-batch") as {events:ConnectedSessionEvent[]}|undefined;
    assert.ok(batch,JSON.stringify(wires));
    return batch!;
  };

  const client=new MockAdapter();
  await prepareConnectedDamageAdapter(client,pack);
  const clientState=connectedStateFor(client);
  clientState.mode="client";
  clientState.sessionId=sessionId;
  clientState.replica=new ClientSessionReplica(sessionId);

  const damageBatch=await runHost(()=>host.resolveAction(action,[TARGET_ID]));
  assert.equal((await host.getSnapshot()).resolution?.stage,"complete");
  assert.equal((await applyConnectedClientEvents(client,damageBatch.events)).status,"applied");
  assert.equal(before-hp(await host.getSnapshot(),TARGET_ID),expectedDamage);
  assert.equal(before-hp(await client.getSnapshot(),TARGET_ID),expectedDamage);

  const reconnect=new MockAdapter();
  await prepareConnectedDamageAdapter(reconnect,pack);
  const reconnectState=connectedStateFor(reconnect);
  reconnectState.mode="client";
  reconnectState.sessionId=sessionId;
  reconnectState.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(reconnect,hostState.ledger!.eventsAfter(0))).status,"applied");
  assert.equal(before-hp(await reconnect.getSnapshot(),TARGET_ID),expectedDamage);

  const undoBatch=await runHost(()=>host.undoLastResolution());
  assert.equal((await applyConnectedClientEvents(client,undoBatch.events)).status,"applied");
  assert.equal((await applyConnectedClientEvents(reconnect,undoBatch.events)).status,"applied");
  assert.equal(hp(await host.getSnapshot(),TARGET_ID),before);
  assert.equal(hp(await client.getSnapshot(),TARGET_ID),before);
  assert.equal(hp(await reconnect.getSnapshot(),TARGET_ID),before);
  return expectedDamage;
}

test("unknown installed damage.apply honors generic target damage defenses with rename invariance and Undo",async()=>{
  const expected:Record<DamageDefenseKind,number>={resistance:2,vulnerability:8,immunity:0};
  for(const kind of ["resistance","vulnerability","immunity"] as const) {
    assert.equal(await execute(`external.family-l-${kind}`,kind),expected[kind]);
    assert.equal(await execute(`completely.renamed-family-l-${kind}`,kind),expected[kind]);
  }
});

test("unknown installed resistance and vulnerability converge through Host replay, reconnect, and Undo",async()=>{
  assert.equal(await executeConnectedDefense("external.family-l-connected-resistance","resistance"),2);
  assert.equal(await executeConnectedDefense("external.family-l-connected-vulnerability","vulnerability"),8);
});

test("unknown installed damage.apply honors schema-declared multiplier with profile rounding, rename invariance, and Undo",async()=>{
  assert.equal(await execute("external.family-l-multiplier",undefined,0.6),2);
  assert.equal(await execute("completely.renamed-family-l-multiplier",undefined,0.6),2);
});

test("unknown installed damage.apply applies structural reduction with rename invariance and Undo",async()=>{
  assert.equal(await execute("external.family-l-reduction",undefined,undefined,3),1);
  assert.equal(await execute("completely.renamed-family-l-reduction",undefined,undefined,3),1);
});

test("unknown installed attack-roll doubles damage dice but not flat damage on critical with rename invariance and Undo",async()=>{
  assert.equal(await executeCritical("external.family-l-critical-dice"),14);
  assert.equal(await executeCritical("completely.renamed-family-l-critical-dice"),14);
});

test("unknown installed damage.apply enforces character instant-death overkill with rename invariance and Undo",async()=>{
  assert.deepEqual(
    await executeInstantDeath("external.family-l-instant-death"),
    await executeInstantDeath("completely.renamed-family-l-instant-death"),
  );
});

function mitigationPackage(prefix:string,property:"damage.reduction"|"damage.threshold",value:number) {
  const moduleId=`${prefix}.module`,contentId=`${prefix}.option`,mechanicId=`${prefix}.damage`;
  return {moduleId,contentId,mechanicId,json:JSON.stringify({
    schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Portable Damage Mitigation Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],content:[{
      id:contentId,category:"option",
      presentation:{defaultLocale:"en",originalName:"Portable Mitigation",locales:{en:{name:"Portable Mitigation"}}},
      mechanics:[{kind:"common-play",config:{schemaVersion:"0.2-draft",id:mechanicId,entryPoints:[
        {id:"mitigate",invocation:"manual",targeting:{from:"targets",min:1,max:1},operations:[{
          kind:"property.modify",property,operation:"add",value:{value},target:"target",owner:"effect",source:"definition",
          duration:{kind:"elapsed",amount:{value:1},unit:"hours"},lifetime:{kind:"until-duration",onEnd:"destroy"},instancePolicy:"stack",
        }]},
        {id:"hit",invocation:"manual",targeting:{from:"targets",min:1,max:1},operations:[{kind:"damage.apply",amount:{value:4},damageType:"fire",target:"target"}]},
      ]}}],
    }],
  })};
}

async function executePortableMitigation(prefix:string,property:"damage.reduction"|"damage.threshold",value:number) {
  const adapter=new MockAdapter();
  const pack=mitigationPackage(prefix,property,value);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const action=(entryPointId:string)=>installedCommonPlayActionId({
    catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId,
  });
  let snapshot=await adapter.resolveAction(action("mitigate"),[TARGET_ID]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  const before=hp(snapshot,TARGET_ID);
  snapshot=await adapter.resolveAction(action("hit"),[TARGET_ID]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  const dealt=before-hp(snapshot,TARGET_ID);
  await adapter.undoLastResolution();
  assert.equal(hp(await adapter.getSnapshot(),TARGET_ID),before,"event-native Undo must restore mitigated damage");
  return dealt;
}

test("unknown installed damage.apply consumes portable structural damage reduction and threshold with rename invariance and Undo",async()=>{
  assert.equal(await executePortableMitigation("external.family-l-reduction","damage.reduction",3),1);
  assert.equal(await executePortableMitigation("completely.renamed-family-l-reduction","damage.reduction",3),1);
  assert.equal(await executePortableMitigation("external.family-l-threshold","damage.threshold",5),0);
  assert.equal(await executePortableMitigation("completely.renamed-family-l-threshold","damage.threshold",5),0);
  assert.equal(await executePortableMitigation("external.family-l-threshold-equal","damage.threshold",4),4,"meeting the threshold must preserve full damage");
});
