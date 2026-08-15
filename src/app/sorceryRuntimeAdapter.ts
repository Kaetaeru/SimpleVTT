import "./progressionRuntimeAdapter";
import type { AppSnapshot, CharacterSheet } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { SORCERER_ID } from "../domain/sorcererProgressionChoices";
import { SORCEROUS_RESTORATION_USAGE_RESOURCE_ID } from "../domain/sorcery";

type AdapterState = {
  activeCharacter: CharacterSheet;
  getSnapshot(): Promise<AppSnapshot>;
};

export function ensureSorcerousRestorationUsage(sheet: CharacterSheet) {
  const sorcererLevel = sheet.classLevels?.find((track) => track.classId === SORCERER_ID)?.level ?? 0;
  if (sorcererLevel < 5) return sheet;
  const existing = sheet.resources.find((resource) => resource.id === SORCEROUS_RESTORATION_USAGE_RESOURCE_ID);
  if (!existing) {
    sheet.resources.push({
      id:SORCEROUS_RESTORATION_USAGE_RESOURCE_ID,
      label:"마력 회복",
      current:1,
      max:1,
      source:`소서러 ${sorcererLevel}레벨 · Sorcerous Restoration · SRD 5.2.1`,
      recovery:{ longRest:"all" },
    });
    return sheet;
  }
  existing.max = 1;
  existing.current = Math.min(existing.current, 1);
  existing.source = `소서러 ${sorcererLevel}레벨 · Sorcerous Restoration · SRD 5.2.1`;
  existing.recovery = { ...(existing.recovery ?? {}), longRest:"all" };
  return sheet;
}

const oldGetSnapshot = MockAdapter.prototype.getSnapshot;

MockAdapter.prototype.getSnapshot = async function getSnapshotWithSorceryResources() {
  const internal = this as unknown as AdapterState;
  ensureSorcerousRestorationUsage(internal.activeCharacter);
  const snapshot = await oldGetSnapshot.call(this);
  ensureSorcerousRestorationUsage(snapshot.activeCharacter);
  return snapshot;
};
