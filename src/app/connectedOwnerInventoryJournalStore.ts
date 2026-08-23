import { invoke } from "@tauri-apps/api/core";
import type { DmInventoryAdjustmentCommand, SessionCharacterInventoryVm } from "./contracts";
import { isTauriCharacterLibraryRuntime } from "./tauriCharacterLibraryStore";

export type ConnectedOwnerInventoryJournalPhase="prepared"|"applied"|"undoing"|"undone"|"finalized";
export type ConnectedOwnerInventoryFinalOutcome="applied"|"undone";

export interface ConnectedOwnerInventoryJournalRecord {
  version:1;
  requestId:string;
  actorId:string;
  phase:ConnectedOwnerInventoryJournalPhase;
  command:DmInventoryAdjustmentCommand;
  before:SessionCharacterInventoryVm;
  after?:SessionCharacterInventoryVm;
  beforeUndo?:SessionCharacterInventoryVm;
  afterUndo?:SessionCharacterInventoryVm;
  finalOutcome?:ConnectedOwnerInventoryFinalOutcome;
}

export interface PrepareConnectedOwnerInventoryJournalRequest {
  requestId:string;
  actorId:string;
  command:DmInventoryAdjustmentCommand;
  before:SessionCharacterInventoryVm;
}

export interface ConnectedOwnerInventoryJournalStore {
  readonly durability:"durable"|"volatile";
  read(requestId:string):Promise<ConnectedOwnerInventoryJournalRecord|null>;
  prepare(request:PrepareConnectedOwnerInventoryJournalRequest):Promise<ConnectedOwnerInventoryJournalRecord>;
  markApplied(requestId:string,after:SessionCharacterInventoryVm):Promise<ConnectedOwnerInventoryJournalRecord>;
  beginUndo(requestId:string,beforeUndo:SessionCharacterInventoryVm,afterUndo:SessionCharacterInventoryVm):Promise<ConnectedOwnerInventoryJournalRecord>;
  markUndone(requestId:string):Promise<ConnectedOwnerInventoryJournalRecord>;
  finalize(requestId:string,outcome:ConnectedOwnerInventoryFinalOutcome):Promise<ConnectedOwnerInventoryJournalRecord>;
}

const cp=<T,>(value:T):T=>structuredClone(value);
const required=(value:string,label:string)=>{const normalized=value.trim();if(!normalized)throw new Error(`${label} is required`);return normalized;};

function same(left:unknown,right:unknown){return JSON.stringify(left)===JSON.stringify(right);}

export class MemoryConnectedOwnerInventoryJournalStore implements ConnectedOwnerInventoryJournalStore {
  readonly durability="volatile" as const;
  private readonly records=new Map<string,ConnectedOwnerInventoryJournalRecord>();

  async read(requestId:string){return cp(this.records.get(required(requestId,"owner inventory requestId"))??null);}

  async prepare(request:PrepareConnectedOwnerInventoryJournalRequest){
    const requestId=required(request.requestId,"owner inventory requestId");
    const actorId=required(request.actorId,"owner inventory actorId");
    const existing=this.records.get(requestId);
    if(existing){
      if(existing.actorId!==actorId||!same(existing.command,request.command)||!same(existing.before,request.before))throw new Error("owner inventory requestId already has a different journal");
      return cp(existing);
    }
    const record:ConnectedOwnerInventoryJournalRecord={version:1,requestId,actorId,phase:"prepared",command:cp(request.command),before:cp(request.before)};
    this.records.set(requestId,record);return cp(record);
  }

  async markApplied(requestId:string,after:SessionCharacterInventoryVm){
    const record=this.records.get(required(requestId,"owner inventory requestId"));if(!record)throw new Error("owner inventory journal is missing");
    if(record.phase==="undone")throw new Error("undone owner inventory transaction cannot become applied");
    if(record.after&&!same(record.after,after))throw new Error("owner inventory applied marker already has different data");
    record.after=cp(after);if(record.phase!=="finalized")record.phase="applied";return cp(record);
  }

  async beginUndo(requestId:string,beforeUndo:SessionCharacterInventoryVm,afterUndo:SessionCharacterInventoryVm){
    const record=this.records.get(required(requestId,"owner inventory requestId"));if(!record)throw new Error("owner inventory journal is missing");
    if(record.phase==="finalized")throw new Error("finalized owner inventory transaction cannot begin undo");
    if(record.beforeUndo&&(!same(record.beforeUndo,beforeUndo)||!same(record.afterUndo,afterUndo)))throw new Error("owner inventory undoing marker already has different data");
    record.beforeUndo=cp(beforeUndo);record.afterUndo=cp(afterUndo);if(record.phase!=="undone")record.phase="undoing";return cp(record);
  }

  async markUndone(requestId:string){
    const record=this.records.get(required(requestId,"owner inventory requestId"));if(!record)throw new Error("owner inventory journal is missing");
    if(record.phase!=="finalized")record.phase="undone";return cp(record);
  }

  async finalize(requestId:string,outcome:ConnectedOwnerInventoryFinalOutcome){
    const record=this.records.get(required(requestId,"owner inventory requestId"));if(!record)throw new Error("owner inventory journal is missing");
    if(record.phase==="prepared"||record.phase==="undoing")throw new Error("owner inventory transaction is not settled and cannot be finalized");
    const settled=record.phase==="finalized"?record.finalOutcome:record.phase;
    if(settled!==outcome)throw new Error("owner inventory finalization outcome does not match journal phase");
    if(record.finalOutcome&&record.finalOutcome!==outcome)throw new Error("owner inventory transaction was finalized with a different outcome");
    record.phase="finalized";record.finalOutcome=outcome;return cp(record);
  }
}

export class TauriConnectedOwnerInventoryJournalStore implements ConnectedOwnerInventoryJournalStore {
  readonly durability="durable" as const;
  async read(requestId:string){return invoke<ConnectedOwnerInventoryJournalRecord|null>("read_connected_owner_inventory_journal",{request:{requestId}});}
  async prepare(request:PrepareConnectedOwnerInventoryJournalRequest){return invoke<ConnectedOwnerInventoryJournalRecord>("prepare_connected_owner_inventory_journal",{request});}
  async markApplied(requestId:string,after:SessionCharacterInventoryVm){return invoke<ConnectedOwnerInventoryJournalRecord>("mark_connected_owner_inventory_applied",{request:{requestId,after}});}
  async beginUndo(requestId:string,beforeUndo:SessionCharacterInventoryVm,afterUndo:SessionCharacterInventoryVm){return invoke<ConnectedOwnerInventoryJournalRecord>("begin_connected_owner_inventory_undo",{request:{requestId,beforeUndo,afterUndo}});}
  async markUndone(requestId:string){return invoke<ConnectedOwnerInventoryJournalRecord>("mark_connected_owner_inventory_undone",{request:{requestId}});}
  async finalize(requestId:string,outcome:ConnectedOwnerInventoryFinalOutcome){return invoke<ConnectedOwnerInventoryJournalRecord>("finalize_connected_owner_inventory_journal",{request:{requestId,outcome}});}
}

export function createConnectedOwnerInventoryJournalStore():ConnectedOwnerInventoryJournalStore {
  return isTauriCharacterLibraryRuntime()?new TauriConnectedOwnerInventoryJournalStore():new MemoryConnectedOwnerInventoryJournalStore();
}
