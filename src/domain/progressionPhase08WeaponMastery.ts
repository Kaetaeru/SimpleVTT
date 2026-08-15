import {
  registerCatalogPendingChoiceResolver,
  validateChoiceDefinitions,
} from "./choiceDefinition";
import type {
  ProgressionCharacterState,
  ProgressionPlan,
  ProgressionRequest,
  ProgressionResolution,
} from "./progression";
import {
  buildProgressionPlanPhase08EpicBoon,
  resolveProgressionPhase08EpicBoon,
} from "./progressionPhase08EpicBoon";
import {
  selectedWeaponMasteryIds,
  weaponMasteryChoiceDefinition,
  type WeaponMasteryProgressionState,
} from "./weaponMasteryProgression";
import { weaponRuleById } from "./weaponRuleCatalog";

registerCatalogPendingChoiceResolver("phase08:weapon-mastery",(definition,selection) => {
  if (definition.kind !== "weapon-mastery" || !definition.id.endsWith(".column.무기 통달")) return undefined;
  if (!selection) {
    return [{ choiceId:definition.id, severity:"blocking", message:`${definition.label} 선택이 필요합니다.` }];
  }
  if (selection.kind !== "options" || selection.optionIds.length !== definition.count) {
    return [{ choiceId:definition.id, severity:"blocking", message:`${definition.label}에서 ${definition.count}개를 선택해야 합니다.` }];
  }
  return [];
});

function unique(values:string[]) {
  return [...new Set(values.filter(Boolean))];
}

function masteryChoice(state:ProgressionCharacterState,basePlan:ProgressionPlan) {
  return weaponMasteryChoiceDefinition({
    state:state as WeaponMasteryProgressionState,
    targetClassId:basePlan.targetClassId,
    targetClassLevel:basePlan.targetClassLevel,
  });
}

export function buildProgressionPlanPhase08WeaponMastery(
  state:ProgressionCharacterState,
  request:ProgressionRequest,
):ProgressionPlan {
  const basePlan = buildProgressionPlanPhase08EpicBoon(state,request);
  const choice = masteryChoice(state,basePlan);
  if (!choice) return basePlan;
  const issues = validateChoiceDefinitions([choice],request.selections);
  const blocking = unique([
    ...basePlan.blocking,
    ...issues.filter((issue) => issue.severity === "blocking").map((issue) => issue.message),
  ]);
  const warnings = unique([
    ...basePlan.warnings,
    ...issues.filter((issue) => issue.severity === "warning").map((issue) => issue.message),
  ]);
  const choices = [...basePlan.choices.filter((entry) => entry.id !== choice.id),choice];
  const diffs = [...basePlan.diffs];
  const selected = selectedWeaponMasteryIds(choice,request.selections);
  if (selected.length) {
    diffs.push({
      label:"무기 통달",
      before:(state as WeaponMasteryProgressionState).weaponMasteryIds?.map((id) => weaponRuleById(id)?.name ?? id).join(", ") || "—",
      after:unique([...(state as WeaponMasteryProgressionState).weaponMasteryIds ?? [],...selected]).map((id) => weaponRuleById(id)?.name ?? id).join(", "),
      source:choice.source,
    });
  }
  return { ...basePlan, choices, blocking, warnings, diffs };
}

export function resolveProgressionPhase08WeaponMastery(
  state:ProgressionCharacterState,
  request:ProgressionRequest,
):ProgressionResolution {
  const plan = buildProgressionPlanPhase08WeaponMastery(state,request);
  if (plan.blocking.length) {
    return { status:"rejected", state, plan, error:plan.blocking.join(" | ") };
  }
  const choice = masteryChoice(state,plan);
  const selected = selectedWeaponMasteryIds(choice,request.selections);
  const base = resolveProgressionPhase08EpicBoon(state,request);
  if (base.status === "rejected") return { status:"rejected", state, plan, error:base.error };
  if (!choice || !selected.length) return { status:"committed", state:base.state, plan };

  const next = structuredClone(base.state) as WeaponMasteryProgressionState;
  next.weaponMasteryIds = unique([...(next.weaponMasteryIds ?? []),...selected]);
  next.weaponMasterySources = { ...(next.weaponMasterySources ?? {}) };
  for (const weaponId of selected) next.weaponMasterySources[weaponId] = choice.source;
  return { status:"committed", state:next, plan };
}
