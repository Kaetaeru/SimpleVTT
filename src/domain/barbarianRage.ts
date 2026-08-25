import { BARBARIAN_RAGE_RESOURCE_ID } from "./barbarianBerserker";
import type { RulesRuntimeState } from "./combatState";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";

export const BARBARIAN_RAGE_FEATURE_ID = "dnd.srd521.feature.barbarian.rage";
export const BARBARIAN_RAGE_TAG = "barbarian:rage";
export const BARBARIAN_RAGE_DURATION_KEY = "barbarian-rage";

export function barbarianRageDamageBonus(level:number) {
  if (!Number.isInteger(level) || level < 1 || level > 20) {
    throw new DomainEvaluationError("Rage requires Barbarian level 1-20");
  }
  if (level >= 16) return 4;
  if (level >= 9) return 3;
  return 2;
}

export interface BarbarianRageStartRequest {
  id:string;
  actorId:string;
  expectedRevision:number;
  barbarianLevel:number;
  wearingHeavyArmor:boolean;
  useBonusActionEconomy?:boolean;
}

function rageEffects(state:RulesRuntimeState,actorId:string) {
  return state.effects.filter((effect) => effect.targetId === actorId && (
    effect.tags.includes(BARBARIAN_RAGE_TAG)
    || (effect.expiry.kind === "special" && effect.expiry.key === BARBARIAN_RAGE_DURATION_KEY)
  ));
}

export function compileBarbarianRageStart(
  inputState:RulesRuntimeState,
  request:BarbarianRageStartRequest,
):PendingResolution {
  const damageBonus = barbarianRageDamageBonus(request.barbarianLevel);
  if (request.wearingHeavyArmor) throw new DomainEvaluationError("Rage cannot start while wearing Heavy armor");
  if (inputState.effects.some((effect) => effect.targetId === request.actorId && effect.tags.includes(BARBARIAN_RAGE_TAG))) {
    throw new DomainEvaluationError("Rage is already active");
  }

  const operations:ResolutionOperation[] = [
    {
      id:`${request.id}:resource`,
      kind:"spend-resource",
      actorId:request.actorId,
      resourceId:BARBARIAN_RAGE_RESOURCE_ID,
      amount:1,
    },
  ];
  if (request.useBonusActionEconomy !== false) {
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
    id:`${request.id}:concentration`,
    kind:"end-concentration",
    actorId:request.actorId,
    reason:"Rage prevents maintaining Concentration",
  });
  operations.push({
    id:`${request.id}:effect`,
    kind:"apply-effect",
    effect:{
      id:`${request.id}:${request.actorId}:rage`,
      sourceId:BARBARIAN_RAGE_FEATURE_ID,
      sourceActorId:request.actorId,
      targetId:request.actorId,
      kind:"marker",
      tags:[
        BARBARIAN_RAGE_TAG,
        "damage-resistance:bludgeoning",
        "damage-resistance:piercing",
        "damage-resistance:slashing",
      ],
      duration:{ kind:"special", key:BARBARIAN_RAGE_DURATION_KEY },
      termination:{ targetBecomesIncapacitated:true, targetDies:true },
      metadata:{ rageDamageBonus:damageBonus },
    },
  });
  for (const family of ["ability-check","saving-throw"] as const) {
    operations.push({
      id:`${request.id}:strength-advantage:${family}`,
      kind:"apply-effect",
      effect:{
        id:`${request.id}:${request.actorId}:strength-advantage:${family}`,
        sourceId:BARBARIAN_RAGE_FEATURE_ID,
        sourceActorId:request.actorId,
        targetId:request.actorId,
        kind:"modifier",
        duration:{ kind:"special", key:BARBARIAN_RAGE_DURATION_KEY },
        termination:{ targetBecomesIncapacitated:true, targetDies:true },
        metadata:{ d20Family:family, d20Ability:"str", d20RollState:"advantage" },
      },
    });
  }
  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:BARBARIAN_RAGE_FEATURE_ID,
    expectedRevision:request.expectedRevision,
    operations,
  };
}

export function resolveBarbarianRageStart(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:BarbarianRageStartRequest,
):ResolutionCommit {
  try {
    return resolvePendingResolution(profile,inputState,compileBarbarianRageStart(inputState,request));
  } catch (error) {
    return { status:"rejected", state:inputState, events:[], results:{}, error:error instanceof Error ? error.message : String(error) };
  }
}

export interface BarbarianRageEndRequest {
  id:string;
  actorId:string;
  expectedRevision:number;
}

export function compileBarbarianRageEnd(
  inputState:RulesRuntimeState,
  request:BarbarianRageEndRequest,
):PendingResolution {
  const active = rageEffects(inputState,request.actorId);
  if (!active.some((effect) => effect.tags.includes(BARBARIAN_RAGE_TAG))) {
    throw new DomainEvaluationError("Rage is not active");
  }
  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:BARBARIAN_RAGE_FEATURE_ID,
    expectedRevision:request.expectedRevision,
    operations:active.map((effect,index) => ({
      id:`${request.id}:remove:${index}`,
      kind:"remove-effect" as const,
      effectId:effect.id,
    })),
  };
}

export function resolveBarbarianRageEnd(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:BarbarianRageEndRequest,
):ResolutionCommit {
  try {
    return resolvePendingResolution(profile,inputState,compileBarbarianRageEnd(inputState,request));
  } catch (error) {
    return { status:"rejected", state:inputState, events:[], results:{}, error:error instanceof Error ? error.message : String(error) };
  }
}
