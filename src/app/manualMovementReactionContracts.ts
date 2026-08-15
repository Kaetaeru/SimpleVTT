import type { AppSnapshot } from "./contracts";
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
