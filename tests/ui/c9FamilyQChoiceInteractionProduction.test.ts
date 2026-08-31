import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { ClientSessionReplica, HostSessionLedger } from "../../src/app/connectedSessionProtocol";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";
import { routeConnectedInterruptResponse } from "../../src/app/connectedInterruptResponsePort";

function payload(prefix:string){return JSON.stringify({
  schemaVersion:"0.1-draft",moduleId:`homebrew.${prefix}`,moduleVersion:"1",
  rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
  source:{document:"Choice Probe",version:"1",license:"CC0",srdDerived:false},dependencies:[],conflicts:[],capabilities:[],
  content:[{id:`option.${prefix}`,category:"option",presentation:{defaultLocale:"en",originalName:"Choice Probe",locales:{en:{name:"Choice Probe",description:"Portable multiple-option interaction"}}},mechanics:[{kind:"common-play",config:{
    schemaVersion:"0.2-draft",id:`external.${prefix}`,
    payments:[{kind:"economy",bucket:"reaction",amount:{value:1},consumeAt:"commit",refundOnCancel:true}],
    entryPoints:[{id:"choose",invocation:"manual",interaction:{id:"portable-choice",kind:"choice",responder:"actor-owner",mode:"blocking",input:{type:"choice",selector:{from:"targets",min:1,max:2,selection:"manual"}},revalidate:"always",stalePolicy:"reject"},operations:[{kind:"healing.apply",amount:{value:1},target:"actor"}]}],
  }}]}]
});}

async function setup(prefix:string){
  const host=new MockAdapter();setInstalledContentStoreForTests(host,new MemoryInstalledContentStore());
  const preview=await host.previewContentImport(payload(prefix));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await host.activateContentImport();
  const actionId=installedCommonPlayActionId({catalogId:catalogQualifiedId(`option.${prefix}`,`homebrew.${prefix}`,"1"),mechanicId:`external.${prefix}`,entryPointId:"choose"});
  const internal=host as unknown as {activeCharacter:{id:string};scene:{entities:Array<{id:string;hp:number}>}};
  const actorId=internal.activeCharacter.id;
  await host.startInitiative();await host.setCurrentActor(actorId);
  const state=connectedStateFor(host);const sessionId=`session.${prefix}`;
  state.mode="host";state.sessionId=sessionId;state.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  const manifest=structuredClone(connectedManifest(host));state.peerManifests.set("peer.actor",manifest);
  return {host,actionId,actorId,sessionId,internal};
}

async function accepted(prefix:string){
  const {host,actionId,actorId,sessionId,internal}=await setup(prefix);
  const hpBefore=internal.scene.entities.find((entity)=>entity.id===actorId)!.hp;
  const direct:Array<{peer:string;message:string}>=[],broadcasts:string[]=[];
  const oldSend=tauriSessionTransport.send,oldSendTo=tauriSessionTransport.sendTo;
  tauriSessionTransport.send=async(message)=>{broadcasts.push(message);return 1;};
  tauriSessionTransport.sendTo=async(peer,message)=>{direct.push({peer,message});return 1;};
  try{
    await host.resolveAction(actionId,[actorId]);
    let snapshot=await host.getSnapshot();
    assert.equal(snapshot.resolution?.stage,"interrupt",JSON.stringify(snapshot.resolution));
    const choice=snapshot.resolution?.interrupt?.choice;assert.ok(choice);
    assert.equal(choice.min,1);assert.equal(choice.max,2);assert.ok(choice.options.length>=2,JSON.stringify(choice));
    assert.equal(snapshot.scene.economyByActor[actorId]?.reaction,true);
    assert.equal(snapshot.scene.entities.find((entity)=>entity.id===actorId)?.hp,hpBefore);
    const selectedIds=choice.options.slice(0,2).map((option)=>option.id);
    const resolutionId=snapshot.resolution!.id,promptId=snapshot.resolution!.interrupt!.id;
    assert.equal(await routeConnectedInterruptResponse(host,{peer:"peer.actor",message:""},{sessionId,resolutionId,promptId,accept:true,selectedIds}),true);
    snapshot=await host.getSnapshot();
    assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
    assert.equal(snapshot.scene.entities.find((entity)=>entity.id===actorId)?.hp,hpBefore+1);
    assert.equal(snapshot.scene.economyByActor[actorId]?.reaction,false);
    assert.ok(snapshot.resolution?.detail.some((line)=>line.includes(selectedIds.join(", "))),JSON.stringify(snapshot.resolution?.detail));
    assert.ok(broadcasts.map((wire)=>JSON.parse(wire)).some((wire)=>wire.type==="event-batch"),JSON.stringify(broadcasts));

    const reconnectSetup=await setup(prefix);
    const reconnect=reconnectSetup.host,reconnectState=connectedStateFor(reconnect);
    reconnectState.mode="client";reconnectState.sessionId=sessionId;reconnectState.replica=new ClientSessionReplica(sessionId);
    assert.equal((await applyConnectedClientEvents(reconnect,connectedStateFor(host).ledger!.eventsAfter(0))).status,"applied");
    const reconnectSnapshot=await reconnect.getSnapshot();
    assert.equal(reconnectSnapshot.scene.entities.find((entity)=>entity.id===actorId)?.hp,snapshot.scene.entities.find((entity)=>entity.id===actorId)?.hp);
    assert.equal(reconnectSnapshot.scene.economyByActor[actorId]?.reaction,false);

    return {delta:(snapshot.scene.entities.find((entity)=>entity.id===actorId)?.hp??0)-hpBefore,selectedCount:selectedIds.length};
  }finally{tauriSessionTransport.send=oldSend;tauriSessionTransport.sendTo=oldSendTo;}
}

test("unknown installed Common Play choice carries multiple connected options into one atomic Resolver commit and is rename invariant",async()=>{
  assert.deepEqual(await accepted("family-q-choice-a"),{delta:1,selectedCount:2});
  assert.deepEqual(await accepted("renamed-family-q-choice-b"),{delta:1,selectedCount:2});
});

test("portable choice decline leaves Reaction and downstream effect untouched",async()=>{
  const {host,actionId,actorId,internal}=await setup("family-q-choice-decline");
  const hpBefore=internal.scene.entities.find((entity)=>entity.id===actorId)!.hp;
  const oldSend=tauriSessionTransport.send,oldSendTo=tauriSessionTransport.sendTo;
  tauriSessionTransport.send=async()=>1;tauriSessionTransport.sendTo=async()=>1;
  try{
    await host.resolveAction(actionId,[actorId]);
    let snapshot=await host.getSnapshot();assert.equal(snapshot.resolution?.stage,"interrupt");
    await host.respondToInterrupt(false);
    snapshot=await host.getSnapshot();
    assert.equal(snapshot.resolution?.stage,"complete");
    assert.equal(snapshot.scene.entities.find((entity)=>entity.id===actorId)?.hp,hpBefore);
    assert.equal(snapshot.scene.economyByActor[actorId]?.reaction,true);
  }finally{tauriSessionTransport.send=oldSend;tauriSessionTransport.sendTo=oldSendTo;}
});

