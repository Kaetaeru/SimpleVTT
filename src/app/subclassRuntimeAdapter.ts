import "./progressionContracts";
import "./progressionPersistentFeatureRuntimeAdapter";
import type { AppSnapshot, CharacterSheet } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { ensureProgressionMetadata } from "./progressionRuntimeAdapter";
import { DRUID_CIRCLE_LAND_SUBCLASS_ID } from "../domain/druidCircleLand";
import {
  DRUID_NATURAL_RECOVERY_CAST_RESOURCE_ID,
  DRUID_NATURAL_RECOVERY_CAST_SOURCE,
  DRUID_NATURAL_RECOVERY_SLOTS_RESOURCE_ID,
  DRUID_NATURAL_RECOVERY_SLOTS_SOURCE,
  naturalRecoveryResourcePools,
} from "../domain/druidCircleLandRecovery";
import { inferSrdSubclassId } from "../domain/srdSubclassCatalog";

const DRUID_ID = "dnd.srd521.class.druid";

type AdapterState = {
  activeCharacter: CharacterSheet;
  getSnapshot(): Promise<AppSnapshot>;
};

function upsertResource(sheet:CharacterSheet, definition:{
  id:string;
  label:string;
  current:number;
  maximum:number;
  recovery?: { shortRest?:number|"all"; longRest?:number|"all"; turnStart?:number|"all" };
}, source:string) {
  const existing = sheet.resources.find((resource) => resource.id === definition.id);
  if (!existing) {
    sheet.resources.push({
      id:definition.id,
      label:definition.label,
      current:definition.current,
      max:definition.maximum,
      source,
      recovery:definition.recovery ? { ...definition.recovery } : undefined,
    });
    return;
  }
  existing.label = definition.label;
  existing.max = definition.maximum;
  existing.current = Math.min(existing.current,definition.maximum);
  existing.source = source;
  existing.recovery = definition.recovery ? { ...(existing.recovery ?? {}),...definition.recovery } : existing.recovery;
}

function naturalRecoverySource(resourceId:string) {
  if (resourceId === DRUID_NATURAL_RECOVERY_CAST_RESOURCE_ID) return DRUID_NATURAL_RECOVERY_CAST_SOURCE;
  if (resourceId === DRUID_NATURAL_RECOVERY_SLOTS_RESOURCE_ID) return DRUID_NATURAL_RECOVERY_SLOTS_SOURCE;
  return "feature:druid.circle-of-the-land.natural-recovery";
}

export function ensureSubclassRuntimeMetadata(sheet:CharacterSheet) {
  ensureProgressionMetadata(sheet);
  sheet.subclassIds ??= {};
  sheet.subclassSources ??= {};

  const primaryTrack = sheet.classLevels?.[0];
  if (primaryTrack && !primaryTrack.subclassName && sheet.subclassName) {
    primaryTrack.subclassName = sheet.subclassName;
  }

  for (const track of sheet.classLevels ?? []) {
    if (!sheet.subclassIds[track.classId]) {
      const inferred = inferSrdSubclassId(track.classId,track.subclassName);
      if (inferred) sheet.subclassIds[track.classId] = inferred;
    }
    const subclassId = sheet.subclassIds[track.classId];
    if (subclassId) {
      sheet.subclassSources[track.classId] ??= `SRD 5.2.1 · ${track.className} · ${track.subclassName ?? subclassId}`;
    }
  }

  const druidTrack = sheet.classLevels?.find((track) => track.classId === DRUID_ID);
  if (druidTrack && druidTrack.level >= 6 && sheet.subclassIds[DRUID_ID] === DRUID_CIRCLE_LAND_SUBCLASS_ID) {
    for (const pool of naturalRecoveryResourcePools(druidTrack.level,DRUID_CIRCLE_LAND_SUBCLASS_ID)) {
      upsertResource(sheet,pool,naturalRecoverySource(pool.id));
    }
  }

  return sheet;
}

const oldGetSnapshot = MockAdapter.prototype.getSnapshot;

MockAdapter.prototype.getSnapshot = async function getSnapshotWithSubclassRuntimeMetadata() {
  const internal = this as unknown as AdapterState;
  ensureSubclassRuntimeMetadata(internal.activeCharacter);
  const snapshot = await oldGetSnapshot.call(this);
  ensureSubclassRuntimeMetadata(snapshot.activeCharacter);
  return snapshot;
};
