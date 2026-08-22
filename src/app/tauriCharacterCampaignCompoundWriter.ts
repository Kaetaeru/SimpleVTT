import { invoke } from "@tauri-apps/api/core";
import type {
  CharacterCampaignCompoundWrite,
  CharacterCampaignCompoundWriter,
} from "./characterCampaignCompoundPersistence";

export class TauriCharacterCampaignCompoundWriter implements CharacterCampaignCompoundWriter {
  async write(request:CharacterCampaignCompoundWrite):Promise<void> {
    await invoke("write_character_campaign_compound",{ request });
  }
}
