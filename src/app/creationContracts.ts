import "./contracts";
import type { AbilityScores } from "./contracts";

export interface CharacterSheetTraitVm {
  id: string;
  name: string;
  source: "class" | "species" | "feat" | "background" | "other";
  sourceLabel: string;
  description?: string;
  detailLines?: string[];
}

export interface CharacterSheetSpellVm {
  id: string;
  name: string;
  nameEn?: string;
  level: number;
  prepared: boolean;
  alwaysPrepared?: boolean;
  description?: string;
  detailLines?: string[];
}

declare module "./contracts" {
  interface CharacterCreateDraft {
    choiceSelections?: Record<string, string[]>;
    backgroundEquipmentPreset?: string;
    finalAbilities?: AbilityScores;
    goldGp?: number;
  }

  interface CharacterCreationOptionVm {
    description?: string;
    detailLines?: string[];
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
    notes?: string;
    classFeatures?: CharacterSheetTraitVm[];
    speciesTraits?: CharacterSheetTraitVm[];
    feats?: CharacterSheetTraitVm[];
    otherTraits?: CharacterSheetTraitVm[];
    spellEntries?: CharacterSheetSpellVm[];
  }
}

export {};
