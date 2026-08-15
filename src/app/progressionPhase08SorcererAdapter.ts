import "./progressionContracts";
import "./creationContracts";
import "./progressionRuntimeAdapter";
import "./sorceryRuntimeAdapter";
import type { AppSnapshot, CharacterSheet, LevelUpDraft } from "./contracts";
import { fightingStyleOptions, generalLanguageOptions, originFeatOptions, spellOptions } from "./characterCreationV10Data";
import { SPELL_PRESENTATIONS } from "./spellPresentation";
import { MockAdapter } from "./mockAdapter";
import { ensureProgressionMetadata } from "./progressionRuntimeAdapter";
import type { ChoiceSelectionMap } from "../domain/choiceDefinition";
import { classByName } from "../domain/progressionCatalog";
import type { ProgressionCharacterState, ProgressionRequest } from "../domain/progression";
import {
  buildProgressionPlanPhase08Sorcerer,
  resolveProgressionPhase08Sorcerer,
} from "../domain/progressionPhase08Sorcerer";

const clone = <T,>(value: T): T => structuredClone(value);
const unique = (values: string[]) => [...new Set(values.filter(Boolean))];
const normalizedSkillName = (value: string) => value.replace(/\s+[+-]\d+$/, "").trim();

type AdapterState = {
  activeCharacter: CharacterSheet;
  levelUpDraft: LevelUpDraft | null;
  catalog: AppSnapshot["catalog"];
  activity: AppSnapshot["activity"];
  getSnapshot(): Promise<AppSnapshot>;
  syncChar(): void;
};

function primaryClass(sheet: CharacterSheet) {
  return classByName(sheet.className) ?? classByName(sheet.className.split("/")[0]?.trim() ?? sheet.className);
}

function characterState(sheet: CharacterSheet): ProgressionCharacterState {
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

function progressionClassCantripOptions(classId: string) {
  const presentations = new Map(SPELL_PRESENTATIONS.map((spell) => [spell.id, spell]));
  return spellOptions(classId, 0).map((option) => {
    const presentation = presentations.get(option.id);
    return {
      id:option.id,
      label:presentation?.name ?? option.name,
      description:presentation?.summary ?? option.summary,
    };
  });
}

function requestFor(state: AdapterState): ProgressionRequest {
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

function syncDraftPlan(draft: LevelUpDraft, plan: ReturnType<typeof buildProgressionPlanPhase08Sorcerer>) {
  draft.validation = [
    ...plan.blocking.map((message) => ({ severity:"blocking" as const, message })),
    ...plan.warnings.map((message) => ({ severity:"warning" as const, message })),
  ];
  draft.preview.diffs = clone(plan.diffs);
}

const oldGetSnapshot = MockAdapter.prototype.getSnapshot;
const oldCommitLevelUp = MockAdapter.prototype.commitLevelUp;

MockAdapter.prototype.getSnapshot = async function getSnapshotWithSorcererReplacement() {
  const internal = this as unknown as AdapterState;
  const snapshot = await oldGetSnapshot.call(this);
  if (!internal.levelUpDraft || !snapshot.levelUpDraft) return snapshot;
  const plan = buildProgressionPlanPhase08Sorcerer(characterState(internal.activeCharacter), requestFor(internal));
  syncDraftPlan(internal.levelUpDraft, plan);
  snapshot.levelUpDraft = clone(internal.levelUpDraft);
  snapshot.progressionPlan = clone(plan);
  return snapshot;
};

MockAdapter.prototype.commitLevelUp = async function commitLevelUpWithSorcererReplacement() {
  const internal = this as unknown as AdapterState;
  if (!internal.levelUpDraft) return oldCommitLevelUp.call(this);

  const stateBefore = characterState(internal.activeCharacter);
  const request = requestFor(internal);
  const resolved = resolveProgressionPhase08Sorcerer(stateBefore, request);
  if (resolved.status === "rejected") {
    syncDraftPlan(internal.levelUpDraft, resolved.plan);
    return internal.getSnapshot();
  }

  const replacementDiff = resolved.plan.diffs.find((diff) => diff.label === "메타매직 교체");
  const snapshot = await oldCommitLevelUp.call(this);
  if (internal.levelUpDraft || !replacementDiff) return snapshot;

  internal.activeCharacter.metamagicIds = clone(resolved.state.metamagicIds ?? []);
  internal.activeCharacter.metamagicSources = clone(resolved.state.metamagicSources ?? {});
  internal.syncChar();

  const activity = internal.activity[0];
  if (activity) {
    activity.detail = [...activity.detail, `메타매직 교체: ${replacementDiff.before} → ${replacementDiff.after} (${replacementDiff.source})`];
    activity.stateChanges = [...activity.stateChanges, "Phase 08 Sorcerer Metamagic replacement → Character Revision"];
  }

  return internal.getSnapshot();
};
