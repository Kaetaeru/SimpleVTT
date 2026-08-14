import "./progressionContracts";
import "./subclassRuntimeAdapter";
import type { AppSnapshot, CharacterSheet } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { classByName } from "../domain/progressionCatalog";
import type { ProgressionCharacterState } from "../domain/progression";
import {
  hasPactOfTheTome,
  pactTomePreparedView,
  resolvePactTomeRest,
  type PactTomeRestRequest,
} from "../domain/warlockPactTome";

const clone = <T,>(value:T):T => structuredClone(value);
const unique = (values:string[]) => [...new Set(values.filter(Boolean))];
const normalizedSkillName = (value:string) => value.replace(/\s+[+-]\d+$/,"").trim();

function characterState(sheet:CharacterSheet):ProgressionCharacterState {
  const primary = classByName(sheet.className) ?? classByName(sheet.className.split("/")[0]?.trim() ?? sheet.className);
  return {
    revision:sheet.progressionRevision ?? 0,
    id:sheet.id,
    name:sheet.name,
    totalLevel:sheet.level,
    abilities:clone(sheet.abilities),
    hpCurrent:sheet.hp,
    hpMaximum:sheet.maxHp,
    proficiencyBonus:sheet.proficiencyBonus,
    classTracks:clone(sheet.classLevels ?? (primary ? [{ classId:primary.id, className:primary.nameKo, level:sheet.level, subclassName:sheet.subclassName }] : [])),
    hitDiceByDie:clone(sheet.hitDiceByDie ?? {}),
    features:clone(sheet.features),
    proficientSkills:unique(sheet.skills.map(normalizedSkillName)),
    expertiseSkills:clone(sheet.expertiseSkills ?? []),
    expertiseSources:clone(sheet.expertiseSources ?? {}),
    languages:clone(sheet.languages ?? []),
    languageSources:clone(sheet.languageSources ?? {}),
    cantripIds:clone(sheet.cantrips ?? []),
    cantripSources:clone(sheet.cantripSources ?? {}),
    preparedSpellIds:clone(sheet.preparedSpells ?? []),
    preparedSpellSources:clone(sheet.preparedSpellSources ?? {}),
    spellbookSpellIds:clone(sheet.spellbookSpells ?? []),
    spellbookSpellSources:clone(sheet.spellbookSpellSources ?? {}),
    spellMasterySpellIds:clone(sheet.spellMasterySpellIds ?? {}),
    spellMasterySources:clone(sheet.spellMasterySources ?? {}),
    signatureSpellIds:clone(sheet.signatureSpellIds ?? []),
    signatureSpellSources:clone(sheet.signatureSpellSources ?? {}),
    metamagicIds:clone(sheet.metamagicIds ?? []),
    metamagicSources:clone(sheet.metamagicSources ?? {}),
    eldritchInvocationIds:clone(sheet.eldritchInvocationIds ?? []),
    eldritchInvocationSources:clone(sheet.eldritchInvocationSources ?? {}),
    mysticArcanumSpellIds:clone(sheet.mysticArcanumSpellIds ?? {}),
    mysticArcanumSources:clone(sheet.mysticArcanumSources ?? {}),
    pactTomeCantripIds:clone(sheet.pactTomeCantripIds ?? []),
    pactTomeRitualSpellIds:clone(sheet.pactTomeRitualSpellIds ?? []),
    pactTomeSpellSources:clone(sheet.pactTomeSpellSources ?? {}),
    pactMagicSlotLevel:sheet.pactMagicSlotLevel ?? 0,
    pactMagicSlotMaximum:sheet.pactMagicSlotMaximum ?? 0,
    spellSlotMaximums:clone(sheet.spellSlotMaximums ?? {}),
  };
}

export function configurePactTomeBook(sheet:CharacterSheet,request:PactTomeRestRequest) {
  const result = resolvePactTomeRest(characterState(sheet),request);
  if (result.status === "rejected") return result;
  sheet.progressionRevision = result.state.revision;
  sheet.pactTomeCantripIds = clone(result.state.pactTomeCantripIds ?? []);
  sheet.pactTomeRitualSpellIds = clone(result.state.pactTomeRitualSpellIds ?? []);
  sheet.pactTomeSpellSources = clone(result.state.pactTomeSpellSources ?? {});
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
