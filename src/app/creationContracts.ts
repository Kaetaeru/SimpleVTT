import "./contracts";
import type { AbilityScores } from "./contracts";

declare module "./contracts" {
  interface CharacterCreateDraft {
    choiceSelections?: Record<string, string[]>;
    backgroundEquipmentPreset?: string;
    finalAbilities?: AbilityScores;
    goldGp?: number;
  }

  interface CharacterCreationSection {
    selection?: {
      choiceId: string;
      count: number;
    };
  }

  interface CharacterDraftCommand {
    choiceId?: string;
  }

  interface CharacterSheet {
    size?: string;
    languages?: string[];
    toolProficiencies?: string[];
    cantrips?: string[];
    preparedSpells?: string[];
    spellbookSpells?: string[];
    masteryWeapons?: string[];
    goldGp?: number;
    creationSelections?: Record<string, string[]>;
  }
}

export {};
