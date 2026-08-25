import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/sessionInventoryRuntimeAdapter";
import "../../src/app/campaignRuntimeAdapter";
import "../../src/app/campaignPartyStashPolicyRuntimeAdapter";
import "../../src/app/progressionContracts";
import { buildCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { reconstructCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjectionReconstruction";
import type { AppSnapshot, CharacterSheet, CharacterSummary, PartyStashTransferCommand, SceneVm } from "../../src/app/contracts";
import { subscribeExternalAdapterSnapshot } from "../../src/app/adapterSnapshotEvents";
import { projectedCharacterById, unmountAllCharacterSessionProjections } from "../../src/app/characterSessionProjectionRegistry";
import { mutateActiveCharacterDurably, setCharacterLibraryStoreForTests } from "../../src/app/characterLibraryRuntimeAdapter";
import { MemoryCampaignLibraryStore } from "../../src/app/memoryCampaignLibraryStore";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { MemoryConnectedOwnerInventoryJournalStore } from "../../src/app/connectedOwnerInventoryJournalStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { setCampaignLibraryStoreForTests } from "../../src/app/campaignRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { deriveProductionCharacterActions } from "../../src/app/productionPlayRuntimeAdapter";
import { materializeCreatedWeaponAttacks } from "../../src/app/characterCreationWeaponAttackAdapter";
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
  const canonicalClass=snapshot.catalog.find((entry)=>entry.scope==="builtin"&&entry.category==="class");
  const canonicalSpecies=snapshot.catalog.find((entry)=>entry.scope==="builtin"&&entry.category==="species");
  const canonicalBackground=snapshot.catalog.find((entry)=>entry.scope==="builtin"&&entry.category==="background");
  assert.ok(canonicalClass?.contentId&&canonicalSpecies?.contentId&&canonicalBackground?.contentId,"connected owner fixture requires canonical content identities");
  const remote:CharacterSheet={
    ...structuredClone(snapshot.activeCharacter),
    id:"char.connected-stash-owner",
    name:"Connected Stash Owner",
    className:canonicalClass.contentId,
    subclassName:"",
    species:canonicalSpecies.contentId,
    background:canonicalBackground.contentId,
    classLevels:undefined,
    cantrips:[],
    preparedSpells:[],
    spellbookSpells:[],
    masteryWeapons:[],
    saveState:"saved",
    goldGp:20,
    sourceRevision:1,
    runtimeRevision:1,
  };
  remote.items=remote.items.filter((item)=>item.definitionId==="dnd.srd521.item.weapon.longsword");
  remote.equipment=remote.items.map((item)=>item.name);
  remote.attacks=materializeCreatedWeaponAttacks(remote);
  mutable.activeCharacter=structuredClone(remote);
  mutable.characters=[structuredClone(remote)];
  await mutateActiveCharacterDurably(client,(character)=>{character.notes="connected owner validation fixture";});
  const persisted=(await client.getSnapshot()).activeCharacter;
  const projection=buildCharacterSessionProjectionV1(persisted,snapshot.catalog);
  const reconstructed=reconstructCharacterSessionProjectionV1(projection,snapshot.catalog);
  assert.equal(reconstructed.status,"accepted",reconstructed.status==="rejected"?reconstructed.error:undefined);
  if(reconstructed.status!=="accepted")throw new Error(reconstructed.error);
  mutable.scene.entities=[
    ...mutable.scene.entities.filter((entity)=>entity.kind!=="character"&&entity.id!==remote.id),
    structuredClone(reconstructed.entity),
  ];
  mutable.scene.actionsByActor={...mutable.scene.actionsByActor,[remote.id]:deriveProductionCharacterActions(persisted)};
  mutable.scene.economyByActor={...mutable.scene.economyByActor,[remote.id]:structuredClone(reconstructed.economy)};
  mutable.scene.selectedActorId=remote.id;
  mutable.scene.currentActorId=remote.id;
  return persisted;
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

function canonical(value:unknown):unknown{
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value as Record<string,unknown>).filter(([,item])=>item!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)]));
  return value;
}

function actionFingerprint(actions:SceneVm["actionsByActor"][string]){
  return actions.map((action)=>{
    const mechanicalDetails=action.details.filter((detail)=>detail.label!=="출처").map(({source:_,...detail})=>detail);
    return canonical({...action,details:mechanicalDetails});
  }).sort((left,right)=>JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function inventoryFingerprint(value:{goldGp:number;items:CharacterSheet["items"]}){
  return canonical({
    goldGp:value.goldGp,
    items:[...value.items].sort((left,right)=>left.id.localeCompare(right.id)).map((item)=>({
      id:item.id,
      definitionId:item.definitionId,
      name:item.name,
      nameEn:item.nameEn,
      kind:item.kind,
      quantity:item.quantity,
      equipped:item.equipped,
      wielded:Boolean(item.wielded),
      wieldSlot:item.wieldSlot,
      attunementRequired:Boolean(item.attunementRequired),
      attuned:Boolean(item.attuned),
      charges:item.charges,
    })),
  });
}

async function assertOwnerUiParity(host:MockAdapter,client:MockAdapter,actorId:string,checkpoint:string){
  const [hostSnapshot,clientSnapshot]=await Promise.all([host.getSnapshot(),client.getSnapshot()]);
  const hostActor=hostSnapshot.scene.entities.find((entity)=>entity.id===actorId);
  const clientActor=clientSnapshot.scene.entities.find((entity)=>entity.id===actorId);
  assert.deepEqual(canonical(hostActor),canonical(clientActor),`${checkpoint}: Host and Client Actor cards must match`);
  assert.deepEqual(
    actionFingerprint(hostSnapshot.scene.actionsByActor[actorId]??[]),
    actionFingerprint(clientSnapshot.scene.actionsByActor[actorId]??[]),
    `${checkpoint}: Host selected-actor and Client owner action bars must match`,
  );
  const hostInventory=hostSnapshot.sessionCharacterInventories?.[actorId];
  assert.ok(hostInventory,`${checkpoint}: Host DM inventory pane must have the owner inventory on first render`);
  assert.deepEqual(
    inventoryFingerprint(hostInventory),
    inventoryFingerprint({goldGp:clientSnapshot.activeCharacter.goldGp??0,items:clientSnapshot.activeCharacter.items}),
    `${checkpoint}: Host DM inventory and Client inventory cards must match`,
  );
  assert.deepEqual(
    inventoryFingerprint({goldGp:projectedCharacterById(host,actorId)?.sheet.goldGp??0,items:projectedCharacterById(host,actorId)?.sheet.items??[]}),
    inventoryFingerprint({goldGp:clientSnapshot.activeCharacter.goldGp??0,items:clientSnapshot.activeCharacter.items}),
    `${checkpoint}: Host executable owner projection and Client durable Character must match`,
  );
}

const hostStatus:SessionTransportStatus={role:"host",state:"connected",address:"0.0.0.0:3210",peerCount:0};
const clientStatus:SessionTransportStatus={role:"client",state:"connected",address:ADDRESS,peerCount:1};
const stoppedStatus:SessionTransportStatus={role:null,state:"disconnected",address:"",peerCount:0};

class FinalizeFaultJournalStore extends MemoryConnectedOwnerInventoryJournalStore {
  failRequestId:string|null=null;
  failed=false;

  override async finalize(requestId:string,outcome:"applied"|"undone"){
    if(requestId===this.failRequestId&&!this.failed){this.failed=true;throw new Error("forced post-commit journal finalize failure");}
    return super.finalize(requestId,outcome);
  }
}

test("MP-J01-J06 connected UI parity survives join, direct DM inventory, undo, Stash failure, and retry",async()=>{
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
    if(["campaign-owner-inventory-result","campaign-owner-inventory-finalize-result"].includes(messageType(message)))sendToHost(message);
    else sendToClient(message);
    return 1;
  };

  const host=new MockAdapter();
  const client=new MockAdapter();
  setCampaignLibraryStoreForTests(host,new MemoryCampaignLibraryStore());
  setCampaignLibraryStoreForTests(client,new MemoryCampaignLibraryStore());
  setCharacterLibraryStoreForTests(client,new MemoryCharacterLibraryStore());
  const remote=await prepareOwningClient(client);
  const publishedSnapshots:AppSnapshot[]=[];
  const unsubscribeSnapshots=subscribeExternalAdapterSnapshot((snapshot)=>publishedSnapshots.push(snapshot));
  let hostStopped=false;
  let clientStopped=false;

  try{
    await import("../../src/app/connectedSessionRuntimeAdapter");
    await import("../../src/app/productionSessionLifecycleAdapter");
    await import("../../src/app/productionSessionEmptyEncounterAdapter");
    await import("../../src/app/connectedSceneTopologyRuntimeAdapter");
    await import("../../src/app/connectedPartyStashHostPolicyAdapter");
    await import("../../src/app/connectedCampaignSystemsRuntimeAdapter");
    await import("../../src/app/connectedPartyStashClientPolicyAdapter");
    const approvalRuntime=await import("../../src/app/connectedPartyStashApprovalRuntimeAdapter");
    const journalRuntime=await import("../../src/app/connectedOwnerInventoryJournalAdapter");
    await import("../../src/app/connectedOwnerInventoryExactCompensationAdapter");
    const ownerJournal=new FinalizeFaultJournalStore();
    journalRuntime.setConnectedOwnerInventoryJournalStoreForTests(client,ownerJournal);

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

    await host.selectDmActor(remote.id);
    await assertOwnerUiParity(host,client,remote.id,"MP-J01-J04 initial connected render");

    const directGoldRequest="ui-parity.direct-gold";
    const goldBeforeDirect=(await client.getSnapshot()).activeCharacter.goldGp??0;
    await host.adjustDmInventory({requestId:directGoldRequest,actorId:remote.id,operation:"grant-currency",amount:7});
    await eventually(
      ()=>publishedSnapshots.some((snapshot)=>snapshot.session.role==="client"&&snapshot.activeCharacter.id===remote.id&&snapshot.activeCharacter.goldGp===goldBeforeDirect+7),
      "MP-J05 remote DM GP grant must publish a Client UI snapshot without a manual refresh",
    );
    await assertOwnerUiParity(host,client,remote.id,"MP-J05 direct GP grant");
    await host.undoDmInventoryAdjustment(directGoldRequest);
    await assertOwnerUiParity(host,client,remote.id,"MP-J05 direct GP undo");

    const potion=seeded.catalog.find((entry)=>entry.category==="item"&&entry.contentId==="dnd.srd521.item.gear.potion-of-healing");
    assert.ok(potion,"generated catalog must contain Potion of Healing");
    const directItemRequest="ui-parity.direct-item";
    await host.adjustDmInventory({requestId:directItemRequest,actorId:remote.id,operation:"grant-item",catalogEntryId:potion.id,quantity:2});
    await assertOwnerUiParity(host,client,remote.id,"MP-J06 catalog item grant");
    assert.ok((await client.getSnapshot()).scene.actionsByActor[remote.id]?.some((action)=>action.id==="action.healing-potion"),"granted item action must appear on both action bars");
    await host.undoDmInventoryAdjustment(directItemRequest);
    await assertOwnerUiParity(host,client,remote.id,"MP-J06 catalog item undo");

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
    await assertOwnerUiParity(host,client,remote.id,"MP-J05-J06 Party Stash committed transfer");
    const successOutcome=client.takeNextPartyStashApprovalOutcome();
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
    await assertOwnerUiParity(host,client,remote.id,"MP-J05 Party Stash compensated failure");
    assert.equal(client.takeNextPartyStashApprovalOutcome(),null,"non-terminal approved failure must not emit a false Player outcome");

    client.adjustDmInventory=realClientAdjust;
    await host.approvePartyStashApproval(failureCommand.requestId);
    const hostAfterRetry=await host.getSnapshot();
    const clientAfterRetry=await client.getSnapshot();
    assert.equal(queue.lookup(failureCommand.requestId)?.state,"committed","same approved request must commit after a successful retry");
    assert.equal(hostAfterRetry.campaignSessionSystems?.partyStash.wallet.gp,(stashBeforeFailure??0)-1,"successful retry must debit the compensated Stash exactly once");
    assert.equal(clientAfterRetry.activeCharacter.goldGp,(clientBeforeFailure.activeCharacter.goldGp??0)+1,"successful retry must grant the owner currency exactly once");
    assert.equal(projectedCharacterById(host,remote.id)?.sheet.goldGp,clientAfterRetry.activeCharacter.goldGp);
    await assertOwnerUiParity(host,client,remote.id,"MP-J05 Party Stash retry");
    const retryOutcome=client.takeNextPartyStashApprovalOutcome();
    assert.equal(retryOutcome?.requestId,failureCommand.requestId);
    assert.equal(retryOutcome?.status,"committed");

    const depositRequestId="ui-parity.player-deposit-finalize-fault";
    ownerJournal.failRequestId=depositRequestId;
    const hostBeforeDeposit=await host.getSnapshot();
    const clientBeforeDeposit=await client.getSnapshot();
    const stashBeforeDeposit=hostBeforeDeposit.campaignSessionSystems?.partyStash.wallet.gp??0;
    const ownerGoldBeforeDeposit=clientBeforeDeposit.activeCharacter.goldGp??0;
    const depositCommand={requestId:depositRequestId,campaignId:CAMPAIGN_ID,actorId:remote.id,direction:"character-to-stash" as const,asset:"currency" as const,amount:2};
    await client.transferPartyStash(depositCommand);
    const hostAfterDeposit=await host.getSnapshot();
    const clientAfterDeposit=await client.getSnapshot();
    const stashAfterDeposit=hostAfterDeposit.campaignSessionSystems?.partyStash.wallet.gp??0;
    const ownerGoldAfterDeposit=clientAfterDeposit.activeCharacter.goldGp??0;
    assert.equal(ownerJournal.failed,true,"test must exercise a post-commit journal finalization failure");
    assert.equal(stashAfterDeposit,stashBeforeDeposit+2,"Player deposit must credit Party Stash exactly once");
    assert.equal(ownerGoldAfterDeposit,ownerGoldBeforeDeposit-2,"Player deposit must debit owner GP exactly once even when journal finalization fails after Host commit");
    assert.equal(stashAfterDeposit+ownerGoldAfterDeposit,stashBeforeDeposit+ownerGoldBeforeDeposit,"Player deposit must conserve total GP across Client and Host durable stores");
    await eventually(
      ()=>publishedSnapshots.some((snapshot)=>snapshot.session.role==="host"
        &&snapshot.campaignSessionSystems?.partyStash.wallet.gp===stashAfterDeposit
        &&snapshot.sessionCharacterInventories?.[remote.id]?.goldGp===ownerGoldAfterDeposit),
      "Player deposit must publish the final Stash and owner GP to the Host UI without a manual refresh",
    );

    await client.transferPartyStash(depositCommand);
    const hostAfterReplay=await host.getSnapshot();
    const clientAfterReplay=await client.getSnapshot();
    assert.equal(hostAfterReplay.campaignSessionSystems?.partyStash.wallet.gp,stashAfterDeposit,"same transfer request replay must not credit Party Stash twice");
    assert.equal(clientAfterReplay.activeCharacter.goldGp,ownerGoldAfterDeposit,"same transfer request replay must not debit or credit Player GP twice");

    await client.stopSession();
    clientStopped=true;
    await host.stopSession();
    hostStopped=true;
  }finally{
    if(!clientStopped)await client.stopSession().catch(()=>undefined);
    if(!hostStopped)await host.stopSession().catch(()=>undefined);
    unsubscribeSnapshots();
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
