import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import {applyConnectedClientEvents,connectedManifest} from "../../src/app/connectedSessionRuntimeAdapter";
import {connectedStateFor} from "../../src/app/connectedSessionState";
import {ClientSessionReplica,HostSessionLedger,type ConnectedSessionEvent} from "../../src/app/connectedSessionProtocol";
import {catalogQualifiedId} from "../../src/app/contentCatalogIdentity";
import {installedCommonPlayActionId} from "../../src/app/installedCommonPlayActionReference";
import {setInstalledContentStoreForTests} from "../../src/app/installedContentRuntimeAdapter";
import {MemoryInstalledContentStore} from "../../src/app/memoryInstalledContentStore";
import {MockAdapter} from "../../src/app/mockAdapter";
import {snapshotAdapterTurnRuntimeState,setTurnRuntimeStateStoreForTests,MemoryTurnRuntimeStateStore,turnRuntimeSessions} from "../../src/app/turnRuntimeSessionRegistry";
import {tauriSessionTransport} from "../../src/app/tauriSessionTransport";

function pack(prefix:string){
  const moduleId=`${prefix}.module`,contentId=`${prefix}.content`,mechanicId=`${prefix}.mechanic`,catalogId=catalogQualifiedId(contentId,moduleId,"1");
  const action=(entryPointId:string)=>installedCommonPlayActionId({catalogId,mechanicId,entryPointId});
  const destination={id:"destination",fact:"spatial.legal-destination",subject:"actor",authority:"actor-owner",visibility:"public",unknownPolicy:"request-authority"};
  return {create:action("create"),walk:action("walk"),swim:action("swim"),melee:action("melee"),ranged:action("ranged-long"),fire:action("fire"),json:JSON.stringify({schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",source:{document:"Family AF",version:"1",license:"CC0",srdDerived:false},capabilities:[],content:[{id:contentId,category:"option",presentation:{defaultLocale:"en",locales:{en:{name:"Unknown environment"}}},mechanics:[{kind:"common-play",config:{schemaVersion:"0.2-draft",id:mechanicId,entryPoints:[
    {id:"create",invocation:"manual",operations:[{kind:"artifact.spawn",template:"environment"}]},
    {id:"walk",invocation:"manual",operations:[{kind:"movement.relocate",mode:"move",movementType:"walk",target:"self",distance:{value:10},destinationFact:destination}]},
    {id:"swim",invocation:"manual",operations:[{kind:"movement.relocate",mode:"move",movementType:"swim",target:"self",distance:{value:10},destinationFact:destination}]},
    {id:"melee",invocation:"manual",targeting:{from:"targets",min:1,max:1},test:{kind:"attack-roll",roller:"actor",dc:{value:1}},attack:{kind:"melee-weapon",properties:[],rangeBand:"normal"},operations:[{kind:"damage.apply",amount:{value:1},damageType:"piercing",target:"target",when:{op:"eq",left:{ref:"test.outcome"},right:{value:"success"}}}]},
    {id:"ranged-long",invocation:"manual",targeting:{from:"targets",min:1,max:1},test:{kind:"attack-roll",roller:"actor",dc:{value:1}},attack:{kind:"ranged-weapon",properties:[],rangeBand:"long"},operations:[{kind:"damage.apply",amount:{value:1},damageType:"piercing",target:"target",when:{op:"eq",left:{ref:"test.outcome"},right:{value:"success"}}}]},
    {id:"fire",invocation:"manual",operations:[{kind:"damage.apply",amount:{value:10},damageType:"fire",target:"self"}]},
  ],artifactTemplates:[{id:"environment",artifactKind:"environment",duration:{kind:"durable"},lifetime:{kind:"durable"},initialState:{id:`${prefix}.opaque-environment`,movementCostMultiplier:2,bypassMovementMultiplierWithModes:["swim"],attackRules:[{attackKind:"melee-weapon",adaptedProperty:"underwater-adapted",otherwise:"disadvantage"},{attackKind:"ranged-weapon",normalRangeOnly:true,otherwise:"automatic-miss"}],damageDefenses:[{damageType:"fire",kind:"resistance"}]}}]}}]}]})};
}

async function setup(prefix:string,store?:MemoryTurnRuntimeStateStore){const adapter=new MockAdapter(),definition=pack(prefix);if(store)setTurnRuntimeStateStoreForTests(adapter,store);setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());const preview=await adapter.previewContentImport(definition.json);assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));await adapter.activateContentImport();await adapter.startInitiative();await adapter.setCurrentActor("char.aelar");return {adapter,definition};}
async function capture(adapter:MockAdapter,operation:()=>Promise<unknown>){const state=connectedStateFor(adapter);assert.ok(state.ledger);const cursor=state.ledger.cursor,send=tauriSessionTransport.send;tauriSessionTransport.send=async()=>1;try{await operation();}finally{tauriSessionTransport.send=send;}return state.ledger.eventsAfter(cursor) as ConnectedSessionEvent[];}
function environmentId(adapter:MockAdapter,snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>){return snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.artifacts?.find((artifact)=>artifact.artifactKind==="environment")?.environment?.id;}

async function run(prefix:string){const {adapter,definition}=await setup(prefix);await adapter.resolveAction(definition.create,["char.aelar"]);assert.equal(environmentId(adapter,await adapter.getSnapshot()),`${prefix}.opaque-environment`);
  await adapter.resolveAction(definition.walk,["char.aelar"]);assert.equal(snapshotAdapterTurnRuntimeState(adapter,(await adapter.getSnapshot()).scene)?.combatants["char.aelar"].economy.movement,10);await adapter.undoLastResolution();
  turnRuntimeSessions.get(adapter)!.state.combatants["char.aelar"].baseProperties!["movement.swim"]=30;await adapter.resolveAction(definition.swim,["char.aelar"]);assert.equal(snapshotAdapterTurnRuntimeState(adapter,(await adapter.getSnapshot()).scene)?.combatants["char.aelar"].economy.movement,20);await adapter.undoLastResolution();
  await adapter.setQueuedD20(20);let snapshot=await adapter.resolveAction(definition.melee,["combatant.goblin-a"]);assert.ok(snapshot.resolution?.detail.some((detail)=>detail.includes("disadvantage")),JSON.stringify(snapshot.resolution));
  const targetBefore=snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-b")!.hp;await adapter.setQueuedD20(20);snapshot=await adapter.resolveAction(definition.ranged,["combatant.goblin-b"]);assert.ok(snapshot.resolution?.detail.some((detail)=>detail.includes("failure")),JSON.stringify(snapshot.resolution));assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-b")!.hp,targetBefore);
  const actorBefore=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!.combatants["char.aelar"].life.hp;await adapter.resolveAction(definition.fire,["char.aelar"]);const actorAfter=snapshotAdapterTurnRuntimeState(adapter,(await adapter.getSnapshot()).scene)!.combatants["char.aelar"].life.hp;assert.equal(actorAfter.current+actorAfter.temporary,actorBefore.current+actorBefore.temporary-5);
}

test("portable underwater movement, attacks, and Fire resistance apply independent of external identity",async()=>{await run("external.underwater");await run("renamed.ocean");});

test("environment activation survives connected replay, duplicate delivery, reconnect, and Undo",async()=>{const prefix="external.connected-environment",sessionId="session.family-af",{adapter:host,definition}=await setup(prefix),hostState=connectedStateFor(host);hostState.mode="host";hostState.sessionId=sessionId;hostState.ledger=new HostSessionLedger(sessionId,connectedManifest(host));const batch=await capture(host,()=>host.resolveAction(definition.create,["char.aelar"]));const {adapter:client}=await setup(prefix),clientState=connectedStateFor(client);clientState.mode="client";clientState.sessionId=sessionId;clientState.replica=new ClientSessionReplica(sessionId);assert.equal((await applyConnectedClientEvents(client,batch)).status,"applied");assert.equal(environmentId(client,await client.getSnapshot()),environmentId(host,await host.getSnapshot()));assert.equal((await applyConnectedClientEvents(client,batch)).status,"duplicate");const {adapter:reconnect}=await setup(prefix),reconnectState=connectedStateFor(reconnect);reconnectState.mode="client";reconnectState.sessionId=sessionId;reconnectState.replica=new ClientSessionReplica(sessionId);assert.equal((await applyConnectedClientEvents(reconnect,hostState.ledger.eventsAfter(0))).status,"applied");assert.equal(environmentId(reconnect,await reconnect.getSnapshot()),environmentId(host,await host.getSnapshot()));const undone=await capture(host,()=>host.undoLastResolution());assert.equal((await applyConnectedClientEvents(client,undone)).status,"applied");assert.equal(environmentId(client,await client.getSnapshot()),undefined);});

test("environment activation persists across local runtime restart",async()=>{const store=new MemoryTurnRuntimeStateStore(),prefix="external.persisted-environment",{adapter,definition}=await setup(prefix,store);await adapter.resolveAction(definition.create,["char.aelar"]);const {adapter:restored}=await setup(prefix,store);assert.equal(environmentId(restored,await restored.getSnapshot()),`${prefix}.opaque-environment`);});
