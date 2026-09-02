import assert from "node:assert/strict";
import test from "node:test";
import { MemoryCampaignLibraryStore } from "../../src/app/memoryCampaignLibraryStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { setCampaignLibraryStoreForTests } from "../../src/app/campaignRuntimeAdapter";
import "../../src/app/campaignDmLibraryOrganizationContracts";
import "../../src/app/campaignDmLibraryOrganizationRuntimeAdapter";

const CAMPAIGN_ID="campaign.dm-library-organization";

function presetEntry(folderId?:string){
  return {
    entryId:"dm-pc-preset.guard",
    kind:"pc-preset" as const,
    label:"호위 기사",
    definitionId:"local.guard.preset",
    folderId,
    favorite:false,
    tags:["아군","기사"],
    pcPreset:{definitionId:"local.guard.preset",name:"호위 기사",level:3,ac:16,maxHp:28,actions:["장검"],statusImmunities:[],source:"Campaign DM Library · Test",version:"1"},
  };
}

function noteEntry(folderId?:string){
  return {
    entryId:"dm-note.secret",
    kind:"note" as const,
    label:"다음 세션 비밀",
    folderId,
    favorite:true,
    tags:[" 비밀 ","후크","비밀"],
    noteText:"  플레이어에게 아직 공개하지 않는다.  ",
  };
}

test("DM Library folders support rename and deletion without deleting organized entries",async()=>{
  const adapter=new MockAdapter();
  setCampaignLibraryStoreForTests(adapter,new MemoryCampaignLibraryStore());
  await adapter.createCampaign({campaignId:CAMPAIGN_ID,name:"Library Organization"});

  await adapter.upsertCampaignDmLibraryFolder(CAMPAIGN_ID,{folderId:"folder.allies",label:"아군"});
  await adapter.upsertCampaignDmLibraryEntry(CAMPAIGN_ID,presetEntry("folder.allies"));
  await adapter.upsertCampaignDmLibraryFolder(CAMPAIGN_ID,{folderId:"folder.allies",label:"주요 아군"});

  let snapshot=await adapter.getSnapshot();
  let campaign=snapshot.campaigns?.find((candidate)=>candidate.campaignId===CAMPAIGN_ID);
  assert.deepEqual(campaign?.dmLibrary.folders,[{folderId:"folder.allies",label:"주요 아군"}]);
  assert.equal(campaign?.dmLibrary.entries.find((entry)=>entry.entryId==="dm-pc-preset.guard")?.folderId,"folder.allies");

  await adapter.removeCampaignDmLibraryFolder(CAMPAIGN_ID,"folder.allies");
  snapshot=await adapter.getSnapshot();
  campaign=snapshot.campaigns?.find((candidate)=>candidate.campaignId===CAMPAIGN_ID);
  assert.deepEqual(campaign?.dmLibrary.folders,[]);
  const preserved=campaign?.dmLibrary.entries.find((entry)=>entry.entryId==="dm-pc-preset.guard");
  assert.ok(preserved);
  assert.equal(preserved?.folderId,undefined);
  assert.equal(preserved?.pcPreset?.definitionId,"local.guard.preset");
});

test("PC preset materializes fresh DM-controlled Actors without creating Player-owned Characters",async()=>{
  const adapter=new MockAdapter();
  setCampaignLibraryStoreForTests(adapter,new MemoryCampaignLibraryStore());
  await adapter.createCampaign({campaignId:CAMPAIGN_ID,name:"Library Organization"});

  await assert.rejects(()=>adapter.upsertCampaignDmLibraryEntry(CAMPAIGN_ID,presetEntry("folder.missing")),/folder not found/i);
  await adapter.upsertCampaignDmLibraryEntry(CAMPAIGN_ID,presetEntry());
  await adapter.upsertCampaignDmLibraryEntry(CAMPAIGN_ID,{...presetEntry(),label:"정예 호위 기사",pcPreset:{...presetEntry().pcPreset,name:"정예 호위 기사",level:4,maxHp:36}});

  const before=await adapter.getSnapshot();
  const characterIdsBefore=before.characters.map((character)=>character.id);
  const sourceBefore=structuredClone(before.campaigns?.find((campaign)=>campaign.campaignId===CAMPAIGN_ID)?.dmLibrary.entries.find((entry)=>entry.entryId==="dm-pc-preset.guard")?.pcPreset);

  const first=await adapter.instantiateCampaignDmLibraryPcPreset(CAMPAIGN_ID,"dm-pc-preset.guard");
  const firstActors=first.scene.entities.filter((entity)=>entity.id.startsWith("local.guard.preset.instance-"));
  assert.equal(firstActors.length,1);
  assert.equal(firstActors[0].kind,"combatant");
  assert.equal(firstActors[0].side,"ally");
  assert.equal(firstActors[0].hp,36);
  assert.equal(firstActors[0].maxHp,36);
  assert.equal(firstActors[0].tempHp,0);
  assert.deepEqual(first.characters.map((character)=>character.id),characterIdsBefore);
  assert.equal(first.characters.some((character)=>character.id===firstActors[0].id),false);
  assert.ok(first.scene.actionsByActor[firstActors[0].id]?.every((action)=>action.actorId===firstActors[0].id));

  const second=await adapter.instantiateCampaignDmLibraryPcPreset(CAMPAIGN_ID,"dm-pc-preset.guard");
  const secondActors=second.scene.entities.filter((entity)=>entity.id.startsWith("local.guard.preset.instance-"));
  assert.equal(secondActors.length,2);
  assert.notEqual(secondActors[0].id,secondActors[1].id);
  assert.ok(secondActors.every((entity)=>entity.side==="ally"&&entity.kind==="combatant"&&entity.hp===entity.maxHp));
  assert.deepEqual(second.characters.map((character)=>character.id),characterIdsBefore);

  const campaign=second.campaigns?.find((candidate)=>candidate.campaignId===CAMPAIGN_ID);
  const sourceAfter=campaign?.dmLibrary.entries.find((entry)=>entry.entryId==="dm-pc-preset.guard")?.pcPreset;
  assert.deepEqual(sourceAfter,sourceBefore);
  assert.equal(campaign?.dmLibrary.recentEntryIds[0],"dm-pc-preset.guard");

  await adapter.joinSession("127.0.0.1:3210");
  await assert.rejects(()=>adapter.instantiateCampaignDmLibraryPcPreset(CAMPAIGN_ID,"dm-pc-preset.guard"),/DM Campaign/i);

  await adapter.hostSession();
  await adapter.removeCampaignDmLibraryEntry(CAMPAIGN_ID,"dm-pc-preset.guard");
  const afterDelete=await adapter.getSnapshot();
  const afterDeleteCampaign=afterDelete.campaigns?.find((candidate)=>candidate.campaignId===CAMPAIGN_ID);
  assert.equal(afterDeleteCampaign?.dmLibrary.entries.some((entry)=>entry.entryId==="dm-pc-preset.guard"),false);
});

test("private DM notes validate, persist, update, organize, and delete through the shared Library transaction",async()=>{
  const adapter=new MockAdapter();
  setCampaignLibraryStoreForTests(adapter,new MemoryCampaignLibraryStore());
  await adapter.createCampaign({campaignId:CAMPAIGN_ID,name:"Library Organization"});
  await adapter.upsertCampaignDmLibraryFolder(CAMPAIGN_ID,{folderId:"folder.secrets",label:"비밀"});

  await assert.rejects(()=>adapter.upsertCampaignDmLibraryEntry(CAMPAIGN_ID,{...noteEntry("folder.secrets"),noteText:"   "}),/note text is required/i);
  await adapter.upsertCampaignDmLibraryEntry(CAMPAIGN_ID,noteEntry("folder.secrets"));

  let snapshot=await adapter.getSnapshot();
  let campaign=snapshot.campaigns?.find((candidate)=>candidate.campaignId===CAMPAIGN_ID);
  let note=campaign?.dmLibrary.entries.find((entry)=>entry.entryId==="dm-note.secret");
  assert.equal(note?.kind,"note");
  assert.equal(note?.noteText,"플레이어에게 아직 공개하지 않는다.");
  assert.deepEqual(note?.tags,["비밀","후크"]);
  assert.equal(note?.folderId,"folder.secrets");
  assert.equal(note?.favorite,true);

  await adapter.upsertCampaignDmLibraryEntry(CAMPAIGN_ID,{...noteEntry("folder.secrets"),label:"수정된 비밀",favorite:false,noteText:"후반부에 공개한다."});
  snapshot=await adapter.getSnapshot();
  campaign=snapshot.campaigns?.find((candidate)=>candidate.campaignId===CAMPAIGN_ID);
  note=campaign?.dmLibrary.entries.find((entry)=>entry.entryId==="dm-note.secret");
  assert.equal(note?.label,"수정된 비밀");
  assert.equal(note?.noteText,"후반부에 공개한다.");
  assert.equal(note?.favorite,false);

  await adapter.removeCampaignDmLibraryEntry(CAMPAIGN_ID,"dm-note.secret");
  snapshot=await adapter.getSnapshot();
  campaign=snapshot.campaigns?.find((candidate)=>candidate.campaignId===CAMPAIGN_ID);
  assert.equal(campaign?.dmLibrary.entries.some((entry)=>entry.entryId==="dm-note.secret"),false);
});