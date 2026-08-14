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
