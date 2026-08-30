import type { SpellComponentContext, SpellComponentRequirements, SpellComponentResolution } from "../domain/commonPlaySpellcastingMeta";
import { resolveSpellComponents } from "../domain/commonPlaySpellcastingMeta";
import type { CharacterSheet } from "./contracts";
import { applyCommonPlayItemOperations } from "./commonPlayItemInventoryProjection";

function occupiedHands(character:CharacterSheet) {
  return character.items.filter((item)=>item.wielded).reduce((count,item)=>count+(item.wieldSlot==="two-hand"?2:1),0);
}

export function prepareCharacterSpellComponents(input:{
  character:CharacterSheet;requirements:SpellComponentRequirements;status:string[];targetCount:number;
}):{context:SpellComponentContext;resolution:SpellComponentResolution} {
  const requiredIds=new Set((input.requirements.materials??(input.requirements.material?[input.requirements.material]:[])).flatMap((material)=>material.id?[material.id]:[]));
  const materials:Record<string,{quantity:number;unitCostGp?:number}>={};
  for(const id of requiredIds) {
    const matches=input.character.items.filter((item)=>item.definitionId===id);
    if(matches.length>1)throw new Error(`spell material selector must resolve exactly one stack: ${id}`);
    if(matches[0])materials[id]={quantity:matches[0].quantity,unitCostGp:matches[0].unitCostGp};
  }
  const context:SpellComponentContext={
    canSpeak:true,silenced:input.status.includes("silenced"),freeHands:Math.max(0,2-occupiedHands(input.character)),
    hasFocus:input.character.items.some((item)=>item.equipped&&item.spellcastingComponent==="focus"),
    hasComponentPouch:input.character.items.some((item)=>item.equipped&&item.spellcastingComponent==="component-pouch"),
    targetCount:input.targetCount,materials,
  };
  return {context,resolution:resolveSpellComponents(input.requirements,context)};
}

export function consumeCharacterSpellMaterials(character:CharacterSheet,consumed:SpellComponentResolution["consumed"]) {
  if(!consumed.length)return {character:structuredClone(character),changes:[] as string[]};
  const operations=consumed.map(({materialId,quantity})=>{
    const matches=character.items.filter((item)=>item.definitionId===materialId);
    if(matches.length!==1)throw new Error(`spell material selector must resolve exactly one stack: ${materialId}`);
    return {kind:"quantity" as const,itemId:matches[0].id,delta:-quantity,removeAtZero:true};
  });
  const result=applyCommonPlayItemOperations({ownerId:character.id,revision:character.runtimeRevision??0,items:character.items,operations});
  return {character:{...structuredClone(character),items:result.items,runtimeRevision:result.revision},changes:result.changes};
}
