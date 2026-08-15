import type { ChoiceSelectionMap } from "./choiceDefinition";
import { classById, numericProgressionColumn } from "./progressionCatalog";
import type { ProgressionCharacterState } from "./progression";
import { DomainEvaluationError } from "./profileEngine";
import { classSpellListEntries } from "./spellListCatalog";
import {
  WIZARD_ID,
  wizardSpellMasteryChoices,
  wizardSpellMasteryChoiceId,
} from "./wizardProgressionChoices";

export type WizardSpellPresentationOption = {
  id:string;
  label:string;
  description?:string;
  level:number;
  castingTime?:string;
  school?:string;
};

export interface WizardSpellMasteryReplacement {
  spellLevel:1|2;
  spellId:string;
}

export interface WizardLongRestPreparationRequest {
  expectedRevision:number;
  normalPreparedSpellIds:string[];
  spellMasteryReplacement?:WizardSpellMasteryReplacement;
  spellOptions?:WizardSpellPresentationOption[];
}

export type WizardLongRestPreparationResolution =
  | { status:"committed"; state:ProgressionCharacterState; replacedSpellLevel?:1|2 }
  | { status:"rejected"; state:ProgressionCharacterState; error:string };

function normalizedSpellId(id:string) {
  return id.replace(/^always:/,"");
}

function wizardLevel(state:ProgressionCharacterState) {
  return state.classTracks.find((track) => track.classId === WIZARD_ID)?.level ?? 0;
}

function highestWizardSpellLevel(level:number) {
  let highest = 0;
  for (let spellLevel = 1; spellLevel <= 9; spellLevel += 1) {
    if (numericProgressionColumn(WIZARD_ID,level,String(spellLevel)) > 0) highest = spellLevel;
  }
  return highest;
}

export function wizardNormalPreparedSpellCount(level:number) {
  if (!Number.isInteger(level) || level < 1 || level > 20) {
    throw new DomainEvaluationError("Wizard level must be an integer from 1 to 20");
  }
  return numericProgressionColumn(WIZARD_ID,level,"준비 주문");
}

function validateUnique(ids:string[],label:string) {
  if (new Set(ids).size !== ids.length) throw new DomainEvaluationError(`${label} cannot contain duplicate spells`);
}

function validateMasteryReplacement(
  state:ProgressionCharacterState,
  replacement:WizardSpellMasteryReplacement|undefined,
  spellOptions:WizardSpellPresentationOption[]|undefined,
) {
  if (!replacement) return;
  const current = state.spellMasterySpellIds?.[replacement.spellLevel];
  if (!current) throw new DomainEvaluationError(`Wizard has no level ${replacement.spellLevel} Spell Mastery selection to replace`);
  if (replacement.spellId === current) throw new DomainEvaluationError("Spell Mastery replacement must choose a different spell");
  const choices = wizardSpellMasteryChoices({
    targetLevel:18,
    knownSpellbookIds:[...(state.spellbookSpellIds ?? [])],
    selections:{} satisfies ChoiceSelectionMap,
    spellOptions,
  });
  const choice = choices.find((entry) => entry.id === wizardSpellMasteryChoiceId(replacement.spellLevel));
  const option = choice?.options.find((entry) => entry.id === replacement.spellId);
  if (!option) throw new DomainEvaluationError(`Spell Mastery replacement must be an eligible level ${replacement.spellLevel} Wizard spell from the spellbook`);
  if (option.disabledReason) throw new DomainEvaluationError(option.disabledReason);
}

export function resolveWizardLongRestPreparation(
  inputState:ProgressionCharacterState,
  request:WizardLongRestPreparationRequest,
):WizardLongRestPreparationResolution {
  try {
    if (request.expectedRevision !== inputState.revision) {
      throw new DomainEvaluationError(`revision mismatch: expected ${request.expectedRevision}, current ${inputState.revision}`);
    }
    const level = wizardLevel(inputState);
    if (level < 1) throw new DomainEvaluationError("Wizard Long-Rest preparation requires a Wizard class track");
    const expectedCount = wizardNormalPreparedSpellCount(level);
    validateUnique(request.normalPreparedSpellIds,"Wizard prepared spell list");
    if (request.normalPreparedSpellIds.length !== expectedCount) {
      throw new DomainEvaluationError(`Wizard level ${level} must prepare exactly ${expectedCount} ordinary spells after a Long Rest`);
    }

    const spellbook = new Set(inputState.spellbookSpellIds ?? []);
    const highestSpellLevel = highestWizardSpellLevel(level);
    const canonical = new Map(classSpellListEntries(WIZARD_ID,highestSpellLevel).map((entry) => [entry.id,entry]));
    for (const spellId of request.normalPreparedSpellIds) {
      if (!spellbook.has(spellId)) throw new DomainEvaluationError(`prepared Wizard spell must be in the spellbook: ${spellId}`);
      if (!canonical.has(spellId)) throw new DomainEvaluationError(`prepared spell is not an eligible Wizard spell for level ${level}: ${spellId}`);
    }

    validateMasteryReplacement(inputState,request.spellMasteryReplacement,request.spellOptions);

    const masteryIds = { ...(inputState.spellMasterySpellIds ?? {}) };
    const masterySources = { ...(inputState.spellMasterySources ?? {}) };
    if (request.spellMasteryReplacement) {
      const replacement = request.spellMasteryReplacement;
      masteryIds[replacement.spellLevel] = replacement.spellId;
      masterySources[replacement.spellLevel] = `위저드 ${level}레벨 · Spell Mastery Long-Rest replacement · SRD 5.2.1`;
    }

    const alwaysPrepared = new Set<string>();
    for (const spellId of Object.values(masteryIds)) if (spellId) alwaysPrepared.add(spellId);
    for (const spellId of inputState.signatureSpellIds ?? []) alwaysPrepared.add(spellId);
    const previousFeatureAlways = (inputState.preparedSpellIds ?? [])
      .filter((id) => id.startsWith("always:"))
      .map(normalizedSpellId)
      .filter((spellId) => !Object.values(inputState.spellMasterySpellIds ?? {}).includes(spellId)
        && !(inputState.signatureSpellIds ?? []).includes(spellId));
    previousFeatureAlways.forEach((spellId) => alwaysPrepared.add(spellId));

    for (const spellId of request.normalPreparedSpellIds) {
      if (alwaysPrepared.has(spellId)) {
        throw new DomainEvaluationError(`always-prepared spell cannot consume an ordinary Wizard preparation slot: ${spellId}`);
      }
    }

    const next:ProgressionCharacterState = structuredClone(inputState);
    next.revision += 1;
    next.spellMasterySpellIds = masteryIds;
    next.spellMasterySources = masterySources;
    next.preparedSpellIds = [
      ...request.normalPreparedSpellIds,
      ...[...alwaysPrepared].map((spellId) => `always:${spellId}`),
    ];
    const sources:Record<string,string> = {};
    for (const spellId of request.normalPreparedSpellIds) {
      sources[spellId] = `위저드 ${level}레벨 · Long-Rest prepared spell · SRD 5.2.1`;
    }
    for (const spellId of previousFeatureAlways) {
      sources[spellId] = inputState.preparedSpellSources?.[spellId] ?? "Existing always-prepared feature";
    }
    for (const [spellLevel,spellId] of Object.entries(masteryIds)) {
      if (!spellId) continue;
      sources[spellId] = masterySources[Number(spellLevel)] ?? "Wizard Spell Mastery";
    }
    for (const spellId of inputState.signatureSpellIds ?? []) {
      sources[spellId] = inputState.signatureSpellSources?.[spellId] ?? "Wizard Signature Spells";
    }
    next.preparedSpellSources = sources;
    return {
      status:"committed",
      state:next,
      replacedSpellLevel:request.spellMasteryReplacement?.spellLevel,
    };
  } catch (error) {
    return {
      status:"rejected",
      state:inputState,
      error:error instanceof Error ? error.message : String(error),
    };
  }
}

export function wizardLongRestPreparationSummary(state:ProgressionCharacterState) {
  const level = wizardLevel(state);
  return {
    classId:classById(WIZARD_ID)?.id ?? WIZARD_ID,
    wizardLevel:level,
    ordinaryPreparedCount:level > 0 ? wizardNormalPreparedSpellCount(level) : 0,
    spellMastery:{ ...(state.spellMasterySpellIds ?? {}) },
    signatureSpells:[...(state.signatureSpellIds ?? [])],
  };
}
