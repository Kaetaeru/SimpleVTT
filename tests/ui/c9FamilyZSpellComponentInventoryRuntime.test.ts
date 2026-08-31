import assert from "node:assert/strict";
import test from "node:test";
import type { CharacterSheet, ItemInstanceVm } from "../../src/app/contracts";
import { consumeCharacterSpellMaterials, prepareCharacterSpellComponents } from "../../src/app/spellComponentInventoryRuntime";

function character(items:ItemInstanceVm[]):CharacterSheet {
  return {id:"external.caster",name:"Caster",className:"Wizard",level:5,species:"Human",background:"Sage",hp:20,maxHp:20,tempHp:0,ac:12,speed:30,proficiencyBonus:3,saveState:"saved",abilities:{str:8,dex:14,con:12,int:18,wis:10,cha:10},saves:[],skills:[],features:[],equipment:[],items,resources:[],attacks:[],runtimeRevision:4};
}

const item=(overrides:Partial<ItemInstanceVm>):ItemInstanceVm=>({
  id:"item",definitionId:"item",name:"Item",kind:"equipment",quantity:1,equipped:false,passiveEffects:[],grantedActionIds:[],provenance:[],...overrides,
});

test("production component preparation uses explicit inventory semantics, not item names",()=>{
  const sheet=character([
    item({id:"focus",definitionId:"external.renamed.focus",name:"아무 이름",equipped:true,spellcastingComponent:"focus"}),
  ]);
  assert.equal(prepareCharacterSpellComponents({character:sheet,status:[],targetCount:1,requirements:{verbal:true,somatic:true,materials:[{}]}}).resolution.usedSubstitute,"focus");
  assert.throws(()=>prepareCharacterSpellComponents({character:sheet,status:["silenced"],targetCount:1,requirements:{verbal:true}}),/verbal spell component/);
});

test("consumed spell materials use the generic revisioned inventory transaction",()=>{
  const sheet=character([item({id:"ruby-stack",definitionId:"external.material.ruby",name:"Ruby",kind:"consumable",quantity:3,unitCostGp:300})]);
  const prepared=prepareCharacterSpellComponents({character:sheet,status:[],targetCount:2,requirements:{materials:[{id:"external.material.ruby",costGp:300,consumed:true,perTarget:true}]}});
  const result=consumeCharacterSpellMaterials(sheet,prepared.resolution.consumed);
  assert.equal(result.character.items[0].quantity,1);
  assert.equal(result.character.runtimeRevision,5);
  assert.equal(sheet.items[0].quantity,3);
});
