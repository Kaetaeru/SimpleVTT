import type { AppSnapshot } from "./contracts";

export interface ConcentrationSaveVm {
  targetId:string;
  targetName:string;
  ability:"con";
  modifier:number;
  modifierSource:string;
  natural?:number;
  total?:number;
  dc?:number;
  outcome?:"성공"|"실패";
}

declare module "./contracts" {
  interface ResolutionView {
    concentrationSave?:ConcentrationSaveVm;
  }

  interface SimpleVttAdapter {
    submitConcentrationSaveD20(face:number):Promise<AppSnapshot>;
  }
}

declare module "./mockAdapter" {
  interface MockAdapter {
    submitConcentrationSaveD20(face:number):Promise<AppSnapshot>;
  }
}

export {};
