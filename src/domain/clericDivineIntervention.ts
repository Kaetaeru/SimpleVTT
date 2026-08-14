import type { RulesRuntimeState } from "./combatState";
import { CLERIC_DIVINE_INTERVENTION_RESOURCE_ID, CLERIC_ID } from "./coreClassResources";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionOperation } from "./resolutionTypes";
import { classSpellListAllEntries } from "./spellListCatalog";
import {
  compileSpellCast,
  type SpellCasterContext,
  type SpellCastDiceInput,
  type SpellCastResolution,
  type SpellCastTarget,
  type SpellMechanicDefinition,
} from "./spellcasting";

export const CLERIC_DIVINE_INTERVENTION_SOURCE = "feature:cleric.divine-intervention";

const CLERIC_SPELLS = new Map(classSpellListAllEntries(CLERIC_ID).map((entry) => [entry.id, entry]));

export interface ClericDivineInterventionRequest {
  id: string;
  actorId: string;
  expectedRevision: number;
  clericLevel: number;
  spellId: string;
  caster: SpellCasterContext;
  targets: SpellCastTarget[];
  nonMaterialComponentsSatisfied: boolean;
  useActionEconomy: boolean;
  dice: SpellCastDiceInput;
  projectileAllocations?: Array<{ targetId:string; count:number }>;
  resourceId?: string;
}

function validateRequest(definition: SpellMechanicDefinition, request: ClericDivineInterventionRequest) {
  if (!Number.isInteger(request.clericLevel) || request.clericLevel < 10 || request.clericLevel > 20) {
    throw new DomainEvaluationError("Divine Intervention requires Cleric level 10-20");
  }
  if (definition.spellId !== request.spellId) {
    throw new DomainEvaluationError("Divine Intervention spell definition mismatch");
  }
  const clericSpell = CLERIC_SPELLS.get(request.spellId);
  if (!clericSpell) throw new DomainEvaluationError("Divine Intervention requires a Cleric spell");
  if (clericSpell.level > 5) throw new DomainEvaluationError("Divine Intervention spell level must be 5 or lower");
  if (definition.castingEconomy === "reaction") {
    throw new DomainEvaluationError("Divine Intervention cannot choose a spell with Reaction casting time");
  }
  if (!request.nonMaterialComponentsSatisfied) {
    throw new DomainEvaluationError("Divine Intervention still requires non-material spell components to be satisfied");
  }
}

function spellRequest(request: ClericDivineInterventionRequest) {
  const featureSpellIds = [...new Set([...(request.caster.featureSpellIds ?? []), request.spellId])];
  const featureResourceIds = { ...(request.caster.featureResourceIds ?? {}) };
  delete featureResourceIds[request.spellId];
  return {
    id:request.id,
    actorId:request.actorId,
    spellId:request.spellId,
    source:"feature" as const,
    expectedRevision:request.expectedRevision,
    caster:{
      ...request.caster,
      featureSpellIds,
      featureResourceIds,
    },
    targets:request.targets,
    componentsSatisfied:true,
    useActionEconomy:false,
    dice:request.dice,
    projectileAllocations:request.projectileAllocations,
  };
}

function withDivineInterventionCosts(
  compilation: ReturnType<typeof compileSpellCast>,
  request: ClericDivineInterventionRequest,
): PendingResolution {
  const operations = structuredClone(compilation.pending.operations);
  const targetingIndex = operations.findIndex((operation) => operation.kind === "targeting");
  const insertionIndex = targetingIndex >= 0 ? targetingIndex + 1 : 0;
  const costs: ResolutionOperation[] = [];
  if (request.useActionEconomy) {
    costs.push({
      id:`${request.id}:divine-intervention:action`,
      kind:"use-economy",
      actorId:request.actorId,
      slot:"action",
    });
  }
  costs.push({
    id:`${request.id}:divine-intervention:resource`,
    kind:"spend-resource",
    actorId:request.actorId,
    resourceId:request.resourceId ?? CLERIC_DIVINE_INTERVENTION_RESOURCE_ID,
    amount:1,
  });
  operations.splice(insertionIndex, 0, ...costs);
  return {
    ...compilation.pending,
    sourceId:CLERIC_DIVINE_INTERVENTION_SOURCE,
    operations,
  };
}

function rejected(
  inputState: RulesRuntimeState,
  request: ClericDivineInterventionRequest,
  error: unknown,
  failedOperationId?: string,
): SpellCastResolution {
  return {
    status:"rejected",
    state:inputState,
    spellId:request.spellId,
    events:[],
    results:{},
    error:error instanceof Error ? error.message : String(error),
    failedOperationId,
  };
}

export function resolveClericDivineIntervention(
  profile: RulesProfileLike,
  definition: SpellMechanicDefinition,
  inputState: RulesRuntimeState,
  request: ClericDivineInterventionRequest,
): SpellCastResolution {
  try {
    validateRequest(definition, request);
    const compilation = compileSpellCast(definition, inputState, spellRequest(request));
    if (compilation.slotted || compilation.slotLevel !== undefined) {
      throw new DomainEvaluationError("Divine Intervention must cast without a spell slot");
    }
    const pending = withDivineInterventionCosts(compilation, request);
    const commit = resolvePendingResolution(profile, inputState, pending);
    if (commit.status === "rejected") {
      return rejected(inputState, request, commit.error, commit.failedOperationId);
    }
    return {
      status:"committed",
      state:commit.state,
      spellId:request.spellId,
      events:commit.events,
      results:commit.results,
    };
  } catch (error) {
    return rejected(inputState, request, error);
  }
}
