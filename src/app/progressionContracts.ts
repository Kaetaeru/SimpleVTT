import "./contracts";
import type { ChoiceSelectionMap } from "../domain/choiceDefinition";
import type { ProgressionClassTrack, ProgressionPlan } from "../domain/progression";

declare module "./contracts" {
  interface CharacterSheet {
    classLevels?: ProgressionClassTrack[];
    hitDiceByDie?: Record<string, number>;
    progressionRevision?: number;
    expertiseSkills?: string[];
    expertiseSources?: Record<string, string>;
    languageSources?: Record<string, string>;
    cantripSources?: Record<string, string>;
    preparedSpellSources?: Record<string, string>;
    spellbookSpellSources?: Record<string, string>;
    metamagicIds?: string[];
    metamagicSources?: Record<string, string>;
    spellSlotMaximums?: Record<number, number>;
  }

  interface LevelUpDraft {
    targetClassId?: string;
    progressionSelections?: ChoiceSelectionMap;
    hpRoll?: number;
  }

  interface AppSnapshot {
    progressionPlan?: ProgressionPlan | null;
  }
}

export {};
