import { validateChoiceDefinitions } from "./choiceDefinition";
import type {
  ProgressionCharacterState,
  ProgressionPlan,
  ProgressionRequest,
  ProgressionResolution,
} from "./progression";
import { classById } from "./progressionCatalog";
import {
  buildProgressionPlanPhase08BardLore,
  resolveProgressionPhase08BardLore,
} from "./progressionPhase08BardLore";
import { subclassFeatureChoiceId, syntheticSubclassFeatureSelection } from "./srdSubclassProgression";
import {
  allDraconicSpellsAtLevel,
  DRACONIC_AFFINITY_TYPES,
  DRACONIC_RESILIENCE_FEATURE_ID,
  DRACONIC_SPELLS_FEATURE_ID,
  DRAGON_COMPANION_FEATURE_ID,
  DRAGON_WINGS_FEATURE_ID,
  draconicSpellsUnlockedAtLevel,
  ELEMENTAL_AFFINITY_FEATURE_ID,
  SORCERER_DRACONIC_SUBCLASS_ID,
  SORCERER_ID,
  type DraconicAffinityDamageType,
} from "./sorcererDraconic";

export interface SorcererDraconicProgressionState extends ProgressionCharacterState {
  subclassIds?:Record<string,string>;
  subclassFeatureIds?:string[];
  subclassFeatureSources?:Record<string,string>;
  draconicAffinityDamageType?:DraconicAffinityDamageType;
}

function unique(values:string[]) {
  return [...new Set(values.filter(Boolean))];
}

function selectedDraconicAtLevel3(request:ProgressionRequest,targetLevel:number) {
  if (targetLevel !== 3) return false;
  const selection = request.selections[`progression.${SORCERER_ID}.3.subclass`];
  const option = selection?.kind === "options" ? selection.optionIds[0] : undefined;
  const selectedName = option?.startsWith("subclass:") ? option.slice("subclass:".length) : undefined;
  return selectedName === classById(SORCERER_ID)?.srdSubclassName;
}

function isDraconic(state:ProgressionCharacterState,request:ProgressionRequest,targetLevel:number) {
  const draconic = state as SorcererDraconicProgressionState;
  return draconic.subclassIds?.[SORCERER_ID] === SORCERER_DRACONIC_SUBCLASS_ID
    || state.classTracks.some((track) => track.classId === SORCERER_ID && track.subclassName === classById(SORCERER_ID)?.srdSubclassName)
    || selectedDraconicAtLevel3(request,targetLevel);
}

export function draconicAffinityChoiceId() {
  return subclassFeatureChoiceId(SORCERER_ID,6);
}

function affinityChoice():import("./choiceDefinition").ChoiceDefinition {
  const labels:Record<DraconicAffinityDamageType,string> = {
    acid:"산성",
    cold:"냉기",
    fire:"화염",
    lightning:"번개",
    poison:"독",
  };
  return {
    id:draconicAffinityChoiceId(),
    label:"원소 친화",
    description:"산성, 냉기, 화염, 번개, 독 중 하나를 선택합니다. 해당 피해에 저항을 얻고, 같은 피해 유형의 주문 피해 굴림 하나에 매력 수정치를 더할 수 있습니다.",
    kind:"feature-option",
    count:1,
    required:true,
    status:"ready",
    source:"드라코닉 소서리 6레벨 · 원소 친화 · SRD 5.2.1",
    options:DRACONIC_AFFINITY_TYPES.map((type) => ({ id:`damage:${type}`, label:labels[type], description:`${labels[type]} 피해 유형` })),
  };
}

function syntheticRequest(state:ProgressionCharacterState,request:ProgressionRequest,preview:ProgressionPlan) {
  if (preview.targetClassId !== SORCERER_ID || !isDraconic(state,request,preview.targetClassLevel)) return request;
  if (![6,14,18].includes(preview.targetClassLevel)) return request;
  return {
    ...request,
    selections:{
      ...request.selections,
      [subclassFeatureChoiceId(SORCERER_ID,preview.targetClassLevel)]:{
        kind:"options" as const,
        optionIds:[syntheticSubclassFeatureSelection(SORCERER_DRACONIC_SUBCLASS_ID)],
      },
    },
  };
}

function buildInner(state:ProgressionCharacterState,request:ProgressionRequest) {
  const preview = buildProgressionPlanPhase08BardLore(state,request);
  const synthetic = syntheticRequest(state,request,preview);
  return { syntheticRequest:synthetic, plan:synthetic === request ? preview : buildProgressionPlanPhase08BardLore(state,synthetic) };
}

function featureIdsForLevel(level:number) {
  if (level === 3) return [DRACONIC_RESILIENCE_FEATURE_ID,DRACONIC_SPELLS_FEATURE_ID];
  if (level === 6) return [ELEMENTAL_AFFINITY_FEATURE_ID];
  if (level === 14) return [DRAGON_WINGS_FEATURE_ID];
  if (level === 18) return [DRAGON_COMPANION_FEATURE_ID];
  return [];
}

function sourceForLevel(level:number) {
  return `드라코닉 소서리 ${level}레벨 · SRD 5.2.1`;
}

function draconicHpMaximumGain(state:ProgressionCharacterState,plan:ProgressionPlan,request:ProgressionRequest) {
  if (plan.targetClassId !== SORCERER_ID || !isDraconic(state,request,plan.targetClassLevel)) return 0;
  if (plan.targetClassLevel === 3) return 3;
  return plan.targetClassLevel > 3 ? 1 : 0;
}

export function buildProgressionPlanPhase08SorcererDraconic(
  state:ProgressionCharacterState,
  request:ProgressionRequest,
):ProgressionPlan {
  const { plan:basePlan } = buildInner(state,request);
  if (basePlan.targetClassId !== SORCERER_ID || !isDraconic(state,request,basePlan.targetClassLevel)) return basePlan;
  const targetLevel = basePlan.targetClassLevel;
  const coreSubclassId = subclassFeatureChoiceId(SORCERER_ID,targetLevel);
  const choices = basePlan.choices.filter((choice) => ![6,14,18].includes(targetLevel) || choice.id !== coreSubclassId);
  const materialized = targetLevel === 6 ? affinityChoice() : undefined;
  if (materialized) choices.push(materialized);
  const issues = materialized ? validateChoiceDefinitions([materialized],request.selections) : [];
  const blocking = unique([...basePlan.blocking,...issues.filter((issue) => issue.severity === "blocking").map((issue) => issue.message)]);
  const warnings = unique([...basePlan.warnings,...issues.filter((issue) => issue.severity === "warning").map((issue) => issue.message)]);
  const draconicSpells = allDraconicSpellsAtLevel(targetLevel);
  for (const choice of choices) {
    if (choice.id === `progression.${SORCERER_ID}.${targetLevel}.column.준비 주문`) {
      choice.options = choice.options.map((option) => draconicSpells.includes(option.id)
        ? { ...option, disabledReason:option.disabledReason ?? "드라코닉 소서리로 항상 준비되는 주문입니다." }
        : option);
    }
  }
  const hpBonus = draconicHpMaximumGain(state,basePlan,request);
  const hp = hpBonus > 0 ? { ...basePlan.hp, totalGain:basePlan.hp.totalGain + hpBonus } : basePlan.hp;
  const diffs = basePlan.diffs.map((diff) => diff.label === "최대 HP" && hpBonus > 0
    ? { ...diff, after:String(Number(diff.after) + hpBonus) }
    : diff);

  const unlocked = draconicSpellsUnlockedAtLevel(targetLevel);
  if (unlocked.length) diffs.push({
    label:"드라코닉 주문",
    before:"—",
    after:unlocked.map((entry) => entry.spellId.split(".").at(-1)).join(", "),
    source:unlocked[0].source,
  });
  if (targetLevel === 3) diffs.push({ label:"서브클래스 특성", before:"—", after:"드라코닉 회복력", source:sourceForLevel(3) });
  if (targetLevel === 6 && materialized) {
    const selection = request.selections[materialized.id];
    const id = selection?.kind === "options" ? selection.optionIds[0] : undefined;
    const option = materialized.options.find((entry) => entry.id === id);
    if (option) diffs.push({ label:"원소 친화", before:"—", after:option.label, source:materialized.source });
  }
  if (targetLevel === 14) diffs.push({ label:"서브클래스 특성", before:"—", after:"드래곤 날개", source:sourceForLevel(14) });
  if (targetLevel === 18) diffs.push({ label:"서브클래스 특성", before:"—", after:"드래곤 동료", source:sourceForLevel(18) });
  return { ...basePlan, choices, blocking, warnings, hp, diffs };
}

function persist(state:SorcererDraconicProgressionState,request:ProgressionRequest,plan:ProgressionPlan) {
  const level = plan.targetClassLevel;
  state.subclassIds = { ...(state.subclassIds ?? {}), [SORCERER_ID]:SORCERER_DRACONIC_SUBCLASS_ID };
  const featureIds = featureIdsForLevel(level);
  if (featureIds.length) {
    state.subclassFeatureIds = unique([...(state.subclassFeatureIds ?? []),...featureIds]);
    state.subclassFeatureSources = { ...(state.subclassFeatureSources ?? {}) };
    for (const featureId of featureIds) state.subclassFeatureSources[featureId] = sourceForLevel(level);
    state.features = unique([...state.features,...featureIds]);
  }
  const unlocked = draconicSpellsUnlockedAtLevel(level);
  if (unlocked.length) {
    state.preparedSpellIds = [...(state.preparedSpellIds ?? [])];
    state.preparedSpellSources = { ...(state.preparedSpellSources ?? {}) };
    for (const entry of unlocked) {
      if (!state.preparedSpellIds.includes(`always:${entry.spellId}`)) state.preparedSpellIds.push(`always:${entry.spellId}`);
      state.preparedSpellSources[entry.spellId] = entry.source;
    }
  }
  if (level === 6) {
    const selection = request.selections[draconicAffinityChoiceId()];
    const option = selection?.kind === "options" ? selection.optionIds[0] : undefined;
    if (option?.startsWith("damage:")) state.draconicAffinityDamageType = option.slice("damage:".length) as DraconicAffinityDamageType;
  }
}

export function resolveProgressionPhase08SorcererDraconic(
  state:ProgressionCharacterState,
  request:ProgressionRequest,
):ProgressionResolution {
  const plan = buildProgressionPlanPhase08SorcererDraconic(state,request);
  if (plan.blocking.length) return { status:"rejected", state, plan, error:plan.blocking.join(" | ") };
  const { syntheticRequest } = buildInner(state,request);
  const base = resolveProgressionPhase08BardLore(state,syntheticRequest);
  if (base.status === "rejected") return { status:"rejected", state, plan, error:base.error };
  if (plan.targetClassId !== SORCERER_ID || !isDraconic(state,request,plan.targetClassLevel)) return { status:"committed", state:base.state, plan };
  const next = structuredClone(base.state) as SorcererDraconicProgressionState;
  const hpBonus = draconicHpMaximumGain(state,plan,request);
  if (hpBonus > 0) next.hpMaximum += hpBonus;
  persist(next,request,plan);
  return { status:"committed", state:next, plan };
}

export function draconicSyntheticSelectionsForPlan(state:ProgressionCharacterState,request:ProgressionRequest,plan:ProgressionPlan) {
  return syntheticRequest(state,request,plan).selections;
}
