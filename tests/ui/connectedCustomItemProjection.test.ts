import assert from "node:assert/strict";
import test from "node:test";
import type { CatalogEntry, CharacterSheet, ItemInstanceVm } from "../../src/app/contracts";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { buildCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { reconstructCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjectionReconstruction";

const SOURCE_ID="dnd.srd-5.2.1";
const VERSION="2024";
function entry(contentId:string,category:CatalogEntry["category"],nameKo:string,nameEn:string):CatalogEntry & {contentId:string;sourceId:string} {
  return {id:catalogQualifiedId(contentId,SOURCE_ID,VERSION),contentId,sourceId:SOURCE_ID,category,nameKo,nameEn,scope:"builtin",source:"SRD 5.2.1",version:VERSION,description:"test",relationships:[],capabilities:[]};
}
const catalog:CatalogEntry[]=[
  entry("dnd.srd521.class.fighter","class","파이터","Fighter"),
  entry("dnd.srd521.species.human","species","인간","Human"),
  entry("dnd.srd521.background.soldier","background","군인","Soldier"),
];
function character(item:ItemInstanceVm):CharacterSheet{return {
  id:"char.custom-item",name:"Custom Item Owner",className:"파이터",level:1,species:"인간",background:"군인",hp:12,maxHp:12,tempHp:0,ac:12,speed:30,proficiencyBonus:2,saveState:"saved",abilities:{str:16,dex:14,con:14,int:10,wis:12,cha:8},saves:[],skills:["운동"],features:["Second Wind"],equipment:[item.name],items:[item],resources:[{id:"resource.second-wind",label:"재기의 바람",current:2,max:2,source:"SRD Fighter"}],attacks:[],rulesProfileId:"dnd.srd-5.2.1",rulesProfileVersion:"0.1-draft",sourceRevision:8,runtimeRevision:9,classLevels:[{classId:"dnd.srd521.class.fighter",level:1}],
};}
function customItem(overrides:Partial<ItemInstanceVm>={}):ItemInstanceVm{return {id:"item.campaign.moon-key",definitionId:"campaign.custom.moon-key",name:"달빛 열쇠",nameEn:"Moon Key",kind:"magic",quantity:1,equipped:false,wielded:false,attunementRequired:false,attuned:false,charges:{current:2,max:3},passiveEffects:["은은한 달빛을 낸다"],grantedActionIds:["action.untrusted.custom"],provenance:["Campaign DM Library","campaign.library/entry.moon-key"],...overrides};}

test("unequipped Campaign custom item projects without pretending to be installed rule content",()=>{
  const projection=buildCharacterSessionProjectionV1(character(customItem()),catalog);
  assert.equal(projection.contentIdentities.some((identity)=>identity.category==="item"),false);
  const reconstructed=reconstructCharacterSessionProjectionV1(projection,catalog);
  assert.equal(reconstructed.status,"accepted");
  if(reconstructed.status!=="accepted")return;
  const item=reconstructed.sheet.items[0];
  assert.equal(item.name,"달빛 열쇠");
  assert.equal(item.nameEn,"Moon Key");
  assert.equal(item.kind,"magic");
  assert.deepEqual(item.charges,{current:2,max:3});
  assert.deepEqual(item.passiveEffects,["은은한 달빛을 낸다"]);
  assert.deepEqual(item.grantedActionIds,[],"embedded custom metadata must not create executable actions");
  assert.match(item.provenance.join(" "),/inert-custom-item/);
});

test("custom item without trusted Host mechanics cannot arrive equipped wielded or attuned",()=>{
  for(const active of [
    customItem({equipped:true}),
    customItem({wielded:true}),
    customItem({attunementRequired:true,attuned:true}),
  ]){
    const reconstructed=reconstructCharacterSessionProjectionV1(buildCharacterSessionProjectionV1(character(active),catalog),catalog);
    assert.equal(reconstructed.status,"rejected");
    if(reconstructed.status==="rejected")assert.match(reconstructed.error,/trusted host mechanic/);
  }
});
