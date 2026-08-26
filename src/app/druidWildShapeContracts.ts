import "./contracts";
import type { DruidWildShapeForm } from "../domain/druidWildShape";

declare module "./contracts" {
  interface CharacterSheet {
    wildShapeKnownForms?:DruidWildShapeForm[];
  }
}
