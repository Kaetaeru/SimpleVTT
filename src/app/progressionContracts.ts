import "./contracts";
import type { ChoiceSelectionMap } from "../domain/choiceDefinition";
import type { ProgressionClassTrack, ProgressionPlan } from "../domain/progression";
import type { CircleLandType } from "../domain/druidCircleLandRecovery";

declare module "./contracts" {
  interface CharacterResourceVm {
    recovery?: {
      shortRest?: number | "all";
      longRest?: number | "all";
      turnStart?: number | "all";
    };
    recoveryLockouts?: {
      shortRest?: number;
      longRest?: number;
    };
  }

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
    spellMasterySpellIds?: Record<number, string>;
    spellMasterySources?: Record<number, string>;
    signatureSpellIds?: string[];
    signatureSpellSources?: Record<string, string>;
    metamagicIds?: string[];
    metamagicSources?: Record<string, string>;
    eldritchInvocationIds?: string[];
    eldritchInvocationSources?: Record<string, string>;
    mysticArcanumSpellIds?: Record<number, string>;
    mysticArcanumSources?: Record<number, string>;
    persistentFeatureOptionIds?: string[];
    persistentFeatureOptionSources?: Record<string, string>;
    epicBoonFeatIds?:string[];
    epicBoonFeatSources?:Record<string,string>;
    subclassIds?: Record<string, string>;
    subclassSources?: Record<string, string>;
    circleLandType?:CircleLandType;
    circleLandCantripIds?:string[];
    circleLandPreparedSpellIds?:string[];
    circleLandSpellSources?:Record<string,string>;
    pactTomeCantripIds?: string[];
    pactTomeRitualSpellIds?: string[];
    pactTomeSpellSources?: Record<string, string>;
    pactMagicSlotLevel?: number;
    pactMagicSlotMaximum?: number;
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
