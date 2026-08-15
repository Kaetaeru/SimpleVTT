import "./progressionContracts";
import "./creationContracts";
import "./progressionPhase08SubclassAdapter";
import "./bardicInspirationRuntimeAdapter";
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
  buildProgressionPlanPhase08BardLore,
  loreSyntheticSelectionsForPlan,
  resolveProgressionPhase08BardLore,
} from "../domain/progressionPhase08BardLore";
import {
  BARD_LORE_BONUS_PROFICIENCIES_FEATURE_ID,
  BARD_LORE_CLASS_ID,
  BARD_LORE_CUTTING_WORDS_FEATURE_ID,
  BARD_LORE_MAGICAL_DISCOVERIES_FEATURE_ID,
  BARD_LORE_PEERLESS_SKILL_FEATURE_ID,
  type BardLoreProgressionState,
} from "../domain/bardLoreProgression";

const clone = <T,>(value:T):T => structuredClone(value);
const unique = (values:string[]) => [...new Set(values.filter(Boolean))];
const normalizedSkillName = (value:string) => value.replace(/\s+[+-]\d+$/,"").trim();

const LORE_FEATURE_LABELS:Record<string,string> = {
  [BARD_LORE_BONUS_PROFICIENCIES_FEATURE_ID]:"추가 숙련",
  [BARD_LORE_CUTTING_WORDS_FEATURE_ID]:"날카로운 말",
  [BARD_LORE_MAGICAL_DISCOVERIES_FEATURE_ID]:"마법 발견",
  [BARD_LORE_PEERLESS_SKILL_FEATURE_ID]:"비할 데 없는 기량",
};

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

function characterState(sheet:CharacterSheet):BardLoreProgressionState {
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
    bardMagicalDiscoverySpellIds:clone(sheet.bardMagicalDiscoverySpellIds ?? []),
    bardMagicalDiscoverySpellSources:clone(sheet.bardMagicalDiscoverySpellSources ?? {}),
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

function syncDraftPlan(draft:LevelUpDraft,plan:ReturnType<typeof buildProgressionPlanPhase08BardLore>) {
  draft.validation = [
    ...plan.blocking.map((message) => ({ severity:"blocking" as const, message })),
    ...plan.warnings.map((message) => ({ severity:"warning" as const, message })),
  ];
  draft.preview.diffs = clone(plan.diffs);
}

function loreRelevant(stateBefore:BardLoreProgressionState,request:ProgressionRequest,plan:ReturnType<typeof buildProgressionPlanPhase08BardLore>) {
  if (plan.targetClassId !== BARD_LORE_CLASS_ID) return false;
  if ([3,6,14].includes(plan.targetClassLevel)) return true;
  return plan.choices.some((choice) => choice.id.endsWith(".lore.magical-discoveries-replacement") && request.selections[choice.id]);
}

const oldGetSnapshot = MockAdapter.prototype.getSnapshot;
const oldCommitLevelUp = MockAdapter.prototype.commitLevelUp;

MockAdapter.prototype.getSnapshot = async function getSnapshotWithCollegeLoreProgression() {
  const internal = this as unknown as AdapterState;
  const snapshot = await oldGetSnapshot.call(this);
  if (!internal.levelUpDraft || !snapshot.levelUpDraft) return snapshot;
  const plan = buildProgressionPlanPhase08BardLore(characterState(internal.activeCharacter),requestFor(internal));
  syncDraftPlan(internal.levelUpDraft,plan);
  snapshot.levelUpDraft = clone(internal.levelUpDraft);
  snapshot.progressionPlan = clone(plan);
  return snapshot;
};

MockAdapter.prototype.commitLevelUp = async function commitLevelUpWithCollegeLoreProgression() {
  const internal = this as unknown as AdapterState;
  if (!internal.levelUpDraft) return oldCommitLevelUp.call(this);
  const stateBefore = characterState(internal.activeCharacter);
  const request = requestFor(internal);
  const resolved = resolveProgressionPhase08BardLore(stateBefore,request);
  if (resolved.status === "rejected") {
    syncDraftPlan(internal.levelUpDraft,resolved.plan);
    return internal.getSnapshot();
  }
  if (!loreRelevant(stateBefore,request,resolved.plan)) return oldCommitLevelUp.call(this);

  const originalSelections = clone(internal.levelUpDraft.progressionSelections ?? {});
  internal.levelUpDraft.progressionSelections = clone(loreSyntheticSelectionsForPlan(stateBefore,request,resolved.plan));
  const snapshot = await oldCommitLevelUp.call(this);
  if (internal.levelUpDraft) {
    internal.levelUpDraft.progressionSelections = originalSelections;
    syncDraftPlan(internal.levelUpDraft,resolved.plan);
    return internal.getSnapshot();
  }

  const next = resolved.state as BardLoreProgressionState;
  internal.activeCharacter.skills = clone(next.proficientSkills ?? internal.activeCharacter.skills);
  internal.activeCharacter.preparedSpells = clone(next.preparedSpellIds ?? internal.activeCharacter.preparedSpells);
  internal.activeCharacter.preparedSpellSources = clone(next.preparedSpellSources ?? internal.activeCharacter.preparedSpellSources ?? {});
  internal.activeCharacter.subclassIds = clone(next.subclassIds ?? internal.activeCharacter.subclassIds ?? {});
  internal.activeCharacter.subclassFeatureIds = clone(next.subclassFeatureIds ?? internal.activeCharacter.subclassFeatureIds ?? []);
  internal.activeCharacter.subclassFeatureSources = clone(next.subclassFeatureSources ?? internal.activeCharacter.subclassFeatureSources ?? {});
  internal.activeCharacter.bardMagicalDiscoverySpellIds = clone(next.bardMagicalDiscoverySpellIds ?? []);
  internal.activeCharacter.bardMagicalDiscoverySpellSources = clone(next.bardMagicalDiscoverySpellSources ?? {});
  internal.activeCharacter.subclassSources ??= {};
  internal.activeCharacter.subclassSources[BARD_LORE_CLASS_ID] ??= "SRD 5.2.1 · 바드 · 전승 학파";
  const loreLabels = (next.subclassFeatureIds ?? []).map((id) => LORE_FEATURE_LABELS[id]).filter((value):value is string => Boolean(value));
  internal.activeCharacter.features = unique([...internal.activeCharacter.features,...loreLabels]);
  internal.syncChar();

  const activity = internal.activity[0];
  if (activity) {
    const details = resolved.plan.diffs.filter((diff) => diff.label.includes("전승 학파") || diff.label === "마법 발견 교체" || diff.after === "날카로운 말" || diff.after === "비할 데 없는 기량");
    activity.detail = [...activity.detail,...details.map((diff) => `${diff.label}: ${diff.after} (${diff.source})`)];
    activity.stateChanges = [...activity.stateChanges,"Phase 08 College of Lore → Character Revision"];
  }
  return internal.getSnapshot();
};
