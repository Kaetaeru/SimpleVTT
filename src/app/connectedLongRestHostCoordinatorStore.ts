import { invoke } from "@tauri-apps/api/core";
import type { ConnectedLongRestCommitPreflight } from "./connectedLongRestPreflight";
import { isTauriCharacterLibraryRuntime } from "./tauriCharacterLibraryStore";

export type ConnectedLongRestHostDurablePhase="owner-prepared"|"committed"|"aborted";

export interface ConnectedLongRestHostDurableRecord {
  version:1;
  phase:ConnectedLongRestHostDurablePhase;
  preflight:ConnectedLongRestCommitPreflight;
  preparationId:string;
  campaignCommitId?:string;
  reason?:string;
}

export interface ConnectedLongRestHostCoordinatorStore {
  readonly durability:"durable"|"volatile";
  readAll():Promise<ConnectedLongRestHostDurableRecord[]>;
  write(record:ConnectedLongRestHostDurableRecord):Promise<void>;
  delete(transactionId:string):Promise<void>;
}

type StoredDto={transactionId:string;payload:string};

function required(value:string,label:string){
  const normalized=value.trim();
  if(!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function revision(value:number,label:string){
  if(!Number.isInteger(value)||value<0) throw new Error(`${label} must be a non-negative integer`);
  return value;
}

export function normalizeConnectedLongRestHostRecord(record:ConnectedLongRestHostDurableRecord):ConnectedLongRestHostDurableRecord {
  const preflight=record.preflight;
  const normalized:ConnectedLongRestHostDurableRecord={
    version:1,
    phase:record.phase,
    preflight:{
      transactionId:required(preflight.transactionId,"connected Long Rest Host transactionId"),
      sessionId:required(preflight.sessionId,"connected Long Rest Host sessionId"),
      campaignId:required(preflight.campaignId,"connected Long Rest Host campaignId"),
      expectedCampaignRevision:revision(preflight.expectedCampaignRevision,"connected Long Rest Host Campaign revision"),
      ownerParticipantId:required(preflight.ownerParticipantId,"connected Long Rest Host ownerParticipantId"),
      character:{
        characterId:required(preflight.character.characterId,"connected Long Rest Host Character id"),
        sourceRevision:revision(preflight.character.sourceRevision,"connected Long Rest Host Character source revision"),
        runtimeRevision:revision(preflight.character.runtimeRevision,"connected Long Rest Host Character runtime revision"),
      },
      options:{
        advanceMinutes:revision(preflight.options.advanceMinutes,"connected Long Rest Host advanceMinutes"),
        consumeRations:Boolean(preflight.options.consumeRations),
      },
    },
    preparationId:required(record.preparationId,"connected Long Rest Host preparationId"),
  };
  if(record.phase==="committed") normalized.campaignCommitId=required(record.campaignCommitId??"","connected Long Rest Host campaignCommitId");
  if(record.phase==="aborted") normalized.reason=required(record.reason??"","connected Long Rest Host abort reason");
  return normalized;
}

function decode(payload:string):ConnectedLongRestHostDurableRecord {
  const value=JSON.parse(payload) as ConnectedLongRestHostDurableRecord;
  if(value?.version!==1||!["owner-prepared","committed","aborted"].includes(String(value?.phase))) {
    throw new Error("unsupported connected Long Rest Host coordinator record");
  }
  return normalizeConnectedLongRestHostRecord(value);
}

export class MemoryConnectedLongRestHostCoordinatorStore implements ConnectedLongRestHostCoordinatorStore {
  readonly durability="volatile" as const;
  private readonly records=new Map<string,ConnectedLongRestHostDurableRecord>();

  async readAll(){return [...this.records.values()].map((record)=>structuredClone(record));}
  async write(record:ConnectedLongRestHostDurableRecord){
    const normalized=normalizeConnectedLongRestHostRecord(record);
    this.records.set(normalized.preflight.transactionId,structuredClone(normalized));
  }
  async delete(transactionId:string){this.records.delete(required(transactionId,"connected Long Rest Host transactionId"));}
}

export class TauriConnectedLongRestHostCoordinatorStore implements ConnectedLongRestHostCoordinatorStore {
  readonly durability="durable" as const;

  async readAll(){
    const records=await invoke<StoredDto[]>("read_connected_long_rest_host_records");
    return records.map((record)=>{
      const decoded=decode(record.payload);
      if(decoded.preflight.transactionId!==record.transactionId) throw new Error("connected Long Rest Host record transaction identity mismatch");
      return decoded;
    });
  }

  async write(record:ConnectedLongRestHostDurableRecord){
    const normalized=normalizeConnectedLongRestHostRecord(record);
    await invoke("write_connected_long_rest_host_record",{
      request:{transactionId:normalized.preflight.transactionId,payload:JSON.stringify(normalized)},
    });
  }

  async delete(transactionId:string){
    await invoke("delete_connected_long_rest_host_record",{request:{transactionId:required(transactionId,"connected Long Rest Host transactionId")}});
  }
}

export function createConnectedLongRestHostCoordinatorStore():ConnectedLongRestHostCoordinatorStore {
  return isTauriCharacterLibraryRuntime()
    ?new TauriConnectedLongRestHostCoordinatorStore()
    :new MemoryConnectedLongRestHostCoordinatorStore();
}
