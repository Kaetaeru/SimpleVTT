import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/sessionInventoryRuntimeAdapter";
import "../../src/app/campaignRuntimeAdapter";
import "../../src/app/campaignPartyStashPolicyRuntimeAdapter";
import "../../src/app/connectedPartyStashApprovalRuntimeAdapter";
import type { CharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import type { PartyStashTransferCommand } from "../../src/app/contracts";
import type { SessionCompatibilityManifest } from "../../src/app/connectedSessionProtocol";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { mountCharacterSessionProjection, unmountAllCharacterSessionProjections } from "../../src/app/characterSessionProjectionRegistry";
import { MemoryCampaignLibraryStore } from "../../src/app/memoryCampaignLibraryStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { partyStashApprovalQueueFor } from "../../src/app/connectedPartyStashApprovalRuntimeAdapter";
import { setCampaignLibraryStoreForTests } from "../../src/app/campaignRuntimeAdapter";

const CAMPAIGN_ID="campaign.connected-stash-approval";
const SESSION_ID="session.connected-stash-approval";
const PEER_ID="peer.connected-stash-approval";
const PARTICIPANT_ID="participant.connected-stash-approval";

async function configuredHost(){
  const host=new MockAdapter();
  setCampaignLibraryStoreForTests(host,new MemoryCampaignLibraryStore());
  const initial=await host.getSnapshot();
  const character=initial.activeCharacter;

  await host.createCampaign({campaignId:CAMPAIGN_ID,name:"Connected Stash Approval"});
  await host.upsertCampaignRosterMember(CAMPAIGN_ID,{
    rosterMemberId:"roster.connected-stash-approval",
    label:character.name,
    kind:"player-character-ref",
    characterRef:{ownerHint:PARTICIPANT_ID,characterId:character.id},
    active:true,
    countsForRations:true,
    rationUnitsPerDay:1,
    stashPermission:"request",
  });
  await host.configureCampaignPartyStashPolicy(CAMPAIGN_ID,"dm-approval");

  const state=connectedStateFor(host);
  state.mode="host";
  state.sessionId=SESSION_ID;
  state.peerParticipants.set(PEER_ID,PARTICIPANT_ID);
  state.peerManifests.set(PEER_ID,{
    protocolVersion:1,
    rulesProfileId:"dnd.srd-5.2.1",
    capabilities:[],
    character:{characterId:character.id,sourceRevision:0,runtimeRevision:0},
  } satisfies SessionCompatibilityManifest);
  mountCharacterSessionProjection(host,{
    peerId:PEER_ID,
    characterId:character.id,
    sourceRevision:0,
    runtimeRevision:0,
    projection:{} as CharacterSessionProjectionV1,
    sheet:character,
  });
  return {host,character};
}

function withdrawal(actorId:string,requestId:string):PartyStashTransferCommand{
  return {requestId,campaignId:CAMPAIGN_ID,actorId,direction:"stash-to-character",asset:"currency",amount:5};
}

function submit(host:MockAdapter,command:PartyStashTransferCommand,characterName:string){
  return partyStashApprovalQueueFor(host).submit({
    command,
    participantId:PARTICIPANT_ID,
    participantName:"Connected Player",
    characterName,
    requestedAt:"2026-08-23T02:00:00.000Z",
  });
}

test("Host approval delegates to the existing Party Stash transfer before marking the request committed",async()=>{
  const {host,character}=await configuredHost();
  const command=withdrawal(character.id,"stash-approval.commit");
  submit(host,command,character.name);
  const delegated:PartyStashTransferCommand[]=[];
  const originalTransfer=host.transferPartyStash;
  host.transferPartyStash=async(incoming)=>{delegated.push(structuredClone(incoming));return host.getSnapshot();};
  try{
    await host.approvePartyStashApproval(command.requestId);
    assert.deepEqual(delegated,[command]);
    assert.equal(partyStashApprovalQueueFor(host).lookup(command.requestId)?.state,"committed");
    assert.deepEqual(host.listPartyStashApprovalRequests(),[]);
  }finally{
    host.transferPartyStash=originalTransfer;
    unmountAllCharacterSessionProjections(host);
  }
});

test("failed authoritative transfer remains approved and can retry without a false commit",async()=>{
  const {host,character}=await configuredHost();
  const command=withdrawal(character.id,"stash-approval.retry");
  submit(host,command,character.name);
  const originalTransfer=host.transferPartyStash;
  host.transferPartyStash=async()=>{throw new Error("owner transfer unavailable");};
  try{
    await assert.rejects(()=>host.approvePartyStashApproval(command.requestId),/owner transfer unavailable/);
    const failed=partyStashApprovalQueueFor(host).lookup(command.requestId);
    assert.equal(failed?.state,"approved");
    assert.equal(failed?.error,"owner transfer unavailable");
    assert.equal(host.listPartyStashApprovalRequests().length,1);

    let retries=0;
    host.transferPartyStash=async(incoming)=>{retries+=1;assert.deepEqual(incoming,command);return host.getSnapshot();};
    await host.approvePartyStashApproval(command.requestId);
    assert.equal(retries,1);
    assert.equal(partyStashApprovalQueueFor(host).lookup(command.requestId)?.state,"committed");
  }finally{
    host.transferPartyStash=originalTransfer;
    unmountAllCharacterSessionProjections(host);
  }
});

test("policy or connected owner changes are revalidated before approval and leave the request pending",async()=>{
  const first=await configuredHost();
  const policyCommand=withdrawal(first.character.id,"stash-approval.policy-change");
  submit(first.host,policyCommand,first.character.name);
  await first.host.configureCampaignPartyStashPolicy(CAMPAIGN_ID,"shared");
  await assert.rejects(()=>first.host.approvePartyStashApproval(policyCommand.requestId),/정책이 변경/);
  assert.equal(partyStashApprovalQueueFor(first.host).lookup(policyCommand.requestId)?.state,"pending");
  unmountAllCharacterSessionProjections(first.host);

  const second=await configuredHost();
  const ownerCommand=withdrawal(second.character.id,"stash-approval.owner-change");
  submit(second.host,ownerCommand,second.character.name);
  connectedStateFor(second.host).peerParticipants.set(PEER_ID,"participant.changed-owner");
  await assert.rejects(()=>second.host.approvePartyStashApproval(ownerCommand.requestId),/현재 연결 소유자가 변경/);
  assert.equal(partyStashApprovalQueueFor(second.host).lookup(ownerCommand.requestId)?.state,"pending");
  unmountAllCharacterSessionProjections(second.host);
});
