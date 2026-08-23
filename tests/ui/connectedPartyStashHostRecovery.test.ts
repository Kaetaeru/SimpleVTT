import assert from "node:assert/strict";
import test from "node:test";
import type { CampaignRecordV1 } from "../../src/app/campaignPersistenceContracts";
import type { PartyStashTransferCommand } from "../../src/app/contracts";
import {
  MemoryConnectedPartyStashHostCoordinatorStore,
  type ConnectedPartyStashHostCoordinatorRecord,
} from "../../src/app/connectedPartyStashHostCoordinatorStore";
import {
  connectedPartyStashRecoveryOutcome,
  partyStashOwnerInventoryCommand,
} from "../../src/app/connectedPartyStashHostRecoveryAdapter";

function command(direction:"character-to-stash"|"stash-to-character"):PartyStashTransferCommand {
  return direction==="character-to-stash"
    ? {requestId:"stash.recover.1",campaignId:"campaign.recover",actorId:"char.remote",direction,asset:"currency",amount:5}
    : {requestId:"stash.recover.1",campaignId:"campaign.recover",actorId:"char.remote",direction,asset:"currency",amount:5};
}

function record(direction:"character-to-stash"|"stash-to-character"):ConnectedPartyStashHostCoordinatorRecord {
  const transfer=command(direction);
  return {version:1,requestId:transfer.requestId,campaignId:transfer.campaignId,actorId:transfer.actorId,ownerParticipantId:"client:char.remote",command:transfer};
}

function campaign(recentRequestIds:string[]):CampaignRecordV1 {
  return {
    campaignId:"campaign.recover",name:"Recover",status:"active",createdAt:"2026-08-23T00:00:00Z",updatedAt:"2026-08-23T00:00:00Z",revision:1,
    roster:[],sessionDefaults:{revision:1,sessionNameTemplate:"Session",startingMode:"freeform",calendarEnabled:false,rationsEnabled:false,rationsVisibleToPlayers:true,stashPolicy:"shared",dmLibraryEnabled:true,contentLoadoutId:"default"},
    calendar:{capability:{enabled:false,providerId:"builtin.gregorian",providerVersion:"1",settingsRevision:1},state:{providerId:"builtin.gregorian",revision:1,absoluteMinute:0,displayAnchor:{year:1,monthId:"1",day:1},history:[]}},
    rations:{capability:{enabled:false,providerId:"builtin.tracking-only",providerVersion:"1",settingsRevision:1},ledger:{revision:1,balances:{ration:0},consumptionHistory:[]}},
    partyStash:{stashId:"stash.recover",revision:1,policy:"shared",wallet:{gp:0,sp:0,cp:0},itemReferences:[]},
    dmLibrary:{namespaceId:"dm.recover",revision:1,entries:[],recentEntryIds:[]},sessionHistory:[],contentLoadout:{loadoutId:"default",revision:1,entries:[]},recentRequestIds,
  };
}

test("Host coordinator record is durable until explicit recovery completion",async()=>{
  const store=new MemoryConnectedPartyStashHostCoordinatorStore();
  const pending=record("character-to-stash");
  await store.write(pending);
  await store.write(pending);
  assert.deepEqual(await store.readAll(),[pending]);
  await store.delete(pending.requestId);
  await store.delete(pending.requestId);
  assert.deepEqual(await store.readAll(),[]);
});

test("Campaign idempotency chooses finalize applied only for an uncompensated commit",()=>{
  const pending=record("character-to-stash");
  assert.equal(connectedPartyStashRecoveryOutcome(pending,campaign([pending.requestId])),"applied");
  assert.equal(connectedPartyStashRecoveryOutcome(pending,campaign([])),"undone");
  assert.equal(connectedPartyStashRecoveryOutcome(pending,campaign([pending.requestId,`${pending.requestId}.compensate`])),"undone");
});

test("recovery reconstructs the exact owner mutation for both Stash directions",()=>{
  assert.deepEqual(partyStashOwnerInventoryCommand(command("character-to-stash")),{requestId:"stash.recover.1",actorId:"char.remote",operation:"revoke-currency",amount:5});
  assert.deepEqual(partyStashOwnerInventoryCommand(command("stash-to-character")),{requestId:"stash.recover.1",actorId:"char.remote",operation:"grant-currency",amount:5});
});
