import type { RulesRuntimeState } from "./combatState";
import { requireCombatant } from "./combatState";
import { compileDivineSpark, type DivineSparkRequest } from "./clericDivineSpark";
import { CLERIC_CHANNEL_DIVINITY_RESOURCE_ID } from "./coreClassResources";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { NumericOperand, PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";
import {
  compileSpellCast,
  type SpellCastRequest,
  type SpellCastResolution,
  type SpellMechanicDefinition,
} from "./spellcasting";
import type { TargetFacts } from "./targeting";

export const CLERIC_LIFE_DOMAIN_SUBCLASS_ID = "dnd.srd521.subclass.cleric.life-domain";
export const LIFE_DISCIPLE_SOURCE = "feature:cleric.life-domain.disciple-of-life";
export const LIFE_PRESERVE_SOURCE = "feature:cleric.life-domain.preserve-life";
export const LIFE_BLESSED_HEALER_SOURCE = "feature:cleric.life-domain.blessed-healer";
export const LIFE_SUPREME_HEALING_SOURCE = "feature:cleric.life-domain.supreme-healing";

export interface LifeDomainContext {
  clericLevel: number;
  subclassId?: string;
}

function validateLifeDomain(context: LifeDomainContext, minimumLevel: number, feature: string) {
  if (!Number.isInteger(context.clericLevel) || context.clericLevel < 0 || context.clericLevel > 20) {
    throw new DomainEvaluationError("Cleric level must be an integer from 0 to 20");
  }
  if (context.subclassId !== CLERIC_LIFE_DOMAIN_SUBCLASS_ID) {
    throw new DomainEvaluationError(`${feature} requires the Life Domain subclass`);
  }
  if (context.clericLevel < minimumLevel) {
    throw new DomainEvaluationError(`${feature} requires Cleric level ${minimumLevel}`);
  }
}

function addToOperand(amount: NumericOperand, add: number): NumericOperand {
  if (typeof amount === "number") return amount + add;
  return { ...amount, add:(amount.add ?? 0) + add };
}

function maximizeDamageRollDice(operations: ResolutionOperation[]) {
  for (const operation of operations) {
    if (operation.kind !== "damage-roll") continue;
    operation.request = {
      ...operation.request,
      dice:operation.request.dice.map((die) => ({
        ...die,
        faces:Array.from({ length:die.count },() => die.sides),
      })),
    };
  }
}

function rejectedSpell(
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
    events:[],
    results:{},
    error:error instanceof Error ? error.message : String(error),
    failedOperationId,
  };
}

export function resolveLifeDomainHealingSpell(
  profile: RulesProfileLike,
  definition: SpellMechanicDefinition,
  inputState: RulesRuntimeState,
  request: SpellCastRequest,
  context: LifeDomainContext,
): SpellCastResolution {
  try {
    validateLifeDomain(context,3,"Disciple of Life");
    if (definition.primary.kind !== "healing") {
      throw new DomainEvaluationError("Life Domain healing wrapper requires an executable healing spell");
    }
    const compilation = compileSpellCast(definition,inputState,request);
    if (!compilation.slotted || request.slotLevel === undefined) {
      throw new DomainEvaluationError("Life Domain spell healing bonuses require a spell cast with a spell slot");
    }
    const pending = structuredClone(compilation.pending);
    const slotBonus = 2 + request.slotLevel;
    const healingOperations = pending.operations.filter(
      (operation): operation is Extract<ResolutionOperation,{ kind:"healing" }> => operation.kind === "healing",
    );
    if (!healingOperations.length) {
      throw new DomainEvaluationError("Life Domain healing wrapper requires an authoritative healing operation");
    }

    if (context.clericLevel >= 17) maximizeDamageRollDice(pending.operations);

    healingOperations.forEach((operation) => {
      operation.amount = addToOperand(operation.amount,slotBonus);
    });

    const otherCreatureHealing = healingOperations.find((operation) => operation.targetId !== request.actorId);
    if (context.clericLevel >= 6 && otherCreatureHealing) {
      pending.operations.push({
        id:`${request.id}:life-domain:blessed-healer`,
        kind:"healing",
        when:{ operationId:otherCreatureHealing.id, field:"restored", greaterThan:0 },
        targetId:request.actorId,
        amount:slotBonus,
      });
    }

    const commit = resolvePendingResolution(profile,inputState,pending);
    if (commit.status === "rejected") {
      return rejectedSpell(inputState,request,commit.error,commit.failedOperationId);
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
    return rejectedSpell(inputState,request,error);
  }
}

export function resolveLifeDomainDivineSparkHealing(
  profile: RulesProfileLike,
  inputState: RulesRuntimeState,
  request: DivineSparkRequest,
  context: LifeDomainContext,
): ResolutionCommit {
  try {
    validateLifeDomain(context,17,"Supreme Healing");
    if (request.mode !== "healing") {
      throw new DomainEvaluationError("Supreme Healing only maximizes the healing mode of Divine Spark");
    }
    const pending = compileDivineSpark(request);
    maximizeDamageRollDice(pending.operations);
    return resolvePendingResolution(profile,inputState,pending);
  } catch (error) {
    return {
      status:"rejected",
      state:inputState,
      events:[],
      results:{},
      error:error instanceof Error ? error.message : String(error),
    };
  }
}

export interface PreserveLifeAllocation {
  target: TargetFacts;
  amount: number;
}

export interface PreserveLifeRequest {
  id: string;
  actorId: string;
  expectedRevision: number;
  clericLevel: number;
  subclassId?: string;
  allocations: PreserveLifeAllocation[];
  channelDivinityResourceId?: string;
  useActionEconomy: boolean;
}

export function compilePreserveLife(inputState: RulesRuntimeState, request: PreserveLifeRequest): PendingResolution {
  validateLifeDomain({ clericLevel:request.clericLevel, subclassId:request.subclassId },3,"Preserve Life");
  if (!request.allocations.length) throw new DomainEvaluationError("Preserve Life requires at least one chosen creature");
  const ids = request.allocations.map((allocation) => allocation.target.id);
  if (new Set(ids).size !== ids.length) throw new DomainEvaluationError("Preserve Life targets must be unique");
  const pool = request.clericLevel * 5;
  let allocated = 0;
  for (const allocation of request.allocations) {
    if (!Number.isInteger(allocation.amount) || allocation.amount < 1) {
      throw new DomainEvaluationError("Preserve Life healing allocations must be positive integers");
    }
    const combatant = requireCombatant(inputState,allocation.target.id);
    if (combatant.life.dead) throw new DomainEvaluationError(`Preserve Life cannot heal a dead creature: ${allocation.target.id}`);
    const halfMaximum = Math.floor(combatant.life.hp.maximum / 2);
    if (combatant.life.hp.current > halfMaximum) {
      throw new DomainEvaluationError(`Preserve Life target is not Bloodied: ${allocation.target.id}`);
    }
    if (combatant.life.hp.current + allocation.amount > halfMaximum) {
      throw new DomainEvaluationError(`Preserve Life cannot heal ${allocation.target.id} above half Hit Point Maximum`);
    }
    allocated += allocation.amount;
  }
  if (allocated > pool) throw new DomainEvaluationError(`Preserve Life allocations exceed healing pool ${pool}`);

  const operations: ResolutionOperation[] = [{
    id:`${request.id}:targets`,
    kind:"targeting",
    sourceId:request.actorId,
    rule:{
      kind:"creature",
      rangeFeet:30,
      minTargets:1,
      maxTargets:request.allocations.length,
      allowedRelations:["self","ally","enemy","neutral"],
      directTarget:false,
    },
    targets:request.allocations.map((allocation) => allocation.target),
  }];
  if (request.useActionEconomy) {
    operations.push({
      id:`${request.id}:action`,
      kind:"use-economy",
      actorId:request.actorId,
      slot:"action",
      actionKind:"magic",
    });
  }
  operations.push({
    id:`${request.id}:channel-divinity`,
    kind:"spend-resource",
    actorId:request.actorId,
    resourceId:request.channelDivinityResourceId ?? CLERIC_CHANNEL_DIVINITY_RESOURCE_ID,
    amount:1,
  });
  request.allocations.forEach((allocation,index) => {
    operations.push({
      id:`${request.id}:healing:${index}`,
      kind:"healing",
      targetId:allocation.target.id,
      amount:allocation.amount,
    });
  });
  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:LIFE_PRESERVE_SOURCE,
    expectedRevision:request.expectedRevision,
    operations,
  };
}

export function resolvePreserveLife(
  profile: RulesProfileLike,
  inputState: RulesRuntimeState,
  request: PreserveLifeRequest,
): ResolutionCommit {
  try {
    return resolvePendingResolution(profile,inputState,compilePreserveLife(inputState,request));
  } catch (error) {
    return {
      status:"rejected",
      state:inputState,
      events:[],
      results:{},
      error:error instanceof Error ? error.message : String(error),
    };
  }
}
