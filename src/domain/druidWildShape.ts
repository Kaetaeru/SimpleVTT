import { DRUID_WILD_SHAPE_RESOURCE_ID } from "./coreClassResources";
import type { RulesRuntimeState } from "./combatState";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";
import type { TemporaryHpChoice } from "./temporaryHp";

export const DRUID_WILD_SHAPE_FEATURE_ID = "druid.wild-shape";
export const DRUID_WILD_SHAPE_TAG = "class-feature:druid-wild-shape";

export interface DruidWildShapeForm {
  id:string;
  name:string;
  challengeRating:number;
  hasFlySpeed:boolean;
  armorClass:number;
  speedFeet:number;
}

export interface DruidWildShapeFormLimits {
  knownForms:number;
  maximumChallengeRating:number;
  flightAllowed:boolean;
}

export function druidWildShapeFormLimits(level:number):DruidWildShapeFormLimits {
  if (!Number.isInteger(level) || level < 1 || level > 20) {
    throw new DomainEvaluationError("Wild Shape requires Druid level 1-20");
  }
  if (level < 2) return { knownForms:0, maximumChallengeRating:0, flightAllowed:false };
  if (level >= 8) return { knownForms:8, maximumChallengeRating:1, flightAllowed:true };
  if (level >= 4) return { knownForms:6, maximumChallengeRating:0.5, flightAllowed:false };
  return { knownForms:4, maximumChallengeRating:0.25, flightAllowed:false };
}

function validateForm(level:number,form:DruidWildShapeForm) {
  if (!form.id || !form.name) throw new DomainEvaluationError("Wild Shape form id and name are required");
  if (!Number.isFinite(form.challengeRating) || form.challengeRating < 0) {
    throw new DomainEvaluationError("Wild Shape form challenge rating must be non-negative");
  }
  if (!Number.isInteger(form.armorClass) || form.armorClass < 0) {
    throw new DomainEvaluationError("Wild Shape form Armor Class must be a non-negative integer");
  }
  if (!Number.isFinite(form.speedFeet) || form.speedFeet < 0) {
    throw new DomainEvaluationError("Wild Shape form speed must be non-negative");
  }
  const limits=druidWildShapeFormLimits(level);
  if (limits.knownForms===0) throw new DomainEvaluationError("Wild Shape requires Druid level 2-20");
  if (form.challengeRating > limits.maximumChallengeRating) {
    throw new DomainEvaluationError(`Wild Shape maximum CR ${limits.maximumChallengeRating} at Druid level ${level}`);
  }
  if (form.hasFlySpeed && !limits.flightAllowed) {
    throw new DomainEvaluationError("Wild Shape cannot use a form with flying speed before Druid level 8");
  }
}

function activeWildShapeEffect(state:RulesRuntimeState,actorId:string) {
  return state.effects.find((effect)=>effect.targetId===actorId&&effect.tags.includes(DRUID_WILD_SHAPE_TAG));
}

export interface DruidWildShapeStartRequest {
  id:string;
  actorId:string;
  expectedRevision:number;
  druidLevel:number;
  form:DruidWildShapeForm;
  temporaryHpChoice?:TemporaryHpChoice;
  useBonusActionEconomy?:boolean;
}

export function compileDruidWildShapeStart(
  inputState:RulesRuntimeState,
  request:DruidWildShapeStartRequest,
):PendingResolution {
  validateForm(request.druidLevel,request.form);
  const operations:ResolutionOperation[]=[];
  const active=activeWildShapeEffect(inputState,request.actorId);
  if(active) {
    operations.push({
      id:`${request.id}:replace-form`,
      kind:"remove-effect",
      effectId:active.id,
    });
  }
  operations.push({
    id:`${request.id}:resource`,
    kind:"spend-resource",
    actorId:request.actorId,
    resourceId:DRUID_WILD_SHAPE_RESOURCE_ID,
    amount:1,
  });
  if(request.useBonusActionEconomy!==false) {
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
    id:`${request.id}:temporary-hp`,
    kind:"temporary-hp",
    targetId:request.actorId,
    amount:request.druidLevel,
    source:DRUID_WILD_SHAPE_FEATURE_ID,
    choice:request.temporaryHpChoice,
  });
  operations.push({
    id:`${request.id}:effect`,
    kind:"apply-effect",
    effect:{
      id:`${request.id}:${request.actorId}:wild-shape`,
      sourceId:DRUID_WILD_SHAPE_FEATURE_ID,
      sourceActorId:request.actorId,
      targetId:request.actorId,
      kind:"marker",
      tags:[DRUID_WILD_SHAPE_TAG],
      duration:{ kind:"hours", amount:request.druidLevel/2 },
      termination:{ targetBecomesIncapacitated:true, targetDies:true },
      metadata:{
        publicLabel:`야생 변신 · ${request.form.name}`,
        formId:request.form.id,
        formName:request.form.name,
        formChallengeRating:request.form.challengeRating,
        formHasFlySpeed:request.form.hasFlySpeed,
        formArmorClass:request.form.armorClass,
        formSpeedFeet:request.form.speedFeet,
        druidLevel:request.druidLevel,
        spellcastingAllowed:request.druidLevel>=18,
      },
    },
  });
  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:DRUID_WILD_SHAPE_FEATURE_ID,
    expectedRevision:request.expectedRevision,
    operations,
  };
}

export function resolveDruidWildShapeStart(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:DruidWildShapeStartRequest,
):ResolutionCommit {
  try {
    return resolvePendingResolution(profile,inputState,compileDruidWildShapeStart(inputState,request));
  } catch(error) {
    return { status:"rejected", state:inputState, events:[], results:{}, error:error instanceof Error?error.message:String(error) };
  }
}

export interface DruidWildShapeEndRequest {
  id:string;
  actorId:string;
  expectedRevision:number;
  useBonusActionEconomy?:boolean;
}

export function compileDruidWildShapeEnd(
  inputState:RulesRuntimeState,
  request:DruidWildShapeEndRequest,
):PendingResolution {
  const active=activeWildShapeEffect(inputState,request.actorId);
  if(!active) throw new DomainEvaluationError("Wild Shape is not active");
  const operations:ResolutionOperation[]=[];
  if(request.useBonusActionEconomy!==false) {
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
    id:`${request.id}:remove-effect`,
    kind:"remove-effect",
    effectId:active.id,
  });
  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:DRUID_WILD_SHAPE_FEATURE_ID,
    expectedRevision:request.expectedRevision,
    operations,
  };
}

export function resolveDruidWildShapeEnd(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:DruidWildShapeEndRequest,
):ResolutionCommit {
  try {
    return resolvePendingResolution(profile,inputState,compileDruidWildShapeEnd(inputState,request));
  } catch(error) {
    return { status:"rejected", state:inputState, events:[], results:{}, error:error instanceof Error?error.message:String(error) };
  }
}
