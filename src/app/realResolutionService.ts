import dndSrdRulesProfile from "../../rules/profiles/dnd.srd-5.2.1.profile.json";
import type { ActionVm, ResolutionView } from "./contracts";
import { resolveD20Test, type ModifierContribution } from "../domain/d20";
import { resolveOpenD20Roll } from "../domain/openD20";
import type { RollStateContribution, RulesProfileLike } from "../domain/profileEngine";
import type { ResolutionEvent } from "../domain/resolutionTypes";

export const SIMPLEVTT_APP_RULES_PROFILE:RulesProfileLike = {
  profileId:"dnd.srd-5.2.1",
  properties:{},
  d20Test:{ advantageDisadvantage:{ sameSideStacks:false, opposingCancel:true } },
  economy:dndSrdRulesProfile.economy as RulesProfileLike["economy"],
};

export interface OpenAbilityCheckResolutionRequest {
  resolutionId:string;
  action:ActionVm;
  diceFaces:number[];
  modifierContributions:ModifierContribution[];
  rollStateContributions?:RollStateContribution[];
  checkLabel?:string;
}

export interface AttackRollResolutionTarget {
  id:string;
  name:string;
  ac:number;
}

export interface AttackRollResolutionRequest {
  resolutionId:string;
  action:ActionVm;
  target:AttackRollResolutionTarget;
  diceFaces:number[];
  modifierContributions:ModifierContribution[];
  rollStateContributions?:RollStateContribution[];
}

function signedModifier(value:number) {
  return value >= 0 ? `+ ${value}` : `- ${Math.abs(value)}`;
}

function provenanceLines(entries:Array<{ source:string; status:string; reason:string }>) {
  return entries.map((entry) => `${entry.source} · ${entry.status} · ${entry.reason}`);
}

function resolveOpenAbilityCheckRoll(request:OpenAbilityCheckResolutionRequest) {
  if (request.action.resolutionKind !== "ability-check") {
    throw new Error(`open ability-check service requires ability-check action: ${request.action.id}`);
  }
  return resolveOpenD20Roll(SIMPLEVTT_APP_RULES_PROFILE,{
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
}

export function resolveOpenAbilityCheckResolution(
  request:OpenAbilityCheckResolutionRequest,
):ResolutionView {
  const roll = resolveOpenAbilityCheckRoll(request);
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
    naturalD20:roll.natural,
    rollTotal:roll.total,
    saveResults:[],
    damageComponents:[],
    compact,
    detail:[`${request.checkLabel ?? request.action.name} ${roll.total}`],
    provenance:provenanceLines(roll.provenance),
    calculatedOutcome:`총합 ${roll.total}`,
    finalOutcome:`총합 ${roll.total}`,
    stateChanges:[],
    adjudicated:false,
    canAdvance:true,
    nextLabel:"결과 적용",
  };
}

export function resolveOpenAbilityCheckResolutionEvent(
  request:OpenAbilityCheckResolutionRequest,
):ResolutionEvent {
  const roll=resolveOpenAbilityCheckRoll(request);
  return {
    id:`${request.resolutionId}:event:d20`,
    resolutionId:request.resolutionId,
    operationId:`op.${request.action.id}.ability-check`,
    kind:"d20",
    actorId:request.action.actorId,
    summary:`${request.checkLabel ?? request.action.name} · d20 ${roll.natural} ${signedModifier(roll.modifier)} = ${roll.total}`,
    provenance:roll.provenance.map((entry)=>structuredClone(entry)),
    stateChanges:[],
    result:structuredClone(roll),
  };
}

export function resolveAttackRollResolution(
  request:AttackRollResolutionRequest,
):ResolutionView {
  if (request.action.resolutionKind !== "attack") {
    throw new Error(`attack-roll service requires attack action: ${request.action.id}`);
  }
  if (!Number.isFinite(request.target.ac) || request.target.ac < 0) {
    throw new Error(`attack-roll service requires a valid target AC: ${request.target.id}`);
  }

  const roll = resolveD20Test(SIMPLEVTT_APP_RULES_PROFILE,{
    family:"attack-roll",
    target:request.target.ac,
    targetSource:`target:${request.target.id}:ac`,
    modifierContributions:request.modifierContributions,
    rollStateContributions:request.rollStateContributions,
    dice:{
      id:`${request.resolutionId}:d20`,
      purpose:request.action.name,
      sides:20,
      faces:request.diceFaces,
    },
  });
  const outcome = roll.outcome === "success" ? "명중" : "빗나감";
  const compact = `${roll.total} vs AC ${request.target.ac} — ${outcome}`;
  const selectedIndex=roll.dice.selectedIndexes[0]??0;
  const authoritativeDice=[roll.natural,...roll.dice.faces.filter((_,index)=>index!==selectedIndex)];

  return {
    id:request.resolutionId,
    actorId:request.action.actorId,
    targetIds:[request.target.id],
    actionId:request.action.id,
    actionName:request.action.name,
    rollKind:"attack",
    stage:"roll-animation",
    // Attack transaction consumers use index 0 as the selected natural face.
    authoritativeDice,
    naturalD20:roll.natural,
    rollTotal:roll.total,
    attackTotal:roll.total,
    targetAc:request.target.ac,
    attackOutcome:outcome,
    critical:roll.critical,
    saveResults:[],
    damageComponents:[],
    compact,
    detail:[`d20 ${roll.natural} + 공격 보너스 ${roll.modifier} = ${roll.total}`],
    provenance:provenanceLines(roll.provenance),
    calculatedOutcome:outcome,
    finalOutcome:outcome,
    stateChanges:[],
    adjudicated:false,
    canAdvance:true,
    nextLabel:"명중 결과",
  };
}
