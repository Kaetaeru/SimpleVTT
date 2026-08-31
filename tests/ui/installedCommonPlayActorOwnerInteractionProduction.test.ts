import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { connectedManifest, resumeConnectedInterruptPromptForCharacter } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { HostSessionLedger } from "../../src/app/connectedSessionProtocol";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";
import { routeConnectedInterruptResponse } from "../../src/app/connectedInterruptResponsePort";
const MODULE_ID="homebrew.actor-owner-consent",CONTENT_ID="option.actor-owner-consent",MECHANIC_ID="external.actor-owner-consent",ENTRY_POINT_ID="react";
function payload(){return JSON.stringify({schemaVersion:"0.1-draft",moduleId:MODULE_ID,moduleVersion:"1",rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",source:{document:"Actor Owner Consent Probe",version:"1",license:"CC0",srdDerived:false},dependencies:[],conflicts:[],capabilities:[],content:[{id:CONTENT_ID,category:"option",presentation:{defaultLocale:"en",originalName:"Actor Owner Consent",locales:{en:{name:"Actor Owner Consent",description:"Portable remote owner consent probe"}}},mechanics:[{kind:"common-play",config:{schemaVersion:"0.2-draft",id:MECHANIC_ID,payments:[{kind:"economy",bucket:"reaction",amount:{value:1},consumeAt:"commit",refundOnCancel:true}],entryPoints:[{id:ENTRY_POINT_ID,invocation:"manual",interaction:{id:"owner-consent",kind:"consent",responder:"actor-owner",mode:"blocking",input:{type:"boolean"},revalidate:"if-revision-changed",stalePolicy:"reject"},operations:[{kind:"healing.apply",amount:{value:5},target:"self"}]}]}}]}]});}
async function install(adapter:MockAdapter){setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());const preview=await adapter.previewContentImport(payload());assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));await adapter.activateContentImport();return installedCommonPlayActionId({catalogId:catalogQualifiedId(CONTENT_ID,MODULE_ID,"1"),mechanicId:MECHANIC_ID,entryPointId:ENTRY_POINT_ID});}
test("actor-owner consent routes the blocking prompt to the owning connected Character and commits through the existing event path",async()=>{
  const sessionId="session.actor-owner-consent",host=new MockAdapter();const actionId=await install(host);
  const internal=host as unknown as {activeCharacter:{id:string;hp:number;maxHp:number};scene:{entities:Array<{id:string;hp:number}>}};internal.activeCharacter.hp=Math.max(0,internal.activeCharacter.maxHp-10);internal.scene.entities.find((entity)=>entity.id===internal.activeCharacter.id)!.hp=internal.activeCharacter.hp;
  await host.startInitiative();await host.setCurrentActor(internal.activeCharacter.id);const before=await host.getSnapshot();
  const hostState=connectedStateFor(host);hostState.mode="host";hostState.sessionId=sessionId;hostState.ledger=new HostSessionLedger(sessionId,connectedManifest(host));hostState.peerManifests.set("peer.owner",connectedManifest(host));
  const direct:Array<{peer:string;message:string}>=[],broadcasts:string[]=[];const oldSend=tauriSessionTransport.send,oldSendTo=tauriSessionTransport.sendTo;tauriSessionTransport.send=async(message)=>{broadcasts.push(message);return 1;};tauriSessionTransport.sendTo=async(peer,message)=>{direct.push({peer,message});return 1;};
  try{await host.resolveAction(actionId,[internal.activeCharacter.id]);let snapshot=await host.getSnapshot();assert.equal(snapshot.resolution?.stage,"interrupt",JSON.stringify(snapshot.resolution));assert.equal(snapshot.resolution?.interrupt?.responderId,internal.activeCharacter.id);const prompt=direct.map((entry)=>({peer:entry.peer,wire:JSON.parse(entry.message)})).find((entry)=>entry.wire.type==="resolution-interrupt-prompt");assert.equal(prompt?.peer,"peer.owner",JSON.stringify(direct));assert.equal(prompt?.wire.interrupt.responderId,internal.activeCharacter.id);assert.equal(snapshot.activeCharacter.hp,before.activeCharacter.hp);assert.equal(snapshot.scene.economyByActor[internal.activeCharacter.id]?.reaction,true);await host.respondToInterrupt(true);snapshot=await host.getSnapshot();assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));assert.equal(snapshot.activeCharacter.hp,before.activeCharacter.hp+5);assert.equal(snapshot.scene.economyByActor[internal.activeCharacter.id]?.reaction,false);assert.ok(broadcasts.map((wire)=>JSON.parse(wire)).some((wire)=>wire.type==="event-batch"),JSON.stringify(broadcasts));}finally{tauriSessionTransport.send=oldSend;tauriSessionTransport.sendTo=oldSendTo;}
});


test("actor-owner decline from the owning peer is side-effect free and replay is rejected",async()=>{
  const sessionId="session.actor-owner-decline",host=new MockAdapter();const actionId=await install(host);
  const internal=host as unknown as {activeCharacter:{id:string;hp:number;maxHp:number};scene:{entities:Array<{id:string;hp:number}>}};internal.activeCharacter.hp=Math.max(0,internal.activeCharacter.maxHp-10);internal.scene.entities.find((entity)=>entity.id===internal.activeCharacter.id)!.hp=internal.activeCharacter.hp;
  await host.startInitiative();await host.setCurrentActor(internal.activeCharacter.id);const before=await host.getSnapshot();
  const hostState=connectedStateFor(host);hostState.mode="host";hostState.sessionId=sessionId;hostState.ledger=new HostSessionLedger(sessionId,connectedManifest(host));hostState.peerManifests.set("peer.owner",connectedManifest(host));
  const direct:Array<{peer:string;message:string}>=[],broadcasts:string[]=[];const oldSend=tauriSessionTransport.send,oldSendTo=tauriSessionTransport.sendTo;tauriSessionTransport.send=async(message)=>{broadcasts.push(message);return 1;};tauriSessionTransport.sendTo=async(peer,message)=>{direct.push({peer,message});return 1;};
  try{
    await host.resolveAction(actionId,[internal.activeCharacter.id]);let snapshot=await host.getSnapshot();
    assert.equal(snapshot.resolution?.stage,"interrupt",JSON.stringify(snapshot.resolution));
    const resolutionId=snapshot.resolution!.id,promptId=snapshot.resolution!.interrupt!.id;
    const response={sessionId,resolutionId,promptId,accept:false};
    assert.equal(await routeConnectedInterruptResponse(host,{peer:"peer.owner",message:""},response),true);
    snapshot=await host.getSnapshot();
    assert.equal(snapshot.resolution?.stage,"complete");
    assert.equal(snapshot.resolution?.finalOutcome,"Common Play 상호작용 거절");
    assert.equal(snapshot.activeCharacter.hp,before.activeCharacter.hp);
    assert.equal(snapshot.scene.economyByActor[internal.activeCharacter.id]?.reaction,true);
    assert.ok(!broadcasts.map((wire)=>JSON.parse(wire)).some((wire)=>wire.type==="event-batch"),JSON.stringify(broadcasts));
    const directBeforeReplay=direct.length;
    assert.equal(await routeConnectedInterruptResponse(host,{peer:"peer.owner",message:""},response),true);
    const replayErrors=direct.slice(directBeforeReplay).map((entry)=>JSON.parse(entry.message)).filter((wire)=>wire.type==="error");
    assert.equal(replayErrors.at(-1)?.code,"interrupt-not-pending",JSON.stringify(replayErrors));
    const afterReplay=await host.getSnapshot();
    assert.equal(afterReplay.activeCharacter.hp,before.activeCharacter.hp);
    assert.equal(afterReplay.scene.economyByActor[internal.activeCharacter.id]?.reaction,true);
  }finally{tauriSessionTransport.send=oldSend;tauriSessionTransport.sendTo=oldSendTo;}
});


test("actor-owner pending consent resumes only for the rebound owner peer after reconnect",async()=>{
  const sessionId="session.actor-owner-reconnect",host=new MockAdapter();const actionId=await install(host);
  const internal=host as unknown as {activeCharacter:{id:string;hp:number;maxHp:number};scene:{entities:Array<{id:string;hp:number}>}};internal.activeCharacter.hp=Math.max(0,internal.activeCharacter.maxHp-10);internal.scene.entities.find((entity)=>entity.id===internal.activeCharacter.id)!.hp=internal.activeCharacter.hp;
  await host.startInitiative();await host.setCurrentActor(internal.activeCharacter.id);const before=await host.getSnapshot();
  const hostState=connectedStateFor(host);hostState.mode="host";hostState.sessionId=sessionId;hostState.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  const ownerManifest=connectedManifest(host);hostState.peerManifests.set("peer.owner",ownerManifest);
  const direct:Array<{peer:string;message:string}>=[],broadcasts:string[]=[];const oldSend=tauriSessionTransport.send,oldSendTo=tauriSessionTransport.sendTo;tauriSessionTransport.send=async(message)=>{broadcasts.push(message);return 1;};tauriSessionTransport.sendTo=async(peer,message)=>{direct.push({peer,message});return 1;};
  try{
    await host.resolveAction(actionId,[internal.activeCharacter.id]);let snapshot=await host.getSnapshot();
    assert.equal(snapshot.resolution?.stage,"interrupt",JSON.stringify(snapshot.resolution));
    const resolutionId=snapshot.resolution!.id,promptId=snapshot.resolution!.interrupt!.id;
    hostState.peerManifests.delete("peer.owner");
    const reboundPeer="peer.owner.reconnected";hostState.peerManifests.set(reboundPeer,ownerManifest);
    const directBeforeReconnect=direct.length;
    assert.deepEqual(await resumeConnectedInterruptPromptForCharacter(host,reboundPeer,internal.activeCharacter.id),{status:"sent"});
    const resumed=direct.slice(directBeforeReconnect).map((entry)=>({peer:entry.peer,wire:JSON.parse(entry.message)})).find((entry)=>entry.wire.type==="resolution-interrupt-prompt");
    assert.equal(resumed?.peer,reboundPeer,JSON.stringify(direct.slice(directBeforeReconnect)));
    assert.equal(resumed?.wire.resolutionId,resolutionId);
    assert.equal(resumed?.wire.interrupt.id,promptId);

    const directBeforeOldPeer=direct.length;
    assert.equal(await routeConnectedInterruptResponse(host,{peer:"peer.owner",message:""},{sessionId,resolutionId,promptId,accept:true}),true);
    const stalePeerErrors=direct.slice(directBeforeOldPeer).map((entry)=>JSON.parse(entry.message)).filter((wire)=>wire.type==="error");
    assert.equal(stalePeerErrors.at(-1)?.code,"interrupt-not-pending",JSON.stringify(stalePeerErrors));
    snapshot=await host.getSnapshot();
    assert.equal(snapshot.resolution?.stage,"interrupt");
    assert.equal(snapshot.activeCharacter.hp,before.activeCharacter.hp);
    assert.equal(snapshot.scene.economyByActor[internal.activeCharacter.id]?.reaction,true);

    assert.equal(await routeConnectedInterruptResponse(host,{peer:reboundPeer,message:""},{sessionId,resolutionId,promptId,accept:true}),true);
    snapshot=await host.getSnapshot();
    assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
    assert.equal(snapshot.activeCharacter.hp,before.activeCharacter.hp+5);
    assert.equal(snapshot.scene.economyByActor[internal.activeCharacter.id]?.reaction,false);
    assert.ok(broadcasts.map((wire)=>JSON.parse(wire)).some((wire)=>wire.type==="event-batch"),JSON.stringify(broadcasts));
  }finally{tauriSessionTransport.send=oldSend;tauriSessionTransport.sendTo=oldSendTo;}
});


test("actor-owner late approval is rejected after the authoritative revision consumes Reaction",async()=>{
  const sessionId="session.actor-owner-stale",host=new MockAdapter();const actionId=await install(host);
  const internal=host as unknown as {activeCharacter:{id:string;hp:number;maxHp:number};scene:{entities:Array<{id:string;hp:number}>;economyByActor:Record<string,{reaction:boolean}>}};internal.activeCharacter.hp=Math.max(0,internal.activeCharacter.maxHp-10);internal.scene.entities.find((entity)=>entity.id===internal.activeCharacter.id)!.hp=internal.activeCharacter.hp;
  await host.startInitiative();await host.setCurrentActor(internal.activeCharacter.id);const before=await host.getSnapshot();
  const hostState=connectedStateFor(host);hostState.mode="host";hostState.sessionId=sessionId;hostState.ledger=new HostSessionLedger(sessionId,connectedManifest(host));hostState.peerManifests.set("peer.owner",connectedManifest(host));
  const direct:Array<{peer:string;message:string}>=[],broadcasts:string[]=[];const oldSend=tauriSessionTransport.send,oldSendTo=tauriSessionTransport.sendTo;tauriSessionTransport.send=async(message)=>{broadcasts.push(message);return 1;};tauriSessionTransport.sendTo=async(peer,message)=>{direct.push({peer,message});return 1;};
  try{
    await host.resolveAction(actionId,[internal.activeCharacter.id]);let snapshot=await host.getSnapshot();
    assert.equal(snapshot.resolution?.stage,"interrupt",JSON.stringify(snapshot.resolution));
    const resolutionId=snapshot.resolution!.id,promptId=snapshot.resolution!.interrupt!.id;
    internal.scene.economyByActor[internal.activeCharacter.id]!.reaction=false;
    const response={sessionId,resolutionId,promptId,accept:true};
    assert.equal(await routeConnectedInterruptResponse(host,{peer:"peer.owner",message:""},response),true);
    snapshot=await host.getSnapshot();
    assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
    assert.match(snapshot.resolution?.finalOutcome??"",/Common Play 상호작용 (현재 권한 재검증 실패|적용 거부:)/);
    assert.equal(snapshot.activeCharacter.hp,before.activeCharacter.hp);
    assert.equal(snapshot.scene.economyByActor[internal.activeCharacter.id]?.reaction,false);
    assert.ok(!broadcasts.map((wire)=>JSON.parse(wire)).some((wire)=>wire.type==="event-batch"),JSON.stringify(broadcasts));
  }finally{tauriSessionTransport.send=oldSend;tauriSessionTransport.sendTo=oldSendTo;}
});
