import "./progressionContracts";
import "./creationContracts";
import "./progressionPhase08WarlockAdapter";
import "./progressionPersistentFeatureRuntimeAdapter";
import type { AppSnapshot, CharacterSheet, LevelUpDraft } from "./contracts";
import { fightingStyleOptions, generalLanguageOptions, originFeatOptions, spellOptions } from "./characterCreationV10Data";
import { SPELL_PRESENTATIONS } from "./spellPresentation";
import { MockAdapter } from "./mockAdapter";
import { ensureProgressionMetadata } from "./progressionRuntimeAdapter";
import type { ChoiceSelectionMap } from "../domain/choiceDefinition";
import { featRuleById } from "../domain/featRuleCatalog";
import { classByName } from "../domain/progressionCatalog";
import type { ProgressionCharacterState, ProgressionRequest } from "../domain/progression";
import {
  buildProgressionPlanPhase08EpicBoon,
  resolveProgressionPhase08EpicBoon,
} from "../domain/progressionPhase08EpicBoon";

const clone = <T,>(value:T):T => structuredClone(value);
const unique = (values:string[]) => [...new Set(values.filter(Boolean))];
const normalizedSkillName = (value:string) => value.replace(/\s+[+-]\d+$/,"").trim();

type AdapterState = {
  activeCharacter:CharacterSheet;
  levelUpDraft:LevelUpDraft|null;
  catalog:AppSnapshot["catalog"];
  activity:AppSnapshot["activity"];
  scene:AppSnapshot["scene"];
  getSnapshot():Promise<AppSnapshot>;
  syncChar():void;
};

function primaryClass(sheet:CharacterSheet) {
  return classByName(sheet.className) ?? classByName(sheet.className.split("/")[0]?.trim() ?? sheet.className);
}

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
    features:unique([...sheet.features,...(sheet.epicBoonFeatIds ?? [])]),
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

function progressionSpellOptions() {
  return SPELL_PRESENTATIONS.map((spell) => ({
    id:spell.id,
    label:spell.name,
    description:spell.summary,
    level:spell.level,
    castingTime:spell.castingTime,
    school:spell.school,
  }));
}

function progressionClassCantripOptions(classId:string) {
  const presentations = new Map(SPELL_PRESENTATIONS.map((spell) => [spell.id,spell]));
  return spellOptions(classId,0).map((option) => {
    const presentation = presentations.get(option.id);
    return {
      id:option.id,
      label:presentation?.name ?? option.name,
      description:presentation?.summary ?? option.summary,
    };
  });
}

function requestFor(state:AdapterState):ProgressionRequest {
  const draft = state.levelUpDraft;
  if (!draft) throw new Error("level-up draft missing");
  const sheet = ensureProgressionMetadata(state.activeCharacter);
  const targetClassId = draft.targetClassId ?? sheet.classLevels?.[0]?.classId ?? primaryClass(sheet)?.id ?? "dnd.srd521.class.fighter";
  return {
    expectedRevision:sheet.progressionRevision ?? 0,
    targetClassId,
    hpMethod:draft.hpMethod,
    hpRoll:draft.hpRoll,
    selections:clone(draft.progressionSelections ?? {}) as ChoiceSelectionMap,
    featOptions:state.catalog.filter((entry) => entry.category === "feat").map((entry) => ({ id:entry.id, label:entry.nameKo, description:entry.description })),
    originFeatOptions:originFeatOptions.map((option) => ({ id:option.id, label:option.name, description:option.summary })),
    fightingStyleOptions:fightingStyleOptions.map((option) => ({ id:option.id, label:option.name, description:option.summary })),
    druidCantripOptions:progressionClassCantripOptions("dnd.srd521.class.druid"),
    clericCantripOptions:progressionClassCantripOptions("dnd.srd521.class.cleric"),
    languageOptions:generalLanguageOptions.map((option) => ({ id:option.id, label:option.name, description:option.summary })),
    spellOptions:progressionSpellOptions(),
  };
}

function syncDraftPlan(draft:LevelUpDraft,plan:ReturnType<typeof buildProgressionPlanPhase08EpicBoon>) {
  draft.validation = [
    ...plan.blocking.map((message) => ({ severity:"blocking" as const, message })),
    ...plan.warnings.map((message) => ({ severity:"warning" as const, message })),
  ];
  draft.preview.diffs = clone(plan.diffs);
}

function selectedEpicBoon(plan:ReturnType<typeof buildProgressionPlanPhase08EpicBoon>,selections:ChoiceSelectionMap) {
  const choice = plan.choices.find((entry) => entry.kind === "epic-boon");
  if (!choice) return undefined;
  const selection = selections[choice.id];
  const featId = selection?.kind === "options" ? selection.optionIds[0] : undefined;
  return featId ? { featId, source:choice.source } : undefined;
}

const oldGetSnapshot = MockAdapter.prototype.getSnapshot;
const oldCommitLevelUp = MockAdapter.prototype.commitLevelUp;

MockAdapter.prototype.getSnapshot = async function getSnapshotWithEpicBoonProgression() {
  const internal = this as unknown as AdapterState;
  const snapshot = await oldGetSnapshot.call(this);
  if (!internal.levelUpDraft || !snapshot.levelUpDraft) return snapshot;
  const plan = buildProgressionPlanPhase08EpicBoon(characterState(internal.activeCharacter),requestFor(internal));
  syncDraftPlan(internal.levelUpDraft,plan);
  snapshot.levelUpDraft = clone(internal.levelUpDraft);
  snapshot.progressionPlan = clone(plan);
  return snapshot;
};

MockAdapter.prototype.commitLevelUp = async function commitLevelUpWithEpicBoonProgression() {
  const internal = this as unknown as AdapterState;
  if (!internal.levelUpDraft) return oldCommitLevelUp.call(this);

  const stateBefore = characterState(internal.activeCharacter);
  const request = requestFor(internal);
  const resolved = resolveProgressionPhase08EpicBoon(stateBefore,request);
  if (resolved.status === "rejected") {
    syncDraftPlan(internal.levelUpDraft,resolved.plan);
    return internal.getSnapshot();
  }
  const selected = selectedEpicBoon(resolved.plan,request.selections);
  const snapshot = await oldCommitLevelUp.call(this);
  if (internal.levelUpDraft || !selected) return snapshot;

  internal.activeCharacter.abilities = clone(resolved.state.abilities);
  internal.activeCharacter.hp = resolved.state.hpCurrent;
  internal.activeCharacter.maxHp = resolved.state.hpMaximum;
  internal.activeCharacter.epicBoonFeatIds = unique([...(internal.activeCharacter.epicBoonFeatIds ?? []),selected.featId]);
  internal.activeCharacter.epicBoonFeatSources = {
    ...(internal.activeCharacter.epicBoonFeatSources ?? {}),
    [selected.featId]:selected.source,
  };
  internal.activeCharacter.features = resolved.state.features.map((feature) => internal.catalog.find((entry) => entry.id === feature)?.nameKo ?? featRuleById(feature)?.name ?? feature);
  const sceneEntity = internal.scene.entities.find((entity) => entity.id === internal.activeCharacter.id);
  if (sceneEntity) {
    sceneEntity.hp = internal.activeCharacter.hp;
    sceneEntity.maxHp = internal.activeCharacter.maxHp;
  }
  internal.syncChar();

  const activity = internal.activity[0];
  const diff = resolved.plan.diffs.find((entry) => entry.label === "에픽 은총");
  if (activity && diff) {
    activity.detail = [...activity.detail, `에픽 은총: ${diff.after} (${diff.source})`];
    activity.stateChanges = [...activity.stateChanges,"Phase 08 Epic Boon → Character Revision"];
  }
  return internal.getSnapshot();
};
