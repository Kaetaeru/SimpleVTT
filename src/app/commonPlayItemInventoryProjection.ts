import {
  resolveCommonPlayAttunement,
  resolveCommonPlayAttunementLoss,
  resolveCommonPlayInventoryTransaction,
  type CommonPlayInventoryOperation,
  type CommonPlayItemInstance,
} from "../domain/commonPlayInventoryRuntime";
import type { ItemInstanceVm } from "./contracts";

function commonItem(item:ItemInstanceVm,ownerId:string):CommonPlayItemInstance {
  return {
    id:item.id,definitionId:item.definitionId,quantity:item.quantity,
    stackable:!item.charges&&!item.attunementRequired,
    equipped:item.equipped,wielded:item.wielded??false,
    ...(item.wieldSlot?{wieldSlot:item.wieldSlot}:{}),
    ...(item.charges?{charges:{current:item.charges.current,maximum:item.charges.max}}:{}),
    ...(item.attunementRequired?{attunement:{
      required:true,
      ...(item.attuned?{attunedTo:ownerId}:{}),
      ...structuredClone(item.attunementPolicy),
    }}:{}),
    grantedEntryPointIds:[...item.grantedActionIds],
  };
}

function appItems(input:{ownerId:string;items:ItemInstanceVm[];templates?:ItemInstanceVm[]},items:CommonPlayItemInstance[]) {
  const presentations=new Map([...input.items,...(input.templates??[])].map((item)=>[item.id,item]));
  return items.map((item)=>{
    const source=presentations.get(item.id);
    if(!source) throw new Error(`inventory item presentation is missing: ${item.id}`);
    return {
      ...structuredClone(source),quantity:item.quantity,equipped:item.equipped,wielded:item.wielded,
      ...(item.wieldSlot?{wieldSlot:item.wieldSlot}:{wieldSlot:undefined}),
      ...(item.charges?{charges:{current:item.charges.current,max:item.charges.maximum}}:{}),
      ...(item.attunement?{
        attunementRequired:item.attunement.required,
        attuned:item.attunement.attunedTo===input.ownerId,
        ...((item.attunement.prerequisite!==undefined||item.attunement.cursed!==undefined||item.attunement.loss!==undefined)?{attunementPolicy:{
          prerequisite:item.attunement.prerequisite,
          cursed:item.attunement.cursed,
          loss:item.attunement.loss,
        }}:{}),
      }:{}),
    };
  });
}

export function applyCommonPlayItemOperations(input:{
  ownerId:string;
  revision:number;
  items:ItemInstanceVm[];
  operations:CommonPlayInventoryOperation[];
  templates?:ItemInstanceVm[];
}) {
  const result=resolveCommonPlayInventoryTransaction({
    ownerId:input.ownerId,revision:input.revision,
    items:input.items.map((item)=>commonItem(item,input.ownerId)),
  },{expectedRevision:input.revision,operations:input.operations});
  if(result.status==="rejected") throw new Error(result.error);
  return {
    revision:result.state.revision,
    changes:result.changes,
    items:appItems(input,result.state.items),
  };
}

export function applyCommonPlayItemAttunement(input:{
  ownerId:string;revision:number;items:ItemInstanceVm[];itemId:string;
  action:"attune"|"unattune";shortRestCompleted?:boolean;maximum:number;
  facts?:Parameters<typeof resolveCommonPlayAttunement>[1]["facts"];curseRemoved?:boolean;
}) {
  const result=resolveCommonPlayAttunement({ownerId:input.ownerId,revision:input.revision,items:input.items.map((item)=>commonItem(item,input.ownerId))},{
    expectedRevision:input.revision,itemId:input.itemId,action:input.action,
    shortRestCompleted:input.shortRestCompleted,maximum:input.maximum,facts:input.facts,curseRemoved:input.curseRemoved,
  });
  if(result.status==="rejected") throw new Error(result.error);
  return {revision:result.state.revision,changes:result.changes,items:appItems(input,result.state.items)};
}

export function applyCommonPlayItemAttunementLoss(input:{
  ownerId:string;revision:number;items:ItemInstanceVm[];itemId:string;
  ownerDead?:boolean;distanceFeet?:number;elapsedSeconds?:number;
}) {
  const result=resolveCommonPlayAttunementLoss({ownerId:input.ownerId,revision:input.revision,items:input.items.map((item)=>commonItem(item,input.ownerId))},{
    expectedRevision:input.revision,itemId:input.itemId,ownerDead:input.ownerDead,distanceFeet:input.distanceFeet,elapsedSeconds:input.elapsedSeconds,
  });
  if(result.status==="rejected") throw new Error(result.error);
  return {revision:result.state.revision,changes:result.changes,items:appItems(input,result.state.items)};
}
