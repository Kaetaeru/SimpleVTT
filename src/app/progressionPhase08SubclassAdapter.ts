import "./progressionContracts";
import "./creationContracts";
import "./progressionPhase08BarbarianPrimalKnowledgeAdapter";
import "./subclassRuntimeAdapter";
import type { AppSnapshot, CharacterSheet, LevelUpDraft } from "./contracts";
import { fightingStyleOptions, generalLanguageOptions, originFeatOptions, spellOptions } from "./characterCreationV10Data";
import { SPELL_PRESENTATIONS } from "./spellPresentation";
import { MockAdapter } from "./mockAdapter";
import { ensureProgressionMetadata } from "./progressionRuntimeAdapter";
import { ensureSubclassRuntimeMetadata } from "./subclassRuntimeAdapter";
import type { ChoiceSelectionMap } from "../domain/choiceDefinition";
import { classByName } from "../domain/progressionCatalog";
import type { ProgressionRequest } from "../domain/progression";
import {
  buildProgressionPlanPhase08Subclass,
  resolveProgressionPhase08Subclass,
  subclassSyntheticSelectionsForPlan,
} from "../domain/progressionPhase08Subclass";
import {
  resolveSrdSubclassId,
  selectedSubclassFeatureOption,
  srdSubclassRelationship,
  subclassFeatureChoiceId,
  type SrdSubclassProgressionState,
} from "../domain/srdSubclassProgression";

const clone = <T,>(value:T):T => structuredClone(value);
const unique = (values:string[]) => [...new Set(values.filter(Boolean))];
const normalizedSkillName = (value:string) => value.replace(/\s+[+-]\d+$/,"").trim();

type AdapterState = {
  activeCharacter:CharacterSheet;
  levelUpDraft:LevelUpDraft|null;
  catalog:AppSnapshot["catalog"];
  activity:AppSnapshot["activity"];
  getSnapshot():Promise<AppSnapshot>;
  syncChar():void;
};

function primaryClass(sheet:CharacterSheet) {
  return classByName(sheet.className) ?? classByName(sheet.className.split("/")[0]?.trim() ?? sheet.className);
}

function characterState(sheet:CharacterSheet):SrdSubclassProgressionState {
  ensureProgressionMetadata(sheet);
  ensureSubclassRuntimeMetadata(sheet);
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
    features:unique([
      ...sheet.features,
      ...(sheet.epicBoonFeatIds ?? []),
      ...(sheet.fightingStyleFeatIds ?? []),
      ...(sheet.subclassFeatureIds ?? []),
    ]),
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
    weaponMasteryIds:clone(sheet.weaponMasteryIds ?? []),
    weaponMasterySources:clone(sheet.weaponMasterySources ?? {}),
    fightingStyleFeatIds:clone(sheet.fightingStyleFeatIds ?? []),
    fightingStyleFeatSources:clone(sheet.fightingStyleFeatSources ?? {}),
    subclassIds:clone(sheet.subclassIds ?? {}),
    subclassFeatureIds:clone(sheet.subclassFeatureIds ?? []),
    subclassFeatureSources:clone(sheet.subclassFeatureSources ?? {}),
    pactMagicSlotLevel:sheet.pactMagicSlotLevel ?? 0,
    pactMagicSlotMaximum:sheet.pactMagicSlotMaximum ?? 0,
    spellSlotMaximums:clone(sheet.spellSlotMaximums ?? {}),
  };
}

function progressionSpellOptions() {
  return SPELL_PRESENTATIONS.map((spell) => ({ id:spell.id, label:spell.name, description:spell.summary, level:spell.level, castingTime:spell.castingTime, school:spell.school }));
}

function progressionClassCantripOptions(classId:string) {
  const presentations = new Map(SPELL_PRESENTATIONS.map((spell) => [spell.id,spell]));
  return spellOptions(classId,0).map((option) => {
    const presentation = presentations.get(option.id);
    return { id:option.id, label:presentation?.name ?? option.name, description:presentation?.summary ?? option.summary };
  });
}

function requestFor(state:AdapterState):ProgressionRequest {
  const draft = state.levelUpDraft;
  if (!draft) throw new Error("level-up draft missing");
  const sheet = ensureProgressionMetadata(state.activeCharacter);
  ensureSubclassRuntimeMetadata(sheet);
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

function syncDraftPlan(draft:LevelUpDraft,plan:ReturnType<typeof buildProgressionPlanPhase08Subclass>) {
  draft.validation = [
    ...plan.blocking.map((message) => ({ severity:"blocking" as const, message })),
    ...plan.warnings.map((message) => ({ severity:"warning" as const, message })),
  ];
  draft.preview.diffs = clone(plan.diffs);
}

function materializedRelationship(state:SrdSubclassProgressionState,request:ProgressionRequest,plan:ReturnType<typeof buildProgressionPlanPhase08Subclass>) {
  const subclassId = resolveSrdSubclassId({ state, classId:plan.targetClassId, targetClassLevel:plan.targetClassLevel, selections:request.selections });
  if (!subclassId) return undefined;
  const relationship = srdSubclassRelationship(plan.targetClassId,subclassId,plan.targetClassLevel);
  return relationship ? { subclassId, relationship } : undefined;
}

const oldGetSnapshot = MockAdapter.prototype.getSnapshot;
const oldCommitLevelUp = MockAdapter.prototype.commitLevelUp;

MockAdapter.prototype.getSnapshot = async function getSnapshotWithSrdSubclassProgression() {
  const internal = this as unknown as AdapterState;
  const snapshot = await oldGetSnapshot.call(this);
  if (!internal.levelUpDraft || !snapshot.levelUpDraft) return snapshot;
  const plan = buildProgressionPlanPhase08Subclass(characterState(internal.activeCharacter),requestFor(internal));
  syncDraftPlan(internal.levelUpDraft,plan);
  snapshot.levelUpDraft = clone(internal.levelUpDraft);
  snapshot.progressionPlan = clone(plan);
  return snapshot;
};

MockAdapter.prototype.commitLevelUp = async function commitLevelUpWithSrdSubclassProgression() {
  const internal = this as unknown as AdapterState;
  if (!internal.levelUpDraft) return oldCommitLevelUp.call(this);

  const stateBefore = characterState(internal.activeCharacter);
  const request = requestFor(internal);
  const resolved = resolveProgressionPhase08Subclass(stateBefore,request);
  if (resolved.status === "rejected") {
    syncDraftPlan(internal.levelUpDraft,resolved.plan);
    return internal.getSnapshot();
  }
  const materialized = materializedRelationship(stateBefore,request,resolved.plan);
  if (!materialized) return oldCommitLevelUp.call(this);

  const originalSelections = clone(internal.levelUpDraft.progressionSelections ?? {});
  internal.levelUpDraft.progressionSelections = clone(subclassSyntheticSelectionsForPlan(stateBefore,request,resolved.plan));
  const snapshot = await oldCommitLevelUp.call(this);
  if (internal.levelUpDraft) {
    internal.levelUpDraft.progressionSelections = originalSelections;
    syncDraftPlan(internal.levelUpDraft,resolved.plan);
    return internal.getSnapshot();
  }

  const next = resolved.state as SrdSubclassProgressionState;
  internal.activeCharacter.subclassIds = clone(next.subclassIds ?? {});
  internal.activeCharacter.subclassFeatureIds = clone(next.subclassFeatureIds ?? []);
  internal.activeCharacter.subclassFeatureSources = clone(next.subclassFeatureSources ?? {});
  internal.activeCharacter.fightingStyleFeatIds = clone(next.fightingStyleFeatIds ?? internal.activeCharacter.fightingStyleFeatIds ?? []);
  internal.activeCharacter.fightingStyleFeatSources = clone(next.fightingStyleFeatSources ?? internal.activeCharacter.fightingStyleFeatSources ?? {});

  const labels = materialized.relationship.features.map((feature) => feature.label);
  const choice = resolved.plan.choices.find((entry) => entry.id === subclassFeatureChoiceId(materialized.relationship.classId,materialized.relationship.classLevel));
  const selectedStyleId = selectedSubclassFeatureOption(choice,request.selections);
  const selectedStyleLabel = choice?.options.find((option) => option.id === selectedStyleId)?.label;
  internal.activeCharacter.features = unique([...internal.activeCharacter.features,...labels,...(selectedStyleLabel ? [selectedStyleLabel] : [])]);
  internal.activeCharacter.subclassSources ??= {};
  internal.activeCharacter.subclassSources[materialized.relationship.classId] ??= `SRD 5.2.1 · ${materialized.subclassId}`;
  internal.syncChar();

  const activity = internal.activity[0];
  if (activity) {
    const detail = resolved.plan.diffs.filter((diff) => diff.label.startsWith("서브클래스 특성"));
    activity.detail = [...activity.detail,...detail.map((diff) => `${diff.label}: ${diff.after} (${diff.source})`)];
    activity.stateChanges = [...activity.stateChanges,"Phase 08 SRD Subclass Features → Character Revision"];
  }
  return internal.getSnapshot();
};
