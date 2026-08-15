import "./progressionContracts";
import "./subclassRuntimeAdapter";
import type { AppSnapshot, CharacterSheet } from "./contracts";
import type { CircleLandRestConfigurationVm } from "./restSpellManagementContracts";
import { MockAdapter } from "./mockAdapter";
import { ensureSubclassRuntimeMetadata } from "./subclassRuntimeAdapter";
import { DRUID_CIRCLE_LAND_SUBCLASS_ID } from "../domain/druidCircleLand";
import type { CircleLandType } from "../domain/druidCircleLandRecovery";
import {
  circleLandSpellView,
  resolveCircleLandSpellRest,
  type CircleLandSpellRestState,
} from "../domain/druidCircleLandSpells";
import { DRUID_ID } from "../domain/druidProgressionChoices";

const clone = <T,>(value:T):T => structuredClone(value);
const circleLandRestConfigurations = new WeakMap<MockAdapter,Map<string,CircleLandSpellRestState>>();

type AdapterState = {
  activeCharacter:CharacterSheet;
};

function druidLevel(sheet:CharacterSheet) {
  return sheet.classLevels?.find((track) => track.classId === DRUID_ID)?.level ?? 0;
}

function configurationStore(adapter:MockAdapter) {
  let store = circleLandRestConfigurations.get(adapter);
  if (!store) {
    store = new Map<string,CircleLandSpellRestState>();
    circleLandRestConfigurations.set(adapter,store);
  }
  return store;
}

function currentConfiguration(adapter:MockAdapter,characterId:string) {
  return circleLandRestConfigurations.get(adapter)?.get(characterId);
}

function configurationVm(characterId:string,state:CircleLandSpellRestState):CircleLandRestConfigurationVm {
  return {
    characterId,
    revision:state.revision,
    landType:state.circleLandType,
    cantripIds:clone(state.circleLandCantripIds ?? []),
    preparedSpellIds:clone(state.circleLandPreparedSpellIds ?? []),
    spellSources:clone(state.circleLandSpellSources ?? {}),
  };
}

function baseSpellView(sheet:CharacterSheet) {
  return {
    cantripIds:clone(sheet.cantrips ?? []),
    preparedSpellIds:clone(sheet.preparedSpells ?? []),
  };
}

export function configureCircleLandSpells(adapter:MockAdapter,landType:CircleLandType) {
  const internal = adapter as unknown as AdapterState;
  const sheet = ensureSubclassRuntimeMetadata(internal.activeCharacter);
  const previous = currentConfiguration(adapter,sheet.id) ?? { revision:0 };
  const result = resolveCircleLandSpellRest(clone(previous),{
    expectedRevision:previous.revision,
    druidLevel:druidLevel(sheet),
    subclassId:sheet.subclassIds?.[DRUID_ID],
    landType,
  });
  if (result.status === "committed") {
    configurationStore(adapter).set(sheet.id,clone(result.state));
  }
  return result;
}

export function circleLandCharacterSpellView(
  sheet:CharacterSheet,
  configuration?:CircleLandSpellRestState,
) {
  ensureSubclassRuntimeMetadata(sheet);
  const base = baseSpellView(sheet);
  if (sheet.subclassIds?.[DRUID_ID] !== DRUID_CIRCLE_LAND_SUBCLASS_ID || !configuration?.circleLandType) return base;
  return circleLandSpellView({
    baseCantripIds:base.cantripIds,
    basePreparedSpellIds:base.preparedSpellIds,
    circleLandCantripIds:configuration.circleLandCantripIds,
    circleLandPreparedSpellIds:configuration.circleLandPreparedSpellIds,
  });
}

function projectCircleLandSpellView(sheet:CharacterSheet,configuration?:CircleLandSpellRestState) {
  ensureSubclassRuntimeMetadata(sheet);
  const view = circleLandCharacterSpellView(sheet,configuration);
  sheet.cantrips = clone(view.cantripIds);
  sheet.preparedSpells = clone(view.preparedSpellIds);
  if (sheet.subclassIds?.[DRUID_ID] !== DRUID_CIRCLE_LAND_SUBCLASS_ID || !configuration?.circleLandType) return sheet;

  sheet.cantripSources ??= {};
  sheet.preparedSpellSources ??= {};
  for (const spellId of configuration.circleLandCantripIds ?? []) {
    sheet.cantripSources[spellId] ??= configuration.circleLandSpellSources?.[spellId] ?? "Circle of the Land · Circle Spells";
  }
  for (const spellId of configuration.circleLandPreparedSpellIds ?? []) {
    sheet.preparedSpellSources[spellId] ??= configuration.circleLandSpellSources?.[spellId] ?? "Circle of the Land · Circle Spells";
  }
  return sheet;
}

const oldGetSnapshot = MockAdapter.prototype.getSnapshot;

MockAdapter.prototype.getSnapshot = async function getSnapshotWithCircleLandSpellView() {
  const snapshot = await oldGetSnapshot.call(this) as AppSnapshot;
  const configuration = currentConfiguration(this,snapshot.activeCharacter.id);
  projectCircleLandSpellView(snapshot.activeCharacter,configuration);
  snapshot.circleLandRestConfiguration = configuration
    ? configurationVm(snapshot.activeCharacter.id,configuration)
    : undefined;
  return snapshot;
};
