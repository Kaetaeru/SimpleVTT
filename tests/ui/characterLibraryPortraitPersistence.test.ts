import assert from "node:assert/strict";
import test from "node:test";
import type { CharacterSheet } from "../../src/app/contracts";
import "../../src/app/characterPortraitContracts";
import { CharacterLibraryRepository } from "../../src/app/characterLibraryPersistence";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { parseLocalImageDataUrl, PORTRAIT_IMAGE_MAX_BYTES } from "../../src/app/localImageAsset";

function sheet():CharacterSheet {
  return {
    id:"char.portrait",name:"Portrait Hero",className:"몽크",level:3,species:"인간",background:"수도승",
    hp:18,maxHp:24,tempHp:0,ac:15,speed:40,proficiencyBonus:2,saveState:"saved",
    abilities:{str:10,dex:16,con:14,int:10,wis:16,cha:8},saves:["STR +2","DEX +5"],skills:["곡예","통찰"],features:["무술"],equipment:["단검"],
    items:[{id:"item.test.dagger",definitionId:"dnd.srd521.item.dagger",name:"단검",kind:"equipment",quantity:1,equipped:true,wielded:true,passiveEffects:[],grantedActionIds:[],provenance:["SRD 5.2.1"]}],
    resources:[{id:"resource.focus",label:"집중점",current:3,max:3,source:"Monk"}],attacks:[{id:"attack.dagger",name:"단검",bonus:5,damage:"1d4+3 관통"}],
    rulesProfileId:"dnd.srd-5.2.1",rulesProfileVersion:"0.1-draft",classLevels:[{classId:"dnd.srd521.class.monk",level:3}],creationSelections:{"species.size":["medium"]},
  };
}

const asset=parseLocalImageDataUrl("data:image/png;base64,iVBORw0KGgo=","hero.png",PORTRAIT_IMAGE_MAX_BYTES);

test("Character portrait stays durable in the owning Character Library without changing mechanics source/runtime revisions",async()=>{
  const store=new MemoryCharacterLibraryStore();
  const writer=new CharacterLibraryRepository(store);
  const initial=await writer.hydrate([sheet()],"char.portrait");
  const withPortrait=structuredClone(initial.sheets[0]);
  withPortrait.portrait={asset,focalX:.35,focalY:.6};
  const first=await writer.commit([withPortrait],withPortrait.id);
  assert.equal(first.document.characters[0].sourceRevision,1);
  assert.equal(first.document.characters[0].runtimeRevision,1);
  assert.deepEqual(first.document.characters[0].materializedCache.sheet.portrait,withPortrait.portrait);

  const reader=new CharacterLibraryRepository(store);
  const rehydrated=await reader.hydrate([sheet()],"char.portrait");
  assert.deepEqual(rehydrated.sheets[0].portrait,withPortrait.portrait,"offline/restart hydration must restore portrait and focal position");

  const refocused=structuredClone(rehydrated.sheets[0]);
  refocused.portrait={...refocused.portrait!,focalX:.8};
  const second=await reader.commit([refocused],refocused.id);
  assert.equal(second.document.characters[0].sourceRevision,1,"presentation-only focal changes must not advance Character mechanics source revision");
  assert.equal(second.document.characters[0].runtimeRevision,1,"presentation-only focal changes must not advance runtime revision");

  const removed=structuredClone(second.sheets[0]);
  delete removed.portrait;
  await reader.commit([removed],removed.id);
  const finalReader=new CharacterLibraryRepository(store);
  const finalState=await finalReader.hydrate([sheet()],"char.portrait");
  assert.equal(finalState.sheets[0].portrait,undefined,"portrait removal must survive restart");
});
