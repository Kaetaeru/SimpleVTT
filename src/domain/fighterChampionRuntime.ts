import type { FixedDiceInput, ModifierContribution } from "./d20";
import { requireCombatant, type RulesRuntimeState } from "./combatState";
import { FIGHTER_CHAMPION_SUBCLASS_ID } from "./fighterChampion";
import { HEROIC_INSPIRATION_RESOURCE_ID } from "./heroicInspiration";
import { resolveInitiativeRoll, type InitiativeController } from "./initiative";
import { resolveDeathSavingThrow, type DeathSaveResolution, type LifeState } from "./life";
import {
  DomainEvaluationError,
  type RollStateContribution,
  type RulesProfileLike,
} from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { ResolutionCommit, ResolutionOperation } from "./resolutionTypes";

export const FIGHTER_CHAMPION_REMARKABLE_ATHLETE_SOURCE = "feature:fighter.champion.remarkable-athlete";
export const FIGHTER_CHAMPION_HEROIC_WARRIOR_SOURCE = "feature:fighter.champion.heroic-warrior";
export const FIGHTER_CHAMPION_SURVIVOR_SOURCE = "feature:fighter.champion.survivor";
export const FIGHTER_CHAMPION_HEROIC_RALLY_SOURCE = "feature:fighter.champion.survivor.heroic-rally";
export const FIGHTER_CHAMPION_DEFY_DEATH_SOURCE = "feature:fighter.champion.survivor.defy-death";

function validateChampion(args:{ fighterLevel:number; subclassId?:string; minimumLevel:number; feature:string }) {
  if (!Number.isInteger(args.fighterLevel) || args.fighterLevel < 0 || args.fighterLevel > 20) {
    throw new DomainEvaluationError("Fighter level must be an integer from 0 to 20");
  }
  if (args.subclassId !== FIGHTER_CHAMPION_SUBCLASS_ID) {
    throw new DomainEvaluationError(`${args.feature} requires the Champion subclass`);
  }
  if (args.fighterLevel < args.minimumLevel) {
    throw new DomainEvaluationError(`${args.feature} requires Fighter level ${args.minimumLevel}`);
  }
}

export function championRemarkableAthleteAdvantage(args:{
  fighterLevel:number;
  subclassId?:string;
  test:"initiative"|"athletics";
}):RollStateContribution {
  validateChampion({ ...args, minimumLevel:3, feature:"Remarkable Athlete" });
  return {
    source:`${FIGHTER_CHAMPION_REMARKABLE_ATHLETE_SOURCE}:${args.test}`,
    state:"advantage",
  };
}

export function resolveChampionInitiativeRoll(profile:RulesProfileLike,args:{
  fighterLevel:number;
  subclassId?:string;
  id:string;
  controller:InitiativeController;
  dice:FixedDiceInput;
  modifierContributions:ModifierContribution[];
}) {
  return resolveInitiativeRoll(profile,{
    id:args.id,
    controller:args.controller,
    dice:args.dice,
    modifierContributions:args.modifierContributions,
    rollStateContributions:[championRemarkableAthleteAdvantage({
      fighterLevel:args.fighterLevel,
      subclassId:args.subclassId,
      test:"initiative",
    })],
  });
}

export function resolveChampionDeathSave(profile:RulesProfileLike,args:{
  fighterLevel:number;
  subclassId?:string;
  life:LifeState;
  dice:FixedDiceInput;
  modifierContributions?:ModifierContribution[];
  rollStateContributions?:RollStateContribution[];
}):DeathSaveResolution {
  validateChampion({ ...args, minimumLevel:18, feature:"Survivor" });
  return resolveDeathSavingThrow(profile,{
    life:args.life,
    dice:args.dice,
    modifierContributions:args.modifierContributions,
    rollStateContributions:[
      ...(args.rollStateContributions ?? []),
      { source:FIGHTER_CHAMPION_DEFY_DEATH_SOURCE, state:"advantage" },
    ],
    natural20Minimum:18,
    natural20MinimumSource:FIGHTER_CHAMPION_DEFY_DEATH_SOURCE,
  });
}

export interface ChampionTurnStartRequest {
  id:string;
  actorId:string;
  expectedRevision:number;
  fighterLevel:number;
  subclassId?:string;
  round:number;
  constitutionModifier:number;
  claimHeroicInspiration?:boolean;
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

export function resolveChampionTurnStart(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:ChampionTurnStartRequest,
):ResolutionCommit {
  try {
    validateChampion({
      fighterLevel:request.fighterLevel,
      subclassId:request.subclassId,
      minimumLevel:10,
      feature:"Champion turn-start features",
    });
    if (!Number.isInteger(request.round) || request.round < 0) {
      throw new DomainEvaluationError("round must be a non-negative integer");
    }
    if (!Number.isFinite(request.constitutionModifier)) {
      throw new DomainEvaluationError("Constitution modifier must be finite");
    }
    const actor = requireCombatant(inputState,request.actorId);
    const operations:ResolutionOperation[] = [{
      id:`${request.id}:begin-turn`,
      kind:"begin-turn",
      actorId:request.actorId,
      round:request.round,
    }];

    if (request.claimHeroicInspiration === true) {
      const existing = actor.resources.find((pool) => pool.id === HEROIC_INSPIRATION_RESOURCE_ID);
      if (!existing) {
        operations.push({
          id:`${request.id}:heroic-inspiration`,
          kind:"gain-resource",
          actorId:request.actorId,
          resourceId:HEROIC_INSPIRATION_RESOURCE_ID,
          amount:1,
          maximumDelta:1,
          createIfMissing:{ label:"Heroic Inspiration" },
        });
      } else if (existing.current === 0) {
        if (existing.maximum !== 1) throw new DomainEvaluationError("Heroic Inspiration resource maximum must be 1");
        operations.push({
          id:`${request.id}:heroic-inspiration`,
          kind:"gain-resource",
          actorId:request.actorId,
          resourceId:HEROIC_INSPIRATION_RESOURCE_ID,
          amount:1,
        });
      }
    }

    if (request.fighterLevel >= 18 && actor.life.hp.current >= 1 && actor.life.hp.current * 2 <= actor.life.hp.maximum) {
      const amount = Math.max(0,5 + request.constitutionModifier);
      if (amount > 0) {
        operations.push({
          id:`${request.id}:heroic-rally`,
          kind:"healing",
          targetId:request.actorId,
          amount,
        });
      }
    }

    return resolvePendingResolution(profile,inputState,{
      id:request.id,
      actorId:request.actorId,
      sourceId:FIGHTER_CHAMPION_SURVIVOR_SOURCE,
      expectedRevision:request.expectedRevision,
      operations,
    });
  } catch (error) {
    return rejected(inputState,error);
  }
}
