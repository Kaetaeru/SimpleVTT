import "./progressionContracts";
import "./sorcererDraconicContracts";
import "./creationContracts";
import "./progressionPhase08BardLoreAdapter";
import type { AppSnapshot, CharacterSheet, LevelUpDraft } from "./contracts";
import { fightingStyleOptions, generalLanguageOptions, originFeatOptions, spellOptions } from "./characterCreationV10Data";
import { SPELL_PRESENTATIONS } from "./spellPresentation";
import { MockAdapter } from "./mockAdapter";
import { ensureProgressionMetadata } from "./progressionRuntimeAdapter";
import { ensureSubclassRuntimeMetadata } from "./subclassRuntimeAdapter";
import type { ChoiceSelectionMap } from "../domain/choiceDefinition";
import { classById, classByName } from "../domain/progressionCatalog";
import type { ProgressionRequest } from "../domain/progression";
import {
  buildProgressionPlanPhase08SorcererDraconic,
  draconicSyntheticSelectionsForPlan,
  resolveProgressionPhase08SorcererDraconic,
  type SorcererDraconicProgressionState,
} from "../domain/progressionPhase08SorcererDraconic";
import {
  DRACONIC_RESILIENCE_FEATURE_ID,
  DRACONIC_SPELLS_FEATURE_ID,
  DRAGON_COMPANION_FEATURE_ID,
  DRAGON_WINGS_FEATURE_ID,
  ELEMENTAL_AFFINITY_FEATURE_ID,
  SORCERER_DRACONIC_SUBCLASS_ID,
  SORCERER_ID,
} from "../domain/sorcererDraconic";

const clone = <T,>(value:T):T => structuredClone(value);
const unique = (values:string[]) => [...new Set(values.filter(Boolean))];
const normalizedSkillName = (value:string) => value.replace(/\s+[+-]\d+$/,"").trim();
const FEATURE_LABELS:Record<string,string> = {
  [DRACONIC_RESILIENCE_FEATURE_ID]:"드라코닉 회복력",
  [DRACONIC_SPELLS_FEATURE_ID]:"드라코닉 주문",
  [ELEMENTAL_AFFINITY_FEATURE_ID]:"원소 친화",
  [DRAGON_WINGS_FEATURE_ID]:"드래곤 날개",
  [DRAGON_COMPANION_FEATURE_ID]:"드래곤 동료",
};

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

function ensureDraconicStableId(sheet:CharacterSheet) {
  ensureSubclassRuntimeMetadata(sheet);
  const sorcerer = sheet.classLevels?.find((track) => track.classId === SORCERER_ID);
  if (sorcerer?.subclassName === classById(SORCERER_ID)?.srdSubclassName) {
    sheet.subclassIds ??= {};
    sheet.subclassSources ??= {};
    sheet.subclassIds[SORCERER_ID] = SORCERER_DRACONIC_SUBCLASS_ID;
    sheet.subclassSources[SORCERER_ID] ??= "SRD 5.2.1 · 소서러 · 드라코닉 소서리";
  }
  return sheet;
}

function characterState(sheet:CharacterSheet):SorcererDraconicProgressionState {
  ensureProgressionMetadata(sheet);
  ensureDraconicStableId(sheet);
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
    draconicAffinityDamageType:sheet.draconicAffinityDamageType,
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
  ensureDraconicStableId(sheet);
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

function syncDraftPlan(draft:LevelUpDraft,plan:ReturnType<typeof buildProgressionPlanPhase08SorcererDraconic>) {
  draft.validation = [
    ...plan.blocking.map((message) => ({ severity:"blocking" as const, message })),
    ...plan.warnings.map((message) => ({ severity:"warning" as const, message })),
  ];
  draft.preview.diffs = clone(plan.diffs);
}

function draconicRelevant(result:SorcererDraconicProgressionState,plan:ReturnType<typeof buildProgressionPlanPhase08SorcererDraconic>) {
  return plan.targetClassId === SORCERER_ID && result.subclassIds?.[SORCERER_ID] === SORCERER_DRACONIC_SUBCLASS_ID;
}

const oldGetSnapshot = MockAdapter.prototype.getSnapshot;
const oldCommitLevelUp = MockAdapter.prototype.commitLevelUp;

MockAdapter.prototype.getSnapshot = async function getSnapshotWithDraconicSorcery() {
  const internal = this as unknown as AdapterState;
  const snapshot = await oldGetSnapshot.call(this);
  ensureDraconicStableId(internal.activeCharacter);
  if (!internal.levelUpDraft || !snapshot.levelUpDraft) return snapshot;
  const plan = buildProgressionPlanPhase08SorcererDraconic(characterState(internal.activeCharacter),requestFor(internal));
  syncDraftPlan(internal.levelUpDraft,plan);
  snapshot.levelUpDraft = clone(internal.levelUpDraft);
  snapshot.progressionPlan = clone(plan);
  snapshot.activeCharacter = clone(internal.activeCharacter);
  return snapshot;
};

MockAdapter.prototype.commitLevelUp = async function commitLevelUpWithDraconicSorcery() {
  const internal = this as unknown as AdapterState;
  if (!internal.levelUpDraft) return oldCommitLevelUp.call(this);
  const stateBefore = characterState(internal.activeCharacter);
  const request = requestFor(internal);
  const resolved = resolveProgressionPhase08SorcererDraconic(stateBefore,request);
  if (resolved.status === "rejected") {
    syncDraftPlan(internal.levelUpDraft,resolved.plan);
    return internal.getSnapshot();
  }
  if (!draconicRelevant(resolved.state as SorcererDraconicProgressionState,resolved.plan)) return oldCommitLevelUp.call(this);

  const originalSelections = clone(internal.levelUpDraft.progressionSelections ?? {});
  internal.levelUpDraft.progressionSelections = clone(draconicSyntheticSelectionsForPlan(stateBefore,request,resolved.plan));
  const snapshot = await oldCommitLevelUp.call(this);
  if (internal.levelUpDraft) {
    internal.levelUpDraft.progressionSelections = originalSelections;
    syncDraftPlan(internal.levelUpDraft,resolved.plan);
    return internal.getSnapshot();
  }

  const next = resolved.state as SorcererDraconicProgressionState;
  internal.activeCharacter.maxHp = next.hpMaximum;
  internal.activeCharacter.preparedSpells = clone(next.preparedSpellIds ?? internal.activeCharacter.preparedSpells);
  internal.activeCharacter.preparedSpellSources = clone(next.preparedSpellSources ?? internal.activeCharacter.preparedSpellSources ?? {});
  internal.activeCharacter.subclassIds = clone(next.subclassIds ?? {});
  internal.activeCharacter.subclassFeatureIds = clone(next.subclassFeatureIds ?? []);
  internal.activeCharacter.subclassFeatureSources = clone(next.subclassFeatureSources ?? {});
  internal.activeCharacter.draconicAffinityDamageType = next.draconicAffinityDamageType;
  internal.activeCharacter.subclassSources ??= {};
  internal.activeCharacter.subclassSources[SORCERER_ID] ??= "SRD 5.2.1 · 소서러 · 드라코닉 소서리";
  const labels = (next.subclassFeatureIds ?? []).map((id) => FEATURE_LABELS[id]).filter((value):value is string => Boolean(value));
  internal.activeCharacter.features = unique([...internal.activeCharacter.features,...labels]);
  const sceneEntity = internal.scene.entities.find((entity) => entity.id === internal.activeCharacter.id);
  if (sceneEntity) sceneEntity.maxHp = internal.activeCharacter.maxHp;
  internal.syncChar();

  const activity = internal.activity[0];
  if (activity) {
    const details = resolved.plan.diffs.filter((diff) => diff.label === "드라코닉 주문" || diff.label === "원소 친화" || diff.after === "드라코닉 회복력" || diff.after === "드래곤 날개" || diff.after === "드래곤 동료");
    activity.detail = [...activity.detail,...details.map((diff) => `${diff.label}: ${diff.after} (${diff.source})`)];
    activity.stateChanges = [...activity.stateChanges,"Phase 08 Draconic Sorcery → Character Revision"];
  }
  return internal.getSnapshot();
};
