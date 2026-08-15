import "./restSpellManagementContracts";
import "./druidCircleLandSpellRuntimeAdapter";
import "./pactTomeRuntimeAdapter";
import type { AppSnapshot, CharacterSheet } from "./contracts";
import type {
  PactTomeRestSpellCommand,
  RestSpellManagementResultVm,
  WizardLongRestSpellCommand,
} from "./restSpellManagementContracts";
import { configureCircleLandSpells } from "./druidCircleLandSpellRuntimeAdapter";
import { MockAdapter } from "./mockAdapter";
import { configurePactTomeBook } from "./pactTomeRuntimeAdapter";
import { ensureProgressionMetadata } from "./progressionRuntimeAdapter";
import { SPELL_PRESENTATIONS } from "./spellPresentation";
import type { CircleLandType } from "../domain/druidCircleLandRecovery";
import type { ProgressionCharacterState } from "../domain/progression";
import { resolveWizardLongRestPreparation } from "../domain/wizardLongRestPreparation";

const clone = <T,>(value:T):T => structuredClone(value);
const unique = (values:string[]) => [...new Set(values.filter(Boolean))];
const normalizedSkillName = (value:string) => value.replace(/\s+[+-]\d+$/,"").trim();

type AdapterState = {
  activeCharacter:CharacterSheet;
  getSnapshot():Promise<AppSnapshot>;
};

function characterState(sheet:CharacterSheet):ProgressionCharacterState {
  ensureProgressionMetadata(sheet);
  return {
    revision:sheet.progressionRevision ?? 0,
    id:sheet.id,
    name:sheet.name,
    totalLevel:sheet.level,
    abilities:clone(sheet.abilities),
    hpCurrent:sheet.hp,
    hpMaximum:sheet.maxHp,
    proficiencyBonus:sheet.proficiencyBonus,
    classTracks:clone(sheet.classLevels ?? []),
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
    pactMagicSlotLevel:sheet.pactMagicSlotLevel ?? 0,
    pactMagicSlotMaximum:sheet.pactMagicSlotMaximum ?? 0,
    spellSlotMaximums:clone(sheet.spellSlotMaximums ?? {}),
  };
}

function wizardSpellOptions() {
  return SPELL_PRESENTATIONS.map((spell) => ({
    id:spell.id,
    label:spell.name,
    description:spell.summary,
    level:spell.level,
    castingTime:spell.castingTime,
    school:spell.school,
  }));
}

async function snapshotWithResult(adapter:MockAdapter,result:RestSpellManagementResultVm) {
  const snapshot = await adapter.getSnapshot();
  snapshot.restSpellManagement = result;
  return snapshot;
}

MockAdapter.prototype.configureWizardLongRest = async function configureWizardLongRest(command:WizardLongRestSpellCommand) {
  const internal = this as unknown as AdapterState;
  const state = characterState(internal.activeCharacter);
  const result = resolveWizardLongRestPreparation(state,{
    expectedRevision:state.revision,
    normalPreparedSpellIds:[...command.normalPreparedSpellIds],
    spellMasteryReplacement:command.spellMasteryReplacement,
    spellOptions:wizardSpellOptions(),
  });
  if (result.status === "rejected") {
    return snapshotWithResult(this,{
      kind:"wizard-long-rest",
      status:"rejected",
      message:result.error,
    });
  }

  internal.activeCharacter.progressionRevision = result.state.revision;
  internal.activeCharacter.preparedSpells = clone(result.state.preparedSpellIds ?? []);
  internal.activeCharacter.preparedSpellSources = clone(result.state.preparedSpellSources ?? {});
  internal.activeCharacter.spellMasterySpellIds = clone(result.state.spellMasterySpellIds ?? {});
  internal.activeCharacter.spellMasterySources = clone(result.state.spellMasterySources ?? {});
  return snapshotWithResult(this,{
    kind:"wizard-long-rest",
    status:"committed",
    message:result.replacedSpellLevel
      ? `Long Rest 준비 주문과 ${result.replacedSpellLevel}레벨 Spell Mastery 교체를 적용했습니다.`
      : "Long Rest 준비 주문을 적용했습니다.",
  });
};

MockAdapter.prototype.configurePactTomeRest = async function configurePactTomeRest(command:PactTomeRestSpellCommand) {
  const internal = this as unknown as AdapterState;
  const result = configurePactTomeBook(internal.activeCharacter,{
    expectedRevision:internal.activeCharacter.progressionRevision ?? 0,
    rest:command.rest,
    cantripIds:[...command.cantripIds],
    ritualSpellIds:[...command.ritualSpellIds],
  });
  if (result.status === "rejected") {
    return snapshotWithResult(this,{
      kind:"pact-tome",
      status:"rejected",
      message:result.error,
    });
  }
  return snapshotWithResult(this,{
    kind:"pact-tome",
    status:"committed",
    message:`${command.rest === "short" ? "Short" : "Long"} Rest 후 Book of Shadows 주문 구성을 적용했습니다.`,
  });
};

MockAdapter.prototype.configureCircleLandRest = async function configureCircleLandRest(landType:CircleLandType) {
  const result = configureCircleLandSpells(this,landType);
  if (result.status === "rejected") {
    return snapshotWithResult(this,{
      kind:"circle-land",
      status:"rejected",
      message:result.error,
    });
  }
  return snapshotWithResult(this,{
    kind:"circle-land",
    status:"committed",
    message:`Long Rest 후 Circle of the Land 지형을 ${landType}(으)로 적용했습니다.`,
  });
};
