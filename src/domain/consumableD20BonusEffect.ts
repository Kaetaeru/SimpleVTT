import { requireCombatant, type RulesRuntimeState } from "./combatState";
import type { D20TestFamily, D20TestResult } from "./d20";
import { effectIsActive, type EffectInstance } from "./effects";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { ResolutionCommit } from "./resolutionTypes";

export const CONSUMABLE_D20_BONUS_KIND="failed-test-add-die";

export interface ConsumeD20BonusEffectRequest {
  id:string;
  actorId:string;
  expectedRevision:number;
  family:D20TestFamily;
  naturalFace:number;
  failedTotal:number;
  target:number;
  dieFace:number;
  effectId?:string;
}

function supportsFamily(effect:EffectInstance,family:D20TestFamily) {
  return String(effect.metadata?.d20Families??"").split(",").map((entry)=>entry.trim()).includes(family);
}

function isConsumableBonus(effect:EffectInstance,targetId:string,family:D20TestFamily) {
  return effectIsActive(effect)
    && effect.targetId===targetId
    && effect.metadata?.d20FollowUp===CONSUMABLE_D20_BONUS_KIND
    && effect.metadata?.consumeOnUse===true
    && supportsFamily(effect,family);
}

export function consumableD20BonusEffectFor(state:RulesRuntimeState,targetId:string,family:D20TestFamily) {
  return state.effects.find((effect)=>isConsumableBonus(effect,targetId,family));
}

export function resolveConsumeD20BonusEffect(
  profile:RulesProfileLike,
  state:RulesRuntimeState,
  request:ConsumeD20BonusEffectRequest,
):ResolutionCommit&{test?:D20TestResult;effect?:EffectInstance} {
  try {
    requireCombatant(state,request.actorId);
    if(!Number.isInteger(request.naturalFace)||request.naturalFace<1||request.naturalFace>20) throw new DomainEvaluationError("consumable d20 bonus requires the authoritative natural d20 face");
    if(!Number.isFinite(request.failedTotal)||!Number.isFinite(request.target)||request.failedTotal>=request.target) throw new DomainEvaluationError("consumable d20 bonus can only follow a failed d20 test");
    const effect=request.effectId
      ? state.effects.find((entry)=>entry.id===request.effectId)
      : consumableD20BonusEffectFor(state,request.actorId,request.family);
    if(!effect||!isConsumableBonus(effect,request.actorId,request.family)) throw new DomainEvaluationError("matching consumable d20 bonus effect not found");
    const sides=Number(effect.metadata?.dieSides);
    if(!Number.isInteger(sides)||sides<2||sides>20) throw new DomainEvaluationError("consumable d20 bonus effect has an invalid die size");
    if(!Number.isInteger(request.dieFace)||request.dieFace<1||request.dieFace>sides) throw new DomainEvaluationError(`consumable d20 bonus requires one fixed d${sides} face`);
    const testId=`${request.id}:test`;
    const commit=resolvePendingResolution(profile,state,{
      id:request.id,
      actorId:request.actorId,
      sourceId:effect.sourceId,
      expectedRevision:request.expectedRevision,
      operations:[
        {
          id:testId,
          kind:"d20",
          actorId:request.actorId,
          request:{
            family:request.family,
            target:request.target,
            targetSource:"authoritative prior d20 target",
            modifierContributions:[{source:"authoritative prior d20 modifier total",value:request.failedTotal-request.naturalFace}],
            rollModifications:[{
              source:effect.sourceId,
              mode:"add-die",
              dice:{id:`${request.id}:bonus-die`,purpose:effect.sourceId,sides,faces:[request.dieFace]},
            }],
            dice:{id:`${request.id}:original-d20`,purpose:"authoritative prior d20",sides:20,faces:[request.naturalFace]},
          },
        },
        {id:`${request.id}:consume`,kind:"remove-effect",effectId:effect.id},
      ],
    });
    return {...commit,test:commit.status==="committed"?commit.results[testId] as D20TestResult:undefined,effect};
  } catch(error) {
    return {status:"rejected",state,events:[],results:{},error:error instanceof Error?error.message:String(error)};
  }
}
