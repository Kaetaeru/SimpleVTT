import assert from "node:assert/strict";
import test from "node:test";
import { parseCampaignDmLibraryJson } from "../../src/app/campaignDmLibraryImport";

function context(){let id=0;return {campaignId:"campaign.json",campaignName:"JSON Campaign",createEntryId:()=>`entry.${++id}`};}

test("DM Library JSON imports a feature-rich magic item without losing runtime fields",()=>{
  const [entry]=parseCampaignDmLibraryJson(JSON.stringify({kind:"custom-item",label:"폭풍 왕관",definitionId:"local.item.storm-crown",favorite:true,tags:["마법","전설"],itemTemplate:{name:"폭풍 왕관",nameEn:"Storm Crown",kind:"magic",attunementRequired:true,charges:{current:3,max:5},passiveEffects:["번개 저항","비행 속도 30"],grantedActionIds:["action.storm-bolt","action.tempest-step"],provenance:["Homebrew 2.0"]}}),context());
  assert.equal(entry.kind,"custom-item");
  assert.equal(entry.itemTemplate?.attunementRequired,true);
  assert.deepEqual(entry.itemTemplate?.charges,{current:3,max:5});
  assert.deepEqual(entry.itemTemplate?.passiveEffects,["번개 저항","비행 속도 30"]);
  assert.deepEqual(entry.itemTemplate?.grantedActionIds,["action.storm-bolt","action.tempest-step"]);
  assert.deepEqual(entry.itemTemplate?.provenance,["Homebrew 2.0"]);
});

test("DM Library JSON accepts arrays and NPC actor definitions",()=>{
  const entries=parseCampaignDmLibraryJson(JSON.stringify([{kind:"magic",label:"달 열쇠",definitionId:"local.item.moon-key",charges:{current:1,max:1}},{kind:"npc-definition",label:"달 사제",definitionId:"local.npc.moon-priest",ac:14,maxHp:27,actions:["월광 광선"],statusImmunities:["매혹"]}]),context());
  assert.equal(entries.length,2);
  assert.equal(entries[0].itemTemplate?.kind,"magic");
  assert.equal(entries[1].npcDefinition?.actions[0],"월광 광선");
});

test("DM Library JSON rejects invalid charge and attunement contracts",()=>{
  assert.throws(()=>parseCampaignDmLibraryJson(JSON.stringify({kind:"magic",label:"깨진 완드",definitionId:"local.item.broken",charges:{current:8,max:3}}),context()),/초과/);
  assert.throws(()=>parseCampaignDmLibraryJson(JSON.stringify({kind:"magic",label:"모호한 반지",definitionId:"local.item.ambiguous",attunementRequired:"yes"}),context()),/boolean/);
});
