import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import {mutateActiveCharacterDurably,setCharacterLibraryStoreForTests} from "../../src/app/characterLibraryRuntimeAdapter";
import {catalogQualifiedId} from "../../src/app/contentCatalogIdentity";
import {applyConnectedClientEvents,connectedManifest} from "../../src/app/connectedSessionRuntimeAdapter";
import {ClientSessionReplica,HostSessionLedger,type ConnectedSessionEvent} from "../../src/app/connectedSessionProtocol";
import {connectedStateFor} from "../../src/app/connectedSessionState";
import {installedCommonPlayActionId} from "../../src/app/installedCommonPlayActionReference";
import {setInstalledContentStoreForTests} from "../../src/app/installedContentRuntimeAdapter";
import {MemoryCharacterLibraryStore} from "../../src/app/memoryCharacterLibraryStore";
import {MemoryInstalledContentStore} from "../../src/app/memoryInstalledContentStore";
import {MockAdapter} from "../../src/app/mockAdapter";
import {tauriSessionTransport} from "../../src/app/tauriSessionTransport";

function pack(prefix:string){
  const moduleId=`${prefix}.module`,contentId=`${prefix}.content`,mechanicId=`${prefix}.mechanic`,catalogId=catalogQualifiedId(contentId,moduleId,"1"),id=(suffix:string)=>`${prefix}.${suffix}`;
  const action=(entryPointId:string)=>installedCommonPlayActionId({catalogId,mechanicId,entryPointId}),item=(suffix:string,weightPounds:number,extra:Record<string,unknown>={})=>({id:id(suffix),definitionId:id(`definition.${suffix}`),name:`Unknown ${suffix}`,kind:"equipment",quantity:1,equipped:false,weightPounds,...extra,passiveEffects:[],grantedActionIds:[],provenance:[mechanicId]});
  return {bag:action("bag"),stone:action("stone"),heavy:action("heavy"),bagId:id("bag"),stoneId:id("stone"),heavyId:id("heavy"),json:JSON.stringify({schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",source:{document:"Family AI",version:"1",license:"CC0",srdDerived:false},capabilities:[],content:[{id:contentId,category:"option",presentation:{defaultLocale:"en",locales:{en:{name:"Unknown cargo"}}},mechanics:[{kind:"common-play",config:{schemaVersion:"0.2-draft",id:mechanicId,entryPoints:[
    {id:"bag",invocation:"manual",operations:[{kind:"item.grant",target:"actor",item:item("bag",2,{containerCapacityPounds:10})}]},
    {id:"stone",invocation:"manual",operations:[{kind:"item.grant",target:"actor",item:item("stone",8,{containerId:id("bag")})}]},
    {id:"heavy",invocation:"manual",operations:[{kind:"item.grant",target:"actor",item:item("heavy",300)}]},
  ]}}]}]})};
}

async function setup(prefix:string,characterStore=new MemoryCharacterLibraryStore(),installedStore=new MemoryInstalledContentStore()){
  const adapter=new MockAdapter(),definition=pack(prefix);setCharacterLibraryStoreForTests(adapter,characterStore);setInstalledContentStoreForTests(adapter,installedStore);await mutateActiveCharacterDurably(adapter,(character)=>{character.size="medium";});const preview=await adapter.previewContentImport(definition.json);assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));await adapter.activateContentImport();await adapter.startInitiative();await adapter.setCurrentActor("char.aelar");return {adapter,definition,characterStore,installedStore};
}
const item=(adapter:MockAdapter,id:string)=>adapter.getSnapshot().then((snapshot)=>snapshot.activeCharacter.items.find((entry)=>entry.id===id));
async function capture(adapter:MockAdapter,operation:()=>Promise<unknown>){const state=connectedStateFor(adapter);assert.ok(state.ledger);const cursor=state.ledger.cursor,send=tauriSessionTransport.send;tauriSessionTransport.send=async()=>1;try{await operation();}finally{tauriSessionTransport.send=send;}return state.ledger.eventsAfter(cursor) as ConnectedSessionEvent[];}
function connectClient(adapter:MockAdapter,sessionId:string){const state=connectedStateFor(adapter);state.mode="client";state.sessionId=sessionId;state.replica=new ClientSessionReplica(sessionId);}

async function exercise(prefix:string){const {adapter,definition,characterStore,installedStore}=await setup(prefix);await adapter.resolveAction(definition.bag,["char.aelar"]);await adapter.resolveAction(definition.stone,["char.aelar"]);assert.equal((await item(adapter,definition.bagId))?.containerCapacityPounds,10);assert.equal((await item(adapter,definition.stoneId))?.containerId,definition.bagId);const before=(await adapter.getSnapshot()).activeCharacter.runtimeRevision;await adapter.resolveAction(definition.heavy,["char.aelar"]);assert.equal(await item(adapter,definition.heavyId),undefined);assert.equal((await adapter.getSnapshot()).activeCharacter.runtimeRevision,before);
  const restarted=new MockAdapter();setCharacterLibraryStoreForTests(restarted,characterStore);setInstalledContentStoreForTests(restarted,installedStore);await restarted.startInitiative();assert.equal((await item(restarted,definition.stoneId))?.weightPounds,8);
}

test("portable weighted items and container capacity enforce production grants under renamed identities",async()=>{await exercise("external.family-ai");await exercise("renamed.family-ai");});

test("weighted inventory facts survive connected retry, reconnect, and Undo",async()=>{const prefix="external.connected-family-ai",sessionId="session.family-ai",{adapter:host,definition}=await setup(prefix),hostState=connectedStateFor(host);hostState.mode="host";hostState.sessionId=sessionId;hostState.ledger=new HostSessionLedger(sessionId,connectedManifest(host));const granted=await capture(host,()=>host.resolveAction(definition.bag,["char.aelar"]));const {adapter:client}=await setup(prefix);connectClient(client,sessionId);assert.equal((await applyConnectedClientEvents(client,granted)).status,"applied");assert.equal((await item(client,definition.bagId))?.weightPounds,2);assert.equal((await applyConnectedClientEvents(client,granted)).status,"duplicate");const {adapter:reconnect}=await setup(prefix);connectClient(reconnect,sessionId);assert.equal((await applyConnectedClientEvents(reconnect,hostState.ledger.eventsAfter(0))).status,"applied");assert.equal((await item(reconnect,definition.bagId))?.containerCapacityPounds,10);const hostResolution=(await host.getSnapshot()).resolution;assert.equal(hostResolution?.stage,"complete");assert.ok(hostResolution&&hostState.publishedResolutionEvents.has(hostResolution.id));let undoSnapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>|undefined;const undone=await capture(host,async()=>{undoSnapshot=await host.undoLastResolution();});assert.ok(undone.length,JSON.stringify(undoSnapshot?.activity.slice(0,2)));const applied=await applyConnectedClientEvents(client,undone);assert.equal(applied.status,"applied",JSON.stringify(applied));assert.equal(await item(client,definition.bagId),undefined);});
