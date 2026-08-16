import assert from "node:assert/strict";
import test from "node:test";
import type { CharacterSheet } from "../../src/app/contracts";
import { projectResolutionCharacterWriteBack } from "../../src/app/resolutionCharacterDurableProjection";
import type { ResolutionEvent } from "../../src/domain/resolutionTypes";
import type { RuntimeStateChange } from "../../src/domain/runtimeStateChange";

function sheet():CharacterSheet {
  return {
    id:"char.hero",name:"Hero",className:"전사",level:5,species:"인간",background:"병사",
    hp:20,maxHp:30,tempHp:4,ac:18,speed:30,proficiencyBonus:3,saveState:"saved",
    abilities:{str:18,dex:14,con:16,int:10,wis:12,cha:8},saves:[],skills:[],features:[],equipment:[],
    items:[
      {id:"item.potion",definitionId:"potion",name:"Potion",kind:"consumable",quantity:2,equipped:false,passiveEffects:[],grantedActionIds:[],provenance:[]},
      {id:"item.wand",definitionId:"wand",name:"Wand",kind:"magic",quantity:1,equipped:true,charges:{current:7,max:7},passiveEffects:[],grantedActionIds:[],provenance:[]},
    ],
    resources:[{id:"resource.second-wind",label:"Second Wind",current:1,max:1,source:"Fighter"}],
    attacks:[],
  };
}

const hp=(targetId:string,field:"current"|"maximum"|"temporary",before:number,after:number):RuntimeStateChange=>({kind:"hp",targetId,field,before,after,provenance:[],lifetime:"character-durable",writeBack:"character"});
const resource=(targetId:string,resourceId:string,before:number,after:number):RuntimeStateChange=>({kind:"resource",targetId,resourceId,before,after,provenance:[],lifetime:"character-durable",writeBack:"character"});
const life=(targetId:string,field:"stable"|"unconscious"|"dead",before:boolean,after:boolean):RuntimeStateChange=>({kind:"life",targetId,field,before,after,provenance:[],lifetime:"character-durable",writeBack:"character"});

function event(...stateChanges:RuntimeStateChange[]):ResolutionEvent {
  return {
    id:"event.test",resolutionId:"resolution.test",operationId:"operation.test",kind:"test",
    actorId:"char.hero",targetId:"char.hero",summary:"test",provenance:[],stateChanges,result:null,
  };
}

test("Character ResolutionEvent projection persists HP/resource/item/life in event order", () => {
  const result=projectResolutionCharacterWriteBack(sheet(),[
    event(
      hp("char.hero","temporary",4,0),
      hp("char.hero","current",20,11),
      resource("char.hero","resource.second-wind",1,0),
      resource("char.hero","phase09:item:item.potion:quantity",2,1),
      resource("char.hero","phase09:item:item.wand:charges",7,6),
      life("char.hero","unconscious",false,true),
    ),
  ],"forward",{stable:false,unconscious:false,dead:false});
  assert.equal(result.status,"committed");
  if (result.status!=="committed") return;
  assert.equal(result.changed,true);
  assert.equal(result.sheet.tempHp,0);
  assert.equal(result.sheet.hp,11);
  assert.equal(result.sheet.maxHp,30);
  assert.equal(result.sheet.resources[0].current,0);
  assert.equal(result.sheet.items[0].quantity,1);
  assert.equal(result.sheet.items[1].charges?.current,6);
  assert.deepEqual(result.sheet.durableLifeFlags,{stable:false,unconscious:true,dead:false});
});

test("inverse Character write-back is drift-safe and restores the exact durable projection", () => {
  const original=sheet();
  const events=[event(
    hp("char.hero","current",20,12),
    resource("char.hero","phase09:item:item.potion:quantity",2,1),
  )];
  const forward=projectResolutionCharacterWriteBack(original,events,"forward");
  assert.equal(forward.status,"committed");
  if (forward.status!=="committed") return;
  const inverse=projectResolutionCharacterWriteBack(forward.sheet,events,"inverse");
  assert.equal(inverse.status,"committed");
  if (inverse.status!=="committed") return;
  assert.equal(inverse.sheet.hp,20);
  assert.equal(inverse.sheet.items[0].quantity,2);

  const drifted=structuredClone(forward.sheet);
  drifted.hp=13;
  const rejected=projectResolutionCharacterWriteBack(drifted,events,"inverse");
  assert.equal(rejected.status,"rejected");
  if (rejected.status==="rejected") assert.match(rejected.error,/write-back drift/);
});

test("maximum HP write-back is rejected until an explicit canonical source contract exists", () => {
  const result=projectResolutionCharacterWriteBack(sheet(),[event(hp("char.hero","maximum",30,25))],"forward");
  assert.equal(result.status,"rejected");
  if (result.status==="rejected") assert.match(result.error,/maximum HP requires an explicit source-model contract/);
});

test("combatant state changes do not mutate the local Character durable projection", () => {
  const result=projectResolutionCharacterWriteBack(sheet(),[
    event(hp("combatant.goblin","current",10,3)),
  ],"forward");
  assert.equal(result.status,"committed");
  if (result.status!=="committed") return;
  assert.equal(result.changed,false);
  assert.equal(result.sheet.hp,20);
});
