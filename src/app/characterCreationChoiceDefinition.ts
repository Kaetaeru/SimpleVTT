import "./creationContracts";
import type { CharacterCreateDraft, CharacterCreationOptionVm } from "./contracts";
import {
  creationChoiceSpecs,
  type ChoiceOwner,
  type CreationChoiceSpec,
} from "./characterCreationV10Choices";
import type { Option } from "./characterCreationV10Data";
import {
  type ChoiceDefinition,
  type ChoiceDefinitionKind,
  type ChoiceSelectionMap,
  type ChoiceValidationIssue,
  validateChoiceDefinitions,
} from "../domain/choiceDefinition";

export interface CreationChoiceDefinition extends ChoiceDefinition {
  owner:ChoiceOwner;
  blocked?:boolean;
  automaticGrants?:string[];
  presentationOptions:Record<string,Option>;
}

function creationChoiceKind(spec:CreationChoiceSpec):ChoiceDefinitionKind {
  if (spec.id.includes("weapon-mastery")) return "weapon-mastery";
  if (spec.id.includes("expertise")) return "expertise";
  if (spec.id.includes("language")) return "language";
  if (spec.id.includes("skillProficiency")) return "skill";
  if (
    spec.id.includes("spells.")
    || spec.id.endsWith(".cantrips")
    || spec.id.endsWith(".level1")
  ) return "spell";
  return "feature-option";
}

function toDefinition(spec:CreationChoiceSpec):CreationChoiceDefinition {
  return {
    id:spec.id,
    label:spec.label,
    description:spec.description,
    kind:creationChoiceKind(spec),
    count:spec.count,
    required:!spec.blocked,
    status:"ready",
    source:spec.source,
    options:spec.options.map((option)=>({
      id:option.id,
      label:option.name,
      description:option.summary,
    })),
    owner:spec.owner,
    blocked:spec.blocked,
    automaticGrants:spec.automaticGrants ? [...spec.automaticGrants] : undefined,
    presentationOptions:Object.fromEntries(spec.options.map((option)=>[option.id,structuredClone(option)])),
  };
}

export function creationChoiceDefinitions(draft:CharacterCreateDraft):CreationChoiceDefinition[] {
  return creationChoiceSpecs(draft).map(toDefinition);
}

export function creationChoiceSelectionMap(
  draft:CharacterCreateDraft,
  definitions:CreationChoiceDefinition[]=creationChoiceDefinitions(draft),
):ChoiceSelectionMap {
  return Object.fromEntries(definitions.flatMap((definition)=>{
    const optionIds=draft.choiceSelections?.[definition.id];
    return optionIds ? [[definition.id,{ kind:"options" as const,optionIds:[...optionIds] }]] : [];
  }));
}

export function validateCreationChoiceDefinitions(
  draft:CharacterCreateDraft,
  definitions:CreationChoiceDefinition[]=creationChoiceDefinitions(draft),
):ChoiceValidationIssue[] {
  return validateChoiceDefinitions(definitions,creationChoiceSelectionMap(draft,definitions));
}

function normalizePass(draft:CharacterCreateDraft) {
  const definitions=creationChoiceDefinitions(draft);
  const active=new Set(definitions.map((definition)=>definition.id));
  for (const key of Object.keys(draft.choiceSelections ?? {})) {
    if (!active.has(key)) delete draft.choiceSelections![key];
  }
  for (const definition of definitions) {
    const allowed=new Set(definition.options.map((option)=>option.id));
    draft.choiceSelections![definition.id]=(draft.choiceSelections?.[definition.id] ?? [])
      .filter((id)=>allowed.has(id))
      .slice(0,definition.count);
  }
}

export function normalizeCreationChoiceSelections(draft:CharacterCreateDraft) {
  draft.choiceSelections ??={};
  normalizePass(draft);
  normalizePass(draft);
  return draft;
}

export function toggleCreationChoiceSelection(draft:CharacterCreateDraft,choiceId:string,optionId:string) {
  normalizeCreationChoiceSelections(draft);
  const definition=creationChoiceDefinitions(draft).find((entry)=>entry.id===choiceId);
  if (!definition || definition.blocked || !definition.options.some((option)=>option.id===optionId)) return draft;
  const values=draft.choiceSelections?.[choiceId] ?? [];
  if (values.includes(optionId)) draft.choiceSelections![choiceId]=values.filter((id)=>id!==optionId);
  else if (definition.count===1) draft.choiceSelections![choiceId]=[optionId];
  else if (values.length<definition.count) draft.choiceSelections![choiceId]=[...values,optionId];
  normalizeCreationChoiceSelections(draft);
  return draft;
}

export function creationChoiceOptionViews(
  definition:CreationChoiceDefinition,
  selectedIds:string[],
):CharacterCreationOptionVm[] {
  return definition.options.map((option)=>{
    const presentation=definition.presentationOptions[option.id];
    return {
      id:option.id,
      name:option.label,
      nameEn:presentation?.nameEn ?? option.label,
      summary:option.description ?? presentation?.summary ?? "",
      source:presentation?.source ?? definition.source,
      selected:selectedIds.includes(option.id),
      recommended:presentation?.recommended ?? false,
      grants:[...(presentation?.grants ?? [])],
      choices:[...(presentation?.choices ?? [])],
      description:presentation?.description,
      detailLines:presentation?.detailLines ? [...presentation.detailLines] : undefined,
    };
  });
}
