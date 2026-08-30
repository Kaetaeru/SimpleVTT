import { invoke } from "@tauri-apps/api/core";
import type { TurnRuntimeSessionStore, TurnRuntimeSessionStoredGeneration } from "./turnRuntimeSessionPersistence";
import { MemoryTurnRuntimeSessionStore } from "./memoryTurnRuntimeSessionStore";
import { isTauriCharacterLibraryRuntime } from "./tauriCharacterLibraryStore";

interface WriteTurnRuntimeSessionGenerationRequest {
  expectedGeneration:number;
  nextGeneration:number;
  payload:string;
}

export class TauriTurnRuntimeSessionStore implements TurnRuntimeSessionStore {
  readonly durability="durable" as const;

  async readGenerations():Promise<TurnRuntimeSessionStoredGeneration[]> {
    return invoke<TurnRuntimeSessionStoredGeneration[]>("read_turn_runtime_session_generations");
  }

  async writeGeneration(expectedGeneration:number,nextGeneration:number,payload:string):Promise<void> {
    const request:WriteTurnRuntimeSessionGenerationRequest={expectedGeneration,nextGeneration,payload};
    await invoke("write_turn_runtime_session_generation",{request});
  }
}

export function createPlatformTurnRuntimeSessionStore():TurnRuntimeSessionStore {
  return isTauriCharacterLibraryRuntime()
    ? new TauriTurnRuntimeSessionStore()
    : new MemoryTurnRuntimeSessionStore();
}
