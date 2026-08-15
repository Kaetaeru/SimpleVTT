import { requireCombatant, type RulesRuntimeState } from "./combatState";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import { findResource } from "./resources";
import type { ResolutionCommit, ResolutionOperation } from "./resolutionTypes";
import { BARDIC_INSPIRATION_RESOURCE_ID, bardicInspirationDieSides } from "./bardicInspiration";

export const BARD_COLLEGE_LORE_SUBCLASS_ID = "dnd.srd521.subclass.bard.college-of-lore";
export const LORE_CUTTING_WORDS_SOURCE = "feature:bard.college-of-lore.cutting-words";
export const LORE_PEERLESS_SKILL_SOURCE = "feature:bard.college-of-lore.peerless-skill";

function validateLore(args:{ bardLevel:number; subclassId?:string; minimumLevel:number; feature:string }) {
  if (!Number.isInteger(args.bardLevel) || args.bardLevel < args.minimumLevel || args.bardLevel > 20) {
    throw new DomainEvaluationError(`${args.feature} requires Bard level ${args.minimumLevel}-20`);
  }
  if (args.subclassId !== BARD_COLLEGE_LORE_SUBCLASS_ID) {
    throw new DomainEvaluationError(`${args.feature} requires College of Lore`);
  }
}

function requireInspiration(state:RulesRuntimeState,actorId:string,resourceId?:string) {
  const actor = requireCombatant(state,actorId);
  const found = findResource(actor.resources,resourceId ?? BARDIC_INSPIRATION_RESOURCE_ID);
  if (found.pool.current < 1) throw new DomainEvaluationError("an available Bardic Inspiration use is required");
}

export type CuttingWordsTrigger =
  | { kind:"ability-check"|"attack-roll"; total:number; target:number }
  | { kind:"damage-roll"; total:number };

export interface LoreCuttingWordsRequest {
  id:string;
  actorId:string;
  expectedRevision:number;
  bardLevel:number;
  subclassId?:string;
  targetActorId:string;
  distanceFeet:number;
  targetVisible:boolean;
  trigger:CuttingWordsTrigger;
  inspirationDieFace:number;
  resourceId?:string;
  useReaction:boolean;
}

export interface CuttingWordsResult {
  kind:CuttingWordsTrigger["kind"];
  originalTotal:number;
  reduction:number;
  adjustedTotal:number;
  target?:number;
  outcome?:"success"|"failure";
}

function cuttingWordsResult(request:LoreCuttingWordsRequest):CuttingWordsResult {
  const trigger = request.trigger;
  const adjustedTotal = Math.max(0,trigger.total - request.inspirationDieFace);
  if (trigger.kind === "damage-roll") {
    return { kind:trigger.kind, originalTotal:trigger.total, reduction:request.inspirationDieFace, adjustedTotal };
  }
  return {
    kind:trigger.kind,
    originalTotal:trigger.total,
    reduction:request.inspirationDieFace,
    adjustedTotal,
    target:trigger.target,
    outcome:adjustedTotal >= trigger.target ? "success" : "failure",
  };
}

export function resolveLoreCuttingWords(
  profile:RulesProfileLike,
  state:RulesRuntimeState,
  request:LoreCuttingWordsRequest,
):ResolutionCommit & { adjustment?:CuttingWordsResult } {
  try {
    validateLore({ bardLevel:request.bardLevel, subclassId:request.subclassId, minimumLevel:3, feature:"Cutting Words" });
    requireCombatant(state,request.targetActorId);
    if (request.targetActorId === request.actorId) throw new DomainEvaluationError("Cutting Words targets another creature");
    if (!Number.isFinite(request.distanceFeet) || request.distanceFeet < 0 || request.distanceFeet > 60) throw new DomainEvaluationError("Cutting Words target must be within 60 feet");
    if (!request.targetVisible) throw new DomainEvaluationError("Cutting Words requires a visible target");
    if (!Number.isFinite(request.trigger.total) || request.trigger.total < 0) throw new DomainEvaluationError("Cutting Words trigger total must be non-negative and finite");
    if (request.trigger.kind !== "damage-roll") {
      if (!Number.isFinite(request.trigger.target) || request.trigger.total < request.trigger.target) {
        throw new DomainEvaluationError("Cutting Words ability/attack trigger must be a successful roll");
      }
    }
    const sides = bardicInspirationDieSides(request.bardLevel);
    if (!Number.isInteger(request.inspirationDieFace) || request.inspirationDieFace < 1 || request.inspirationDieFace > sides) {
      throw new DomainEvaluationError(`Cutting Words requires one fixed d${sides} face`);
    }
    requireInspiration(state,request.actorId,request.resourceId);
    const operations:ResolutionOperation[] = [];
    if (request.useReaction) operations.push({ id:`${request.id}:reaction`, kind:"use-economy", actorId:request.actorId, slot:"reaction", actionKind:"other" });
    operations.push(
      { id:`${request.id}:resource`, kind:"spend-resource", actorId:request.actorId, resourceId:request.resourceId ?? BARDIC_INSPIRATION_RESOURCE_ID, amount:1 },
      { id:`${request.id}:roll`, kind:"damage-roll", request:{ dice:[{ source:LORE_CUTTING_WORDS_SOURCE, count:1, sides, faces:[request.inspirationDieFace] }] } },
    );
    const adjustment = cuttingWordsResult(request);
    const commit = resolvePendingResolution(profile,state,{
      id:request.id,
      actorId:request.actorId,
      sourceId:LORE_CUTTING_WORDS_SOURCE,
      expectedRevision:request.expectedRevision,
      operations,
    });
    return { ...commit, adjustment };
  } catch (error) {
    return { status:"rejected", state, events:[], results:{}, error:error instanceof Error ? error.message : String(error) };
  }
}

export interface LorePeerlessSkillRequest {
  id:string;
  actorId:string;
  expectedRevision:number;
  bardLevel:number;
  subclassId?:string;
  kind:"ability-check"|"attack-roll";
  failedTotal:number;
  target:number;
  inspirationDieFace:number;
  resourceId?:string;
}

export interface PeerlessSkillResult {
  kind:"ability-check"|"attack-roll";
  initialTotal:number;
  target:number;
  bonus:number;
  finalTotal:number;
  outcome:"success"|"failure";
  inspirationExpended:boolean;
}

export function resolveLorePeerlessSkill(
  profile:RulesProfileLike,
  state:RulesRuntimeState,
  request:LorePeerlessSkillRequest,
):ResolutionCommit & { check?:PeerlessSkillResult } {
  try {
    validateLore({ bardLevel:request.bardLevel, subclassId:request.subclassId, minimumLevel:14, feature:"Peerless Skill" });
    if (!Number.isFinite(request.failedTotal) || !Number.isFinite(request.target) || request.failedTotal >= request.target) {
      throw new DomainEvaluationError("Peerless Skill can only follow a failed ability check or attack roll");
    }
    const sides = bardicInspirationDieSides(request.bardLevel);
    if (!Number.isInteger(request.inspirationDieFace) || request.inspirationDieFace < 1 || request.inspirationDieFace > sides) {
      throw new DomainEvaluationError(`Peerless Skill requires one fixed d${sides} face`);
    }
    requireInspiration(state,request.actorId,request.resourceId);
    const finalTotal = request.failedTotal + request.inspirationDieFace;
    const success = finalTotal >= request.target;
    const check:PeerlessSkillResult = {
      kind:request.kind,
      initialTotal:request.failedTotal,
      target:request.target,
      bonus:request.inspirationDieFace,
      finalTotal,
      outcome:success ? "success" : "failure",
      inspirationExpended:success,
    };
    const operations:ResolutionOperation[] = [{
      id:`${request.id}:roll`,
      kind:"damage-roll",
      request:{ dice:[{ source:LORE_PEERLESS_SKILL_SOURCE, count:1, sides, faces:[request.inspirationDieFace] }] },
    }];
    if (success) operations.push({
      id:`${request.id}:resource`,
      kind:"spend-resource",
      actorId:request.actorId,
      resourceId:request.resourceId ?? BARDIC_INSPIRATION_RESOURCE_ID,
      amount:1,
    });
    const commit = resolvePendingResolution(profile,state,{
      id:request.id,
      actorId:request.actorId,
      sourceId:LORE_PEERLESS_SKILL_SOURCE,
      expectedRevision:request.expectedRevision,
      operations,
    });
    return { ...commit, check };
  } catch (error) {
    return { status:"rejected", state, events:[], results:{}, error:error instanceof Error ? error.message : String(error) };
  }
}
