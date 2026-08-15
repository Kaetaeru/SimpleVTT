import type { ActionVm, ResolutionView } from "./contracts";
import { resolveOpenD20Roll } from "../domain/openD20";
import type { ModifierContribution } from "../domain/d20";
import type { RollStateContribution, RulesProfileLike } from "../domain/profileEngine";

export const SIMPLEVTT_APP_RULES_PROFILE:RulesProfileLike = {
  profileId:"dnd.srd-5.2.1",
  properties:{},
  d20Test:{ advantageDisadvantage:{ sameSideStacks:false, opposingCancel:true } },
};

export interface OpenAbilityCheckResolutionRequest {
  resolutionId:string;
  action:ActionVm;
  diceFaces:number[];
  modifierContributions:ModifierContribution[];
  rollStateContributions?:RollStateContribution[];
  checkLabel?:string;
}

function signedModifier(value:number) {
  return value >= 0 ? `+ ${value}` : `- ${Math.abs(value)}`;
}

export function resolveOpenAbilityCheckResolution(
  request:OpenAbilityCheckResolutionRequest,
):ResolutionView {
  if (request.action.resolutionKind !== "ability-check") {
    throw new Error(`open ability-check service requires ability-check action: ${request.action.id}`);
  }

  const roll = resolveOpenD20Roll(SIMPLEVTT_APP_RULES_PROFILE,{
    family:"ability-check",
    modifierContributions:request.modifierContributions,
    rollStateContributions:request.rollStateContributions,
    dice:{
      id:`${request.resolutionId}:d20`,
      purpose:request.action.name,
      sides:20,
      faces:request.diceFaces,
    },
  });
  const compact = `d20 ${roll.natural} ${signedModifier(roll.modifier)} = ${roll.total}`;

  return {
    id:request.resolutionId,
    actorId:request.action.actorId,
    targetIds:[],
    actionId:request.action.id,
    actionName:request.action.name,
    rollKind:"check",
    stage:"roll-animation",
    authoritativeDice:[...roll.dice.faces],
    rollTotal:roll.total,
    saveResults:[],
    damageComponents:[],
    compact,
    detail:[`${request.checkLabel ?? request.action.name} ${roll.total}`],
    provenance:roll.provenance.map((entry) => `${entry.source} · ${entry.status} · ${entry.reason}`),
    calculatedOutcome:`총합 ${roll.total}`,
    finalOutcome:`총합 ${roll.total}`,
    stateChanges:[],
    adjudicated:false,
    canAdvance:true,
    nextLabel:"결과 적용",
  };
}
