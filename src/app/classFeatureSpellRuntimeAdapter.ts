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

type AdapterState = {
  activeCharacter: CharacterSheet;
  getSnapshot(): Promise<AppSnapshot>;
};

export function ensureClassFeatureSpellResources(sheet: CharacterSheet) {
  ensureProgressionMetadata(sheet);
  const tracks = sheet.classLevels ?? [];
  const definitions = classFeatureSpellResourceDefinitions(tracks);
  sheet.featureSpellResourceIds = classFeatureSpellResourceIds(tracks);
  sheet.featureSpellSources = classFeatureSpellSources(tracks);

  for (const definition of definitions) {
    const existing = sheet.resources.find((resource) => resource.id === definition.resourceId);
    if (!existing) {
      sheet.resources.push({
        id:definition.resourceId,
        label:definition.label,
        current:definition.maximum,
        max:definition.maximum,
        source:definition.source,
        recovery:{ longRest:"all" },
      });
      continue;
    }
    existing.label = definition.label;
    existing.max = definition.maximum;
    existing.current = Math.min(existing.current, definition.maximum);
    existing.source = definition.source;
    existing.recovery = { ...(existing.recovery ?? {}), longRest:"all" };
  }
  return sheet;
}

const oldGetSnapshot = MockAdapter.prototype.getSnapshot;

MockAdapter.prototype.getSnapshot = async function getSnapshotWithClassFeatureSpellResources() {
  const internal = this as unknown as AdapterState;
  ensureClassFeatureSpellResources(internal.activeCharacter);
  return oldGetSnapshot.call(this);
};
