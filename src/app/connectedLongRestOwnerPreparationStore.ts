import { invoke } from "@tauri-apps/api/core";
import type { PreparedGenerationWrite } from "./characterCampaignCompoundPersistence";
import { MemoryCharacterLibraryStore } from "./memoryCharacterLibraryStore";
import { isTauriCharacterLibraryRuntime } from "./tauriCharacterLibraryStore";

export type ConnectedLongRestOwnerPreparationPhase = "prepared"|"materialized"|"aborted";

export interface ConnectedLongRestOwnerPreparationRequest {
  transactionId:string;
  preparationId:string;
  write:PreparedGenerationWrite;
}

export interface ConnectedLongRestOwnerPreparationIdentity {
  transactionId:string;
  preparationId:string;
}

export interface ConnectedLongRestOwnerPreparationResult {
  transactionId:string;
  preparationId:string;
  phase:ConnectedLongRestOwnerPreparationPhase;
  expectedGeneration:number;
  nextGeneration:number;
}

export interface ConnectedLongRestOwnerPreparationStore {
  readonly durability:"durable"|"volatile";
  prepare(request:ConnectedLongRestOwnerPreparationRequest):Promise<ConnectedLongRestOwnerPreparationResult>;
  materialize(request:ConnectedLongRestOwnerPreparationIdentity):Promise<ConnectedLongRestOwnerPreparationResult>;
  abort(request:ConnectedLongRestOwnerPreparationIdentity):Promise<ConnectedLongRestOwnerPreparationResult>;
}

type MemoryMarker={
  request:ConnectedLongRestOwnerPreparationRequest;
  phase:ConnectedLongRestOwnerPreparationPhase;
};

function required(value:string,label:string) {
  const normalized=value.trim();
  if(!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function sameWrite(left:PreparedGenerationWrite,right:PreparedGenerationWrite) {
  return left.expectedGeneration===right.expectedGeneration
    &&left.nextGeneration===right.nextGeneration
    &&left.payload===right.payload;
}

function result(marker:MemoryMarker):ConnectedLongRestOwnerPreparationResult {
  return {
    transactionId:marker.request.transactionId,
    preparationId:marker.request.preparationId,
    phase:marker.phase,
    expectedGeneration:marker.request.write.expectedGeneration,
    nextGeneration:marker.request.write.nextGeneration,
  };
}

/** Volatile reference implementation used by browser/dev deterministic tests. */
export class MemoryConnectedLongRestOwnerPreparationStore implements ConnectedLongRestOwnerPreparationStore {
  readonly durability="volatile" as const;
  private readonly markers=new Map<string,MemoryMarker>();

  constructor(private readonly characterStore:MemoryCharacterLibraryStore){}

  async prepare(request:ConnectedLongRestOwnerPreparationRequest) {
    const transactionId=required(request.transactionId,"connected Long Rest transactionId");
    const preparationId=required(request.preparationId,"connected Long Rest preparationId");
    const normalized={transactionId,preparationId,write:structuredClone(request.write)};
    const existing=this.markers.get(transactionId);
    if(existing){
      if(existing.request.preparationId!==preparationId||!sameWrite(existing.request.write,normalized.write)) {
        throw new Error("connected Long Rest transaction already has a different Character preparation");
      }
      return result(existing);
    }
    this.characterStore.preflightCompoundWrite(normalized.write);
    const marker:MemoryMarker={request:normalized,phase:"prepared"};
    this.markers.set(transactionId,marker);
    return result(marker);
  }

  async materialize(identity:ConnectedLongRestOwnerPreparationIdentity) {
    const transactionId=required(identity.transactionId,"connected Long Rest transactionId");
    const preparationId=required(identity.preparationId,"connected Long Rest preparationId");
    const marker=this.markers.get(transactionId);
    if(!marker) throw new Error("connected Long Rest Character preparation is missing");
    if(marker.request.preparationId!==preparationId) throw new Error("connected Long Rest Character preparation identity mismatch");
    if(marker.phase==="aborted") throw new Error("aborted connected Long Rest Character preparation cannot be materialized");
    if(marker.phase==="materialized") return result(marker);
    this.characterStore.preflightCompoundWrite(marker.request.write);
    this.characterStore.applyPreflightedCompoundWrite(marker.request.write);
    marker.phase="materialized";
    return result(marker);
  }

  async abort(identity:ConnectedLongRestOwnerPreparationIdentity) {
    const transactionId=required(identity.transactionId,"connected Long Rest transactionId");
    const preparationId=required(identity.preparationId,"connected Long Rest preparationId");
    const marker=this.markers.get(transactionId);
    if(!marker) throw new Error("connected Long Rest Character preparation is missing");
    if(marker.request.preparationId!==preparationId) throw new Error("connected Long Rest Character preparation identity mismatch");
    if(marker.phase==="materialized") throw new Error("materialized connected Long Rest Character preparation cannot be aborted");
    marker.phase="aborted";
    return result(marker);
  }
}

export class TauriConnectedLongRestOwnerPreparationStore implements ConnectedLongRestOwnerPreparationStore {
  readonly durability="durable" as const;

  prepare(request:ConnectedLongRestOwnerPreparationRequest) {
    return invoke<ConnectedLongRestOwnerPreparationResult>("prepare_connected_long_rest_character_generation",{request});
  }

  materialize(request:ConnectedLongRestOwnerPreparationIdentity) {
    return invoke<ConnectedLongRestOwnerPreparationResult>("materialize_connected_long_rest_character_generation",{request});
  }

  abort(request:ConnectedLongRestOwnerPreparationIdentity) {
    return invoke<ConnectedLongRestOwnerPreparationResult>("abort_connected_long_rest_character_generation",{request});
  }
}

export function createConnectedLongRestOwnerPreparationStore(characterStore:MemoryCharacterLibraryStore):ConnectedLongRestOwnerPreparationStore {
  return isTauriCharacterLibraryRuntime()
    ? new TauriConnectedLongRestOwnerPreparationStore()
    : new MemoryConnectedLongRestOwnerPreparationStore(characterStore);
}
