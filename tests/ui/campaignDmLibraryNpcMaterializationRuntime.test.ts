import assert from "node:assert/strict";
import test from "node:test";
import type { CombatantDefinitionVm } from "../../src/app/contracts";
import { MemoryCampaignLibraryStore } from "../../src/app/memoryCampaignLibraryStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { setCampaignLibraryStoreForTests } from "../../src/app/campaignRuntimeAdapter";
import "../../src/app/campaignDmLibraryOrganizationContracts";
import "../../src/app/campaignDmLibraryOrganizationRuntimeAdapter";

const CAMPAIGN_ID="campaign.dm-library-npc-materialization";
const DEFINITION_ID="local.campaign.npc.guard";

function npcEntry(){
  return {
    entryId:"dm-npc.guard",
    kind:"npc-definition" as const,
    label:"성문 경비병",
    definitionId:DEFINITION_ID,
    favorite:false,
    tags:["경비","NPC"],
    npcDefinition:{
      definitionId:DEFINITION_ID,
      name:"성문 경비병",
      nameEn:"Gate Guard",
      ac:16,
      maxHp:18,
      actions:["창"],
      statusImmunities:[],
      source:"Campaign DM Library · Test",
      version:"1",
    },
  };
}

test("NPC definitions materialize fresh full-health Actors without mutating the Campaign source",async()=>{
  const adapter=new MockAdapter();
  setCampaignLibraryStoreForTests(adapter,new MemoryCampaignLibraryStore());
  await adapter.createCampaign({campaignId:CAMPAIGN_ID,name:"NPC Materialization"});
  await adapter.upsertCampaignDmLibraryEntry(CAMPAIGN_ID,npcEntry());
  (adapter as unknown as {combatantDefinitions:CombatantDefinitionVm[]}).combatantDefinitions=[];

  const before=await adapter.getSnapshot();
  const sourceBefore=structuredClone(before.campaigns?.find((campaign)=>campaign.campaignId===CAMPAIGN_ID)?.dmLibrary.entries.find((entry)=>entry.entryId==="dm-npc.guard")?.npcDefinition);

  const first=await adapter.instantiateCampaignDmLibraryNpcDefinition(CAMPAIGN_ID,"dm-npc.guard");
  const firstActors=first.scene.entities.filter((entity)=>entity.id.startsWith(`${DEFINITION_ID}.instance-`));
  assert.equal(firstActors.length,1);
  assert.equal(firstActors[0].hp,18);
  assert.equal(firstActors[0].maxHp,18);
  assert.equal(firstActors[0].tempHp,0);
  assert.deepEqual(firstActors[0].status,[]);
  assert.equal(firstActors[0].side,"enemy");

  const second=await adapter.instantiateCampaignDmLibraryNpcDefinition(CAMPAIGN_ID,"dm-npc.guard");
  const secondActors=second.scene.entities.filter((entity)=>entity.id.startsWith(`${DEFINITION_ID}.instance-`));
  assert.equal(secondActors.length,2);
  assert.notEqual(secondActors[0].id,secondActors[1].id);
  assert.ok(secondActors.every((entity)=>entity.hp===entity.maxHp));

  const campaign=second.campaigns?.find((candidate)=>candidate.campaignId===CAMPAIGN_ID);
  const sourceAfter=campaign?.dmLibrary.entries.find((entry)=>entry.entryId==="dm-npc.guard")?.npcDefinition;
  assert.deepEqual(sourceAfter,sourceBefore);
  assert.equal(campaign?.dmLibrary.recentEntryIds[0],"dm-npc.guard");
});
