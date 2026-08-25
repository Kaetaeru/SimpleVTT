import type { AppSnapshot, CatalogEntry, DmInventoryAdjustmentCommand, ItemInstanceVm, PartyStashTransferCommand, SessionCharacterInventoryVm } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { connectedStateFor } from "./connectedSessionState";
import { projectedCharacterById } from "./characterSessionProjectionRegistry";
import { mutateActiveCharacterDurably } from "./characterLibraryRuntimeAdapter";
import { refreshSessionCharacterInventoryProjection } from "./sessionInventoryRuntimeAdapter";
import { tauriSessionTransport, type SessionTransportMessage } from "./tauriSessionTransport";
import {
  createConnectedOwnerInventoryJournalStore,
  type ConnectedOwnerInventoryFinalOutcome,
  type ConnectedOwnerInventoryJournalRecord,
  type ConnectedOwnerInventoryJournalStore,
} from "./connectedOwnerInventoryJournalStore";

interface OwnerInventoryFinalizeRequest {type:"campaign-owner-inventory-finalize";sessionId:string;requestId:string;actorId:string;outcome:ConnectedOwnerInventoryFinalOutcome;}
interface OwnerInventoryFinalizeResult {type:"campaign-owner-inventory-finalize-result";sessionId:string;requestId:string;actorId:string;outcome:ConnectedOwnerInventoryFinalOutcome;accepted:boolean;error?:string;}
type Raw=Record<string,unknown>;
type HostOwnerMutation={peer:string;actorId:string;outcome?:ConnectedOwnerInventoryFinalOutcome};

const cp=<T,>(value:T):T=>structuredClone(value);
const stores=new WeakMap<MockAdapter,ConnectedOwnerInventoryJournalStore>();
const hostMutations=new WeakMap<MockAdapter,Map<string,HostOwnerMutation>>();
const lastHostRequestByActor=new WeakMap<MockAdapter,Map<string,string>>();
const deferHostFinalize=new WeakMap<MockAdapter,number>();
const pendingFinalize=new WeakMap<MockAdapter,Map<string,{peer:string;resolve():void;reject(error:Error):void;timer:ReturnType<typeof setTimeout>}>>();
const ownerApplyInFlight=new WeakMap<MockAdapter,Map<string,{command:DmInventoryAdjustmentCommand;promise:Promise<AppSnapshot>}>>();
const stashTransferInFlight=new WeakMap<MockAdapter,Map<string,{command:PartyStashTransferCommand;promise:Promise<AppSnapshot>}>>();
let activeHostAdapter:MockAdapter|null=null;
let registeringClientAdapter:MockAdapter|null=null;

function object(value:unknown):Raw|undefined{return value&&typeof value==="object"&&!Array.isArray(value)?value as Raw:undefined;}
function canonical(value:unknown):unknown{if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value as Raw).sort(([left],[right])=>left.localeCompare(right)).map(([key,item])=>[key,canonical(item)]));return value;}
function sameCommand(left:DmInventoryAdjustmentCommand,right:DmInventoryAdjustmentCommand){return JSON.stringify(canonical(left))===JSON.stringify(canonical(right));}
function storeFor(adapter:MockAdapter){let store=stores.get(adapter);if(!store){store=createConnectedOwnerInventoryJournalStore();stores.set(adapter,store);}return store;}
function ownerApplyMap(adapter:MockAdapter){let map=ownerApplyInFlight.get(adapter);if(!map){map=new Map();ownerApplyInFlight.set(adapter,map);}return map;}
function stashTransferMap(adapter:MockAdapter){let map=stashTransferInFlight.get(adapter);if(!map){map=new Map();stashTransferInFlight.set(adapter,map);}return map;}
export function setConnectedOwnerInventoryJournalStoreForTests(adapter:MockAdapter,store:ConnectedOwnerInventoryJournalStore){stores.set(adapter,store);}

function inventory(snapshot:AppSnapshot,actorId:string):SessionCharacterInventoryVm{
  const projected=snapshot.sessionCharacterInventories?.[actorId];
  if(projected)return cp(projected);
  if(snapshot.activeCharacter.id!==actorId)throw new Error(`owner inventory Character is not available: ${actorId}`);
  return {characterId:actorId,characterName:snapshot.activeCharacter.name,revision:snapshot.activeCharacter.runtimeRevision??0,goldGp:snapshot.activeCharacter.goldGp??0,items:cp(snapshot.activeCharacter.items)};
}
function itemSort(items:ItemInstanceVm[]){return [...items].sort((a,b)=>a.id.localeCompare(b.id));}
function inventoryCore(value:SessionCharacterInventoryVm){return {characterId:value.characterId,goldGp:value.goldGp,items:itemSort(value.items)};}
function sameInventory(left:SessionCharacterInventoryVm,right:SessionCharacterInventoryVm){return JSON.stringify(canonical(inventoryCore(left)))===JSON.stringify(canonical(inventoryCore(right)));}
function sameItem(left:ItemInstanceVm,right:ItemInstanceVm){return JSON.stringify(canonical(left))===JSON.stringify(canonical(right));}
function sameItems(left:ItemInstanceVm[],right:ItemInstanceVm[]){return JSON.stringify(canonical(itemSort(left)))===JSON.stringify(canonical(itemSort(right)));}
const aliases:Record<string,string>={"item.chain-mail":"dnd.srd521.item.armor.chain-mail","item.shield":"dnd.srd521.item.shield","item.potion-of-healing":"dnd.srd521.item.gear.potion-of-healing"};
function compatibleDefinition(value:string){return aliases[value]??value;}
function definitionFor(command:DmInventoryAdjustmentCommand,catalog:CatalogEntry[]){
  if(command.operation==="grant-item-template")return command.itemTemplate.definitionId;
  if(command.operation!=="grant-item")return undefined;
  const entry=catalog.find((candidate)=>candidate.id===command.catalogEntryId&&candidate.category==="item") as (CatalogEntry&{contentId?:string})|undefined;
  return entry?.contentId?.trim()||entry?.id;
}
function allUnchanged(before:ItemInstanceVm[],current:ItemInstanceVm[],exceptId?:string){
  for(const item of before){if(item.id===exceptId)continue;const now=current.find((candidate)=>candidate.id===item.id);if(!now||!sameItem(now,item))return false;}
  return true;
}
function matchesApplied(before:SessionCharacterInventoryVm,current:SessionCharacterInventoryVm,command:DmInventoryAdjustmentCommand,catalog:CatalogEntry[]){
  if(before.characterId!==current.characterId)return false;
  if(command.operation==="grant-currency"||command.operation==="revoke-currency"){
    const expected=before.goldGp+(command.operation==="grant-currency"?command.amount:-command.amount);
    return current.goldGp===expected&&sameItems(current.items,before.items);
  }
  if(current.goldGp!==before.goldGp)return false;
  if(command.operation==="revoke-item"){
    const source=before.items.find((item)=>item.id===command.itemId);if(!source)return false;
    const now=current.items.find((item)=>item.id===source.id);
    if(source.quantity===command.quantity){if(now)return false;}else{
      if(!now||now.quantity!==source.quantity-command.quantity)return false;
      const expected=cp(source);expected.quantity-=command.quantity;
      if(command.forceUnequip){expected.equipped=false;expected.wielded=false;expected.attuned=false;delete expected.wieldSlot;}
      if(!sameItem(now,expected))return false;
    }
    return current.items.length===before.items.length-(source.quantity===command.quantity?1:0)&&allUnchanged(before.items,current.items,source.id);
  }
  if(command.operation!=="grant-item"&&command.operation!=="grant-item-template")return false;
  const definition=definitionFor(command,catalog);if(!definition)return false;
  const quantity=command.quantity;
  const existing=before.items.find((item)=>compatibleDefinition(item.definitionId)===compatibleDefinition(definition)&&!item.charges&&!item.attunementRequired);
  if(existing){
    const now=current.items.find((item)=>item.id===existing.id);if(!now||now.quantity!==existing.quantity+quantity)return false;
    const expected={...cp(existing),quantity:existing.quantity+quantity};
    return sameItem(now,expected)&&current.items.length===before.items.length&&allUnchanged(before.items,current.items,existing.id);
  }
  const beforeIds=new Set(before.items.map((item)=>item.id));
  const extras=current.items.filter((item)=>!beforeIds.has(item.id));
  return extras.length===1&&compatibleDefinition(extras[0].definitionId)===compatibleDefinition(definition)&&extras[0].quantity===quantity&&!extras[0].equipped&&!extras[0].wielded&&!extras[0].attuned&&current.items.length===before.items.length+1&&allUnchanged(before.items,current.items);
}
function activeState(item:ItemInstanceVm|undefined){return item?{equipped:item.equipped,wielded:item.wielded??false,wieldSlot:item.wieldSlot,attuned:item.attuned??false}:undefined;}
function sameActiveState(left:ItemInstanceVm,right:ItemInstanceVm){return JSON.stringify(activeState(left))===JSON.stringify(activeState(right));}
function restoreActiveState(target:ItemInstanceVm,source:ItemInstanceVm){target.equipped=source.equipped;target.wielded=source.wielded;target.attuned=source.attuned;if(source.wieldSlot)target.wieldSlot=source.wieldSlot;else delete target.wieldSlot;}
function compensate(current:SessionCharacterInventoryVm,record:ConnectedOwnerInventoryJournalRecord){
  if(!record.after)throw new Error("owner inventory applied journal is missing after state");
  const next=cp(current);const goldDelta=record.after.goldGp-record.before.goldGp;
  if(goldDelta>0&&next.goldGp<goldDelta)throw new Error("later currency changes prevent safe owner inventory compensation");
  next.goldGp-=goldDelta;
  const ids=new Set([...record.before.items,...record.after.items].map((item)=>item.id));
  for(const id of ids){
    const beforeItem=record.before.items.find((item)=>item.id===id);const afterItem=record.after.items.find((item)=>item.id===id);
    const delta=(afterItem?.quantity??0)-(beforeItem?.quantity??0);let currentItem=next.items.find((item)=>item.id===id);
    if(delta>0){if(!currentItem||currentItem.quantity<delta)throw new Error("later item changes prevent safe owner inventory compensation");currentItem.quantity-=delta;if(currentItem.quantity===0){next.items=next.items.filter((item)=>item.id!==id);currentItem=undefined;}}
    else if(delta<0){const restore=-delta;if(currentItem)currentItem.quantity+=restore;else if(beforeItem){currentItem={...cp(beforeItem),quantity:restore};next.items.push(currentItem);}}
    if(beforeItem&&afterItem&&!sameActiveState(beforeItem,afterItem)){currentItem=next.items.find((item)=>item.id===id);if(!currentItem||!sameActiveState(currentItem,afterItem))throw new Error("later equipped/attuned changes prevent safe owner inventory compensation");restoreActiveState(currentItem,beforeItem);}
  }
  next.revision=current.revision+1;return next;
}

const baseAdjust=MockAdapter.prototype.adjustDmInventory;
const baseUndo=MockAdapter.prototype.undoDmInventoryAdjustment;
const baseUndoLast=MockAdapter.prototype.undoLastDmInventoryAdjustment;
const baseTransfer=MockAdapter.prototype.transferPartyStash;
const baseGrantLibrary=MockAdapter.prototype.grantCampaignDmLibraryItem;
const baseHostSession=MockAdapter.prototype.hostSession;
const baseJoinSession=MockAdapter.prototype.joinSession;
const baseStopSession=MockAdapter.prototype.stopSession;
const baseOnMessage=tauriSessionTransport.onMessage.bind(tauriSessionTransport);
const baseSendTo=tauriSessionTransport.sendTo.bind(tauriSessionTransport);

async function applyClientJournal(adapter:MockAdapter,command:DmInventoryAdjustmentCommand){
  const store=storeFor(adapter);let snapshot=await adapter.getSnapshot();let current=inventory(snapshot,command.actorId);let record=await store.read(command.requestId);
  if(!record)record=await store.prepare({requestId:command.requestId,actorId:command.actorId,command:cp(command),before:current});
  if(record.actorId!==command.actorId||!sameCommand(record.command,command))throw new Error("owner inventory retry does not match durable journal identity");
  if(record.phase==="finalized"){
    if(record.finalOutcome==="applied")return snapshot;
    throw new Error("owner inventory request was already finalized as undone");
  }
  if(record.phase==="undone"||record.phase==="undoing")throw new Error("owner inventory request is already being or has been undone");
  if(record.phase==="applied")return snapshot;
  if(!sameInventory(current,record.before)){
    if(!matchesApplied(record.before,current,command,snapshot.catalog))throw new Error("owner inventory prepared journal cannot reconcile current Character state");
    await store.markApplied(command.requestId,current);return snapshot;
  }
  await baseAdjust.call(adapter,command);
  snapshot=await adapter.getSnapshot();current=inventory(snapshot,command.actorId);
  await store.markApplied(command.requestId,current);return snapshot;
}

async function writeUndoTarget(adapter:MockAdapter,target:SessionCharacterInventoryVm){
  const snapshot=await adapter.getSnapshot();if(snapshot.activeCharacter.id!==target.characterId)throw new Error("owner inventory compensation requires the active owner Character");
  await mutateActiveCharacterDurably(adapter,(character)=>{character.items=cp(target.items);character.goldGp=target.goldGp;});
  refreshSessionCharacterInventoryProjection(adapter,target);
  return adapter.getSnapshot();
}
async function undoClientJournal(adapter:MockAdapter,requestId:string){
  const store=storeFor(adapter);let record=await store.read(requestId);if(!record)return baseUndo.call(adapter,requestId);
  let snapshot=await adapter.getSnapshot();let current=inventory(snapshot,record.actorId);
  if(record.phase==="finalized"){
    if(record.finalOutcome==="undone")return snapshot;
    throw new Error("finalized applied owner inventory transaction cannot be undone");
  }
  if(record.phase==="undone")return snapshot;
  if(record.phase==="prepared"){
    if(sameInventory(current,record.before)){await store.markUndone(requestId);return snapshot;}
    if(!matchesApplied(record.before,current,record.command,snapshot.catalog))throw new Error("owner inventory prepared journal cannot determine whether apply committed");
    record=await store.markApplied(requestId,current);
  }
  if(record.phase==="applied"){
    const target=compensate(current,record);record=await store.beginUndo(requestId,current,target);
  }
  if(record.phase!=="undoing"||!record.beforeUndo||!record.afterUndo)throw new Error("owner inventory undo journal is incomplete");
  snapshot=await adapter.getSnapshot();current=inventory(snapshot,record.actorId);
  if(sameInventory(current,record.afterUndo)){await store.markUndone(requestId);return snapshot;}
  if(!sameInventory(current,record.beforeUndo))throw new Error("owner inventory changed during restart-safe compensation");
  await baseUndo.call(adapter,requestId);
  snapshot=await adapter.getSnapshot();current=inventory(snapshot,record.actorId);
  if(!sameInventory(current,record.afterUndo)){
    if(!sameInventory(current,record.beforeUndo))throw new Error("owner inventory compensation produced an unexpected Character state");
    snapshot=await writeUndoTarget(adapter,record.afterUndo);current=inventory(snapshot,record.actorId);
    if(!sameInventory(current,record.afterUndo))throw new Error("owner inventory durable compensation did not reach the journal target");
  }
  await store.markUndone(requestId);return snapshot;
}

function hostRoute(adapter:MockAdapter,actorId:string){const state=connectedStateFor(adapter);if(state.mode!=="host"||!state.sessionId)return null;const mounted=projectedCharacterById(adapter,actorId);if(!mounted)return null;const manifest=state.peerManifests.get(mounted.peerId)?.character;if(manifest?.characterId!==actorId)return null;return {peer:mounted.peerId,actorId};}
function hostMap(adapter:MockAdapter){let map=hostMutations.get(adapter);if(!map){map=new Map();hostMutations.set(adapter,map);}return map;}
function actorRequestMap(adapter:MockAdapter){let map=lastHostRequestByActor.get(adapter);if(!map){map=new Map();lastHostRequestByActor.set(adapter,map);}return map;}
function defer(adapter:MockAdapter,delta:number){const value=Math.max(0,(deferHostFinalize.get(adapter)??0)+delta);deferHostFinalize.set(adapter,value);return value;}
function finalizeKey(requestId:string,outcome:ConnectedOwnerInventoryFinalOutcome){return `${requestId}:${outcome}`;}
function decodeFinalizeRequest(raw:string):OwnerInventoryFinalizeRequest|null{try{const value=object(JSON.parse(raw));if(value?.type!=="campaign-owner-inventory-finalize"||typeof value.sessionId!=="string"||typeof value.requestId!=="string"||typeof value.actorId!=="string"||(value.outcome!=="applied"&&value.outcome!=="undone"))return null;return value as unknown as OwnerInventoryFinalizeRequest;}catch{return null;}}
function decodeFinalizeResult(raw:string):OwnerInventoryFinalizeResult|null{try{const value=object(JSON.parse(raw));if(value?.type!=="campaign-owner-inventory-finalize-result"||typeof value.sessionId!=="string"||typeof value.requestId!=="string"||typeof value.actorId!=="string"||(value.outcome!=="applied"&&value.outcome!=="undone")||typeof value.accepted!=="boolean"||(value.error!==undefined&&typeof value.error!=="string"))return null;return value as unknown as OwnerInventoryFinalizeResult;}catch{return null;}}
async function finalizeLocal(adapter:MockAdapter,requestId:string,outcome:ConnectedOwnerInventoryFinalOutcome){const record=await storeFor(adapter).read(requestId);if(!record)return;if(record.phase==="finalized"){if(record.finalOutcome!==outcome)throw new Error("owner inventory journal finalized with a different outcome");return;}await storeFor(adapter).finalize(requestId,outcome);}
async function sendFinalize(adapter:MockAdapter,requestId:string,mutation:HostOwnerMutation){
  const state=connectedStateFor(adapter);if(state.mode!=="host"||!state.sessionId||!mutation.outcome)throw new Error("owner inventory finalize requires a settled Host transaction");
  const key=finalizeKey(requestId,mutation.outcome);let map=pendingFinalize.get(adapter);if(!map){map=new Map();pendingFinalize.set(adapter,map);}
  const wait=new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{map!.delete(key);reject(new Error("원격 Character 인벤토리 finalize 응답 시간이 초과되었습니다."));},8000);map!.set(key,{peer:mutation.peer,resolve,reject,timer});});
  try{await baseSendTo(mutation.peer,JSON.stringify({type:"campaign-owner-inventory-finalize",sessionId:state.sessionId,requestId,actorId:mutation.actorId,outcome:mutation.outcome} satisfies OwnerInventoryFinalizeRequest));await wait;hostMap(adapter).delete(requestId);}
  catch(error){const pending=map.get(key);if(pending){clearTimeout(pending.timer);map.delete(key);}throw error;}
}
async function handleFinalizeClient(adapter:MockAdapter,peer:string,request:OwnerInventoryFinalizeRequest){let error:string|undefined;try{const state=connectedStateFor(adapter);const snapshot=await adapter.getSnapshot();if(state.mode!=="client"||state.sessionId!==request.sessionId)throw new Error("세션이 일치하지 않습니다.");if(snapshot.activeCharacter.id!==request.actorId)throw new Error("finalize 대상 Character가 owner active Character와 다릅니다.");await finalizeLocal(adapter,request.requestId,request.outcome);}catch(cause){error=cause instanceof Error?cause.message:String(cause);}await baseSendTo(peer,JSON.stringify({type:"campaign-owner-inventory-finalize-result",sessionId:request.sessionId,requestId:request.requestId,actorId:request.actorId,outcome:request.outcome,accepted:!error,...(error?{error}:{})} satisfies OwnerInventoryFinalizeResult));}
function settleFinalizeHost(adapter:MockAdapter,message:SessionTransportMessage,result:OwnerInventoryFinalizeResult){const state=connectedStateFor(adapter);if(state.sessionId!==result.sessionId)return;const key=finalizeKey(result.requestId,result.outcome);const pending=pendingFinalize.get(adapter)?.get(key);if(!pending||pending.peer!==message.peer)return;clearTimeout(pending.timer);pendingFinalize.get(adapter)?.delete(key);if(result.accepted)pending.resolve();else pending.reject(new Error(result.error||"owner inventory finalize was rejected"));}

tauriSessionTransport.onMessage=async function onMessageWithOwnerInventoryJournal(handler:(message:SessionTransportMessage)=>void){const client=registeringClientAdapter;return baseOnMessage((message)=>{const finalizeRequest=decodeFinalizeRequest(message.message);if(client&&finalizeRequest){void handleFinalizeClient(client,message.peer,finalizeRequest);return;}const finalizeResult=decodeFinalizeResult(message.message);if(activeHostAdapter&&finalizeResult){settleFinalizeHost(activeHostAdapter,message,finalizeResult);return;}handler(message);});};
MockAdapter.prototype.hostSession=async function hostSessionWithOwnerInventoryJournal(){activeHostAdapter=this;return baseHostSession.call(this);};
MockAdapter.prototype.joinSession=async function joinSessionWithOwnerInventoryJournal(address:string){registeringClientAdapter=this;try{return await baseJoinSession.call(this,address);}finally{registeringClientAdapter=null;}};

async function adjustDmInventoryWithOwnerJournal(adapter:MockAdapter,command:DmInventoryAdjustmentCommand){
  const state=connectedStateFor(adapter);
  if(state.mode==="client")return applyClientJournal(adapter,command);
  if(state.mode!=="host")return baseAdjust.call(adapter,command);
  const route=hostRoute(adapter,command.actorId);if(!route)return baseAdjust.call(adapter,command);
  const previousRequestId=actorRequestMap(adapter).get(command.actorId);
  const previousMutation=previousRequestId&&previousRequestId!==command.requestId?hostMap(adapter).get(previousRequestId):undefined;
  if(previousRequestId&&previousMutation?.outcome)await sendFinalize(adapter,previousRequestId,previousMutation);
  const result=await baseAdjust.call(adapter,command);const mutation={...route,outcome:"applied" as const};hostMap(adapter).set(command.requestId,mutation);actorRequestMap(adapter).set(command.actorId,command.requestId);
  // A direct DM grant/revoke remains compensatable while it is the latest UI
  // operation for this Character. Compound Stash/Library callers finalize it
  // explicitly after their other owner commits settle; a later direct command
  // finalizes the previous one above.
  return result;
}
MockAdapter.prototype.adjustDmInventory=function adjustDmInventoryWithOwnerJournalSingleFlight(command:DmInventoryAdjustmentCommand){
  const map=ownerApplyMap(this);const existing=map.get(command.requestId);
  if(existing){
    if(!sameCommand(existing.command,command))return Promise.reject(new Error("owner inventory in-flight requestId does not match command identity"));
    return existing.promise;
  }
  const promise=adjustDmInventoryWithOwnerJournal(this,command).finally(()=>{if(map.get(command.requestId)?.promise===promise)map.delete(command.requestId);});
  map.set(command.requestId,{command:cp(command),promise});
  return promise;
};
MockAdapter.prototype.undoDmInventoryAdjustment=async function undoDmInventoryWithOwnerJournal(requestId:string){
  const state=connectedStateFor(this);
  if(state.mode==="client")return undoClientJournal(this,requestId);
  const known=hostMap(this).get(requestId);const result=await baseUndo.call(this,requestId);
  if(state.mode==="host"&&known){known.outcome="undone";hostMap(this).set(requestId,known);if((deferHostFinalize.get(this)??0)===0)await sendFinalize(this,requestId,known);}
  return result;
};
MockAdapter.prototype.undoLastDmInventoryAdjustment=async function undoLastDmInventoryWithOwnerJournal(){const state=connectedStateFor(this);if(state.mode==="client"){const snapshot=await this.getSnapshot();const actorId=snapshot.activeCharacter.id;const requestId=actorRequestMap(this).get(actorId);return requestId?this.undoDmInventoryAdjustment(requestId):baseUndoLast.call(this);}return baseUndoLast.call(this);};

async function transferPartyStashWithOwnerJournal(adapter:MockAdapter,command:PartyStashTransferCommand){
  const state=connectedStateFor(adapter);
  if(state.mode==="host"){
    defer(adapter,1);try{
      const result=await baseTransfer.call(adapter,command);
      const mutation=hostMap(adapter).get(command.requestId);
      // At this point both the owner Character and Campaign Stash commits are
      // durable. Finalization only retires recovery metadata; a lost/failing
      // finalize acknowledgement must not report the completed transfer as a
      // failure or trigger a Client rollback that mints/duplicates assets.
      if(mutation?.outcome)await sendFinalize(adapter,command.requestId,mutation).catch(()=>undefined);
      return result;
    }
    catch(error){const mutation=hostMap(adapter).get(command.requestId);if(mutation?.outcome==="undone")await sendFinalize(adapter,command.requestId,mutation).catch(()=>undefined);throw error;}finally{defer(adapter,-1);}
  }
  if(state.mode==="client"){
    let result:AppSnapshot;
    try{result=await baseTransfer.call(adapter,command);}
    catch(error){let record=await storeFor(adapter).read(command.requestId);if(record&&record.phase!=="undone"&&record.phase!=="finalized"){await undoClientJournal(adapter,command.requestId).catch(()=>undefined);record=await storeFor(adapter).read(command.requestId);}if(record?.phase==="undone")await finalizeLocal(adapter,command.requestId,"undone").catch(()=>undefined);throw error;}
    // baseTransfer returning means the Host Campaign mutation is already
    // durable. Journal finalization is recovery metadata and must never turn a
    // committed deposit into a Client rollback (which would duplicate assets).
    const record=await storeFor(adapter).read(command.requestId).catch(()=>null);
    if(record?.phase==="applied")await finalizeLocal(adapter,command.requestId,"applied").catch(()=>undefined);
    return result;
  }
  return baseTransfer.call(adapter,command);
}
MockAdapter.prototype.transferPartyStash=function transferPartyStashWithOwnerJournalSingleFlight(command:PartyStashTransferCommand){
  const map=stashTransferMap(this);const existing=map.get(command.requestId);
  if(existing){
    if(JSON.stringify(canonical(existing.command))!==JSON.stringify(canonical(command)))return Promise.reject(new Error("Party Stash in-flight requestId does not match command identity"));
    return existing.promise;
  }
  const promise=transferPartyStashWithOwnerJournal(this,command).finally(()=>{if(map.get(command.requestId)?.promise===promise)map.delete(command.requestId);});
  map.set(command.requestId,{command:cp(command),promise});
  return promise;
};

MockAdapter.prototype.grantCampaignDmLibraryItem=async function grantCampaignDmLibraryItemWithOwnerJournal(campaignId,entryId,target,quantity){
  if(target.kind!=="character"||connectedStateFor(this).mode!=="host")return baseGrantLibrary.call(this,campaignId,entryId,target,quantity);
  const beforeRequest=actorRequestMap(this).get(target.actorId);defer(this,1);
  try{const result=await baseGrantLibrary.call(this,campaignId,entryId,target,quantity);const requestId=actorRequestMap(this).get(target.actorId);if(requestId&&requestId!==beforeRequest){const mutation=hostMap(this).get(requestId);if(mutation?.outcome)await sendFinalize(this,requestId,mutation);}return result;}
  catch(error){const requestId=actorRequestMap(this).get(target.actorId);if(requestId&&requestId!==beforeRequest){const mutation=hostMap(this).get(requestId);if(mutation?.outcome==="applied"){await this.undoDmInventoryAdjustment(requestId).catch(()=>undefined);}const settled=hostMap(this).get(requestId);if(settled?.outcome==="undone")await sendFinalize(this,requestId,settled).catch(()=>undefined);}throw error;}
  finally{defer(this,-1);}
};

MockAdapter.prototype.stopSession=async function stopSessionWithOwnerInventoryJournal(){
  if(connectedStateFor(this).mode==="host"){
    for(const [requestId,mutation] of hostMap(this))if(mutation.outcome)await sendFinalize(this,requestId,mutation).catch(()=>undefined);
  }
  const result=await baseStopSession.call(this);if(activeHostAdapter===this)activeHostAdapter=null;if(registeringClientAdapter===this)registeringClientAdapter=null;pendingFinalize.delete(this);hostMutations.delete(this);lastHostRequestByActor.delete(this);deferHostFinalize.delete(this);ownerApplyInFlight.delete(this);stashTransferInFlight.delete(this);return result;
};

export {};
