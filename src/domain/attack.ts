import type { FixedDiceInput, ModifierContribution } from "./d20";
import type { FixedDamageDice, FlatDamageContribution } from "./damageRoll";
import type { RulesRuntimeState } from "./combatState";
import type { ConcentrationCheckRequest } from "./concentration";
import { DomainEvaluationError, type RollStateContribution, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";
import type { CoverDegree, TargetFacts } from "./targeting";
import type { TurnSlot } from "./turnEconomy";

export type AttackSourceKind = "weapon" | "unarmed" | "wild-shape";

type AttackTargetIdentity=Pick<TargetFacts,"id"|"kind"|"relation">&{
  ac: number;
  creatureKind: "character" | "monster";
};

export type AttackTarget=AttackTargetIdentity&(
  | { spatialAuthority:"manual-unconstrained";distanceFeet?:never;visible?:never;cover?:never;targetCanSeeAttacker?:never }
  | { spatialAuthority?:"authoritative";distanceFeet:number;visible:boolean;cover:CoverDegree;targetCanSeeAttacker:boolean }
);

export interface AttackDamageComponent {
  sourceId: string;
  damageType: string;
  dice: FixedDamageDice[];
  flat?: FlatDamageContribution[];
  oncePerOwnTurnFeatureId?: string;
}

export interface AttackEconomyCost {
  slot: TurnSlot;
  bonusActionGranted?: boolean;
  actionKind?:"attack"|"other";
  attacksPerAction?:number;
}

export interface AttackCriticalRange {
  threshold: number;
  sourceId: string;
}

export interface AttackCriticalFreeMovement {
  distanceFeet:number;
  maximumDistanceFeet:number;
  doesNotProvokeOpportunityAttacks?:boolean;
}

export interface AttackRequest {
  id: string;
  actorId: string;
  expectedRevision: number;
  sourceId: string;
  sourceKind: AttackSourceKind;
  target: AttackTarget;
  rangeFeet: number;
  attackDice: FixedDiceInput;
  attackModifierContributions: ModifierContribution[];
  rollStateContributions?: RollStateContribution[];
  requiresSight?: boolean;
  baseDamage: AttackDamageComponent;
  riders?: AttackDamageComponent[];
  economy?: AttackEconomyCost;
  criticalRange?: AttackCriticalRange;
  onCriticalFreeMovement?:AttackCriticalFreeMovement;
  concentrationCheck?: Omit<ConcentrationCheckRequest, "damage">;
}

function validateComponent(component: AttackDamageComponent, label: string) {
  if (!component.sourceId) throw new DomainEvaluationError(`${label} source id is required`);
  if (!component.damageType) throw new DomainEvaluationError(`${label} damage type is required`);
  if (!component.dice.length && !(component.flat?.length)) {
    throw new DomainEvaluationError(`${label} requires damage dice or a flat contribution`);
  }
}

function validateRequest(request: AttackRequest) {
  if (!request.id || !request.actorId || !request.sourceId) {
    throw new DomainEvaluationError("attack id, actorId, and sourceId are required");
  }
  if (!Number.isFinite(request.rangeFeet) || request.rangeFeet <= 0) {
    throw new DomainEvaluationError("attack range must be a positive finite number");
  }
  if (!Number.isFinite(request.target.ac) || request.target.ac < 0) {
    throw new DomainEvaluationError("attack target AC must be a non-negative finite number");
  }
  if(request.target.spatialAuthority==="manual-unconstrained") {
    if(request.target.distanceFeet!==undefined||request.target.visible!==undefined||request.target.cover!==undefined||request.target.targetCanSeeAttacker!==undefined) {
      throw new DomainEvaluationError("manual-unconstrained attack target cannot contain fabricated spatial or sensory facts");
    }
  } else if(request.target.distanceFeet===undefined||request.target.visible===undefined||request.target.cover===undefined||request.target.targetCanSeeAttacker===undefined) {
    throw new DomainEvaluationError("authoritative attack target requires distance, visibility, cover, and target sight facts");
  }
  if (request.criticalRange) {
    if (!request.criticalRange.sourceId) throw new DomainEvaluationError("critical range source id is required");
    if (!Number.isInteger(request.criticalRange.threshold) || request.criticalRange.threshold < 2 || request.criticalRange.threshold > 20) {
      throw new DomainEvaluationError("critical range threshold must be an integer from 2 to 20");
    }
  }
  if (request.onCriticalFreeMovement) {
    const movement = request.onCriticalFreeMovement;
    if (!Number.isFinite(movement.distanceFeet) || movement.distanceFeet < 0) {
      throw new DomainEvaluationError("critical granted movement distance must be non-negative and finite");
    }
    if (!Number.isFinite(movement.maximumDistanceFeet) || movement.maximumDistanceFeet < 0) {
      throw new DomainEvaluationError("critical granted movement maximum must be non-negative and finite");
    }
    if (movement.distanceFeet > movement.maximumDistanceFeet) {
      throw new DomainEvaluationError(`critical granted movement cannot exceed ${movement.maximumDistanceFeet} feet`);
    }
  }
  validateComponent(request.baseDamage, "base attack damage");
  (request.riders ?? []).forEach((rider, index) => validateComponent(rider, `attack rider ${index}`));
  const featureIds = (request.riders ?? [])
    .map((rider) => rider.oncePerOwnTurnFeatureId)
    .filter((value): value is string => Boolean(value));
  if (new Set(featureIds).size !== featureIds.length) {
    throw new DomainEvaluationError("an attack cannot spend the same once-per-turn feature more than once");
  }
}

export function compileAttack(request: AttackRequest): PendingResolution {
  validateRequest(request);
  const manualUnconstrained=request.target.spatialAuthority==="manual-unconstrained";
  const targetId = request.target.id;
  const targetingId = `${request.id}:target`;
  const attackId = `${request.id}:attack`;
  const operations: ResolutionOperation[] = [
    {
      id:targetingId,
      kind:"targeting",
      sourceId:request.actorId,
      rule:{
        kind:"creature",
        rangeFeet:manualUnconstrained?undefined:request.rangeFeet,
        minTargets:1,
        maxTargets:1,
        allowedRelations:["ally","enemy","neutral"],
        requiresSight:manualUnconstrained?false:request.requiresSight ?? true,
        directTarget:!manualUnconstrained,
      },
      targets:[request.target],
      harmful:true,
    },
  ];

  if (request.economy) {
    operations.push({
      id:`${request.id}:economy`,
      kind:"use-economy",
      actorId:request.actorId,
      slot:request.economy.slot,
      bonusActionGranted:request.economy.bonusActionGranted,
      actionKind:request.economy.actionKind??"other",
      attacksPerAction:request.economy.attacksPerAction,
    });
  }

  operations.push({
    id:attackId,
    kind:"d20",
    actorId:request.actorId,
    targetId,
    request:{
      family:"attack-roll",
      target:request.target.ac,
      modifierContributions:request.attackModifierContributions,
      rollStateContributions:request.rollStateContributions,
      dice:request.attackDice,
      targetSource:`target:${targetId}:ac`,
      criticalThreshold:request.criticalRange?.threshold,
      criticalThresholdSource:request.criticalRange?.sourceId,
    },
    cover:{ targetingOperationId:targetingId, targetId, appliesTo:"ac" },
    condition:{
      distanceToTargetFeet:request.target.distanceFeet,
      actorCanSeeTarget:request.target.visible,
      targetCanSeeActor:request.target.targetCanSeeAttacker,
    },
  });

  const components = [request.baseDamage, ...(request.riders ?? [])];
  const compoundComponents: Extract<ResolutionOperation, { kind:"compound-damage" }>["components"] = [];

  components.forEach((component, index) => {
    if (component.oncePerOwnTurnFeatureId) {
      operations.push({
        id:`${request.id}:turn-feature:${index}`,
        kind:"use-turn-feature",
        actorId:request.actorId,
        featureId:component.oncePerOwnTurnFeatureId,
        when:{ operationId:attackId, field:"outcome", equals:"success" },
      });
    }
    const rollId = `${request.id}:damage-roll:${index}`;
    operations.push({
      id:rollId,
      kind:"damage-roll",
      when:{ operationId:attackId, field:"outcome", equals:"success" },
      criticalFrom:attackId,
      request:{
        dice:component.dice,
        flat:component.flat,
      },
    });
    compoundComponents.push({
      damageType:component.damageType,
      amount:{ operationId:rollId, field:"total" },
    });
  });

  operations.push({
    id:`${request.id}:damage`,
    kind:"compound-damage",
    when:{ operationId:attackId, field:"outcome", equals:"success" },
    targetId,
    components:compoundComponents,
    creatureKind:request.target.creatureKind,
    criticalFrom:attackId,
    concentrationCheck:request.concentrationCheck,
  });

  if (request.onCriticalFreeMovement) {
    operations.push({
      id:`${request.id}:critical-movement`,
      kind:"free-move",
      actorId:request.actorId,
      distanceFeet:request.onCriticalFreeMovement.distanceFeet,
      maximumDistanceFeet:request.onCriticalFreeMovement.maximumDistanceFeet,
      doesNotProvokeOpportunityAttacks:request.onCriticalFreeMovement.doesNotProvokeOpportunityAttacks,
      when:{ operationId:attackId, field:"critical", equals:true },
    });
  }

  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:request.sourceId,
    expectedRevision:request.expectedRevision,
    operations,
  };
}

export function resolveAttack(
  profile: RulesProfileLike,
  inputState: RulesRuntimeState,
  request: AttackRequest,
): ResolutionCommit {
  try {
    return resolvePendingResolution(profile, inputState, compileAttack(request));
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
