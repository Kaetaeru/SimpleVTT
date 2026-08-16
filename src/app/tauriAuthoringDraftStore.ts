import { invoke } from "@tauri-apps/api/core";
import type { AuthoringDraftStore, AuthoringDraftStoredGeneration } from "./authoringDraftContracts";
import { MemoryAuthoringDraftStore } from "./memoryAuthoringDraftStore";
import { isTauriCharacterLibraryRuntime } from "./tauriCharacterLibraryStore";

interface WriteAuthoringDraftGenerationRequest {
  expectedGeneration:number;
  nextGeneration:number;
  payload:string;
}

export class TauriAuthoringDraftStore implements AuthoringDraftStore {
  readonly durability = "durable" as const;

  async readGenerations():Promise<AuthoringDraftStoredGeneration[]> {
    return invoke<AuthoringDraftStoredGeneration[]>("read_authoring_draft_generations");
  }

  async writeGeneration(expectedGeneration:number,nextGeneration:number,payload:string):Promise<void> {
    const request:WriteAuthoringDraftGenerationRequest = { expectedGeneration,nextGeneration,payload };
    await invoke("write_authoring_draft_generation",{ request });
  }
}

export function createPlatformAuthoringDraftStore():AuthoringDraftStore {
  return isTauriCharacterLibraryRuntime()
    ? new TauriAuthoringDraftStore()
    : new MemoryAuthoringDraftStore();
}
