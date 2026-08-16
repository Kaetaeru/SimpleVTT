import "./creationContracts";
import type {
  AbilityKey,
  AbilityMethod,
  AbilityRollSlot,
  AbilityScores,
  CharacterCreateDraft,
  CharacterSheet,
} from "./contracts";

export type CharacterCreationAuthoringCompleteness = "explicit" | "legacy-reconstructed";

export interface CharacterCreationAuthoringSourceV1 {
  completeness:CharacterCreationAuthoringCompleteness;
  abilityMethod:AbilityMethod;
  abilities:AbilityScores;
  rolledPool:AbilityRollSlot[];
  rolledAssignments:Partial<Record<AbilityKey,string>>;
  selectedSkills:string[];
  selectedSpells:string[];
  selectedClassChoices:string[];
  equipmentPreset:string;
  backgroundEquipmentPreset:string;
  overrides:{ hp?:number; ac?:number; speed?:number };
}

const cp = <T,>(value:T):T => structuredClone(value);

export function projectExplicitCreationAuthoringSourceV1(draft:CharacterCreateDraft):CharacterCreationAuthoringSourceV1 {
  return cp({
    completeness:"explicit",
    abilityMethod:draft.abilityMethod,
    abilities:draft.abilities,
    rolledPool:draft.rolledPool,
    rolledAssignments:draft.rolledAssignments,
    selectedSkills:draft.selectedSkills,
    selectedSpells:draft.selectedSpells,
    selectedClassChoices:draft.selectedClassChoices ?? [],
    equipmentPreset:draft.equipmentPreset,
    backgroundEquipmentPreset:draft.backgroundEquipmentPreset ?? "",
    overrides:draft.overrides,
  });
}

export function reconstructLegacyCreationAuthoringSourceV1(sheet:CharacterSheet):CharacterCreationAuthoringSourceV1 {
  return {
    completeness:"legacy-reconstructed",
    abilityMethod:"custom",
    abilities:cp(sheet.abilities),
    rolledPool:[],
    rolledAssignments:{},
    selectedSkills:[],
    selectedSpells:[],
    selectedClassChoices:[],
    equipmentPreset:"",
    backgroundEquipmentPreset:"",
    overrides:{},
  };
}

export function applyCreationAuthoringSourceV1(
  draft:CharacterCreateDraft,
  source:CharacterCreationAuthoringSourceV1,
) {
  draft.authoringSourceCompleteness=source.completeness;
  draft.abilityMethod=source.abilityMethod;
  draft.abilities=cp(source.abilities);
  draft.rolledPool=cp(source.rolledPool);
  draft.rolledAssignments=cp(source.rolledAssignments);
  draft.selectedSkills=cp(source.selectedSkills);
  draft.selectedSpells=cp(source.selectedSpells);
  draft.selectedClassChoices=cp(source.selectedClassChoices);
  draft.equipmentPreset=source.equipmentPreset;
  draft.backgroundEquipmentPreset=source.backgroundEquipmentPreset;
  draft.overrides=cp(source.overrides);
  return draft;
}

declare module "./contracts" {
  interface CharacterSheet {
    creationAuthoringSource?:CharacterCreationAuthoringSourceV1;
  }

  interface CharacterCreateDraft {
    authoringSourceCompleteness?:CharacterCreationAuthoringCompleteness;
  }
}

export {};
