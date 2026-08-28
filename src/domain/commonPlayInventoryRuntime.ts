import { DomainEvaluationError, evaluateSemanticPredicate, type SemanticPredicate, type SemanticValue } from "./profileEngine";

export interface CommonPlayItemInstance {
  id:string;
  definitionId:string;
  quantity:number;
  stackable:boolean;
  equipped:boolean;
  wielded:boolean;
  wieldSlot?:"main-hand"|"off-hand"|"two-hand";
  charges?:{current:number;maximum:number};
  attunement?:{
    required:boolean;
    attunedTo?:string;
    prerequisite?:SemanticPredicate;
    cursed?:boolean;
    loss?:{onDeath?:boolean;maximumDistanceFeet?:number;durationSeconds?:number};
  };
  grantedEntryPointIds?:string[];
  effectDefinitionIds?:string[];
  spellDefinitionIds?:string[];
  containerId?:string;
}

export interface CommonPlayInventoryState {
  ownerId:string;
  revision:number;
  items:CommonPlayItemInstance[];
}

export type CommonPlayInventoryOperation=
  | {kind:"grant";item:CommonPlayItemInstance}
  | {kind:"quantity";itemId:string;delta:number;removeAtZero?:boolean}
  | {kind:"destroy";itemId:string;force?:boolean}
  | {kind:"equip";itemId:string;equipped:boolean}
  | {kind:"wield";itemId:string;wielded:boolean;slot?:"main-hand"|"off-hand"|"two-hand"}
  | {kind:"charges";itemId:string;delta:number};

export type CommonPlayInventoryResult=
  | {status:"committed";state:CommonPlayInventoryState;changes:string[]}
  | {status:"rejected";state:CommonPlayInventoryState;error:string};

function validateItem(item:CommonPlayItemInstance) {
  if(!item.id||!item.definitionId||!Number.isInteger(item.quantity)||item.quantity<1) throw new DomainEvaluationError("item identity and positive integer quantity are required");
  if(item.charges&&(!Number.isInteger(item.charges.current)||!Number.isInteger(item.charges.maximum)||item.charges.current<0||item.charges.maximum<0||item.charges.current>item.charges.maximum)) throw new DomainEvaluationError("item charges are invalid");
  if(item.wielded&&!item.equipped) throw new DomainEvaluationError("a wielded item must be equipped");
  if(item.wielded&&!item.wieldSlot) throw new DomainEvaluationError("a wielded item requires a wield slot");
  if(item.attunement?.attunedTo&&!item.attunement.required) throw new DomainEvaluationError("only attunement-required items can have an attuned owner");
}

function validateInventory(state:CommonPlayInventoryState) {
  if(!state.ownerId||!Number.isInteger(state.revision)||state.revision<0) throw new DomainEvaluationError("inventory owner and non-negative revision are required");
  if(new Set(state.items.map((item)=>item.id)).size!==state.items.length) throw new DomainEvaluationError("inventory item instance identities must be unique");
  state.items.forEach(validateItem);
  const byId=new Map(state.items.map((item)=>[item.id,item]));
  for(const entry of state.items) {
    if(entry.containerId&&!byId.has(entry.containerId)) throw new DomainEvaluationError(`item container not found: ${entry.containerId}`);
    const seen=new Set([entry.id]);let current=entry;
    while(current.containerId) {
      if(seen.has(current.containerId)) throw new DomainEvaluationError("item containers cannot form a cycle");
      seen.add(current.containerId);current=byId.get(current.containerId)!;
    }
  }
}

function item(state:CommonPlayInventoryState,itemId:string) {
  const found=state.items.find((entry)=>entry.id===itemId);
  if(!found) throw new DomainEvaluationError(`inventory item not found: ${itemId}`);
  return found;
}

export function resolveCommonPlayInventoryTransaction(
  input:CommonPlayInventoryState,
  request:{expectedRevision:number;operations:CommonPlayInventoryOperation[]},
):CommonPlayInventoryResult {
  try {
    if(request.expectedRevision!==input.revision) throw new DomainEvaluationError(`inventory revision mismatch: expected ${request.expectedRevision}, current ${input.revision}`);
    if(!request.operations.length) throw new DomainEvaluationError("inventory transaction requires at least one operation");
    validateInventory(input);
    const state=structuredClone(input);const changes:string[]=[];
    for(const operation of request.operations) {
      if(operation.kind==="grant") {
        validateItem(operation.item);
        if(state.items.some((entry)=>entry.id===operation.item.id)) throw new DomainEvaluationError(`duplicate item instance id: ${operation.item.id}`);
        state.items.push(structuredClone(operation.item));changes.push(`granted ${operation.item.id} x${operation.item.quantity}`);continue;
      }
      const current=item(state,operation.itemId);
      if(operation.kind==="quantity") {
        if(!Number.isInteger(operation.delta)||operation.delta===0) throw new DomainEvaluationError("item quantity delta must be a non-zero integer");
        const next=current.quantity+operation.delta;
        if(next<0||(next===0&&operation.removeAtZero!==true)) throw new DomainEvaluationError("item quantity cannot fall below one without explicit removal");
        if(next===0) state.items=state.items.filter((entry)=>entry.id!==current.id); else current.quantity=next;
        changes.push(`${current.id} quantity ${current.quantity-operation.delta} -> ${next}`);continue;
      }
      if(operation.kind==="destroy") {
        if((current.equipped||current.wielded||current.attunement?.attunedTo)&&operation.force!==true) throw new DomainEvaluationError("equipped, wielded, or attuned item requires explicit forced destruction");
        state.items=state.items.filter((entry)=>entry.id!==current.id);changes.push(`destroyed ${current.id}`);continue;
      }
      if(operation.kind==="equip") {
        current.equipped=operation.equipped;if(!operation.equipped){current.wielded=false;delete current.wieldSlot;}changes.push(`${current.id} equipped=${operation.equipped}`);continue;
      }
      if(operation.kind==="wield") {
        if(operation.wielded&&!current.equipped) throw new DomainEvaluationError("item must be equipped before wielding");
        if(operation.wielded&&!operation.slot) throw new DomainEvaluationError("wielding requires a slot");
        current.wielded=operation.wielded;
        if(operation.wielded) current.wieldSlot=operation.slot; else delete current.wieldSlot;
        changes.push(`${current.id} wielded=${operation.wielded}`);continue;
      }
      if(!current.charges) throw new DomainEvaluationError(`item has no charges: ${current.id}`);
      if(!Number.isInteger(operation.delta)||operation.delta===0) throw new DomainEvaluationError("charge delta must be a non-zero integer");
      const next=current.charges.current+operation.delta;
      if(next<0||next>current.charges.maximum) throw new DomainEvaluationError("item charges exceed available bounds");
      current.charges.current=next;changes.push(`${current.id} charges ${next-operation.delta} -> ${next}`);
    }
    validateInventory(state);state.revision+=1;
    return {status:"committed",state,changes};
  } catch(error) { return {status:"rejected",state:input,error:error instanceof Error?error.message:String(error)}; }
}

export function resolveCommonPlayItemTransfer(
  source:CommonPlayInventoryState,target:CommonPlayInventoryState,
  request:{sourceRevision:number;targetRevision:number;itemId:string;quantity:number;newItemId:string},
) {
  try {
    if(source.ownerId===target.ownerId) throw new DomainEvaluationError("item transfer requires distinct owners");
    if(request.sourceRevision!==source.revision||request.targetRevision!==target.revision) throw new DomainEvaluationError("item transfer revision mismatch");
    if(!Number.isInteger(request.quantity)||request.quantity<1) throw new DomainEvaluationError("item transfer quantity must be positive");
    validateInventory(source);validateInventory(target);const existing=item(source,request.itemId);validateItem(existing);
    if(existing.quantity<request.quantity) throw new DomainEvaluationError("item transfer exceeds source quantity");
    if(!existing.stackable&&request.quantity!==existing.quantity) throw new DomainEvaluationError("non-stackable item instances cannot be split");
    if(target.items.some((entry)=>entry.id===request.newItemId)) throw new DomainEvaluationError("item transfer target instance id already exists");
    const from=structuredClone(source);const to=structuredClone(target);const moving=item(from,request.itemId);
    moving.quantity-=request.quantity;if(moving.quantity===0) from.items=from.items.filter((entry)=>entry.id!==moving.id);
    const transferred={...structuredClone(existing),id:request.newItemId,quantity:request.quantity,equipped:false,wielded:false};
    delete transferred.wieldSlot;
    if(transferred.attunement) delete transferred.attunement.attunedTo;
    to.items.push(transferred);validateInventory(from);validateInventory(to);from.revision+=1;to.revision+=1;
    return {status:"committed" as const,source:from,target:to,item:transferred};
  } catch(error) { return {status:"rejected" as const,source,target,error:error instanceof Error?error.message:String(error)}; }
}

export function resolveCommonPlayAttunement(
  input:CommonPlayInventoryState,
  request:{expectedRevision:number;itemId:string;action:"attune"|"unattune";shortRestCompleted?:boolean;maximum:number;facts?:Record<string,SemanticValue>;curseRemoved?:boolean},
):CommonPlayInventoryResult {
  try {
    if(request.expectedRevision!==input.revision) throw new DomainEvaluationError("attunement inventory revision mismatch");
    if(!Number.isInteger(request.maximum)||request.maximum<0) throw new DomainEvaluationError("attunement maximum must be a non-negative integer");
    const state=structuredClone(input);const current=item(state,request.itemId);const policy=current.attunement;
    if(!policy?.required) throw new DomainEvaluationError("item does not require attunement");
    if(request.action==="attune") {
      if(request.shortRestCompleted!==true) throw new DomainEvaluationError("attunement requires a completed Short Rest process");
      if(policy.attunedTo&&policy.attunedTo!==state.ownerId) throw new DomainEvaluationError("item is exclusively attuned to another owner");
      if(policy.prerequisite&&!evaluateSemanticPredicate(policy.prerequisite,(ref)=>request.facts?.[ref])) throw new DomainEvaluationError("attunement prerequisite is not satisfied");
      const count=state.items.filter((entry)=>entry.attunement?.attunedTo===state.ownerId&&entry.id!==current.id).length;
      if(count>=request.maximum) throw new DomainEvaluationError("attunement maximum is reached");
      policy.attunedTo=state.ownerId;
    } else {
      if(policy.cursed&&request.curseRemoved!==true) throw new DomainEvaluationError("cursed item cannot be unattuned until its curse is removed");
      delete policy.attunedTo;
    }
    state.revision+=1;return {status:"committed",state,changes:[`${current.id} ${request.action}`]};
  } catch(error) { return {status:"rejected",state:input,error:error instanceof Error?error.message:String(error)}; }
}

export function commonPlayItemBenefitsActive(inventory:CommonPlayInventoryState,itemId:string) {
  const current=item(inventory,itemId);
  return current.attunement?.required!==true||current.attunement.attunedTo===inventory.ownerId;
}

export function resolveCommonPlayAttunementLoss(
  input:CommonPlayInventoryState,
  request:{expectedRevision:number;itemId:string;ownerDead?:boolean;distanceFeet?:number;elapsedSeconds?:number},
):CommonPlayInventoryResult {
  try {
    if(request.expectedRevision!==input.revision) throw new DomainEvaluationError("attunement loss revision mismatch");
    const state=structuredClone(input);const current=item(state,request.itemId);const loss=current.attunement?.loss;
    if(!current.attunement?.attunedTo||!loss) return {status:"committed",state,changes:[]};
    const lost=(loss.onDeath===true&&request.ownerDead===true)
      ||(loss.maximumDistanceFeet!==undefined&&request.distanceFeet!==undefined&&request.distanceFeet>loss.maximumDistanceFeet)
      ||(loss.durationSeconds!==undefined&&request.elapsedSeconds!==undefined&&request.elapsedSeconds>=loss.durationSeconds);
    if(!lost) return {status:"committed",state,changes:[]};
    delete current.attunement.attunedTo;state.revision+=1;
    return {status:"committed",state,changes:[`${current.id} attunement lost`]};
  } catch(error) { return {status:"rejected",state:input,error:error instanceof Error?error.message:String(error)}; }
}
