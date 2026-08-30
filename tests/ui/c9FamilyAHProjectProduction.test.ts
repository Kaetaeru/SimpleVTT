import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import {catalogQualifiedId} from "../../src/app/contentCatalogIdentity";
import {applyConnectedClientEvents,connectedManifest} from "../../src/app/connectedSessionRuntimeAdapter";
import {ClientSessionReplica,HostSessionLedger,type ConnectedSessionEvent} from "../../src/app/connectedSessionProtocol";
import {connectedStateFor} from "../../src/app/connectedSessionState";
import {mutateActiveCharacterDurably,setCharacterLibraryStoreForTests} from "../../src/app/characterLibraryRuntimeAdapter";
import {installedCommonPlayActionId} from "../../src/app/installedCommonPlayActionReference";
import {setInstalledContentStoreForTests} from "../../src/app/installedContentRuntimeAdapter";
import {MemoryCharacterLibraryStore} from "../../src/app/memoryCharacterLibraryStore";
import {MemoryInstalledContentStore} from "../../src/app/memoryInstalledContentStore";
import {MockAdapter} from "../../src/app/mockAdapter";
import {MemoryTurnRuntimeStateStore,setTurnRuntimeStateStoreForTests,snapshotAdapterTurnRuntimeState} from "../../src/app/turnRuntimeSessionRegistry";
import {tauriSessionTransport} from "../../src/app/tauriSessionTransport";

function pack(prefix:string){
  const moduleId=`${prefix}.module`,contentId=`${prefix}.content`,mechanicId=`${prefix}.mechanic`,catalogId=catalogQualifiedId(contentId,moduleId,"1");
  const action=(entryPointId:string)=>installedCommonPlayActionId({catalogId,mechanicId,entryPointId});
  const outputId=`crafted.${prefix}`,materialId=`${prefix}.materials`;
  return {create:action("create"),work:action("work"),cancel:action("cancel"),outputId,materialId,json:JSON.stringify({schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",source:{document:"Family AH",version:"1",license:"CC0",srdDerived:false},capabilities:[],content:[{id:contentId,category:"option",presentation:{defaultLocale:"en",locales:{en:{name:"Unknown project"}}},mechanics:[{kind:"common-play",config:{schemaVersion:"0.2-draft",id:mechanicId,entryPoints:[
    {id:"create",invocation:"manual",operations:[{kind:"artifact.spawn",template:"craft"}]},
    {id:"work",invocation:"manual",operations:[{kind:"resource.change",resource:materialId,amount:{value:-1},target:"actor"},{kind:"project.advance",artifact:"craft",work:{value:1},payments:{[materialId]:{value:1}},onComplete:{operations:[{kind:"item.grant",target:"actor",item:{id:outputId,definitionId:`${prefix}.scroll`,name:"Unknown Crafted Scroll",kind:"consumable",quantity:1,equipped:false,passiveEffects:[],grantedActionIds:[],spellDefinitionIds:[`${prefix}.spell`],provenance:[mechanicId]}}]}}]},
    {id:"cancel",invocation:"manual",operations:[{kind:"project.cancel",artifact:"craft"}]},
  ],artifactTemplates:[{id:"craft",artifactKind:"project",duration:{kind:"durable"},lifetime:{kind:"durable"},initialState:{revision:0,requiredWork:2,completedWork:0,status:"active",payments:{},requirements:{toolProficiencyIds:[`${prefix}.tool`],preparedSpellDefinitionIds:[`${prefix}.spell`]}}}]}}]}]})};
}

async function setup(prefix:string){
  const adapter=new MockAdapter(),characterStore=new MemoryCharacterLibraryStore(),runtimeStore=new MemoryTurnRuntimeStateStore(),installedStore=new MemoryInstalledContentStore(),definition=pack(prefix);
  setCharacterLibraryStoreForTests(adapter,characterStore);setTurnRuntimeStateStoreForTests(adapter,runtimeStore);setInstalledContentStoreForTests(adapter,installedStore);
  await mutateActiveCharacterDurably(adapter,(character)=>{character.toolProficiencies=[...(character.toolProficiencies??[]),`${prefix}.tool`];character.preparedSpells=[...(character.preparedSpells??[]),`${prefix}.spell`];character.resources.push({id:definition.materialId,label:"Materials",current:2,max:2});});
  const preview=await adapter.previewContentImport(definition.json);assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));await adapter.activateContentImport();await adapter.startInitiative();await adapter.setCurrentActor("char.aelar");
  return {adapter,characterStore,runtimeStore,definition};
}

function project(adapter:MockAdapter,snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>){return snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.artifacts?.find((artifact)=>artifact.artifactKind==="project")?.project;}
function material(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>,id:string){return snapshot.activeCharacter.resources.find((resource)=>resource.id===id)?.current;}
async function shape(adapter:MockAdapter,definition:ReturnType<typeof pack>){const snapshot=await adapter.getSnapshot(),active=project(adapter,snapshot);return {work:active?.completedWork,status:active?.status,material:material(snapshot,definition.materialId),output:snapshot.activeCharacter.items.some((item)=>item.id===definition.outputId)};}
async function capture(adapter:MockAdapter,operation:()=>Promise<unknown>){const state=connectedStateFor(adapter);assert.ok(state.ledger);const cursor=state.ledger.cursor,send=tauriSessionTransport.send;tauriSessionTransport.send=async()=>1;try{await operation();}finally{tauriSessionTransport.send=send;}return state.ledger.eventsAfter(cursor) as ConnectedSessionEvent[];}
function connectClient(adapter:MockAdapter,sessionId:string){const state=connectedStateFor(adapter);state.mode="client";state.sessionId=sessionId;state.replica=new ClientSessionReplica(sessionId);}

async function exercise(prefix:string){
  const {adapter,characterStore,runtimeStore,definition}=await setup(prefix);let snapshot=await adapter.resolveAction(definition.create,["char.aelar"]);assert.equal(project(adapter,snapshot)?.completedWork,0);
  snapshot=await adapter.resolveAction(definition.work,["char.aelar"]);assert.equal(project(adapter,snapshot)?.completedWork,1);assert.equal(material(snapshot,definition.materialId),1);assert.equal(snapshot.activeCharacter.items.some((item)=>item.id===definition.outputId),false);
  snapshot=await adapter.resolveAction(definition.work,["char.aelar"]);assert.equal(project(adapter,snapshot)?.status,"completed");assert.equal(material(snapshot,definition.materialId),0);assert.equal(snapshot.activeCharacter.items.find((item)=>item.id===definition.outputId)?.spellDefinitionIds?.[0],`${prefix}.spell`);
  const restarted=new MockAdapter();setCharacterLibraryStoreForTests(restarted,characterStore);setTurnRuntimeStateStoreForTests(restarted,runtimeStore);await restarted.startInitiative();await restarted.setCurrentActor("char.aelar");const restored=await restarted.getSnapshot();assert.equal(project(restarted,restored)?.status,"completed");assert.equal(restored.activeCharacter.items.some((item)=>item.id===definition.outputId),true);
  snapshot=await adapter.undoLastResolution();assert.equal(project(adapter,snapshot)?.completedWork,1);assert.equal(material(snapshot,definition.materialId),1);assert.equal(snapshot.activeCharacter.items.some((item)=>item.id===definition.outputId),false);
  return {work:project(adapter,snapshot)?.completedWork,material:material(snapshot,definition.materialId),output:snapshot.activeCharacter.items.some((item)=>item.id===definition.outputId)};
}

test("portable crafting project persists progress, pays materials, grants output, and Undo restores atomically under renamed identities",async()=>{
  assert.deepEqual(await exercise("external.family-ah"),{work:1,material:1,output:false});
  assert.deepEqual(await exercise("renamed.family-ah"),{work:1,material:1,output:false});
});

test("project cancellation is durable and rejects later work",async()=>{
  const {adapter,definition}=await setup("external.cancelled-project");await adapter.resolveAction(definition.create,["char.aelar"]);let snapshot=await adapter.resolveAction(definition.cancel,["char.aelar"]);assert.equal(project(adapter,snapshot)?.status,"cancelled");const before=material(snapshot,definition.materialId);snapshot=await adapter.resolveAction(definition.work,["char.aelar"]);assert.equal(material(snapshot,definition.materialId),before);assert.equal(project(adapter,snapshot)?.status,"cancelled");
});

test("project progress, payment, output, retry, reconnect, and Undo converge through connected events",async()=>{
  const prefix="external.connected-family-ah",sessionId="session.family-ah",{adapter:host,definition}=await setup(prefix),hostState=connectedStateFor(host);hostState.mode="host";hostState.sessionId=sessionId;hostState.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  const created=await capture(host,()=>host.resolveAction(definition.create,["char.aelar"])),first=await capture(host,()=>host.resolveAction(definition.work,["char.aelar"])),completed=await capture(host,()=>host.resolveAction(definition.work,["char.aelar"]));
  const {adapter:client}=await setup(prefix);connectClient(client,sessionId);assert.equal((await applyConnectedClientEvents(client,[...created,...first,...completed])).status,"applied");assert.deepEqual(await shape(client,definition),await shape(host,definition));assert.equal((await applyConnectedClientEvents(client,completed)).status,"duplicate");
  const {adapter:reconnect}=await setup(prefix);connectClient(reconnect,sessionId);assert.equal((await applyConnectedClientEvents(reconnect,hostState.ledger.eventsAfter(0))).status,"applied");assert.deepEqual(await shape(reconnect,definition),await shape(host,definition));
  const undone=await capture(host,()=>host.undoLastResolution()),appliedUndo=await applyConnectedClientEvents(client,undone);assert.equal(appliedUndo.status,"applied",JSON.stringify(appliedUndo));assert.deepEqual(await shape(client,definition),{work:1,status:"active",material:1,output:false});
});
