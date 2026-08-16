import { invoke } from "@tauri-apps/api/core";
import type { CharacterLibraryStore, CharacterLibraryStoredGeneration } from "./persistenceContracts";
import { MemoryCharacterLibraryStore } from "./memoryCharacterLibraryStore";

interface WriteCharacterLibraryGenerationRequest {
  expectedGeneration:number;
  nextGeneration:number;
  payload:string;
}

export class TauriCharacterLibraryStore implements CharacterLibraryStore {
  readonly durability = "durable" as const;

  async readGenerations():Promise<CharacterLibraryStoredGeneration[]> {
    return invoke<CharacterLibraryStoredGeneration[]>("read_character_library_generations");
  }

  async writeGeneration(expectedGeneration:number,nextGeneration:number,payload:string):Promise<void> {
    const request:WriteCharacterLibraryGenerationRequest = { expectedGeneration,nextGeneration,payload };
    await invoke("write_character_library_generation",{ request });
  }
}

export function isTauriCharacterLibraryRuntime() {
  const root = globalThis as typeof globalThis & { __TAURI_INTERNALS__?:unknown };
  return root.__TAURI_INTERNALS__ !== undefined;
}

export function createPlatformCharacterLibraryStore():CharacterLibraryStore {
  return isTauriCharacterLibraryRuntime()
    ? new TauriCharacterLibraryStore()
    : new MemoryCharacterLibraryStore();
}
