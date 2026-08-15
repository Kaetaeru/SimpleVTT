import "./progressionContracts";
import type { CharacterResourceVm, CharacterSheet } from "./contracts";

export interface CharacterResourceDefinition {
  resourceId:string;
  label:string;
  maximum:number;
  source:string;
  recovery?:CharacterResourceVm["recovery"];
}

export function upsertCharacterResource(sheet:CharacterSheet,definition:CharacterResourceDefinition) {
  const existing=sheet.resources.find((resource)=>resource.id===definition.resourceId);
  if (!existing) {
    sheet.resources.push({
      id:definition.resourceId,
      label:definition.label,
      current:definition.maximum,
      max:definition.maximum,
      source:definition.source,
      recovery:definition.recovery ? { ...definition.recovery } : undefined,
    });
    return sheet.resources[sheet.resources.length-1];
  }
  existing.label=definition.label;
  existing.max=definition.maximum;
  existing.current=Math.min(existing.current,definition.maximum);
  existing.source=definition.source;
  if (definition.recovery) existing.recovery={ ...(existing.recovery ?? {}),...definition.recovery };
  return existing;
}
