import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import "../../src/app/connectedTurnRoutingAdapter";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId, parseSpecialCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";
import { setTurnRuntimeInitiativeCount } from "../../src/app/turnRuntimeInitiativeCountService";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

function payload(prefix:string){
  const moduleId=`${prefix}.module`,actionContentId=`${prefix}.action-content`,actionMechanicId=`${prefix}.actions`;
  const definitionActionId=installedCommonPlayActionId({catalogId:catalogQualifiedId(actionContentId,moduleId,"1"),mechanicId:actionMechanicId,entryPointId:"tail"});
  const summonContentId=`${prefix}.summon-content`,summonMechanicId=`${prefix}.summon`;
  return {
    combatantId:`${prefix}.guardian`,
    summonActionId:installedCommonPlayActionId({catalogId:catalogQualifiedId(summonContentId,moduleId,"1"),mechanicId:summonMechanicId,entryPointId:"summon"}),
    json:JSON.stringify({schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",source:{document:"Family AC",version:"1",license:"CC0",srdDerived:false},dependencies:[],conflicts:[],capabilities:[],content:[
      {id:summonContentId,category:"option",presentation:{defaultLocale:"en",locales:{en:{name:"Unknown guardian"}}},mechanics:[{kind:"common-play",config:{schemaVersion:"0.2-draft",id:summonMechanicId,entryPoints:[{id:"summon",invocation:"manual",operations:[{kind:"artifact.spawn",template:"guardian"}]}],artifactTemplates:[{id:"guardian",artifactKind:"actor",duration:{kind:"durable"},lifetime:{kind:"durable"},initialState:{combatantId:`${prefix}.guardian`,statDefinitionId:`${prefix}.stat`,ownerId:"actor",controllerId:"actor",side:"ally",initiative:"independent",properties:{"presentation.name":"Unknown guardian","defense.ac":13,"hp.maximum":10,"movement.walk":30,"initiative":12},actionDefinitionIds:[definitionActionId],resources:[{id:`${prefix}.pool`,current:3,maximum:3,recovery:{turnStart:"all"}}]}}]}}]},
      {id:actionContentId,category:"option",presentation:{defaultLocale:"en",locales:{en:{name:"Unknown off-turn option"}}},mechanics:[{kind:"common-play",config:{schemaVersion:"0.2-draft",id:actionMechanicId,entryPoints:[{id:"tail",invocation:"manual",operations:[{kind:"healing.apply",amount:{value:1},target:"self"}]}],specialActions:[{id:`${prefix}.window`,timing:{kind:"after-turn",actor:"other"},poolResourceId:`${prefix}.pool`,options:[{id:`${prefix}.tail`,cost:2,entryPointId:"tail"}]},{id:`${prefix}.lair`,timing:{kind:"initiative-count",count:20},options:[{id:`${prefix}.pulse`,cost:0,entryPointId:"tail"}]}]}}]},
    ]}),
  };
}

async function run(prefix:string){
  const {adapter,pack}=await setup(prefix);
  await adapter.resolveAction(pack.summonActionId,["char.aelar"]);
  await adapter.endTurn();
  let snapshot=await adapter.getSnapshot();
  const action=snapshot.scene.actionsByActor[pack.combatantId]?.find((candidate)=>parseSpecialCommonPlayActionId(candidate.id));
  assert.ok(action?.available,JSON.stringify(snapshot.scene.actionsByActor[pack.combatantId]));
  snapshot=await adapter.resolveAction(action!.id,[pack.combatantId]);
  const runtime=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene);
  assert.equal(runtime?.combatants[pack.combatantId]?.resources.find((resource)=>resource.id===`${prefix}.pool`)?.current,1);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  snapshot=await adapter.endTurn();
  for(let index=0;index<snapshot.scene.entities.length+1&&snapshot.scene.currentActorId!==pack.combatantId;index++)snapshot=await adapter.endTurn();
  const refreshed=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.combatants[pack.combatantId]?.resources.find((resource)=>resource.id===`${prefix}.pool`)?.current;
  assert.equal(refreshed,3);
  return {spentPool:1,refreshedPool:refreshed};
}

async function setup(prefix:string){
  const adapter=new MockAdapter(),pack=payload(prefix);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const snapshot=await adapter.previewContentImport(pack.json);
  assert.ok(!snapshot.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(snapshot.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  return {adapter,pack};
}

async function captureBatch(adapter:MockAdapter,operation:()=>Promise<unknown>){
  const state=connectedStateFor(adapter);assert.ok(state.ledger);
  const cursor=state.ledger.cursor,send=tauriSessionTransport.send;tauriSessionTransport.send=async()=>1;
  try{await operation();}finally{tauriSessionTransport.send=send;}
  const events=state.ledger.eventsAfter(cursor);assert.ok(events.length);
  return {type:"event-batch" as const,events:events as ConnectedSessionEvent[]};
}

function pool(adapter:MockAdapter,snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>,prefix:string){
  return snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.combatants[`${prefix}.guardian`]?.resources.find((resource)=>resource.id===`${prefix}.pool`)?.current;
}

test("portable special timing projects and atomically spends an off-turn pool independent of identity",async()=>{
  assert.deepEqual(await run("external.legendary"),await run("fully-renamed.offturn"));
});

test("initiative-count special action uses the authoritative Resolver clock",async()=>{
  const prefix="external.initiative-special",{adapter,pack}=await setup(prefix);
  await adapter.resolveAction(pack.summonActionId,["char.aelar"]);
  const before=await adapter.getSnapshot(),state=snapshotAdapterTurnRuntimeState(adapter,before.scene);assert.ok(state);
  const session={state,initiativeOrder:before.scene.entities.map((entity)=>entity.id),activeIndex:0};
  const advanced=setTurnRuntimeInitiativeCount(session,20);assert.equal(advanced.status,"committed");
  assert.equal(commitAdapterTurnRuntimeState(adapter,before.scene,state.revision,session.state),true);
  const snapshot=await adapter.getSnapshot();
  const action=snapshot.scene.actionsByActor[pack.combatantId]?.find((candidate)=>parseSpecialCommonPlayActionId(candidate.id)?.specialActionId===`${prefix}.lair`);
  assert.ok(action?.available,JSON.stringify(snapshot.scene.actionsByActor[pack.combatantId]));
  assert.equal((await adapter.resolveAction(action!.id,[pack.combatantId])).resolution?.stage,"complete");
});

test("special timing converges through connected replay, reconnect, duplicate rejection, and Undo",async()=>{
  const prefix="external.connected-special",sessionId="session.family-ac";
  const {adapter:host,pack}=await setup(prefix),hostState=connectedStateFor(host);
  hostState.mode="host";hostState.sessionId=sessionId;hostState.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  await captureBatch(host,()=>host.resolveAction(pack.summonActionId,["char.aelar"]));
  await captureBatch(host,()=>host.endTurn());
  const special=(await host.getSnapshot()).scene.actionsByActor[pack.combatantId]?.find((action)=>parseSpecialCommonPlayActionId(action.id));
  assert.ok(special?.available);
  const spent=await captureBatch(host,()=>host.resolveAction(special!.id,[pack.combatantId]));

  const {adapter:client}=await setup(prefix),clientState=connectedStateFor(client);
  clientState.mode="client";clientState.sessionId=sessionId;clientState.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(client,hostState.ledger.eventsAfter(0))).status,"applied");
  assert.equal(pool(client,await client.getSnapshot(),prefix),1);
  assert.equal((await applyConnectedClientEvents(client,spent.events)).status,"duplicate");

  const {adapter:reconnect}=await setup(prefix),reconnectState=connectedStateFor(reconnect);
  reconnectState.mode="client";reconnectState.sessionId=sessionId;reconnectState.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(reconnect,hostState.ledger.eventsAfter(0))).status,"applied");
  assert.equal(pool(reconnect,await reconnect.getSnapshot(),prefix),1);

  const undone=await captureBatch(host,()=>host.undoLastResolution());
  assert.equal((await applyConnectedClientEvents(client,undone.events)).status,"applied");
  assert.equal(pool(host,await host.getSnapshot(),prefix),3);
  assert.equal(pool(client,await client.getSnapshot(),prefix),3);
});
