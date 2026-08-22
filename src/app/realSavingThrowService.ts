import type { ActionVm, ResolutionView } from "./contracts";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { resolveD20Test } from "../domain/d20";
import type { RollStateContribution } from "../domain/profileEngine";

export interface SavingThrowResolutionTarget {
  id:string;
  name:string;
  modifier:number;
  modifierSource:string;
  rollStateContributions?:RollStateContribution[];
}

export interface SavingThrowResolutionRequest {
  resolutionId:string;
  action:ActionVm;
  targets:SavingThrowResolutionTarget[];
  diceFaces:number[];
  diceFacesByTarget?:Record<string,number[]>;
}

export function resolveSavingThrowResolution(request:SavingThrowResolutionRequest):ResolutionView {
  if (request.action.resolutionKind !== "saving-throw") {
    throw new Error(`saving-throw service requires saving-throw action: ${request.action.id}`);
  }
  const dc = request.action.saveDc;
  if (!Number.isFinite(dc)) throw new Error(`saving-throw service requires a finite DC: ${request.action.id}`);
  if (request.targets.length !== request.diceFaces.length) {
    throw new Error("saving-throw service requires one authoritative d20 face per target");
  }
  const ability = request.action.saveAbility ?? "내성";
  const results = request.targets.map((target,index) => {
    const faces=request.diceFacesByTarget?.[target.id]??[request.diceFaces[index]];
    const roll = resolveD20Test(SIMPLEVTT_APP_RULES_PROFILE,{
      family:"saving-throw",
      target:dc!,
      targetSource:`action:${request.action.id}:save-dc`,
      modifierContributions:[{ source:target.modifierSource, value:target.modifier }],
      rollStateContributions:target.rollStateContributions,
      dice:{
        id:`${request.resolutionId}:${target.id}:d20`,
        purpose:`${request.action.name} · ${target.name} ${ability} 내성`,
        sides:20,
        faces,
      },
    });
    return {
      target,
      roll,
      view:{
        targetId:target.id,
        targetName:target.name,
        d20:roll.natural,
        total:roll.total,
        dc:dc!,
        outcome:(roll.outcome === "success" ? "성공" : "실패") as "성공"|"실패",
      },
    };
  });
  const successes = results.filter((entry) => entry.view.outcome === "성공").length;
  const failures = results.length - successes;

  return {
    id:request.resolutionId,
    actorId:request.action.actorId,
    targetIds:request.targets.map((target) => target.id),
    actionId:request.action.id,
    actionName:request.action.name,
    rollKind:"save",
    stage:"save-animation",
    authoritativeDice:results.map((entry) => entry.roll.natural),
    saveResults:results.map((entry) => entry.view),
    damageComponents:[],
    compact:`${ability} 내성 DC ${dc} · ${successes} 성공 / ${failures} 실패`,
    detail:results.map((entry) => `${entry.target.name}: d20 ${entry.roll.natural} + ${entry.target.modifier} = ${entry.roll.total} vs DC ${dc} · ${entry.view.outcome}`),
    provenance:results.flatMap((entry) => entry.roll.provenance.map((provenance) => `${entry.target.name} · ${provenance.source} · ${provenance.status} · ${provenance.reason}`)),
    calculatedOutcome:"내성 결과",
    finalOutcome:"내성 결과",
    stateChanges:[],
    adjudicated:false,
    canAdvance:true,
    nextLabel:"내성 결과",
  };
}
