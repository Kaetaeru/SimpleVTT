import { CLERIC_DIVINE_STRIKE_OPTION, CLERIC_POTENT_SPELLCASTING_OPTION } from "./clericProgressionChoices";
import type { RulesRuntimeState } from "./combatState";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { ResolutionOperation } from "./resolutionTypes";
import { classCantripListEntries } from "./spellListCatalog";
import {
  compileSpellCast,
  type SpellCastRequest,
  type SpellCastResolution,
  type SpellMechanicDefinition,
} from "./spellcasting";
import type { TargetFacts } from "./targeting";
import type { TemporaryHpChoice } from "./temporaryHp";

export const CLERIC_ID = "dnd.srd521.class.cleric";
export const CLERIC_BLESSED_STRIKES_SOURCE = "feature:cleric.blessed-strikes";

const CLERIC_CANTRIP_IDS = new Set(classCantripListEntries(CLERIC_ID).map((entry) => entry.id));

type BlessedStrikesChoice = "divine-strike" | "potent-spellcasting" | undefined;

export interface ImprovedPotentSpellcastingTarget extends TargetFacts {
  temporaryHpChoice?: TemporaryHpChoice;
}

export interface ClericBlessedStrikesContext {
  clericLevel: number;
  wisdomModifier: number;
  persistentFeatureOptionIds?: readonly string[];
  improvedPotentSpellcastingTarget?: ImprovedPotentSpellcastingTarget;
}

function validateClericLevel(level: number) {
  if (!Number.isInteger(level) || level < 0 || level > 20) {
    throw new DomainEvaluationError("Cleric level must be an integer from 0 to 20");
  }
}

export function clericBlessedStrikesChoice(optionIds: readonly string[] | undefined): BlessedStrikesChoice {
  const ids = new Set(optionIds ?? []);
  const divineStrike = ids.has(CLERIC_DIVINE_STRIKE_OPTION);
  const potentSpellcasting = ids.has(CLERIC_POTENT_SPELLCASTING_OPTION);
  if (divineStrike && potentSpellcasting) {
    throw new DomainEvaluationError("Blessed Strikes cannot contain both persistent options");
  }
  if (divineStrike) return "divine-strike";
  if (potentSpellcasting) return "potent-spellcasting";
  return undefined;
}

export function clericDivineStrikeDiceCount(
  clericLevel: number,
  optionIds: readonly string[] | undefined,
) {
  validateClericLevel(clericLevel);
  if (clericBlessedStrikesChoice(optionIds) !== "divine-strike") return 0;
  if (clericLevel < 7) throw new DomainEvaluationError("Divine Strike requires Cleric level 7");
  return clericLevel >= 14 ? 2 : 1;
}

export function clericPotentSpellcastingModifier(
  clericLevel: number,
  wisdomModifier: number,
  optionIds: readonly string[] | undefined,
) {
  validateClericLevel(clericLevel);
  if (!Number.isFinite(wisdomModifier)) throw new DomainEvaluationError("Wisdom modifier must be finite");
  if (clericBlessedStrikesChoice(optionIds) !== "potent-spellcasting") return 0;
  if (clericLevel < 7) throw new DomainEvaluationError("Potent Spellcasting requires Cleric level 7");
  return wisdomModifier;
}

function addPotentSpellcastingDamage(
  definition: SpellMechanicDefinition,
  operations: ResolutionOperation[],
  modifier: number,
) {
  if (definition.baseLevel !== 0 || !CLERIC_CANTRIP_IDS.has(definition.spellId)) {
    throw new DomainEvaluationError("Potent Spellcasting requires a Cleric cantrip");
  }
  if (definition.primary.kind !== "attack-damage" && definition.primary.kind !== "save-damage") {
    throw new DomainEvaluationError("this Cleric cantrip damage mechanic is not executable for Potent Spellcasting");
  }
  const damageRolls = operations.filter(
    (operation): operation is Extract<ResolutionOperation, { kind:"damage-roll" }> => operation.kind === "damage-roll",
  );
  if (damageRolls.length !== 1) {
    throw new DomainEvaluationError("Potent Spellcasting requires one authoritative cantrip damage roll");
  }
  damageRolls[0].request = {
    ...damageRolls[0].request,
    flat:[
      ...(damageRolls[0].request.flat ?? []),
      { source:CLERIC_POTENT_SPELLCASTING_OPTION, value:modifier },
    ],
  };
}

function addImprovedPotentSpellcasting(
  request: SpellCastRequest,
  operations: ResolutionOperation[],
  context: ClericBlessedStrikesContext,
) {
  const target = context.improvedPotentSpellcastingTarget;
  if (!target) return;
  if (context.clericLevel < 14) {
    throw new DomainEvaluationError("Improved Blessed Strikes requires Cleric level 14");
  }
  if (request.targets.length !== 1) {
    throw new DomainEvaluationError("Improved Potent Spellcasting currently requires a single-target Cleric cantrip");
  }
  const damageOperations = operations.filter(
    (operation): operation is Extract<ResolutionOperation, { kind:"damage" }> => operation.kind === "damage",
  );
  if (!damageOperations.length) {
    throw new DomainEvaluationError("Improved Potent Spellcasting requires a cantrip that can deal damage");
  }

  const targetOperation: ResolutionOperation = {
    id:`${request.id}:blessed-strikes:temp-hp-target`,
    kind:"targeting",
    sourceId:request.actorId,
    rule:{
      kind:"creature",
      rangeFeet:60,
      minTargets:1,
      maxTargets:1,
      allowedRelations:["self","ally","enemy","neutral"],
      directTarget:true,
    },
    targets:[target],
  };
  operations.unshift(targetOperation);

  const amount = Math.max(0, Math.trunc(context.wisdomModifier * 2));
  for (const [index, damage] of damageOperations.entries()) {
    operations.push({
      id:`${request.id}:blessed-strikes:temp-hp:${index}`,
      kind:"temporary-hp",
      when:{ operationId:damage.id, field:"finalDamage", greaterThan:0 },
      targetId:target.id,
      amount,
      source:CLERIC_POTENT_SPELLCASTING_OPTION,
      choice:target.temporaryHpChoice,
    });
  }
}

function rejected(
  inputState: RulesRuntimeState,
  request: SpellCastRequest,
  error: unknown,
  failedOperationId?: string,
): SpellCastResolution {
  return {
    status:"rejected",
    state:inputState,
    spellId:request.spellId,
    slotLevel:request.slotLevel,
    error:error instanceof Error ? error.message : String(error),
    failedOperationId,
    events:[],
    results:{},
  };
}

export function resolveClericCantripWithBlessedStrikes(
  profile: RulesProfileLike,
  definition: SpellMechanicDefinition,
  inputState: RulesRuntimeState,
  request: SpellCastRequest,
  context: ClericBlessedStrikesContext,
): SpellCastResolution {
  try {
    validateClericLevel(context.clericLevel);
    if (!Number.isFinite(context.wisdomModifier)) throw new DomainEvaluationError("Wisdom modifier must be finite");
    const choice = clericBlessedStrikesChoice(context.persistentFeatureOptionIds);
    const compilation = compileSpellCast(definition, inputState, request);
    if (compilation.slotted) throw new DomainEvaluationError("Blessed Strikes cantrip wrapper cannot resolve a slotted spell");
    const pending = structuredClone(compilation.pending);

    if (choice === "potent-spellcasting") {
      if (context.clericLevel < 7) throw new DomainEvaluationError("Potent Spellcasting requires Cleric level 7");
      addPotentSpellcastingDamage(definition, pending.operations, context.wisdomModifier);
      addImprovedPotentSpellcasting(request, pending.operations, context);
    } else if (context.improvedPotentSpellcastingTarget) {
      throw new DomainEvaluationError("Improved Potent Spellcasting requires the Potent Spellcasting option");
    }

    const commit = resolvePendingResolution(profile, inputState, pending);
    if (commit.status === "rejected") {
      return rejected(inputState, request, commit.error, commit.failedOperationId);
    }
    return {
      status:"committed",
      state:commit.state,
      spellId:request.spellId,
      slotLevel:request.slotLevel,
      events:commit.events,
      results:commit.results,
    };
  } catch (error) {
    return rejected(inputState, request, error);
  }
}
