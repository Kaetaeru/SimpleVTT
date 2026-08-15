import { validateChoiceDefinitions, type ChoiceSelectionMap } from "./choiceDefinition";
import { BARD_COLLEGE_LORE_SUBCLASS_ID } from "./bardCollegeLore";
import {
  BARD_LORE_BONUS_PROFICIENCIES_FEATURE_ID,
  BARD_LORE_CLASS_ID,
  BARD_LORE_CUTTING_WORDS_FEATURE_ID,
  BARD_LORE_MAGICAL_DISCOVERIES_FEATURE_ID,
  BARD_LORE_PEERLESS_SKILL_FEATURE_ID,
  decodeLoreMagicalDiscoveryReplacement,
  isCollegeOfLore,
  loreBonusProficienciesChoice,
  loreMagicalDiscoveriesChoice,
  loreMagicalDiscoveriesChoiceId,
  loreMagicalDiscoveriesReplacementChoice,
  selectedOptionIds,
  type BardLoreProgressionState,
} from "./bardLoreProgression";
import type {
  ProgressionCharacterState,
  ProgressionPlan,
  ProgressionRequest,
  ProgressionResolution,
} from "./progression";
import {
  buildProgressionPlanPhase08Subclass,
  resolveProgressionPhase08Subclass,
} from "./progressionPhase08Subclass";
import { inferSrdSubclassId } from "./srdSubclassCatalog";
import { subclassFeatureChoiceId, syntheticSubclassFeatureSelection } from "./srdSubclassProgression";

function unique(values:string[]) {
  return [...new Set(values.filter(Boolean))];
}

function normalizedSpellId(value:string) {
  return value.startsWith("always:") ? value.slice("always:".length) : value;
}

function selectedLoreAtLevel3(request:ProgressionRequest,targetLevel:number) {
  if (targetLevel !== 3) return false;
  const selection = request.selections[`progression.${BARD_LORE_CLASS_ID}.3.subclass`];
  const option = selection?.kind === "options" ? selection.optionIds[0] : undefined;
  const name = option?.startsWith("subclass:") ? option.slice("subclass:".length) : undefined;
  return inferSrdSubclassId(BARD_LORE_CLASS_ID,name) === BARD_COLLEGE_LORE_SUBCLASS_ID;
}

function loreApplies(state:ProgressionCharacterState,request:ProgressionRequest,targetClassId:string,targetLevel:number) {
  if (targetClassId !== BARD_LORE_CLASS_ID) return false;
  return isCollegeOfLore(state as BardLoreProgressionState) || selectedLoreAtLevel3(request,targetLevel);
}

function syntheticRequestForLore(state:ProgressionCharacterState,request:ProgressionRequest,preview:ProgressionPlan) {
  if (!loreApplies(state,request,preview.targetClassId,preview.targetClassLevel)) return request;
  if (preview.targetClassLevel !== 6 && preview.targetClassLevel !== 14) return request;
  return {
    ...request,
    selections:{
      ...request.selections,
      [subclassFeatureChoiceId(BARD_LORE_CLASS_ID,preview.targetClassLevel)]:{
        kind:"options" as const,
        optionIds:[syntheticSubclassFeatureSelection(BARD_COLLEGE_LORE_SUBCLASS_ID)],
      },
    },
  };
}

function buildInner(state:ProgressionCharacterState,request:ProgressionRequest) {
  const preview = buildProgressionPlanPhase08Subclass(state,request);
  const synthetic = syntheticRequestForLore(state,request,preview);
  return {
    syntheticRequest:synthetic,
    plan:synthetic === request ? preview : buildProgressionPlanPhase08Subclass(state,synthetic),
  };
}

function presentationOptions(request:ProgressionRequest) {
  return request.spellOptions?.map((option) => ({ id:option.id, label:option.label, description:option.description }));
}

function materializedChoices(state:ProgressionCharacterState,request:ProgressionRequest,plan:ProgressionPlan) {
  if (!loreApplies(state,request,plan.targetClassId,plan.targetClassLevel)) return [];
  const loreState = state as BardLoreProgressionState;
  const choices = [];
  if (plan.targetClassLevel === 3) choices.push(loreBonusProficienciesChoice(state));
  if (plan.targetClassLevel === 6) choices.push(loreMagicalDiscoveriesChoice({ state:loreState, spellOptions:presentationOptions(request) }));
  const replacement = loreMagicalDiscoveriesReplacementChoice({
    state:loreState,
    targetClassLevel:plan.targetClassLevel,
    spellOptions:presentationOptions(request),
  });
  if (replacement) choices.push(replacement);
  return choices;
}

function featureSource(level:number) {
  return `전승 학파 ${level}레벨 · SRD 5.2.1`;
}

export function buildProgressionPlanPhase08BardLore(
  state:ProgressionCharacterState,
  request:ProgressionRequest,
):ProgressionPlan {
  const { plan:basePlan } = buildInner(state,request);
  if (!loreApplies(state,request,basePlan.targetClassId,basePlan.targetClassLevel)) return basePlan;
  const materialized = materializedChoices(state,request,basePlan);
  const coreSubclassId = subclassFeatureChoiceId(BARD_LORE_CLASS_ID,basePlan.targetClassLevel);
  const choices = [
    ...basePlan.choices.filter((choice) => !(basePlan.targetClassLevel === 6 || basePlan.targetClassLevel === 14) || choice.id !== coreSubclassId),
    ...materialized,
  ];
  const issues = validateChoiceDefinitions(materialized,request.selections);
  const blocking = unique([
    ...basePlan.blocking,
    ...issues.filter((issue) => issue.severity === "blocking").map((issue) => issue.message),
  ]);
  const warnings = unique([
    ...basePlan.warnings,
    ...issues.filter((issue) => issue.severity === "warning").map((issue) => issue.message),
  ]);
  const diffs = [...basePlan.diffs];

  if (basePlan.targetClassLevel === 3) {
    const choice = materialized.find((entry) => entry.id.endsWith(".lore.bonus-proficiencies"));
    const selected = selectedOptionIds(choice,request.selections)
      .map((id) => choice?.options.find((option) => option.id === id)?.label)
      .filter((value):value is string => Boolean(value));
    if (selected.length) diffs.push({ label:"전승 학파 · 추가 숙련", before:"—", after:selected.join(", "), source:choice!.source });
    diffs.push({ label:"서브클래스 특성", before:"—", after:"날카로운 말", source:featureSource(3) });
  }
  if (basePlan.targetClassLevel === 6) {
    const choice = materialized.find((entry) => entry.id === loreMagicalDiscoveriesChoiceId());
    const selected = selectedOptionIds(choice,request.selections)
      .map((id) => choice?.options.find((option) => option.id === id)?.label ?? id);
    if (selected.length) diffs.push({ label:"전승 학파 · 마법 발견", before:"—", after:selected.join(", "), source:choice!.source });
  }
  if (basePlan.targetClassLevel === 14) {
    diffs.push({ label:"서브클래스 특성", before:"—", after:"비할 데 없는 기량", source:featureSource(14) });
  }
  const replacement = materialized.find((entry) => entry.id.endsWith(".lore.magical-discoveries-replacement"));
  const replacementValue = selectedOptionIds(replacement,request.selections)[0];
  const decoded = replacementValue ? decodeLoreMagicalDiscoveryReplacement(replacementValue) : undefined;
  if (decoded && replacement) {
    const option = replacement.options.find((entry) => entry.id === replacementValue);
    const [before,after] = option?.label.split(" → ") ?? [decoded.oldSpellId,decoded.newSpellId];
    diffs.push({ label:"마법 발견 교체", before, after, source:replacement.source });
  }
  return { ...basePlan, choices, blocking, warnings, diffs };
}

function persistFeatureIds(state:BardLoreProgressionState,level:number) {
  const ids = level === 3
    ? [BARD_LORE_BONUS_PROFICIENCIES_FEATURE_ID,BARD_LORE_CUTTING_WORDS_FEATURE_ID]
    : level === 6
      ? [BARD_LORE_MAGICAL_DISCOVERIES_FEATURE_ID]
      : level === 14
        ? [BARD_LORE_PEERLESS_SKILL_FEATURE_ID]
        : [];
  if (!ids.length) return;
  state.subclassFeatureIds = unique([...(state.subclassFeatureIds ?? []),...ids]);
  state.subclassFeatureSources = { ...(state.subclassFeatureSources ?? {}) };
  for (const id of ids) state.subclassFeatureSources[id] = featureSource(level);
  state.features = unique([...state.features,...ids]);
}

function persistLoreChoices(
  state:BardLoreProgressionState,
  request:ProgressionRequest,
  plan:ProgressionPlan,
) {
  state.subclassIds = { ...(state.subclassIds ?? {}), [BARD_LORE_CLASS_ID]:BARD_COLLEGE_LORE_SUBCLASS_ID };
  persistFeatureIds(state,plan.targetClassLevel);

  if (plan.targetClassLevel === 3) {
    const choice = plan.choices.find((entry) => entry.id.endsWith(".lore.bonus-proficiencies"));
    const labels = selectedOptionIds(choice,request.selections)
      .map((id) => choice?.options.find((option) => option.id === id)?.label)
      .filter((value):value is string => Boolean(value));
    state.proficientSkills = unique([...(state.proficientSkills ?? []),...labels]);
  }

  if (plan.targetClassLevel === 6) {
    const choice = plan.choices.find((entry) => entry.id === loreMagicalDiscoveriesChoiceId());
    const spellIds = selectedOptionIds(choice,request.selections);
    state.bardMagicalDiscoverySpellIds = unique([...(state.bardMagicalDiscoverySpellIds ?? []),...spellIds]);
    state.bardMagicalDiscoverySpellSources = { ...(state.bardMagicalDiscoverySpellSources ?? {}) };
    state.preparedSpellIds = [...(state.preparedSpellIds ?? [])];
    state.preparedSpellSources = { ...(state.preparedSpellSources ?? {}) };
    for (const spellId of spellIds) {
      const source = choice?.source ?? featureSource(6);
      state.bardMagicalDiscoverySpellSources[spellId] = source;
      if (!state.preparedSpellIds.some((value) => normalizedSpellId(value) === spellId && value.startsWith("always:"))) {
        state.preparedSpellIds.push(`always:${spellId}`);
      }
      state.preparedSpellSources[spellId] = source;
    }
  }

  const replacement = plan.choices.find((entry) => entry.id.endsWith(".lore.magical-discoveries-replacement"));
  const replacementValue = selectedOptionIds(replacement,request.selections)[0];
  const decoded = replacementValue ? decodeLoreMagicalDiscoveryReplacement(replacementValue) : undefined;
  if (decoded && replacement) {
    state.bardMagicalDiscoverySpellIds = (state.bardMagicalDiscoverySpellIds ?? []).filter((id) => id !== decoded.oldSpellId);
    state.bardMagicalDiscoverySpellIds = unique([...(state.bardMagicalDiscoverySpellIds ?? []),decoded.newSpellId]);
    state.bardMagicalDiscoverySpellSources = { ...(state.bardMagicalDiscoverySpellSources ?? {}) };
    delete state.bardMagicalDiscoverySpellSources[decoded.oldSpellId];
    state.bardMagicalDiscoverySpellSources[decoded.newSpellId] = replacement.source;
    state.preparedSpellIds = (state.preparedSpellIds ?? []).filter((value) => value !== `always:${decoded.oldSpellId}`);
    state.preparedSpellIds = unique([...(state.preparedSpellIds ?? []),`always:${decoded.newSpellId}`]);
    state.preparedSpellSources = { ...(state.preparedSpellSources ?? {}) };
    if (state.preparedSpellSources[decoded.oldSpellId] === replacement.source || state.preparedSpellSources[decoded.oldSpellId]?.includes("마법 발견")) {
      delete state.preparedSpellSources[decoded.oldSpellId];
    }
    state.preparedSpellSources[decoded.newSpellId] = replacement.source;
  }
}

export function resolveProgressionPhase08BardLore(
  state:ProgressionCharacterState,
  request:ProgressionRequest,
):ProgressionResolution {
  const plan = buildProgressionPlanPhase08BardLore(state,request);
  if (plan.blocking.length) return { status:"rejected", state, plan, error:plan.blocking.join(" | ") };
  const { syntheticRequest } = buildInner(state,request);
  const base = resolveProgressionPhase08Subclass(state,syntheticRequest);
  if (base.status === "rejected") return { status:"rejected", state, plan, error:base.error };
  if (!loreApplies(state,request,plan.targetClassId,plan.targetClassLevel)) return { status:"committed", state:base.state, plan };
  const next = structuredClone(base.state) as BardLoreProgressionState;
  persistLoreChoices(next,request,plan);
  return { status:"committed", state:next, plan };
}

export function loreSyntheticSelectionsForPlan(
  state:ProgressionCharacterState,
  request:ProgressionRequest,
  plan:ProgressionPlan,
):ChoiceSelectionMap {
  return syntheticRequestForLore(state,request,plan).selections;
}
