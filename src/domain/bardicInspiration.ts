import { requireCombatant, type RulesRuntimeState } from "./combatState";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import { findResource, type ResourceRecovery } from "./resources";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";
import { resolveConsumeD20BonusEffect, type ConsumeD20BonusEffectRequest } from "./consumableD20BonusEffect";

export const BARD_ID = "dnd.srd521.class.bard";
export const BARDIC_INSPIRATION_RESOURCE_ID = "resource:bard.bardic-inspiration";
export const BARDIC_INSPIRATION_SOURCE = "feature:bard.bardic-inspiration";
export const FONT_OF_INSPIRATION_SOURCE = "feature:bard.font-of-inspiration";
export const SUPERIOR_INSPIRATION_SOURCE = "feature:bard.superior-inspiration";
export const BARDIC_INSPIRATION_EFFECT_TAG = "bardic-inspiration";

export interface BardicInspirationResourceDefinition {
  resourceId:string;
  label:string;
  maximum:number;
  dieSides:number;
  recovery:ResourceRecovery;
  source:string;
}

function validateBardLevel(level:number,minimum=1) {
  if (!Number.isInteger(level) || level < minimum || level > 20) {
    throw new DomainEvaluationError(`Bard level must be an integer from ${minimum} to 20`);
  }
}

export function bardicInspirationDieSides(bardLevel:number) {
  validateBardLevel(bardLevel);
  if (bardLevel >= 15) return 12;
  if (bardLevel >= 10) return 10;
  if (bardLevel >= 5) return 8;
  return 6;
}

export function bardicInspirationMaximum(charismaModifier:number) {
  if (!Number.isInteger(charismaModifier)) throw new DomainEvaluationError("Charisma modifier must be an integer");
  return Math.max(1,charismaModifier);
}

export function bardicInspirationResourceDefinition(bardLevel:number,charismaModifier:number):BardicInspirationResourceDefinition {
  validateBardLevel(bardLevel);
  return {
    resourceId:BARDIC_INSPIRATION_RESOURCE_ID,
    label:"바드의 영감",
    maximum:bardicInspirationMaximum(charismaModifier),
    dieSides:bardicInspirationDieSides(bardLevel),
    recovery:bardLevel >= 5 ? { shortRest:"all", longRest:"all" } : { longRest:"all" },
    source:`바드 ${bardLevel}레벨 · 바드의 영감${bardLevel >= 5 ? " / 영감의 샘" : ""} · SRD 5.2.1`,
  };
}

export function bardicInspirationEffectForTarget(state:RulesRuntimeState,targetId:string) {
  return state.effects.find((effect) => effect.targetId === targetId && effect.tags.includes(BARDIC_INSPIRATION_EFFECT_TAG));
}

export interface GrantBardicInspirationRequest {
  id:string;
  actorId:string;
  targetId:string;
  expectedRevision:number;
  bardLevel:number;
  distanceFeet:number;
  targetCanSeeOrHearBard:boolean;
  useBonusAction:boolean;
  resourceId?:string;
  effectId?:string;
}

function validateGrant(state:RulesRuntimeState,request:GrantBardicInspirationRequest) {
  validateBardLevel(request.bardLevel);
  requireCombatant(state,request.actorId);
  requireCombatant(state,request.targetId);
  if (request.targetId === request.actorId) throw new DomainEvaluationError("Bardic Inspiration must target another creature");
  if (!Number.isFinite(request.distanceFeet) || request.distanceFeet < 0 || request.distanceFeet > 60) {
    throw new DomainEvaluationError("Bardic Inspiration target must be within 60 feet");
  }
  if (!request.targetCanSeeOrHearBard) throw new DomainEvaluationError("Bardic Inspiration target must be able to see or hear the Bard");
  if (bardicInspirationEffectForTarget(state,request.targetId)) {
    throw new DomainEvaluationError("a creature can hold only one Bardic Inspiration die at a time");
  }
  const actor = requireCombatant(state,request.actorId);
  const found = findResource(actor.resources,request.resourceId ?? BARDIC_INSPIRATION_RESOURCE_ID);
  if (found.pool.current < 1) throw new DomainEvaluationError("Bardic Inspiration requires an available use");
}

export function compileGrantBardicInspiration(state:RulesRuntimeState,request:GrantBardicInspirationRequest):PendingResolution {
  validateGrant(state,request);
  const operations:ResolutionOperation[] = [];
  if (request.useBonusAction) {
    operations.push({
      id:`${request.id}:bonus-action`,
      kind:"use-economy",
      actorId:request.actorId,
      slot:"bonus-action",
      bonusActionGranted:true,
      actionKind:"other",
    });
  }
  operations.push(
    {
      id:`${request.id}:resource`,
      kind:"spend-resource",
      actorId:request.actorId,
      resourceId:request.resourceId ?? BARDIC_INSPIRATION_RESOURCE_ID,
      amount:1,
    },
    {
      id:`${request.id}:effect`,
      kind:"apply-effect",
      effect:{
        id:request.effectId ?? `effect:bardic-inspiration:${request.actorId}:${request.targetId}:${request.id}`,
        sourceId:BARDIC_INSPIRATION_SOURCE,
        sourceActorId:request.actorId,
        targetId:request.targetId,
        kind:"marker",
        tags:[BARDIC_INSPIRATION_EFFECT_TAG],
        duration:{ kind:"hours", amount:1 },
        metadata:{
          dieSides:bardicInspirationDieSides(request.bardLevel),
          displayName:"바드의 영감",
          publicLabel:`바드의 영감 · d${bardicInspirationDieSides(request.bardLevel)}`,
          d20FollowUp:"failed-test-add-die",
          d20Families:"ability-check,saving-throw,attack-roll",
          consumeOnUse:true,
        },
      },
    },
  );
  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:BARDIC_INSPIRATION_SOURCE,
    expectedRevision:request.expectedRevision,
    operations,
  };
}

export function resolveGrantBardicInspiration(
  profile:RulesProfileLike,
  state:RulesRuntimeState,
  request:GrantBardicInspirationRequest,
):ResolutionCommit {
  try {
    return resolvePendingResolution(profile,state,compileGrantBardicInspiration(state,request));
  } catch (error) {
    return { status:"rejected", state, events:[], results:{}, error:error instanceof Error ? error.message : String(error) };
  }
}

export type UseBardicInspirationRequest=ConsumeD20BonusEffectRequest;

export interface BardicInspirationCheckResult {
  initialTotal:number;
  target:number;
  bonus:number;
  finalTotal:number;
  outcome:"success"|"failure";
  effectId:string;
}

export function resolveUseBardicInspiration(
  profile:RulesProfileLike,
  state:RulesRuntimeState,
  request:UseBardicInspirationRequest,
):ResolutionCommit & { check?:BardicInspirationCheckResult } {
  const committed=resolveConsumeD20BonusEffect(profile,state,request);
  if(committed.status==="rejected"||!committed.test||!committed.effect)return committed;
  return {...committed,check:{
    initialTotal:request.failedTotal,
    target:request.target,
    bonus:request.dieFace,
    finalTotal:committed.test.total,
    outcome:committed.test.outcome,
    effectId:committed.effect.id,
  }};
}

export interface FontOfInspirationSlotRecoveryRequest {
  id:string;
  actorId:string;
  expectedRevision:number;
  bardLevel:number;
  spellSlotResourceId:string;
  bardicInspirationResourceId?:string;
}

export function resolveFontOfInspirationSlotRecovery(
  profile:RulesProfileLike,
  state:RulesRuntimeState,
  request:FontOfInspirationSlotRecoveryRequest,
):ResolutionCommit {
  try {
    validateBardLevel(request.bardLevel,5);
    const actor = requireCombatant(state,request.actorId);
    const inspiration = findResource(actor.resources,request.bardicInspirationResourceId ?? BARDIC_INSPIRATION_RESOURCE_ID);
    if (inspiration.pool.current >= inspiration.pool.maximum) throw new DomainEvaluationError("Bardic Inspiration is already at maximum uses");
    findResource(actor.resources,request.spellSlotResourceId);
    return resolvePendingResolution(profile,state,{
      id:request.id,
      actorId:request.actorId,
      sourceId:FONT_OF_INSPIRATION_SOURCE,
      expectedRevision:request.expectedRevision,
      operations:[
        { id:`${request.id}:slot`, kind:"spend-resource", actorId:request.actorId, resourceId:request.spellSlotResourceId, amount:1 },
        { id:`${request.id}:inspiration`, kind:"gain-resource", actorId:request.actorId, resourceId:request.bardicInspirationResourceId ?? BARDIC_INSPIRATION_RESOURCE_ID, amount:1 },
      ],
    });
  } catch (error) {
    return { status:"rejected", state, events:[], results:{}, error:error instanceof Error ? error.message : String(error) };
  }
}

export interface SuperiorInspirationRequest {
  id:string;
  actorId:string;
  expectedRevision:number;
  bardLevel:number;
  resourceId?:string;
}

export function resolveSuperiorInspirationOnInitiative(
  profile:RulesProfileLike,
  state:RulesRuntimeState,
  request:SuperiorInspirationRequest,
):ResolutionCommit {
  try {
    validateBardLevel(request.bardLevel,18);
    const actor = requireCombatant(state,request.actorId);
    const found = findResource(actor.resources,request.resourceId ?? BARDIC_INSPIRATION_RESOURCE_ID);
    const amount = Math.max(0,Math.min(found.pool.maximum,2) - found.pool.current);
    return resolvePendingResolution(profile,state,{
      id:request.id,
      actorId:request.actorId,
      sourceId:SUPERIOR_INSPIRATION_SOURCE,
      expectedRevision:request.expectedRevision,
      operations:amount > 0 ? [{ id:`${request.id}:restore`, kind:"gain-resource", actorId:request.actorId, resourceId:request.resourceId ?? BARDIC_INSPIRATION_RESOURCE_ID, amount }] : [],
    });
  } catch (error) {
    return { status:"rejected", state, events:[], results:{}, error:error instanceof Error ? error.message : String(error) };
  }
}
