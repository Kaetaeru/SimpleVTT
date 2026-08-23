import { invoke } from "@tauri-apps/api/core";
import type { PartyStashTransferCommand } from "./contracts";
import type { MockAdapter } from "./mockAdapter";
import { isTauriCharacterLibraryRuntime } from "./tauriCharacterLibraryStore";

export interface ConnectedPartyStashHostCoordinatorRecord {
  version:1;
  requestId:string;
  campaignId:string;
  actorId:string;
  ownerParticipantId:string;
  command:PartyStashTransferCommand;
}

export interface ConnectedPartyStashHostCoordinatorStore {
  readonly durability:"durable"|"volatile";
  readAll():Promise<ConnectedPartyStashHostCoordinatorRecord[]>;
  write(record:ConnectedPartyStashHostCoordinatorRecord):Promise<void>;
  delete(requestId:string):Promise<void>;
}

type StoredDto={requestId:string;payload:string};
const stores=new WeakMap<MockAdapter,ConnectedPartyStashHostCoordinatorStore>();
const cp=<T,>(value:T):T=>structuredClone(value);
const required=(value:string,label:string)=>{const normalized=value.trim();if(!normalized)throw new Error(`${label} is required`);return normalized;};

export function normalizeConnectedPartyStashHostCoordinatorRecord(record:ConnectedPartyStashHostCoordinatorRecord):ConnectedPartyStashHostCoordinatorRecord {
  const requestId=required(record.requestId,"Party Stash Host requestId");
  const campaignId=required(record.campaignId,"Party Stash Host campaignId");
  const actorId=required(record.actorId,"Party Stash Host actorId");
  const ownerParticipantId=required(record.ownerParticipantId,"Party Stash Host ownerParticipantId");
  const command=cp(record.command);
  if(command.requestId!==requestId||command.campaignId!==campaignId||command.actorId!==actorId)throw new Error("Party Stash Host coordinator identity does not match command");
  if(command.direction!=="character-to-stash"&&command.direction!=="stash-to-character")throw new Error("Party Stash Host coordinator direction is invalid");
  if(command.asset!=="item"&&command.asset!=="currency")throw new Error("Party Stash Host coordinator asset is invalid");
  return {version:1,requestId,campaignId,actorId,ownerParticipantId,command};
}

function decode(payload:string){
  const value=JSON.parse(payload) as ConnectedPartyStashHostCoordinatorRecord;
  if(value?.version!==1)throw new Error("unsupported Party Stash Host coordinator record");
  return normalizeConnectedPartyStashHostCoordinatorRecord(value);
}

export class MemoryConnectedPartyStashHostCoordinatorStore implements ConnectedPartyStashHostCoordinatorStore {
  readonly durability="volatile" as const;
  private readonly records=new Map<string,ConnectedPartyStashHostCoordinatorRecord>();
  async readAll(){return [...this.records.values()].map(cp);}
  async write(record:ConnectedPartyStashHostCoordinatorRecord){
    const normalized=normalizeConnectedPartyStashHostCoordinatorRecord(record);
    const existing=this.records.get(normalized.requestId);
    if(existing&&JSON.stringify(existing)!==JSON.stringify(normalized))throw new Error("Party Stash Host requestId already has a different coordinator record");
    this.records.set(normalized.requestId,cp(normalized));
  }
  async delete(requestId:string){this.records.delete(required(requestId,"Party Stash Host requestId"));}
}

export class TauriConnectedPartyStashHostCoordinatorStore implements ConnectedPartyStashHostCoordinatorStore {
  readonly durability="durable" as const;
  async readAll(){
    const records=await invoke<StoredDto[]>("read_connected_party_stash_host_records");
    return records.map((entry)=>{
      const record=decode(entry.payload);
      if(record.requestId!==entry.requestId)throw new Error("Party Stash Host stored request identity mismatch");
      return record;
    });
  }
  async write(record:ConnectedPartyStashHostCoordinatorRecord){
    const normalized=normalizeConnectedPartyStashHostCoordinatorRecord(record);
    await invoke("write_connected_party_stash_host_record",{request:{requestId:normalized.requestId,payload:JSON.stringify(normalized)}});
  }
  async delete(requestId:string){await invoke("delete_connected_party_stash_host_record",{request:{requestId:required(requestId,"Party Stash Host requestId")}});}
}

export function createConnectedPartyStashHostCoordinatorStore():ConnectedPartyStashHostCoordinatorStore {
  return isTauriCharacterLibraryRuntime()?new TauriConnectedPartyStashHostCoordinatorStore():new MemoryConnectedPartyStashHostCoordinatorStore();
}

export function connectedPartyStashHostCoordinatorStoreFor(adapter:MockAdapter){
  let store=stores.get(adapter);
  if(!store){store=createConnectedPartyStashHostCoordinatorStore();stores.set(adapter,store);}
  return store;
}

export function setConnectedPartyStashHostCoordinatorStoreForTests(adapter:MockAdapter,store:ConnectedPartyStashHostCoordinatorStore){stores.set(adapter,store);}
