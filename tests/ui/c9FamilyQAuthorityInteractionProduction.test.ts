import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { HostSessionLedger } from "../../src/app/connectedSessionProtocol";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";
import { routeConnectedInterruptResponse } from "../../src/app/connectedInterruptResponsePort";

type Responder="dm"|"host";
type Identity={moduleId:string;contentId:string;mechanicId:string;entryPointId:string};
const ORIGINAL:Identity={moduleId:"homebrew.authority-consent",contentId:"option.authority-consent",mechanicId:"external.unknown.authority-consent",entryPointId:"ask-authority"};
const RENAMED:Identity={moduleId:"third-party.renamed-authority",contentId:"option.renamed-authority",mechanicId:"portable.renamed-authority",entryPointId:"invoke-renamed-authority"};

function payload(identity:Identity,responder:Responder){return JSON.stringify({
  schemaVersion:"0.1-draft",moduleId:identity.moduleId,moduleVersion:"1",
  rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
  source:{document:"Authority Consent Probe",version:"1",license:"CC0",srdDerived:false},dependencies:[],conflicts:[],capabilities:[],
  content:[{id:identity.contentId,category:"option",presentation:{defaultLocale:"en",originalName:"Authority Consent",locales:{en:{name:"Authority Consent",description:"Portable DM/Host consent probe"}}},mechanics:[{kind:"common-play",config:{
    schemaVersion:"0.2-draft",id:identity.mechanicId,
    payments:[{kind:"economy",bucket:"reaction",amount:{value:1},consumeAt:"commit",refundOnCancel:true}],
    entryPoints:[{id:identity.entryPointId,invocation:"manual",interaction:{id:`${responder}-consent`,kind:"consent",responder,mode:"blocking",input:{type:"boolean"},revalidate:"if-revision-changed",stalePolicy:"reject"},targeting:{from:"targets",min:1,max:1},operations:[{kind:"damage.apply",amount:{value:1},damageType:"force",target:"target"}]}],
  }}]}]
});}

async function install(adapter:MockAdapter,identity:Identity,responder:Responder){
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(payload(identity,responder));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  return installedCommonPlayActionId({catalogId:catalogQualifiedId(identity.contentId,identity.moduleId,"1"),mechanicId:identity.mechanicId,entryPointId:identity.entryPointId});
}

async function run(identity:Identity,responder:Responder){
  const sessionId=`session.${identity.moduleId}.${responder}`,host=new MockAdapter();
  const actionId=await install(host,identity,responder);
  const internal=host as unknown as {activeCharacter:{id:string};scene:{entities:Array<{id:string;name:string;hp:number}>}};
  const actorId=internal.activeCharacter.id;
  const target=internal.scene.entities.find((entity)=>entity.id!==actorId&&entity.hp>0);
  assert.ok(target);
  const targetHpBefore=target.hp;
  await host.startInitiative();await host.setCurrentActor(actorId);

  const state=connectedStateFor(host);state.mode="host";state.sessionId=sessionId;state.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  const peerManifest=structuredClone(connectedManifest(host));
  state.peerManifests.set("peer.actor",peerManifest);
  const direct:Array<{peer:string;message:string}>=[],broadcasts:string[]=[];
  const oldSend=tauriSessionTransport.send,oldSendTo=tauriSessionTransport.sendTo;
  tauriSessionTransport.send=async(message)=>{broadcasts.push(message);return 1;};
  tauriSessionTransport.sendTo=async(peer,message)=>{direct.push({peer,message});return 1;};
  try{
    await host.resolveAction(actionId,[target.id]);
    let snapshot=await host.getSnapshot();
    assert.equal(snapshot.resolution?.stage,"interrupt",JSON.stringify(snapshot.resolution));
    assert.equal(snapshot.resolution?.interrupt?.responderId,`authority:${responder}`);
    assert.equal(snapshot.resolution?.interrupt?.responderName,responder==="dm"?"DM":"Host");
    assert.ok(!direct.map((entry)=>JSON.parse(entry.message)).some((wire)=>wire.type==="resolution-interrupt-prompt"),JSON.stringify(direct));
    assert.equal(snapshot.scene.entities.find((entity)=>entity.id===target.id)?.hp,targetHpBefore);
    assert.equal(snapshot.scene.economyByActor[actorId]?.reaction,true);

    const resolutionId=snapshot.resolution!.id,promptId=snapshot.resolution!.interrupt!.id;
    const beforeUnauthorized=direct.length;
    assert.equal(await routeConnectedInterruptResponse(host,{peer:"peer.actor",message:""},{sessionId,resolutionId,promptId,accept:true}),true);
    const errors=direct.slice(beforeUnauthorized).map((entry)=>JSON.parse(entry.message)).filter((wire)=>wire.type==="error");
    assert.equal(errors.at(-1)?.code,"interrupt-not-authorized",JSON.stringify(errors));
    snapshot=await host.getSnapshot();
    assert.equal(snapshot.resolution?.stage,"interrupt");
    assert.equal(snapshot.scene.economyByActor[actorId]?.reaction,true);

    await host.respondToInterrupt(true);
    snapshot=await host.getSnapshot();
    assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
    assert.equal(snapshot.scene.entities.find((entity)=>entity.id===target.id)?.hp,targetHpBefore-1);
    assert.equal(snapshot.scene.economyByActor[actorId]?.reaction,false);
    assert.ok(broadcasts.map((wire)=>JSON.parse(wire)).some((wire)=>wire.type==="event-batch"),JSON.stringify(broadcasts));
    return {responderId:`authority:${responder}`,hpDelta:-1};
  }finally{tauriSessionTransport.send=oldSend;tauriSessionTransport.sendTo=oldSendTo;}
}

for(const responder of ["dm","host"] as const)test(`${responder} consent stays host-authoritative, rejects remote Character responses, and is identity invariant`,async()=>{
  assert.deepEqual(await run(ORIGINAL,responder),await run(RENAMED,responder));
});
