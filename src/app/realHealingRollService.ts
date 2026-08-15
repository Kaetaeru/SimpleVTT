import type { ActionVm, ResolutionView } from "./contracts";
import type { Phase09HealingFact } from "./phase09ReferenceRulesFacts";
import { resolveFixedDiceFormula } from "../domain/diceFormula";

export interface HealingRollResolutionRequest {
  resolutionId:string;
  action:ActionVm;
  targetIds:string[];
  healingFact:Phase09HealingFact;
}

export function resolveHealingRollResolution(request:HealingRollResolutionRequest):ResolutionView {
  if (request.action.resolutionKind !== "healing" || !request.action.healing) {
    throw new Error(`healing roll service requires healing action: ${request.action.id}`);
  }
  const roll = resolveFixedDiceFormula({
    dice:request.healingFact.dice,
    flat:request.healingFact.flat,
  });
  return {
    id:request.resolutionId,
    actorId:request.action.actorId,
    targetIds:[...request.targetIds],
    actionId:request.action.id,
    actionName:request.action.name,
    rollKind:"healing",
    stage:"roll-animation",
    authoritativeDice:[...roll.selectedFaces],
    rollTotal:roll.total,
    saveResults:[],
    damageComponents:[],
    compact:`${roll.total} HP 회복`,
    detail:[`${request.action.healing.dice} + ${request.action.healing.flat} = ${roll.total}`],
    provenance:roll.provenance.map((entry) => `${entry.source} · ${entry.status} · ${entry.reason}`),
    calculatedOutcome:`${roll.total} HP 회복`,
    finalOutcome:`${roll.total} HP 회복`,
    stateChanges:[],
    adjudicated:false,
    canAdvance:true,
    nextLabel:"회복 Preview",
  };
}
