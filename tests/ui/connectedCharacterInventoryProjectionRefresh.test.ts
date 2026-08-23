import assert from "node:assert/strict";
import test from "node:test";
import type { CatalogEntry, CharacterSheet, ItemInstanceVm } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { buildCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { reconstructCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjectionReconstruction";
import { acceptHostCharacterSessionProjection } from "../../src/app/connectedCharacterProjectionHandshake";
import { refreshReconstructedCharacterSessionProjection } from "../../src/app/characterSessionProjectionMount";
import type { SessionCompatibilityManifest } from "../../src/app/connectedSessionProtocol";

const SOURCE_ID="dnd.srd-5.2.1";
const VERSION="2024";
function entry(contentId:string,category:CatalogEntry["category"],nameKo:string,nameEn:string):CatalogEntry & {contentId:string;sourceId:string} {
  return {id:catalogQualifiedId(contentId,SOURCE_ID,VERSION),contentId,sourceId:SOURCE_ID,category,nameKo,nameEn,scope:"builtin",source:"SRD 5.2.1",version:VERSION,description:"test",relationships:[],capabilities:[]};
}
const catalog:CatalogEntry[]=[
  entry("dnd.srd521.class.fighter","class","파이터","Fighter"),
  entry("dnd.srd521.species.human","species","인간","Human"),
  entry("dnd.srd521.background.soldier","background","군인","Soldier"),
  entry("dnd.srd521.item.gear.potion-of-healing","item","치유 물약","Potion of Healing"),
];
function sheet(items:ItemInstanceVm[]=[],sourceRevision=4,runtimeRevision=6):CharacterSheet {
  return {
    id:"char.inventory-refresh",name:"Inventory Refresh",className:"파이터",level:1,species:"인간",background:"군인",
    hp:12,maxHp:12,tempHp:0,ac:12,speed:30,proficiencyBonus:2,saveState:"saved",abilities:{str:16,dex:14,con:14,int:10,wis:12,cha:8},saves:[],skills:["운동"],features:["Second Wind"],equipment:items.map((item)=>item.name),items,
    resources:[{id:"resource.second-wind",label:"재기의 바람",current:2,max:2,source:"SRD Fighter"}],attacks:[],rulesProfileId:"dnd.srd-5.2.1",rulesProfileVersion:"0.1-draft",sourceRevision,runtimeRevision,classLevels:[{classId:"dnd.srd521.class.fighter",level:1}],
  };
}
function manifest(character:CharacterSheet):SessionCompatibilityManifest{return {protocolVersion:1,rulesProfileId:"dnd.srd-5.2.1",capabilities:["resolution-event-v1","character-projection-v1","event-cursor-v1"],character:{characterId:character.id,sourceRevision:character.sourceRevision??0,runtimeRevision:character.runtimeRevision??0}};}

test("mounted remote Character accepts forward source revision when only inventory membership changed",()=>{
  const host=new MockAdapter();(host as unknown as {catalog:CatalogEntry[]}).catalog=structuredClone(catalog);
  const before=sheet();const beforeProjection=buildCharacterSessionProjectionV1(before,catalog);
  assert.equal(acceptHostCharacterSessionProjection(host,"peer.inventory",manifest(before),beforeProjection).status,"accepted");
  const potion:ItemInstanceVm={id:"item.remote.potion",definitionId:"dnd.srd521.item.gear.potion-of-healing",name:"치유 물약",nameEn:"Potion of Healing",kind:"consumable",quantity:1,equipped:false,passiveEffects:[],grantedActionIds:[],provenance:["Campaign Party Stash"]};
  const after=sheet([potion],5,7);const reconstructed=reconstructCharacterSessionProjectionV1(buildCharacterSessionProjectionV1(after,catalog),catalog);
  assert.equal(reconstructed.status,"accepted");
  assert.deepEqual(refreshReconstructedCharacterSessionProjection(host,"peer.inventory",reconstructed),{status:"accepted",characterId:before.id});
});

test("inventory refresh still rejects non-inventory source drift behind the same durable owner path",()=>{
  const host=new MockAdapter();(host as unknown as {catalog:CatalogEntry[]}).catalog=structuredClone(catalog);
  const before=sheet();const beforeProjection=buildCharacterSessionProjectionV1(before,catalog);
  assert.equal(acceptHostCharacterSessionProjection(host,"peer.inventory",manifest(before),beforeProjection).status,"accepted");
  const drifted=buildCharacterSessionProjectionV1(sheet([],5,7),catalog);drifted.source.name="Unauthorized Rename";
  const reconstructed=reconstructCharacterSessionProjectionV1(drifted,catalog);
  assert.equal(reconstructed.status,"accepted");
  const refreshed=refreshReconstructedCharacterSessionProjection(host,"peer.inventory",reconstructed);
  assert.equal(refreshed.status,"rejected");
  if(refreshed.status==="rejected")assert.match(refreshed.error,/non-inventory source changed/);
});
