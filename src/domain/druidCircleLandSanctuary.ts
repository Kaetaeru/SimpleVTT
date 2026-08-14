import type { RulesRuntimeState } from "./combatState";
import { DRUID_WILD_SHAPE_RESOURCE_ID } from "./coreClassResources";
import { DRUID_CIRCLE_LAND_SUBCLASS_ID } from "./druidCircleLand";
import type { CircleLandType } from "./druidCircleLandRecovery";
import { naturesWardResistance } from "./druidCircleLandWard";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";
import type { TargetFacts } from "./targeting";

export const DRUID_NATURES_SANCTUARY_SOURCE = "feature:druid.circle-of-the-land.natures-sanctuary";
export const DRUID_NATURES_SANCTUARY_TAG = "druid:circle-land:natures-sanctuary";

export interface SanctuaryPoint extends TargetFacts {
  onGround: boolean;
}

export interface NaturesSanctuaryActivateRequest {
  id:string;
  actorId:string;
  expectedRevision:number;
  druidLevel:number;
  subclassId?:string;
  landType:CircleLandType;
  center:SanctuaryPoint;
  wildShapeResourceId?:string;
  useActionEconomy:boolean;
}

export interface NaturesSanctuaryMoveRequest {
  id:string;
  actorId:string;
  expectedRevision:number;
  druidLevel:number;
  subclassId?:string;
  effectId:string;
  destination:SanctuaryPoint;
  movementFeet:number;
  useActionEconomy:boolean;
}

function validateCircleLand14(druidLevel:number, subclassId:string|undefined, feature:string) {
  if (!Number.isInteger(druidLevel) || druidLevel < 14 || druidLevel > 20) {
    throw new DomainEvaluationError(`${feature} requires Druid level 14-20`);
  }
  if (subclassId !== DRUID_CIRCLE_LAND_SUBCLASS_ID) {
    throw new DomainEvaluationError(`${feature} requires the Circle of the Land subclass`);
  }
}

function validatePoint(point:SanctuaryPoint, label:string) {
  if (point.kind !== "point") throw new DomainEvaluationError(`${label} must be an authoritative point`);
  if (!point.onGround) throw new DomainEvaluationError(`${label} must be on the ground`);
  if (!Number.isFinite(point.distanceFeet) || point.distanceFeet < 0 || point.distanceFeet > 120) {
    throw new DomainEvaluationError(`${label} must be on ground within 120 feet of the Druid`);
  }
}

export function compileNaturesSanctuaryActivation(request:NaturesSanctuaryActivateRequest):PendingResolution {
  validateCircleLand14(request.druidLevel,request.subclassId,"Nature's Sanctuary");
  validatePoint(request.center,"Nature's Sanctuary center");
  const effectId = `${request.id}:zone`;
  const operations:ResolutionOperation[] = [{
    id:`${request.id}:center`,
    kind:"targeting",
    sourceId:request.actorId,
    rule:{
      kind:"point",
      rangeFeet:120,
      minTargets:1,
      maxTargets:1,
      allowedRelations:["neutral"],
      directTarget:false,
    },
    targets:[request.center],
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
  operations.push(
    {
      id:`${request.id}:wild-shape`,
      kind:"spend-resource",
      actorId:request.actorId,
      resourceId:request.wildShapeResourceId ?? DRUID_WILD_SHAPE_RESOURCE_ID,
      amount:1,
    },
    {
      id:`${request.id}:effect`,
      kind:"apply-effect",
      effect:{
        id:effectId,
        sourceId:DRUID_NATURES_SANCTUARY_SOURCE,
        sourceActorId:request.actorId,
        targetId:request.actorId,
        kind:"marker",
        tags:[DRUID_NATURES_SANCTUARY_TAG],
        duration:{ kind:"minutes", amount:1 },
        termination:{ sourceBecomesIncapacitated:true, sourceDies:true },
        metadata:{
          centerPointId:request.center.id,
          centerDistanceFromSourceFeet:request.center.distanceFeet,
          cubeSizeFeet:15,
          onGround:true,
          landType:request.landType,
        },
      },
    },
  );
  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:DRUID_NATURES_SANCTUARY_SOURCE,
    expectedRevision:request.expectedRevision,
    operations,
  };
}

export function resolveNaturesSanctuaryActivation(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:NaturesSanctuaryActivateRequest,
):ResolutionCommit {
  try {
    return resolvePendingResolution(profile,inputState,compileNaturesSanctuaryActivation(request));
  } catch (error) {
    return { status:"rejected", state:inputState, events:[], results:{}, error:error instanceof Error ? error.message : String(error) };
  }
}

export function compileNaturesSanctuaryMove(
  inputState:RulesRuntimeState,
  request:NaturesSanctuaryMoveRequest,
):PendingResolution {
  validateCircleLand14(request.druidLevel,request.subclassId,"Nature's Sanctuary movement");
  validatePoint(request.destination,"Nature's Sanctuary destination");
  if (!Number.isFinite(request.movementFeet) || request.movementFeet < 0 || request.movementFeet > 60) {
    throw new DomainEvaluationError("Nature's Sanctuary can move at most 60 feet with the Bonus Action");
  }
  const effect = inputState.effects.find((entry) => entry.id === request.effectId);
  if (!effect || effect.sourceId !== DRUID_NATURES_SANCTUARY_SOURCE || effect.sourceActorId !== request.actorId) {
    throw new DomainEvaluationError("active Nature's Sanctuary effect not found for this Druid");
  }
  const operations:ResolutionOperation[] = [{
    id:`${request.id}:destination`,
    kind:"targeting",
    sourceId:request.actorId,
    rule:{
      kind:"point",
      rangeFeet:120,
      minTargets:1,
      maxTargets:1,
      allowedRelations:["neutral"],
      directTarget:false,
    },
    targets:[request.destination],
  }];
  if (request.useActionEconomy) {
    operations.push({
      id:`${request.id}:bonus-action`,
      kind:"use-economy",
      actorId:request.actorId,
      slot:"bonus-action",
      bonusActionGranted:true,
      actionKind:"other",
    });
  }
  operations.push({
    id:`${request.id}:update`,
    kind:"update-effect",
    effectId:request.effectId,
    metadataPatch:{
      centerPointId:request.destination.id,
      centerDistanceFromSourceFeet:request.destination.distanceFeet,
      onGround:true,
    },
  });
  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:DRUID_NATURES_SANCTUARY_SOURCE,
    expectedRevision:request.expectedRevision,
    operations,
  };
}

export function resolveNaturesSanctuaryMove(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:NaturesSanctuaryMoveRequest,
):ResolutionCommit {
  try {
    return resolvePendingResolution(profile,inputState,compileNaturesSanctuaryMove(inputState,request));
  } catch (error) {
    return { status:"rejected", state:inputState, events:[], results:{}, error:error instanceof Error ? error.message : String(error) };
  }
}

export interface SanctuaryBenefitQuery {
  effectId:string;
  targetId:string;
  relationToDruid:"self"|"ally"|"enemy"|"neutral";
  insideCube:boolean;
}

export interface SanctuaryBenefits {
  active:boolean;
  halfCover:boolean;
  grantedResistance?:"fire"|"cold"|"lightning"|"poison";
}

export function naturesSanctuaryBenefits(state:RulesRuntimeState, query:SanctuaryBenefitQuery):SanctuaryBenefits {
  const effect = state.effects.find((entry) => entry.id === query.effectId && entry.sourceId === DRUID_NATURES_SANCTUARY_SOURCE);
  if (!effect || !query.insideCube || (query.relationToDruid !== "self" && query.relationToDruid !== "ally")) {
    return { active:Boolean(effect), halfCover:false };
  }
  const landType = effect.metadata?.landType;
  if (landType !== "arid" && landType !== "polar" && landType !== "temperate" && landType !== "tropical") {
    throw new DomainEvaluationError("Nature's Sanctuary effect is missing canonical land metadata");
  }
  return {
    active:true,
    halfCover:true,
    grantedResistance:query.relationToDruid === "ally"
      ? naturesWardResistance(14,DRUID_CIRCLE_LAND_SUBCLASS_ID,landType)
      : undefined,
  };
}
