import "./classFeatureSpellContracts";
import "./progressionContracts";
import { MockAdapter } from "./mockAdapter";
import type { AppSnapshot, CharacterSheet } from "./contracts";
import { ensureProgressionMetadata } from "./progressionRuntimeAdapter";
import {
  classFeatureSpellResourceDefinitions,
  classFeatureSpellResourceIds,
  classFeatureSpellSources,
} from "../domain/classFeatureSpellResources";
import { coreClassResourceDefinitions } from "../domain/coreClassResources";

type AdapterState = {
  activeCharacter: CharacterSheet;
  getSnapshot(): Promise<AppSnapshot>;
};

function upsertResource(sheet: CharacterSheet, definition: {
  resourceId: string;
  label: string;
  maximum: number;
  source: string;
  recovery: { shortRest?:number|"all"; longRest?:number|"all" };
}) {
  const existing = sheet.resources.find((resource) => resource.id === definition.resourceId);
  if (!existing) {
    sheet.resources.push({
      id:definition.resourceId,
      label:definition.label,
      current:definition.maximum,
      max:definition.maximum,
      source:definition.source,
      recovery:{ ...definition.recovery },
    });
    return;
  }
  existing.label = definition.label;
  existing.max = definition.maximum;
  existing.current = Math.min(existing.current, definition.maximum);
  existing.source = definition.source;
  existing.recovery = { ...(existing.recovery ?? {}), ...definition.recovery };
}

export function ensureClassFeatureSpellResources(sheet: CharacterSheet) {
  ensureProgressionMetadata(sheet);
  const tracks = sheet.classLevels ?? [];
  const definitions = classFeatureSpellResourceDefinitions(tracks);
  sheet.featureSpellResourceIds = classFeatureSpellResourceIds(tracks);
  sheet.featureSpellSources = classFeatureSpellSources(tracks);
  for (const definition of definitions) upsertResource(sheet, definition);
  return sheet;
}

export function ensureCoreClassResources(sheet: CharacterSheet) {
  ensureProgressionMetadata(sheet);
  for (const definition of coreClassResourceDefinitions(sheet.classLevels ?? [])) upsertResource(sheet, definition);
  return sheet;
}

const oldGetSnapshot = MockAdapter.prototype.getSnapshot;

MockAdapter.prototype.getSnapshot = async function getSnapshotWithClassFeatureResources() {
  const internal = this as unknown as AdapterState;
  ensureClassFeatureSpellResources(internal.activeCharacter);
  ensureCoreClassResources(internal.activeCharacter);
  return oldGetSnapshot.call(this);
};
