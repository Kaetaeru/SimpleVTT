import type { SpellComponentContext, SpellComponentRequirements, SpellComponentResolution } from "../domain/commonPlaySpellcastingMeta";
import { resolveSpellComponents } from "../domain/commonPlaySpellcastingMeta";
import type { ActionVm, CharacterSheet } from "./contracts";
import { applyCommonPlayItemOperations } from "./commonPlayItemInventoryProjection";
import type { RulesRuntimeState } from "../domain/combatState";
import type { ResolutionOperation } from "../domain/resolutionTypes";

const itemQuantityResourceId=(itemId:string)=>`phase09:item:${itemId}:quantity`;
const itemChargeResourceId=(itemId:string)=>`phase09:item:${itemId}:charges`;

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

export function spellPaymentRuntimeContext(input:{
  state:RulesRuntimeState;character:CharacterSheet;actorId:string;consumed:SpellComponentResolution["consumed"];itemCost?:ActionVm["itemCost"];
}) {
  if(!input.consumed.length&&!input.itemCost)return {state:input.state,operations:[] as ResolutionOperation[],resourceIds:[] as string[]};
  const state=structuredClone(input.state);
  const combatant=state.combatants[input.actorId];
  if(!combatant)throw new Error(`spell material actor is missing: ${input.actorId}`);
  const operations:ResolutionOperation[]=[];
  const resourceIds:string[]=[];
  if(input.itemCost) {
    const item=input.character.items.find((candidate)=>candidate.id===input.itemCost!.itemId);
    if(!item)throw new Error(`spell item is missing: ${input.itemCost.itemId}`);
    for(const payment of [
      input.itemCost.quantity?{resourceId:itemQuantityResourceId(item.id),label:`${item.name} quantity`,current:item.quantity,maximum:item.quantity,amount:input.itemCost.quantity}:undefined,
      input.itemCost.charges?{resourceId:itemChargeResourceId(item.id),label:`${item.name} charges`,current:item.charges?.current,maximum:item.charges?.max,amount:input.itemCost.charges}:undefined,
    ]) {
      if(!payment)continue;
      if(payment.current===undefined||payment.maximum===undefined)throw new Error(`spell item payment pool is missing: ${item.id}`);
      combatant.resources=combatant.resources.filter((resource)=>resource.id!==payment.resourceId);
      combatant.resources.push({id:payment.resourceId,label:payment.label,current:payment.current,maximum:payment.maximum});
      operations.push({id:`spell-item:${item.id}:${payment.resourceId}`,kind:"spend-resource",actorId:input.actorId,resourceId:payment.resourceId,amount:payment.amount});
      resourceIds.push(payment.resourceId);
    }
  }
  for(const {materialId,quantity} of input.consumed) {
    const matches=input.character.items.filter((item)=>item.definitionId===materialId);
    if(matches.length!==1)throw new Error(`spell material selector must resolve exactly one stack: ${materialId}`);
    const item=matches[0];
    const resourceId=itemQuantityResourceId(item.id);
    combatant.resources=combatant.resources.filter((resource)=>resource.id!==resourceId);
    combatant.resources.push({id:resourceId,label:`${item.name} quantity`,current:item.quantity,maximum:item.quantity});
    operations.push({id:`spell-material:${item.id}`,kind:"spend-resource",actorId:input.actorId,resourceId,amount:quantity});
    resourceIds.push(resourceId);
  }
  return {state,operations,resourceIds};
}

export function stripSpellPaymentRuntimeResources(state:RulesRuntimeState,actorId:string,resourceIds:string[]) {
  const combatant=state.combatants[actorId];
  if(combatant&&resourceIds.length)combatant.resources=combatant.resources.filter((resource)=>!resourceIds.includes(resource.id));
}
