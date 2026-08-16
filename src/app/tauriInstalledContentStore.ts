import { invoke } from "@tauri-apps/api/core";
import type { InstalledContentStore, InstalledContentStoredGeneration } from "./installedContentContracts";
import { MemoryInstalledContentStore } from "./memoryInstalledContentStore";
import { isTauriCharacterLibraryRuntime } from "./tauriCharacterLibraryStore";

interface WriteInstalledContentGenerationRequest {
  expectedGeneration:number;
  nextGeneration:number;
  payload:string;
}

export class TauriInstalledContentStore implements InstalledContentStore {
  readonly durability="durable" as const;

  async readGenerations():Promise<InstalledContentStoredGeneration[]> {
    return invoke<InstalledContentStoredGeneration[]>("read_installed_content_generations");
  }

  async writeGeneration(expectedGeneration:number,nextGeneration:number,payload:string):Promise<void> {
    const request:WriteInstalledContentGenerationRequest={expectedGeneration,nextGeneration,payload};
    await invoke("write_installed_content_generation",{request});
  }
}

export function createPlatformInstalledContentStore():InstalledContentStore {
  return isTauriCharacterLibraryRuntime()
    ? new TauriInstalledContentStore()
    : new MemoryInstalledContentStore();
}
