import "./progressionContracts";
import type { AppSnapshot } from "./contracts";
import type { CircleLandType } from "../domain/druidCircleLandRecovery";
import type { WizardSpellMasteryReplacement } from "../domain/wizardLongRestPreparation";

export interface WizardLongRestSpellCommand {
  normalPreparedSpellIds:string[];
  spellMasteryReplacement?:WizardSpellMasteryReplacement;
}

export interface PactTomeRestSpellCommand {
  rest:"short"|"long";
  cantripIds:string[];
  ritualSpellIds:string[];
}

export interface CircleLandRestConfigurationVm {
  characterId:string;
  revision:number;
  landType?:CircleLandType;
  cantripIds:string[];
  preparedSpellIds:string[];
  spellSources:Record<string,string>;
}

export interface RestSpellManagementResultVm {
  kind:"wizard-long-rest"|"pact-tome"|"circle-land";
  status:"committed"|"rejected";
  message:string;
}

declare module "./contracts" {
  interface AppSnapshot {
    restSpellManagement?:RestSpellManagementResultVm;
    circleLandRestConfiguration?:CircleLandRestConfigurationVm;
  }

  interface SimpleVttAdapter {
    configureWizardLongRest(command:WizardLongRestSpellCommand):Promise<AppSnapshot>;
    configurePactTomeRest(command:PactTomeRestSpellCommand):Promise<AppSnapshot>;
    configureCircleLandRest(landType:CircleLandType):Promise<AppSnapshot>;
  }
}

declare module "./mockAdapter" {
  interface MockAdapter {
    configureWizardLongRest(command:WizardLongRestSpellCommand):Promise<AppSnapshot>;
    configurePactTomeRest(command:PactTomeRestSpellCommand):Promise<AppSnapshot>;
    configureCircleLandRest(landType:CircleLandType):Promise<AppSnapshot>;
  }
}

export {};
