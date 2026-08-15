import "./contracts";
import type { DraconicAffinityDamageType } from "../domain/sorcererDraconic";

declare module "./contracts" {
  interface CharacterSheet {
    draconicAffinityDamageType?:DraconicAffinityDamageType;
  }
}

export {};
