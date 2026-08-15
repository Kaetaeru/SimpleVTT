import type { ChoiceSelectionMap } from "./choiceDefinition";
import { isClericPersistentFeatureChoice } from "./clericProgressionChoices";
import { isDruidPersistentFeatureChoice } from "./druidProgressionChoices";
import type { ProgressionPlan } from "./progression";

export interface PersistentFeatureChoiceSelection {
  choiceId: string;
  optionId: string;
  label: string;
  source: string;
}

export function isPersistentFeatureChoice(choiceId: string) {
  return isClericPersistentFeatureChoice(choiceId) || isDruidPersistentFeatureChoice(choiceId);
}

export function persistentFeatureChoiceSelections(
  plan: ProgressionPlan,
  selections: ChoiceSelectionMap,
): PersistentFeatureChoiceSelection[] {
  const resolved: PersistentFeatureChoiceSelection[] = [];
  for (const choice of plan.choices.filter((entry) => isPersistentFeatureChoice(entry.id))) {
    const selection = selections[choice.id];
    if (selection?.kind !== "options") continue;
    const options = new Map(choice.options.map((option) => [option.id, option]));
    for (const optionId of selection.optionIds) {
      const option = options.get(optionId);
      if (!option || option.disabledReason) continue;
      resolved.push({
        choiceId:choice.id,
        optionId,
        label:option.label,
        source:choice.source,
      });
    }
  }
  return resolved;
}

export function hasPersistentFeatureOption(optionIds: readonly string[] | undefined, optionId: string) {
  return optionIds?.includes(optionId) === true;
}
