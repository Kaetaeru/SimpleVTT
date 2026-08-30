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

function payload(responder:Responder){return JSON.stringify({
  schemaVersion:"0.1-draft",moduleId:`homebrew.authority.${responder}`,moduleVersion:"1",
  rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
  source:{document:"Authority Probe",version:"1",license:"CC0",srdDerived:false},dependencies:[],conflicts:[],capabilities:[],
  content:[{id:`option.authority.${responder}`,category:"option",presentation:{defaultLocale:"en",originalName:"Authority Probe",locales:{en:{name:"Authority Probe",description:"Portable authority consent"}}},mechanics:[{kind:"common-play",config:{
    schemaVersion:"0.2-draft",id:`external.authority.${responder}`,
    payments:[{kind:"economy",bucket:"reaction",amount:{value:1},consumeAt:"commit",refundOnCancel:true}],
    entryPoints:[{id:"ask",invocation:"manual",interaction:{id:`consent.${responder}`,kind:"consent",responder,mode:"blocking",input:{type:"boolean"},revalidate:"if-revision-changed",stalePolicy:"reject"},operations:[{kind:"damage.apply",amount:{value:1},damageType:"force",target:"actor"}]}],
  }}]}]
});}

async function fixture(responder:Responder){
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(payload(responder));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  const actionId=installedCommonPlayActionId({catalogId:catalogQualifiedId(`option.authority.${responder}`,`homebrew.authority.${responder}`,"1"),mechanicId:`external.authority.${responder}`,entryPointId:"ask"});
  const internal=adapter as unknown as {activeCharacter:{id:string};role:"player"|"dm"};
  const actorId=internal.activeCharacter.id;
  await adapter.startInitiative();await adapter.setCurrentActor(actorId);
  internal.role="dm";
  return {adapter,actionId,internal,actorId};
}

for(const responder of ["dm","host"] as const)test(`${responder} authority is required at declaration and revalidated before commit`,async()=>{
  const {adapter,actionId,internal,actorId}=await fixture(responder);
  const state=connectedStateFor(adapter);
  if(responder==="dm")internal.role="player";else state.mode=null;
  let snapshot=await adapter.resolveAction(actionId,[actorId]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  assert.match(snapshot.resolution?.detail.join(" ")??"",/requires/);
  if(responder==="dm")internal.role="dm";else state.mode="host";
  snapshot=await adapter.resolveAction(actionId,[actorId]);
  assert.equal(snapshot.resolution?.stage,"interrupt",JSON.stringify(snapshot.resolution));
  assert.equal(snapshot.resolution?.interrupt?.responderId,`authority:${responder}`);
  if(responder==="dm")internal.role="player";else state.mode=null;
  snapshot=await adapter.respondToInterrupt(true);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  assert.match(snapshot.resolution?.finalOutcome??"",/권한 재검증 실패/);
});

for(const responder of ["dm","host"] as const)test(`${responder} prompt rejects a remote Character response`,async()=>{
  const {adapter,actionId,actorId}=await fixture(responder);
  const state=connectedStateFor(adapter);
  if(responder==="host")state.mode="host";
  let snapshot=await adapter.resolveAction(actionId,[actorId]);
  assert.equal(snapshot.resolution?.stage,"interrupt",JSON.stringify(snapshot.resolution));
  assert.equal(snapshot.resolution?.interrupt?.responderId,`authority:${responder}`);
  const sessionId=`session.authority.${responder}`;
  state.mode="host";state.sessionId=sessionId;state.ledger=new HostSessionLedger(sessionId,connectedManifest(adapter));
  state.peerManifests.set("peer.actor",structuredClone(connectedManifest(adapter)));
  const direct:Array<{peer:string;message:string}>=[];
  const oldSendTo=tauriSessionTransport.sendTo;
  tauriSessionTransport.sendTo=async(peer,message)=>{direct.push({peer,message});return 1;};
  try{
    const resolutionId=snapshot.resolution!.id,promptId=snapshot.resolution!.interrupt!.id;
    assert.equal(await routeConnectedInterruptResponse(adapter,{peer:"peer.actor",message:""},{sessionId,resolutionId,promptId,accept:true}),true);
    const errors=direct.map((entry)=>JSON.parse(entry.message)).filter((wire)=>wire.type==="error");
    assert.equal(errors.at(-1)?.code,"interrupt-not-authorized",JSON.stringify(errors));
    snapshot=await adapter.getSnapshot();
    assert.equal(snapshot.resolution?.stage,"interrupt");
  }finally{tauriSessionTransport.sendTo=oldSendTo;}
});
