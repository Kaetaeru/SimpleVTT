export type ChoiceDefinitionKind =
  | "asi-or-feat"
  | "subclass"
  | "spell"
  | "weapon-mastery"
  | "skill"
  | "expertise"
  | "language"
  | "feature-option"
  | "epic-boon";

export type ChoiceDefinitionStatus = "ready" | "catalog-pending" | "not-applicable";

export interface ChoiceOptionDefinition {
  id: string;
  label: string;
  description?: string;
  disabledReason?: string;
}

export interface ChoiceDefinition {
  id: string;
  label: string;
  description: string;
  kind: ChoiceDefinitionKind;
  count: number;
  required: boolean;
  status: ChoiceDefinitionStatus;
  source: string;
  options: ChoiceOptionDefinition[];
  pendingReason?: string;
}

export type AbilityChoiceKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

export type ChoiceSelectionValue =
  | { kind: "options"; optionIds: string[] }
  | { kind: "asi"; mode: "plus-two" | "split" | "feat"; primary?: AbilityChoiceKey; secondary?: AbilityChoiceKey; featId?: string };

export type ChoiceSelectionMap = Record<string, ChoiceSelectionValue>;

export interface ChoiceValidationIssue {
  choiceId: string;
  message: string;
  severity: "blocking" | "warning";
}

export function validateChoiceDefinitions(definitions: ChoiceDefinition[], selections: ChoiceSelectionMap): ChoiceValidationIssue[] {
  const issues: ChoiceValidationIssue[] = [];
  for (const definition of definitions) {
    if (!definition.required || definition.status === "not-applicable") continue;
    if (definition.status === "catalog-pending") {
      issues.push({ choiceId: definition.id, severity: "blocking", message: definition.pendingReason ?? `${definition.label} 선택 데이터가 아직 연결되지 않았습니다.` });
      continue;
    }
    const selection = selections[definition.id];
    if (!selection) {
      issues.push({ choiceId: definition.id, severity: "blocking", message: `${definition.label} 선택이 필요합니다.` });
      continue;
    }
    if (definition.kind === "asi-or-feat") {
      if (selection.kind !== "asi") {
        issues.push({ choiceId: definition.id, severity: "blocking", message: "능력치 향상/재주 선택 형식이 올바르지 않습니다." });
        continue;
      }
      if (selection.mode === "plus-two" && !selection.primary) issues.push({ choiceId: definition.id, severity: "blocking", message: "+2를 적용할 능력치를 선택해야 합니다." });
      if (selection.mode === "split" && (!selection.primary || !selection.secondary || selection.primary === selection.secondary)) issues.push({ choiceId: definition.id, severity: "blocking", message: "+1/+1은 서로 다른 두 능력치를 선택해야 합니다." });
      if (selection.mode === "feat" && !selection.featId) issues.push({ choiceId: definition.id, severity: "blocking", message: "획득할 재주를 선택해야 합니다." });
      continue;
    }
    if (selection.kind !== "options" || selection.optionIds.length !== definition.count) {
      issues.push({ choiceId: definition.id, severity: "blocking", message: `${definition.label}에서 ${definition.count}개를 선택해야 합니다.` });
      continue;
    }
    if (new Set(selection.optionIds).size !== selection.optionIds.length) {
      issues.push({ choiceId: definition.id, severity: "blocking", message: `${definition.label}에서 같은 선택지를 중복 선택할 수 없습니다.` });
      continue;
    }
    const byId = new Map(definition.options.map((option) => [option.id, option]));
    const unknown = selection.optionIds.filter((id) => !byId.has(id));
    if (unknown.length) {
      issues.push({ choiceId: definition.id, severity: "blocking", message: `${definition.label}에 알 수 없는 선택값이 있습니다.` });
      continue;
    }
    const disabled = selection.optionIds.map((id) => byId.get(id)!).find((option) => Boolean(option.disabledReason));
    if (disabled) {
      issues.push({ choiceId: definition.id, severity: "blocking", message: `${disabled.label}은(는) 선택할 수 없습니다: ${disabled.disabledReason}` });
    }
  }
  return issues;
}
