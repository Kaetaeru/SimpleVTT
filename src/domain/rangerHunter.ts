import type { DamageDefenseContribution } from "./damage";
import type { RulesRuntimeState } from "./combatState";
import { DomainEvaluationError, type RollStateContribution, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";
import { RANGER_HUNTER_SUBCLASS_ID } from "./srdSubclassCatalog";

export const HUNTER_DEFENSIVE_TACTICS_FEATURE_ID = "dnd.srd521.feature.ranger.hunter.defensive-tactics";
export const HUNTER_ESCAPE_THE_HORDE_OPTION_ID = "dnd.srd521.feature.ranger.hunter.defensive-tactics.escape-the-horde";
export const HUNTER_MULTIATTACK_DEFENSE_OPTION_ID = "dnd.srd521.feature.ranger.hunter.defensive-tactics.multiattack-defense";
export const HUNTER_SUPERIOR_PREY_FEATURE_ID = "dnd.srd521.feature.ranger.hunter.superior-hunters-prey";
export const HUNTER_SUPERIOR_DEFENSE_FEATURE_ID = "dnd.srd521.feature.ranger.hunter.superior-hunters-defense";
export const HUNTER_MULTIATTACK_DEFENSE_TAG = "ranger:hunter:multiattack-defense";
export const HUNTER_SUPERIOR_DEFENSE_TAG = "ranger:hunter:superior-defense";

export const HUNTER_DEFENSIVE_TACTIC_OPTIONS = [
  {
    id:HUNTER_ESCAPE_THE_HORDE_OPTION_ID,
    label:"무리에서 벗어나기",
    description:"자신을 향한 기회 공격에 불리점을 적용합니다.",
  },
  {
    id:HUNTER_MULTIATTACK_DEFENSE_OPTION_ID,
    label:"다중공격 방어",
    description:"한 크리처에게 명중당한 뒤 같은 턴 그 크리처가 자신에게 하는 후속 명중 굴림에 불리점을 적용합니다.",
  },
] as const;

function validateHunter(level:number,subclassId:string|undefined,minimumLevel:number,feature:string) {
  if (!Number.isInteger(level) || level < minimumLevel || level > 20) {
    throw new DomainEvaluationError(`${feature} requires Ranger level ${minimumLevel}-20`);
  }
  if (subclassId !== RANGER_HUNTER_SUBCLASS_ID) {
    throw new DomainEvaluationError(`${feature} requires the Hunter subclass`);
  }
}

function selectedTactic(optionIds:string[]) {
  const selected = optionIds.filter((id) => HUNTER_DEFENSIVE_TACTIC_OPTIONS.some((option) => option.id === id));
  if (selected.length !== 1) throw new DomainEvaluationError("Hunter Defensive Tactics requires exactly one stable option id");
  return selected[0];
}

function rejected(inputState:RulesRuntimeState,error:unknown):ResolutionCommit {
  return {
    status:"rejected",
    state:inputState,
    events:[],
    results:{},
    error:error instanceof Error ? error.message : String(error),
  };
}

export function replaceHunterDefensiveTactic(
  subclassFeatureIds:string[],
  nextOptionId:string,
  rest:"short"|"long",
) {
  if (rest !== "short" && rest !== "long") throw new DomainEvaluationError("Defensive Tactics can change only after a Short or Long Rest");
  if (!HUNTER_DEFENSIVE_TACTIC_OPTIONS.some((option) => option.id === nextOptionId)) {
    throw new DomainEvaluationError(`unknown Hunter Defensive Tactics option: ${nextOptionId}`);
  }
  return [
    ...subclassFeatureIds.filter((id) => id !== HUNTER_ESCAPE_THE_HORDE_OPTION_ID && id !== HUNTER_MULTIATTACK_DEFENSE_OPTION_ID),
    nextOptionId,
  ];
}

export function hunterEscapeTheHordeContribution(args:{
  rangerLevel:number;
  subclassId?:string;
  subclassFeatureIds:string[];
  opportunityAttack:boolean;
}):RollStateContribution|undefined {
  validateHunter(args.rangerLevel,args.subclassId,7,"Escape the Horde");
  if (selectedTactic(args.subclassFeatureIds) !== HUNTER_ESCAPE_THE_HORDE_OPTION_ID || !args.opportunityAttack) return undefined;
  return { source:HUNTER_ESCAPE_THE_HORDE_OPTION_ID, state:"disadvantage" };
}

export interface HunterMultiattackDefenseTriggerRequest {
  id:string;
  rangerId:string;
  attackerId:string;
  expectedRevision:number;
  rangerLevel:number;
  subclassId?:string;
  subclassFeatureIds:string[];
  attackHit:boolean;
  round:number;
}

export function resolveHunterMultiattackDefenseTrigger(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:HunterMultiattackDefenseTriggerRequest,
):ResolutionCommit {
  try {
    validateHunter(request.rangerLevel,request.subclassId,7,"Multiattack Defense");
    if (selectedTactic(request.subclassFeatureIds) !== HUNTER_MULTIATTACK_DEFENSE_OPTION_ID) {
      throw new DomainEvaluationError("Multiattack Defense is not the selected Defensive Tactics option");
    }
    if (!request.attackHit) throw new DomainEvaluationError("Multiattack Defense requires an attack roll that hit the Ranger");
    if (!Number.isInteger(request.round) || request.round < 0) throw new DomainEvaluationError("round must be a non-negative integer");
    return resolvePendingResolution(profile,inputState,{
      id:request.id,
      actorId:request.rangerId,
      sourceId:HUNTER_MULTIATTACK_DEFENSE_OPTION_ID,
      expectedRevision:request.expectedRevision,
      operations:[{
        id:`${request.id}:marker`,
        kind:"apply-effect",
        effect:{
          id:`${request.id}:${request.attackerId}:marker`,
          sourceId:HUNTER_MULTIATTACK_DEFENSE_OPTION_ID,
          sourceActorId:request.attackerId,
          targetId:request.rangerId,
          kind:"marker",
          tags:[HUNTER_MULTIATTACK_DEFENSE_TAG],
          duration:{ kind:"until-turn-boundary", actorId:request.attackerId, round:request.round, boundary:"end" },
          metadata:{ attackerId:request.attackerId },
        },
      }],
    });
  } catch (error) {
    return rejected(inputState,error);
  }
}

export function hunterMultiattackDefenseContribution(args:{
  state:RulesRuntimeState;
  rangerId:string;
  attackerId:string;
}):RollStateContribution|undefined {
  const active = args.state.effects.some((effect) =>
    effect.targetId === args.rangerId
    && effect.sourceActorId === args.attackerId
    && effect.tags.includes(HUNTER_MULTIATTACK_DEFENSE_TAG));
  return active ? { source:HUNTER_MULTIATTACK_DEFENSE_OPTION_ID, state:"disadvantage" } : undefined;
}

export interface HunterSuperiorPreyRequest {
  id:string;
  rangerId:string;
  expectedRevision:number;
  rangerLevel:number;
  subclassId?:string;
  primaryTargetId:string;
  primaryTargetIsHuntersMarkTarget:boolean;
  huntersMarkBonusDamage:number;
  secondaryTarget:{
    id:string;
    distanceFromPrimaryFeet:number;
    visibleByRanger:boolean;
    creatureKind:"character"|"monster";
  };
  concentrationCheck?:Extract<ResolutionOperation,{kind:"damage"}>["concentrationCheck"];
}

export function resolveHunterSuperiorPrey(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:HunterSuperiorPreyRequest,
):ResolutionCommit {
  try {
    validateHunter(request.rangerLevel,request.subclassId,11,"Superior Hunter's Prey");
    if (!request.primaryTargetIsHuntersMarkTarget) throw new DomainEvaluationError("Superior Hunter's Prey requires damage to the Hunter's Mark target");
    if (!Number.isInteger(request.huntersMarkBonusDamage) || request.huntersMarkBonusDamage < 0) {
      throw new DomainEvaluationError("Hunter's Mark bonus damage must be a non-negative integer");
    }
    if (request.secondaryTarget.id === request.primaryTargetId) throw new DomainEvaluationError("Superior Hunter's Prey requires a different secondary creature");
    if (!request.secondaryTarget.visibleByRanger) throw new DomainEvaluationError("Superior Hunter's Prey secondary creature must be visible to the Ranger");
    if (!Number.isFinite(request.secondaryTarget.distanceFromPrimaryFeet)
      || request.secondaryTarget.distanceFromPrimaryFeet < 0
      || request.secondaryTarget.distanceFromPrimaryFeet > 30) {
      throw new DomainEvaluationError("Superior Hunter's Prey secondary creature must be within 30 feet of the marked target");
    }
    const operations:ResolutionOperation[] = [{
      id:`${request.id}:turn-feature`,
      kind:"use-turn-feature",
      actorId:request.rangerId,
      featureId:HUNTER_SUPERIOR_PREY_FEATURE_ID,
    }];
    if (request.huntersMarkBonusDamage > 0) {
      operations.push({
        id:`${request.id}:damage`,
        kind:"damage",
        targetId:request.secondaryTarget.id,
        damageType:"force",
        amount:request.huntersMarkBonusDamage,
        creatureKind:request.secondaryTarget.creatureKind,
        concentrationCheck:request.concentrationCheck,
      });
    }
    return resolvePendingResolution(profile,inputState,{
      id:request.id,
      actorId:request.rangerId,
      sourceId:HUNTER_SUPERIOR_PREY_FEATURE_ID,
      expectedRevision:request.expectedRevision,
      operations,
    });
  } catch (error) {
    return rejected(inputState,error);
  }
}

export interface HunterSuperiorDefenseRequest {
  id:string;
  rangerId:string;
  expectedRevision:number;
  rangerLevel:number;
  subclassId?:string;
  damageType:string;
  incomingDamage:number;
  creatureKind:"character"|"monster";
  currentTurnActorId:string;
  round:number;
  concentrationCheck?:Extract<ResolutionOperation,{kind:"damage"}>["concentrationCheck"];
}

export function hunterSuperiorDefenseResistance(
  state:RulesRuntimeState,
  rangerId:string,
  damageType:string,
):DamageDefenseContribution|undefined {
  const active = state.effects.find((effect) =>
    effect.targetId === rangerId
    && effect.sourceId === HUNTER_SUPERIOR_DEFENSE_FEATURE_ID
    && effect.tags.includes(HUNTER_SUPERIOR_DEFENSE_TAG)
    && effect.metadata?.damageType === damageType);
  return active ? { source:HUNTER_SUPERIOR_DEFENSE_FEATURE_ID, kind:"resistance", damageType } : undefined;
}

export function resolveHunterSuperiorDefense(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:HunterSuperiorDefenseRequest,
):ResolutionCommit {
  try {
    validateHunter(request.rangerLevel,request.subclassId,15,"Superior Hunter's Defense");
    if (!request.damageType) throw new DomainEvaluationError("Superior Hunter's Defense requires the triggering damage type");
    if (!Number.isInteger(request.incomingDamage) || request.incomingDamage < 0) throw new DomainEvaluationError("incoming damage must be a non-negative integer");
    if (!Number.isInteger(request.round) || request.round < 0) throw new DomainEvaluationError("round must be a non-negative integer");
    const resistance:DamageDefenseContribution = {
      source:HUNTER_SUPERIOR_DEFENSE_FEATURE_ID,
      kind:"resistance",
      damageType:request.damageType,
    };
    return resolvePendingResolution(profile,inputState,{
      id:request.id,
      actorId:request.rangerId,
      sourceId:HUNTER_SUPERIOR_DEFENSE_FEATURE_ID,
      expectedRevision:request.expectedRevision,
      operations:[
        {
          id:`${request.id}:reaction`,
          kind:"use-economy",
          actorId:request.rangerId,
          slot:"reaction",
          actionKind:"other",
        },
        {
          id:`${request.id}:resistance`,
          kind:"apply-effect",
          effect:{
            id:`${request.id}:${request.rangerId}:resistance`,
            sourceId:HUNTER_SUPERIOR_DEFENSE_FEATURE_ID,
            sourceActorId:request.rangerId,
            targetId:request.rangerId,
            kind:"marker",
            tags:[HUNTER_SUPERIOR_DEFENSE_TAG],
            duration:{ kind:"until-turn-boundary", actorId:request.currentTurnActorId, round:request.round, boundary:"end" },
            metadata:{ damageType:request.damageType },
          },
        },
        {
          id:`${request.id}:triggering-damage`,
          kind:"damage",
          targetId:request.rangerId,
          damageType:request.damageType,
          amount:request.incomingDamage,
          defenses:[resistance],
          creatureKind:request.creatureKind,
          concentrationCheck:request.concentrationCheck,
        },
      ],
    });
  } catch (error) {
    return rejected(inputState,error);
  }
}
