import type { ActionVm, AppSnapshot } from "./contracts";
import type { RuntimeCover } from "./spatialRuntimeContracts";

export type ManualMovementReactionKind = "opportunity-attack" | "other-reaction-attack";

export interface ManualMovementReactionCommand {
  kind:ManualMovementReactionKind;
  provokerId:string;
  reactorId:string;
  attackActionId:string;
  distanceFeet:number;
  visibleAtTrigger:boolean;
  coverAtTrigger:RuntimeCover;
  targetCanSeeReactorAtTrigger:boolean;
  triggerLabel?:string;
}

export function isOpportunityAttackAction(action:ActionVm) {
  return action.resolutionKind==="attack"
    && !action.itemCost
    && !action.resourceCost
    && Boolean(action.runtimeAttack)
    && action.runtimeAttack!.rangeFeet<=10;
}

export function opportunityAttackCommand(provokerId:string,reactorId:string,action:ActionVm):ManualMovementReactionCommand {
  if (!isOpportunityAttackAction(action)) throw new Error("기회공격에는 도달거리 10피트 이하의 근접 공격이 필요합니다.");
  return {
    kind:"opportunity-attack",
    provokerId,
    reactorId,
    attackActionId:action.id,
    distanceFeet:action.runtimeAttack!.rangeFeet,
    visibleAtTrigger:true,
    coverAtTrigger:"none",
    targetCanSeeReactorAtTrigger:true,
  };
}

declare module "./contracts" {
  interface SimpleVttAdapter {
    declareManualMovementReaction(command:ManualMovementReactionCommand):Promise<AppSnapshot>;
  }
}

declare module "./mockAdapter" {
  interface MockAdapter {
    declareManualMovementReaction(command:ManualMovementReactionCommand):Promise<AppSnapshot>;
  }
}
