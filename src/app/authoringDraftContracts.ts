import "./creationContracts";
import "./progressionContracts";
import type {
  AbilityKey,
  AbilityMethod,
  AbilityRollSlot,
  AbilityScores,
  CharacterCreateDraft,
  LevelUpDraft,
} from "./contracts";
import type { ChoiceSelectionMap } from "../domain/choiceDefinition";

export const AUTHORING_DRAFT_SCHEMA_ID = "simplevtt.authoring-drafts" as const;
export const AUTHORING_DRAFT_SCHEMA_VERSION = 1 as const;

export interface CreationDraftIntentV1 {
  draftId:string;
  editingCharacterId?:string;
  editingBaseSourceRevision?:number;
  baseCharacterIds:string[];
  step:number;
  activeSectionId?:string;
  mode:CharacterCreateDraft["mode"];
  rulesProfileId:string;
  name:string;
  className:string;
  subclassName:string;
  species:string;
  background:string;
  level:number;
  abilityMethod:AbilityMethod;
  abilities:AbilityScores;
  rolledPool:AbilityRollSlot[];
  rolledAssignments:Partial<Record<AbilityKey,string>>;
  selectedSkills:string[];
  selectedSpells:string[];
  selectedClassChoices?:string[];
  equipmentPreset:string;
  backgroundEquipmentPreset?:string;
  notes:string;
  overrides:{hp?:number;ac?:number;speed?:number};
  choiceSelections:Record<string,string[]>;
}

export interface ProgressionDraftIntentV1 {
  characterId:string;
  baseSourceRevision:number;
  step:number;
  targetClassId?:string;
  hpMethod:LevelUpDraft["hpMethod"];
  hpRoll?:number;
  progressionSelections:ChoiceSelectionMap;
}

export interface AuthoringDraftDocumentV1 {
  schemaId:typeof AUTHORING_DRAFT_SCHEMA_ID;
  schemaVersion:typeof AUTHORING_DRAFT_SCHEMA_VERSION;
  storageRevision:number;
  creation:CreationDraftIntentV1|null;
  progression:ProgressionDraftIntentV1|null;
}

export interface AuthoringDraftStoredGeneration {
  generation:number;
  payload:string|null;
  readError?:string;
}

export interface AuthoringDraftStore {
  readonly durability:"durable"|"volatile";
  readGenerations():Promise<AuthoringDraftStoredGeneration[]>;
  writeGeneration(expectedGeneration:number,nextGeneration:number,payload:string):Promise<void>;
}
