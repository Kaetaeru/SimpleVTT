import "./creationContracts";
import "./progressionContracts";
import "./characterCreationAuthoringSource";
import type { AbilityScores, CharacterResourceVm, CharacterSheet, ItemInstanceVm } from "./contracts";
import type { ProgressionClassTrack } from "../domain/progression";
import type { CharacterCreationAuthoringSourceV1 } from "./characterCreationAuthoringSource";

export const CHARACTER_LIBRARY_SCHEMA_ID = "simplevtt.character-library" as const;
export const CHARACTER_LIBRARY_SCHEMA_VERSION = 1 as const;
export const DEFAULT_RULES_PROFILE = { id:"dnd.srd-5.2.1", version:"0.1-draft" } as const;

export interface RulesProfileRefV1 { id:string; version:string; }
export interface CharacterDurableLifeFlagsV1 { stable:boolean; unconscious:boolean; dead:boolean; }

export interface CharacterProgressionSelectionsV1 {
  expertiseSkills?:string[]; expertiseSources?:Record<string,string>; languageSources?:Record<string,string>;
  cantripSources?:Record<string,string>; preparedSpellSources?:Record<string,string>; spellbookSpellSources?:Record<string,string>;
  spellMasterySpellIds?:Record<number,string>; spellMasterySources?:Record<number,string>; signatureSpellIds?:string[];
  signatureSpellSources?:Record<string,string>; metamagicIds?:string[]; metamagicSources?:Record<string,string>;
  eldritchInvocationIds?:string[]; eldritchInvocationSources?:Record<string,string>; mysticArcanumSpellIds?:Record<number,string>;
  mysticArcanumSources?:Record<number,string>; persistentFeatureOptionIds?:string[]; persistentFeatureOptionSources?:Record<string,string>;
  epicBoonFeatIds?:string[]; epicBoonFeatSources?:Record<string,string>; weaponMasteryIds?:string[]; weaponMasterySources?:Record<string,string>;
  fightingStyleFeatIds?:string[]; fightingStyleFeatSources?:Record<string,string>; subclassIds?:Record<string,string>;
  subclassSources?:Record<string,string>; subclassFeatureIds?:string[]; subclassFeatureSources?:Record<string,string>;
  bardMagicalDiscoverySpellIds?:string[]; bardMagicalDiscoverySpellSources?:Record<string,string>; pactTomeCantripIds?:string[];
  pactTomeRitualSpellIds?:string[]; pactTomeSpellSources?:Record<string,string>; spellMasterySourcesByLevel?:Record<number,string>;
}

export interface CharacterSourceSnapshotV1 {
  characterId:string;
  name:string;
  rulesProfile:RulesProfileRefV1;
  build:{
    className:string; subclassName?:string; level:number; species:string; background:string; abilities:AbilityScores; skills:string[];
    classLevels?:ProgressionClassTrack[]; hitDiceByDie?:Record<string,number>; size?:string; languages?:string[]; toolProficiencies?:string[];
    creationSelections:Record<string,string[]>; notes?:string;
  };
  creationAuthoring?:CharacterCreationAuthoringSourceV1;
  spellAndFeatureSelections:{ cantrips?:string[]; preparedSpells?:string[]; spellbookSpells?:string[]; masteryWeapons?:string[]; };
  progression:CharacterProgressionSelectionsV1;
  itemReferences:Array<{ id:string; definitionId:string; provenance:string[] }>;
}

export interface CharacterRuntimeDurableSnapshotV1 {
  hp:number; tempHp:number; lifeFlags?:CharacterDurableLifeFlagsV1; resources:CharacterResourceVm[]; items:ItemInstanceVm[]; goldGp?:number;
}

export interface CharacterMaterializedCacheV1 { sourceRevision:number; runtimeRevision:number; sheet:CharacterSheet; }
export interface CharacterLibraryRecordV1 {
  characterId:string; sourceRevision:number; runtimeRevision:number; source:CharacterSourceSnapshotV1; runtime:CharacterRuntimeDurableSnapshotV1; materializedCache:CharacterMaterializedCacheV1;
}
export interface CharacterLibraryDocumentV1 {
  schemaId:typeof CHARACTER_LIBRARY_SCHEMA_ID; schemaVersion:typeof CHARACTER_LIBRARY_SCHEMA_VERSION; storageRevision:number; activeCharacterId:string|null; characters:CharacterLibraryRecordV1[];
}
export interface CharacterLibraryStoredGeneration { generation:number; payload:string|null; readError?:string; }
export interface CharacterLibraryStore {
  readonly durability:"durable"|"volatile";
  readGenerations():Promise<CharacterLibraryStoredGeneration[]>;
  writeGeneration(expectedGeneration:number,nextGeneration:number,payload:string):Promise<void>;
}

declare module "./contracts" {
  interface CharacterSheet {
    rulesProfileId?:string; rulesProfileVersion?:string; sourceRevision?:number; runtimeRevision?:number; durableLifeFlags?:CharacterDurableLifeFlagsV1;
  }
}
export {};
