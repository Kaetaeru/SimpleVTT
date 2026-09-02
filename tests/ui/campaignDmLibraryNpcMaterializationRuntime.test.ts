import assert from "node:assert/strict";
import test from "node:test";
import type { CombatantDefinitionVm } from "../../src/app/contracts";
import { parseCampaignDmLibraryJson } from "../../src/app/campaignDmLibraryImport";
import { MemoryCampaignLibraryStore } from "../../src/app/memoryCampaignLibraryStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { setCampaignLibraryStoreForTests } from "../../src/app/campaignRuntimeAdapter";
import "../../src/app/sessionInventoryRuntimeAdapter";
import "../../src/app/campaignRuntimeAdapter";
import "../../src/app/campaignDmLibraryMaterializationAdapter";
import "../../src/app/campaignDmLibraryOrganizationContracts";
import "../../src/app/campaignDmLibraryOrganizationRuntimeAdapter";

const CAMPAIGN_ID="campaign.dm-library-npc-materialization";
const DEFINITION_ID="local.campaign.npc.guard";
const IMAGE_DATA_URL="data:image/png;base64,AA==";

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

function jsonContext(campaignId:string){let id=0;return {campaignId,campaignName:"MP-G03 JSON",createEntryId:()=>`entry.${++id}`};}

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

test("MP-G03 valid custom item NPC and image JSON survives Campaign materialization",async()=>{
  const campaignId="campaign.mp-g03-json";
  const entries=parseCampaignDmLibraryJson(JSON.stringify([
    {kind:"custom-item",entryId:"entry.item",label:"폭풍 왕관",definitionId:"local.item.storm-crown",favorite:true,tags:["마법","전설"],itemTemplate:{name:"폭풍 왕관",nameEn:"Storm Crown",kind:"magic",attunementRequired:true,charges:{current:3,max:5},passiveEffects:["번개 저항"],grantedActionIds:["action.storm-bolt"],provenance:["Homebrew 2.0"]}},
    {kind:"npc-definition",entryId:"entry.npc",label:"달 사제",definitionId:"local.npc.moon-priest",npcDefinition:{definitionId:"local.npc.moon-priest",name:"달 사제",nameEn:"Moon Priest",ac:14,maxHp:27,actions:["월광 광선"],statusImmunities:["매혹"],source:"Homebrew NPC",version:"2"}},
    {kind:"image",entryId:"entry.image",label:"비밀 지도",favorite:true,tags:["핸드아웃"],imageAsset:{mimeType:"image/png",dataUrl:IMAGE_DATA_URL,byteLength:1,fileName:"secret-map.png"}},
  ]),jsonContext(campaignId));

  const adapter=new MockAdapter();
  setCampaignLibraryStoreForTests(adapter,new MemoryCampaignLibraryStore());
  await adapter.createCampaign({campaignId,name:"MP-G03 JSON"});
  for(const entry of entries)await adapter.upsertCampaignDmLibraryEntry(campaignId,entry);

  let snapshot=await adapter.getSnapshot();
  const campaign=snapshot.campaigns?.find((candidate)=>candidate.campaignId===campaignId);
  const item=campaign?.dmLibrary.entries.find((entry)=>entry.entryId==="entry.item");
  const npc=campaign?.dmLibrary.entries.find((entry)=>entry.entryId==="entry.npc");
  const image=campaign?.dmLibrary.entries.find((entry)=>entry.entryId==="entry.image");
  assert.equal(item?.itemTemplate?.attunementRequired,true);
  assert.deepEqual(item?.itemTemplate?.charges,{current:3,max:5});
  assert.deepEqual(item?.itemTemplate?.grantedActionIds,["action.storm-bolt"]);
  assert.deepEqual(item?.itemTemplate?.provenance,["Homebrew 2.0"]);
  assert.equal(npc?.npcDefinition?.source,"Homebrew NPC");
  assert.equal(npc?.npcDefinition?.version,"2");
  assert.deepEqual(image?.imageAsset,{mimeType:"image/png",dataUrl:IMAGE_DATA_URL,byteLength:1,fileName:"secret-map.png"});

  snapshot=await adapter.grantCampaignDmLibraryItem(campaignId,"entry.item",{kind:"character",actorId:"char.aelar"},1);
  const granted=snapshot.sessionCharacterInventories?.["char.aelar"]?.items.find((candidate)=>candidate.definitionId==="local.item.storm-crown");
  assert.ok(granted);
  assert.deepEqual(granted?.provenance,["Homebrew 2.0"]);

  (adapter as unknown as {combatantDefinitions:CombatantDefinitionVm[]}).combatantDefinitions=[];
  snapshot=await adapter.instantiateCampaignDmLibraryNpcDefinition(campaignId,"entry.npc");
  const actor=snapshot.scene.entities.find((entity)=>entity.id.startsWith("local.npc.moon-priest.instance-"));
  assert.ok(actor);
  assert.equal(actor?.maxHp,27);
});

test("MP-G03 rejects executable unknown fields and unsafe image payloads",()=>{
  assert.throws(()=>parseCampaignDmLibraryJson(JSON.stringify({kind:"custom-item",label:"실행 아이템",definitionId:"local.item.exec",itemTemplate:{name:"실행 아이템",kind:"magic",passiveEffects:[],grantedActionIds:[],provenance:[],script:"globalThis.pwned=true"}}),jsonContext("campaign.unsafe.item")),/지원하지 않는 필드.*script/);
  assert.throws(()=>parseCampaignDmLibraryJson(JSON.stringify({kind:"npc-definition",label:"실행 NPC",definitionId:"local.npc.exec",npcDefinition:{definitionId:"local.npc.exec",name:"실행 NPC",ac:10,maxHp:5,actions:[],statusImmunities:[],onSpawn:"eval(payload)"}}),jsonContext("campaign.unsafe.npc")),/지원하지 않는 필드.*onSpawn/);
  assert.throws(()=>parseCampaignDmLibraryJson(JSON.stringify({kind:"image",label:"HTML",imageAsset:{dataUrl:"data:text/html;base64,PHNjcmlwdD4="}}),jsonContext("campaign.unsafe.image")),/PNG, JPEG, WebP/);
  assert.throws(()=>parseCampaignDmLibraryJson(JSON.stringify({kind:"image",label:"불일치",imageAsset:{mimeType:"image/jpeg",dataUrl:IMAGE_DATA_URL,byteLength:1}}),jsonContext("campaign.mismatch.image")),/mimeType/);
});
