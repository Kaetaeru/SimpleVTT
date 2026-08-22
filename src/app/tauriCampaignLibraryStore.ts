import { invoke } from "@tauri-apps/api/core";
import type { CampaignLibraryStore, CampaignStoredGeneration } from "./campaignPersistenceContracts";
import { MemoryCampaignLibraryStore } from "./memoryCampaignLibraryStore";
import { isTauriCharacterLibraryRuntime } from "./tauriCharacterLibraryStore";

interface WriteCampaignLibraryGenerationRequest {
  expectedGeneration:number;
  nextGeneration:number;
  payload:string;
}

export class TauriCampaignLibraryStore implements CampaignLibraryStore {
  readonly durability="durable" as const;
  async readGenerations():Promise<CampaignStoredGeneration[]> {
    return invoke<CampaignStoredGeneration[]>("read_campaign_library_generations");
  }
  async writeGeneration(expectedGeneration:number,nextGeneration:number,payload:string):Promise<void> {
    const request:WriteCampaignLibraryGenerationRequest={expectedGeneration,nextGeneration,payload};
    await invoke("write_campaign_library_generation",{request});
  }
}

export function createPlatformCampaignLibraryStore():CampaignLibraryStore {
  return isTauriCharacterLibraryRuntime()
    ? new TauriCampaignLibraryStore()
    : new MemoryCampaignLibraryStore();
}
