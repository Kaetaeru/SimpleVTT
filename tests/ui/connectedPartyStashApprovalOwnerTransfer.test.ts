import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/sessionInventoryRuntimeAdapter";
import "../../src/app/campaignRuntimeAdapter";
import "../../src/app/campaignPartyStashPolicyRuntimeAdapter";
import "../../src/app/progressionContracts";
import { buildCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { reconstructCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjectionReconstruction";
import type { CharacterSheet, CharacterSummary, PartyStashTransferCommand, SceneVm } from "../../src/app/contracts";
import { projectedCharacterById, unmountAllCharacterSessionProjections } from "../../src/app/characterSessionProjectionRegistry";
import { MemoryCampaignLibraryStore } from "../../src/app/memoryCampaignLibraryStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { setCampaignLibraryStoreForTests } from "../../src/app/campaignRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import {
  tauriSessionTransport,
  type SessionTransportMessage,
  type SessionTransportStatus,
} from "../../src/app/tauriSessionTransport";

const CAMPAIGN_ID="campaign.connected-stash-owner-transfer";
const CLIENT_PEER="peer.connected-stash-owner-transfer";
const ADDRESS="127.0.0.1:3210";

type MutableAdapterState={
  activeCharacter:CharacterSheet;
  characters:CharacterSummary[];
  scene:SceneVm;
};

async function prepareOwningClient(client:MockAdapter){
  const mutable=client as unknown as MutableAdapterState;
  const snapshot=await client.getSnapshot();
  const remote:CharacterSheet={
    ...structuredClone(snapshot.activeCharacter),
    id:"char.connected-stash-owner",
    name:"Connected Stash Owner",
    saveState:"saved",
    goldGp:20,
    sourceRevision:1,
    runtimeRevision:1,
  };
  const projection=buildCharacterSessionProjectionV1(remote,snapshot.catalog);
  const reconstructed=reconstructCharacterSessionProjectionV1(projection,snapshot.catalog);
  assert.equal(reconstructed.status,"accepted",reconstructed.status==="rejected"?reconstructed.error:undefined);
  if(reconstructed.status!=="accepted")throw new Error(reconstructed.error);
  mutable.activeCharacter=structuredClone(remote);
  mutable.characters=[structuredClone(remote)];
  mutable.scene.entities=[
    ...mutable.scene.entities.filter((entity)=>entity.kind!=="character"&&entity.id!==remote.id),
    structuredClone(reconstructed.entity),
  ];
  mutable.scene.actionsByActor={...mutable.scene.actionsByActor,[remote.id]:structuredClone(reconstructed.actions)};
  mutable.scene.economyByActor={...mutable.scene.economyByActor,[remote.id]:structuredClone(reconstructed.economy)};
  mutable.scene.selectedActorId=remote.id;
  mutable.scene.currentActorId=remote.id;
  return remote;
}

function withdrawal(actorId:string,requestId:string,amount=1):PartyStashTransferCommand{
  return {requestId,campaignId:CAMPAIGN_ID,actorId,direction:"stash-to-character",asset:"currency",amount};
}

function messageType(message:string){
  try{return String((JSON.parse(message) as {type?:unknown}).type??"");}catch{return "";}
}

async function eventually(predicate:()=>boolean|Promise<boolean>,message:string){
  for(let attempt=0;attempt<80;attempt+=1){
    if(await predicate())return;
    await new Promise<void>((resolve)=>setTimeout(resolve,0));
  }
  assert.fail(message);
}

const hostStatus:SessionTransportStatus={role:"host",state:"connected",address:"0.0.0.0:3210",peerCount:0};
const clientStatus:SessionTransportStatus={role:"client",state:"connected",address:ADDRESS,peerCount:1};
const stoppedStatus:SessionTransportStatus={role:null,state:"disconnected",address:"",peerCount:0};

test("DM approval uses the real connected owner transfer and compensates Party Stash on owner failure",async()=>{
  const listeners:Array<(message:SessionTransportMessage)=>void>=[];
  const originalTransport={
    available:tauriSessionTransport.available,
    startHost:tauriSessionTransport.startHost,
    connectClient:tauriSessionTransport.connectClient,
    send:tauriSessionTransport.send,
    sendTo:tauriSessionTransport.sendTo,
    stop:tauriSessionTransport.stop,
    onMessage:tauriSessionTransport.onMessage,
    onState:tauriSessionTransport.onState,
    onPeerLifecycle:tauriSessionTransport.onPeerLifecycle,
  };

  const sendToHost=(message:string)=>{
    assert.ok(listeners[0],"Host connected listener must be registered");
    listeners[0]({peer:CLIENT_PEER,message});
  };
  const sendToClient=(message:string)=>{
    assert.ok(listeners[1],"Client connected listener must be registered");
    listeners[1]({peer:"host",message});
  };

  tauriSessionTransport.available=()=>true;
  tauriSessionTransport.startHost=async()=>structuredClone(hostStatus);
  tauriSessionTransport.connectClient=async()=>structuredClone(clientStatus);
  tauriSessionTransport.stop=async()=>structuredClone(stoppedStatus);
  tauriSessionTransport.onMessage=async(listener)=>{listeners.push(listener);return ()=>{};};
  tauriSessionTransport.onState=async()=>()=>{};
  tauriSessionTransport.onPeerLifecycle=async()=>()=>{};
  tauriSessionTransport.send=async(message)=>{
    const type=messageType(message);
    if(type==="hello"||type==="campaign-stash-deposit"||type==="campaign-stash-approval-request"||type==="campaign-owner-inventory-result")sendToHost(message);
    else if(listeners[1])sendToClient(message);
    return 1;
  };
  tauriSessionTransport.sendTo=async(_peer,message)=>{
    if(messageType(message)==="campaign-owner-inventory-result")sendToHost(message);
    else sendToClient(message);
    return 1;
  };

  const host=new MockAdapter();
  const client=new MockAdapter();
  setCampaignLibraryStoreForTests(host,new MemoryCampaignLibraryStore());
  setCampaignLibraryStoreForTests(client,new MemoryCampaignLibraryStore());
  const remote=await prepareOwningClient(client);
  let hostStopped=false;
  let clientStopped=false;

  try{
    await import("../../src/app/connectedSessionRuntimeAdapter");
    await import("../../src/app/productionSessionLifecycleAdapter");
    await import("../../src/app/connectedPartyStashHostPolicyAdapter");
    await import("../../src/app/connectedCampaignSystemsRuntimeAdapter");
    await import("../../src/app/connectedPartyStashClientPolicyAdapter");
    const approvalRuntime=await import("../../src/app/connectedPartyStashApprovalRuntimeAdapter");
    await import("../../src/app/connectedOwnerInventoryJournalAdapter");
    await import("../../src/app/connectedOwnerInventoryExactCompensationAdapter");

    const hostCharacter=(await host.getSnapshot()).activeCharacter;
    await host.createCampaign({campaignId:CAMPAIGN_ID,name:"Connected Stash Owner Transfer"});
    await host.upsertCampaignRosterMember(CAMPAIGN_ID,{
      rosterMemberId:"roster.connected-stash-host",
      label:hostCharacter.name,
      kind:"player-character-ref",
      characterRef:{ownerHint:"host",characterId:hostCharacter.id},
      active:true,
      countsForRations:true,
      rationUnitsPerDay:1,
      stashPermission:"manage",
    });
    await host.upsertCampaignRosterMember(CAMPAIGN_ID,{
      rosterMemberId:"roster.connected-stash-owner",
      label:remote.name,
      kind:"player-character-ref",
      characterRef:{ownerHint:`client:${remote.id}`,characterId:remote.id},
      active:true,
      countsForRations:true,
      rationUnitsPerDay:1,
      stashPermission:"request",
    });
    await host.configureCampaignPartyStashPolicy(CAMPAIGN_ID,"dm-approval");
    await host.adjustDmInventory({requestId:"stash-owner.seed-gold",actorId:hostCharacter.id,operation:"grant-currency",amount:3});
    await host.transferPartyStash({requestId:"stash-owner.seed-stash",campaignId:CAMPAIGN_ID,actorId:hostCharacter.id,direction:"character-to-stash",asset:"currency",amount:3});
    await host.prepareCampaignSessionSnapshot(CAMPAIGN_ID);

    const seeded=await host.getSnapshot();
    assert.equal(seeded.campaignSessionSystems?.partyStash.wallet.gp,3,"test setup must seed three gp into Campaign Party Stash");

    await host.hostSession();
    await client.joinSession(ADDRESS);
    assert.ok(listeners.length>=2,"Host and Client must register the composed connected listener stack");

    await eventually(async()=>{
      const hostState=connectedStateFor(host);
      const clientState=connectedStateFor(client);
      const clientSnapshot=await client.getSnapshot();
      return Boolean(
        hostState.sessionId
        &&clientState.sessionId===hostState.sessionId
        &&hostState.peerParticipants.get(CLIENT_PEER)===`client:${remote.id}`
        &&projectedCharacterById(host,remote.id)?.peerId===CLIENT_PEER
        &&clientSnapshot.campaignSessionSystems?.campaignId===CAMPAIGN_ID
        &&clientSnapshot.campaignSessionSystems.partyStash.policy==="dm-approval"
      );
    },"real hello/hello-ack handshake must establish owner projection and Host Campaign projection");

    const queue=approvalRuntime.partyStashApprovalQueueFor(host);
    const successCommand=withdrawal(remote.id,"stash-approval.owner-success");
    const clientBeforeSuccess=await client.getSnapshot();
    await client.transferPartyStash(successCommand);
    assert.equal(queue.lookup(successCommand.requestId)?.state,"pending");

    await host.approvePartyStashApproval(successCommand.requestId);
    const hostAfterSuccess=await host.getSnapshot();
    const clientAfterSuccess=await client.getSnapshot();
    assert.equal(queue.lookup(successCommand.requestId)?.state,"committed");
    assert.equal(hostAfterSuccess.campaignSessionSystems?.partyStash.wallet.gp,2,"successful approval must debit Campaign Party Stash exactly once");
    assert.equal(clientAfterSuccess.activeCharacter.goldGp,(clientBeforeSuccess.activeCharacter.goldGp??0)+1,"successful approval must grant currency to the owning Client Character");
    assert.equal(projectedCharacterById(host,remote.id)?.sheet.goldGp,clientAfterSuccess.activeCharacter.goldGp,"Host owner projection must refresh from the Client result");
    const successOutcome=client.takeLatestPartyStashApprovalOutcome();
    assert.equal(successOutcome?.requestId,successCommand.requestId);
    assert.equal(successOutcome?.status,"committed");
    assert.match(successOutcome?.message??"",/승인/);

    const failureCommand=withdrawal(remote.id,"stash-approval.owner-failure");
    const stashBeforeFailure=(await host.getSnapshot()).campaignSessionSystems?.partyStash.wallet.gp;
    const clientBeforeFailure=await client.getSnapshot();
    await client.transferPartyStash(failureCommand);
    assert.equal(queue.lookup(failureCommand.requestId)?.state,"pending");

    const realClientAdjust=client.adjustDmInventory.bind(client);
    client.adjustDmInventory=async(command)=>{
      if(command.requestId===failureCommand.requestId)throw new Error("forced remote owner mutation failure");
      return realClientAdjust(command);
    };
    await assert.rejects(()=>host.approvePartyStashApproval(failureCommand.requestId),/forced remote owner mutation failure/);

    const hostAfterFailure=await host.getSnapshot();
    const clientAfterFailure=await client.getSnapshot();
    const failedRecord=queue.lookup(failureCommand.requestId);
    assert.equal(failedRecord?.state,"approved","failed owner mutation must remain approved and retryable");
    assert.match(failedRecord?.error??"",/forced remote owner mutation failure/);
    assert.equal(hostAfterFailure.campaignSessionSystems?.partyStash.wallet.gp,stashBeforeFailure,"owner failure must compensate the earlier Campaign Party Stash debit");
    assert.equal(clientAfterFailure.activeCharacter.goldGp,clientBeforeFailure.activeCharacter.goldGp,"failed owner mutation must not change Player currency");
    assert.equal(client.takeLatestPartyStashApprovalOutcome(),null,"non-terminal approved failure must not emit a false Player outcome");

    client.adjustDmInventory=realClientAdjust;
    await host.approvePartyStashApproval(failureCommand.requestId);
    const hostAfterRetry=await host.getSnapshot();
    const clientAfterRetry=await client.getSnapshot();
    assert.equal(queue.lookup(failureCommand.requestId)?.state,"committed","same approved request must commit after a successful retry");
    assert.equal(hostAfterRetry.campaignSessionSystems?.partyStash.wallet.gp,(stashBeforeFailure??0)-1,"successful retry must debit the compensated Stash exactly once");
    assert.equal(clientAfterRetry.activeCharacter.goldGp,(clientBeforeFailure.activeCharacter.goldGp??0)+1,"successful retry must grant the owner currency exactly once");
    assert.equal(projectedCharacterById(host,remote.id)?.sheet.goldGp,clientAfterRetry.activeCharacter.goldGp);
    const retryOutcome=client.takeLatestPartyStashApprovalOutcome();
    assert.equal(retryOutcome?.requestId,failureCommand.requestId);
    assert.equal(retryOutcome?.status,"committed");

    await client.stopSession();
    clientStopped=true;
    await host.stopSession();
    hostStopped=true;
  }finally{
    if(!clientStopped)await client.stopSession().catch(()=>undefined);
    if(!hostStopped)await host.stopSession().catch(()=>undefined);
    unmountAllCharacterSessionProjections(host);
    tauriSessionTransport.available=originalTransport.available;
    tauriSessionTransport.startHost=originalTransport.startHost;
    tauriSessionTransport.connectClient=originalTransport.connectClient;
    tauriSessionTransport.send=originalTransport.send;
    tauriSessionTransport.sendTo=originalTransport.sendTo;
    tauriSessionTransport.stop=originalTransport.stop;
    tauriSessionTransport.onMessage=originalTransport.onMessage;
    tauriSessionTransport.onState=originalTransport.onState;
    tauriSessionTransport.onPeerLifecycle=originalTransport.onPeerLifecycle;
  }
});
