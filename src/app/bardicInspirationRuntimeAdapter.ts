import "./progressionContracts";
import type { AppSnapshot, CharacterSheet } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { BARD_ID, BARDIC_INSPIRATION_RESOURCE_ID, bardicInspirationResourceDefinition } from "../domain/bardicInspiration";

function modifier(score:number) {
  return Math.floor((score - 10) / 2);
}

export function ensureBardicInspirationResource(sheet:CharacterSheet) {
  const bardLevel = sheet.classLevels?.find((track) => track.classId === BARD_ID)?.level ?? 0;
  if (bardLevel < 1) return sheet;
  const definition = bardicInspirationResourceDefinition(bardLevel,modifier(sheet.abilities.cha));
  const existing = sheet.resources.find((resource) => resource.id === BARDIC_INSPIRATION_RESOURCE_ID);
  if (!existing) {
    sheet.resources.push({
      id:definition.resourceId,
      label:definition.label,
      current:definition.maximum,
      max:definition.maximum,
      dieSides:definition.dieSides,
      source:definition.source,
      recovery:{ ...definition.recovery },
    });
    return sheet;
  }
  existing.label = definition.label;
  existing.current = Math.min(existing.current,definition.maximum);
  existing.max = definition.maximum;
  existing.dieSides = definition.dieSides;
  existing.source = definition.source;
  existing.recovery = { ...definition.recovery };
  return sheet;
}

const oldGetSnapshot = MockAdapter.prototype.getSnapshot;

MockAdapter.prototype.getSnapshot = async function getSnapshotWithBardicInspirationResource() {
  const internal = this as unknown as { activeCharacter:CharacterSheet };
  ensureBardicInspirationResource(internal.activeCharacter);
  return oldGetSnapshot.call(this) as Promise<AppSnapshot>;
};
