import "./progressionContracts";
import "./subclassRuntimeAdapter";
import type { AppSnapshot, CharacterSheet } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { ensureSubclassRuntimeMetadata } from "./subclassRuntimeAdapter";
import { DRUID_CIRCLE_LAND_SUBCLASS_ID } from "../domain/druidCircleLand";
import type { CircleLandType } from "../domain/druidCircleLandRecovery";
import {
  circleLandSpellView,
  resolveCircleLandSpellRest,
} from "../domain/druidCircleLandSpells";
import { DRUID_ID } from "../domain/druidProgressionChoices";

const clone = <T,>(value:T):T => structuredClone(value);

function druidLevel(sheet:CharacterSheet) {
  return sheet.classLevels?.find((track) => track.classId === DRUID_ID)?.level ?? 0;
}

function currentCircleSpellIds(sheet:CharacterSheet) {
  return new Set([...(sheet.circleLandCantripIds ?? []),...(sheet.circleLandPreparedSpellIds ?? [])]);
}

function baseSpellView(sheet:CharacterSheet) {
  const circleIds = currentCircleSpellIds(sheet);
  return {
    cantripIds:(sheet.cantrips ?? []).filter((spellId) => !circleIds.has(spellId)),
    preparedSpellIds:(sheet.preparedSpells ?? []).filter((spellId) => !circleIds.has(spellId)),
  };
}

export function configureCircleLandSpells(sheet:CharacterSheet,landType:CircleLandType) {
  ensureSubclassRuntimeMetadata(sheet);
  const result = resolveCircleLandSpellRest({
    revision:sheet.progressionRevision ?? 0,
    circleLandType:sheet.circleLandType,
    circleLandCantripIds:clone(sheet.circleLandCantripIds ?? []),
    circleLandPreparedSpellIds:clone(sheet.circleLandPreparedSpellIds ?? []),
    circleLandSpellSources:clone(sheet.circleLandSpellSources ?? {}),
  },{
    expectedRevision:sheet.progressionRevision ?? 0,
    druidLevel:druidLevel(sheet),
    subclassId:sheet.subclassIds?.[DRUID_ID],
    landType,
  });
  if (result.status === "rejected") return result;
  sheet.progressionRevision = result.state.revision;
  sheet.circleLandType = result.state.circleLandType;
  sheet.circleLandCantripIds = clone(result.state.circleLandCantripIds ?? []);
  sheet.circleLandPreparedSpellIds = clone(result.state.circleLandPreparedSpellIds ?? []);
  sheet.circleLandSpellSources = clone(result.state.circleLandSpellSources ?? {});
  return result;
}

export function circleLandCharacterSpellView(sheet:CharacterSheet) {
  ensureSubclassRuntimeMetadata(sheet);
  const base = baseSpellView(sheet);
  if (sheet.subclassIds?.[DRUID_ID] !== DRUID_CIRCLE_LAND_SUBCLASS_ID) return base;
  return circleLandSpellView({
    baseCantripIds:base.cantripIds,
    basePreparedSpellIds:base.preparedSpellIds,
    circleLandCantripIds:sheet.circleLandCantripIds,
    circleLandPreparedSpellIds:sheet.circleLandPreparedSpellIds,
  });
}

function projectCircleLandSpellView(sheet:CharacterSheet) {
  ensureSubclassRuntimeMetadata(sheet);
  const previousSources = sheet.circleLandSpellSources ?? {};
  sheet.cantripSources ??= {};
  sheet.preparedSpellSources ??= {};
  for (const [spellId,source] of Object.entries(previousSources)) {
    if (sheet.cantripSources[spellId] === source) delete sheet.cantripSources[spellId];
    if (sheet.preparedSpellSources[spellId] === source) delete sheet.preparedSpellSources[spellId];
  }

  const view = circleLandCharacterSpellView(sheet);
  sheet.cantrips = clone(view.cantripIds);
  sheet.preparedSpells = clone(view.preparedSpellIds);
  if (sheet.subclassIds?.[DRUID_ID] !== DRUID_CIRCLE_LAND_SUBCLASS_ID) return sheet;

  for (const spellId of sheet.circleLandCantripIds ?? []) {
    sheet.cantripSources[spellId] ??= sheet.circleLandSpellSources?.[spellId] ?? "Circle of the Land · Circle Spells";
  }
  for (const spellId of sheet.circleLandPreparedSpellIds ?? []) {
    sheet.preparedSpellSources[spellId] ??= sheet.circleLandSpellSources?.[spellId] ?? "Circle of the Land · Circle Spells";
  }
  return sheet;
}

const oldGetSnapshot = MockAdapter.prototype.getSnapshot;

MockAdapter.prototype.getSnapshot = async function getSnapshotWithCircleLandSpellView() {
  const snapshot = await oldGetSnapshot.call(this) as AppSnapshot;
  projectCircleLandSpellView(snapshot.activeCharacter);
  return snapshot;
};
