import type { AppSnapshot } from "./contracts";
import type { RuntimeCover } from "./spatialRuntimeContracts";

export interface MovementSpatialUpdate {
  sourceId:string;
  targetId:string;
  distanceFeet:number;
  visible:boolean;
  cover:RuntimeCover;
  targetCanSeeAttacker:boolean;
}

export interface MoveActorCommand {
  actorId:string;
  distanceFeet:number;
  spatialUpdates:MovementSpatialUpdate[];
  destinationMovesCloserToVisibleFrighteningSource?:boolean;
  visibleSourceIds?:string[];
}

declare module "./contracts" {
  interface SimpleVttAdapter {
    moveActor(command:MoveActorCommand):Promise<AppSnapshot>;
  }
}

declare module "./mockAdapter" {
  interface MockAdapter {
    moveActor(command:MoveActorCommand):Promise<AppSnapshot>;
  }
}
