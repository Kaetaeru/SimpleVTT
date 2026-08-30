import {
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
    ...(item.attunementRequired?{attunement:{required:true,...(item.attuned?{attunedTo:ownerId}:{})}}:{}),
    grantedEntryPointIds:[...item.grantedActionIds],
  };
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
  const appItems=new Map([...input.items,...(input.templates??[])].map((item)=>[item.id,item]));
  return {
    revision:result.state.revision,
    changes:result.changes,
    items:result.state.items.map((item)=>{
      const source=appItems.get(item.id);
      if(!source) throw new Error(`inventory item presentation is missing: ${item.id}`);
      return {
        ...structuredClone(source),quantity:item.quantity,equipped:item.equipped,wielded:item.wielded,
        ...(item.wieldSlot?{wieldSlot:item.wieldSlot}:{wieldSlot:undefined}),
        ...(item.charges?{charges:{current:item.charges.current,max:item.charges.maximum}}:{}),
        ...(item.attunement?{attunementRequired:item.attunement.required,attuned:item.attunement.attunedTo===input.ownerId}:{}),
      };
    }),
  };
}

