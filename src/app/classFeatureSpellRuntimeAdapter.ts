import "./classFeatureSpellContracts";
import "./progressionContracts";
import { MockAdapter } from "./mockAdapter";
import type { AppSnapshot, CharacterSheet } from "./contracts";
import { upsertCharacterResource } from "./characterResourceApplicationService";
import { ensureProgressionMetadata } from "./progressionRuntimeAdapter";
import {
  classFeatureSpellResourceDefinitions,
  classFeatureSpellResourceIds,
  classFeatureSpellSources,
} from "../domain/classFeatureSpellResources";
import { coreClassResourceDefinitions } from "../domain/coreClassResources";
import { barbarianRuntimeResourceDefinitions } from "../domain/barbarianBerserker";
import { paladinDevotionRuntimeResourceDefinitions } from "../domain/paladinDevotion";
import { warlockFiendRuntimeResourceDefinitions } from "../domain/warlockFiend";
import { monkOpenHandRuntimeResourceDefinitions } from "../domain/monkOpenHand";

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
  for (const definition of definitions) upsertCharacterResource(sheet, definition);
  return sheet;
}

export function ensureCoreClassResources(sheet: CharacterSheet) {
  ensureProgressionMetadata(sheet);
  for (const definition of coreClassResourceDefinitions(sheet.classLevels ?? [])) upsertCharacterResource(sheet, definition);
  for (const definition of barbarianRuntimeResourceDefinitions(sheet.classLevels ?? [],sheet.subclassIds ?? {})) upsertCharacterResource(sheet, definition);
  for (const definition of paladinDevotionRuntimeResourceDefinitions(sheet.classLevels ?? [],sheet.subclassIds ?? {})) upsertCharacterResource(sheet, definition);
  for (const definition of warlockFiendRuntimeResourceDefinitions(sheet.classLevels ?? [],sheet.subclassIds ?? {},sheet.abilities.cha)) upsertCharacterResource(sheet, definition);
  for (const definition of monkOpenHandRuntimeResourceDefinitions(sheet.classLevels ?? [],sheet.subclassIds ?? {},sheet.abilities.wis)) upsertCharacterResource(sheet, definition);
  return sheet;
}

const oldGetSnapshot = MockAdapter.prototype.getSnapshot;

MockAdapter.prototype.getSnapshot = async function getSnapshotWithClassFeatureResources() {
  const internal = this as unknown as AdapterState;
  ensureClassFeatureSpellResources(internal.activeCharacter);
  ensureCoreClassResources(internal.activeCharacter);
  return oldGetSnapshot.call(this);
};
