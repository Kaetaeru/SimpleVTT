import "./progressionContracts";
import "./progressionRuntimeAdapter";
import type { AppSnapshot, CharacterSheet, LevelUpDraft } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { persistentFeatureChoiceSelections } from "../domain/progressionPersistentFeatureChoices";

const clone = <T,>(value: T): T => structuredClone(value);
const unique = (values: string[]) => [...new Set(values.filter(Boolean))];

type AdapterState = {
  activeCharacter: CharacterSheet;
  levelUpDraft: LevelUpDraft | null;
  getSnapshot(): Promise<AppSnapshot>;
  syncChar(): void;
};

export function ensurePersistentFeatureMetadata(sheet: CharacterSheet) {
  sheet.persistentFeatureOptionIds = unique(sheet.persistentFeatureOptionIds ?? []);
  sheet.persistentFeatureOptionSources ??= {};
  for (const optionId of sheet.persistentFeatureOptionIds) {
    sheet.persistentFeatureOptionSources[optionId] ??= "Existing character / progression feature choice";
  }
  return sheet;
}

const oldGetSnapshot = MockAdapter.prototype.getSnapshot;
const oldCommitLevelUp = MockAdapter.prototype.commitLevelUp;

MockAdapter.prototype.getSnapshot = async function getSnapshotWithPersistentFeatureOptions() {
  const internal = this as unknown as AdapterState;
  ensurePersistentFeatureMetadata(internal.activeCharacter);
  const snapshot = await oldGetSnapshot.call(this);
  ensurePersistentFeatureMetadata(snapshot.activeCharacter);
  return snapshot;
};

MockAdapter.prototype.commitLevelUp = async function commitLevelUpWithPersistentFeatureOptions() {
  const internal = this as unknown as AdapterState;
  if (!internal.levelUpDraft) return oldCommitLevelUp.call(this);

  ensurePersistentFeatureMetadata(internal.activeCharacter);
  const revisionBefore = internal.activeCharacter.progressionRevision ?? 0;
  const selections = clone(internal.levelUpDraft.progressionSelections ?? {});
  const snapshotBefore = await oldGetSnapshot.call(this);
  const selected = snapshotBefore.progressionPlan
    ? persistentFeatureChoiceSelections(snapshotBefore.progressionPlan, selections)
    : [];

  const snapshot = await oldCommitLevelUp.call(this);
  const revisionAfter = internal.activeCharacter.progressionRevision ?? 0;
  if (internal.levelUpDraft || revisionAfter <= revisionBefore || !selected.length) return snapshot;

  const ids = new Set(internal.activeCharacter.persistentFeatureOptionIds ?? []);
  const sources = { ...(internal.activeCharacter.persistentFeatureOptionSources ?? {}) };
  for (const selection of selected) {
    ids.add(selection.optionId);
    sources[selection.optionId] = selection.source;
  }
  internal.activeCharacter.persistentFeatureOptionIds = [...ids];
  internal.activeCharacter.persistentFeatureOptionSources = sources;
  internal.syncChar();
  return internal.getSnapshot();
};
