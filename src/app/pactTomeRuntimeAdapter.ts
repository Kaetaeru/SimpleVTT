import "./progressionContracts";
import "./subclassRuntimeAdapter";
import type { AppSnapshot, CharacterSheet } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import {
  applyProgressionCharacterState,
  projectProgressionCharacterState,
} from "./progressionCharacterApplicationService";
import {
  hasPactOfTheTome,
  pactTomePreparedView,
  resolvePactTomeRest,
  type PactTomeRestRequest,
} from "../domain/warlockPactTome";

const clone = <T,>(value:T):T => structuredClone(value);

function characterState(sheet:CharacterSheet) {
  return projectProgressionCharacterState(sheet,{ excludePactTomeFromBaseSpells:true });
}

export function configurePactTomeBook(sheet:CharacterSheet,request:PactTomeRestRequest) {
  const result = resolvePactTomeRest(characterState(sheet),request);
  if (result.status === "rejected") return result;
  applyProgressionCharacterState(sheet,result.state,{ scope:"pact-tome" });
  return result;
}

export function pactTomeCharacterSpellView(sheet:CharacterSheet) {
  return pactTomePreparedView(characterState(sheet));
}

function projectTomeView(sheet:CharacterSheet) {
  const state = characterState(sheet);
  if (!hasPactOfTheTome(state)) return sheet;
  const view = pactTomePreparedView(state);
  sheet.cantrips = clone(view.cantripIds);
  sheet.preparedSpells = clone(view.preparedSpellIds);
  sheet.cantripSources ??= {};
  sheet.preparedSpellSources ??= {};
  for (const spellId of sheet.pactTomeCantripIds ?? []) {
    sheet.cantripSources[spellId] = sheet.pactTomeSpellSources?.[spellId] ?? "Pact of the Tome · Book of Shadows";
  }
  for (const spellId of sheet.pactTomeRitualSpellIds ?? []) {
    sheet.preparedSpellSources[spellId] = sheet.pactTomeSpellSources?.[spellId] ?? "Pact of the Tome · Book of Shadows";
  }
  return sheet;
}

const oldGetSnapshot = MockAdapter.prototype.getSnapshot;

MockAdapter.prototype.getSnapshot = async function getSnapshotWithPactTomeView() {
  const snapshot = await oldGetSnapshot.call(this) as AppSnapshot;
  projectTomeView(snapshot.activeCharacter);
  return snapshot;
};
