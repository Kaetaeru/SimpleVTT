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
  selectedClassChoices:string[];
  equipmentPreset:string;
  backgroundEquipmentPreset:string;
  choiceSelections:Record<string,string[]>;
  notes:string;
  overrides:{ hp?:number; ac?:number; speed?:number };
}

const cp = <T,>(value:T):T => structuredClone(value);

export function projectExplicitCreationAuthoringSourceV1(draft:CharacterCreateDraft):CharacterCreationAuthoringSourceV1 {
  return cp({
    completeness:"explicit",
    rulesProfileId:draft.rulesProfileId,
    name:draft.name,
    className:draft.className,
    subclassName:draft.subclassName,
    species:draft.species,
    background:draft.background,
    level:draft.level,
    abilityMethod:draft.abilityMethod,
    abilities:draft.abilities,
    rolledPool:draft.rolledPool,
    rolledAssignments:draft.rolledAssignments,
    selectedSkills:draft.selectedSkills,
    selectedSpells:draft.selectedSpells,
    selectedClassChoices:draft.selectedClassChoices ?? [],
    equipmentPreset:draft.equipmentPreset,
    backgroundEquipmentPreset:draft.backgroundEquipmentPreset ?? "",
    choiceSelections:draft.choiceSelections ?? {},
    notes:draft.notes,
    overrides:draft.overrides,
  });
}

export function reconstructLegacyCreationAuthoringSourceV1(sheet:CharacterSheet):CharacterCreationAuthoringSourceV1 {
  return {
    completeness:"legacy-reconstructed",
    rulesProfileId:sheet.rulesProfileId ?? "dnd.srd-5.2.1",
    name:sheet.name,
    className:sheet.className,
    subclassName:sheet.subclassName ?? "",
    species:sheet.species,
    background:sheet.background,
    level:sheet.level,
    abilityMethod:"custom",
    abilities:cp(sheet.abilities),
    rolledPool:[],
    rolledAssignments:{},
    selectedSkills:[],
    selectedSpells:[],
    selectedClassChoices:[],
    equipmentPreset:"",
    backgroundEquipmentPreset:"",
    choiceSelections:cp(sheet.creationSelections ?? {}),
    notes:sheet.notes ?? "",
    overrides:{},
  };
}

export function applyCreationAuthoringSourceV1(
  draft:CharacterCreateDraft,
  source:CharacterCreationAuthoringSourceV1,
) {
  draft.authoringSourceCompleteness=source.completeness;
  draft.rulesProfileId=source.rulesProfileId;
  draft.name=source.name;
  draft.className=source.className;
  draft.subclassName=source.subclassName;
  draft.species=source.species;
  draft.background=source.background;
  draft.level=source.level;
  draft.abilityMethod=source.abilityMethod;
  draft.abilities=cp(source.abilities);
  draft.rolledPool=cp(source.rolledPool);
  draft.rolledAssignments=cp(source.rolledAssignments);
  draft.selectedSkills=cp(source.selectedSkills);
  draft.selectedSpells=cp(source.selectedSpells);
  draft.selectedClassChoices=cp(source.selectedClassChoices);
  draft.equipmentPreset=source.equipmentPreset;
  draft.backgroundEquipmentPreset=source.backgroundEquipmentPreset;
  draft.choiceSelections=cp(source.choiceSelections);
  draft.notes=source.notes;
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
