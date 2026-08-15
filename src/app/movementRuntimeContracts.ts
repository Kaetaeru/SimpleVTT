import type { AppSnapshot } from "./contracts";
import type { RuntimeCover } from "./spatialRuntimeContracts";

/**
 * Core policy: SimpleVTT does not provide or own a movement/map system.
 * A 2D grid, 3D scene, theater-of-the-mind aid, or other external module
 * calculates positions/pathing/spatial facts and may submit the resulting
 * authoritative movement facts through the movement-module host hook.
 */
export type MovementModuleKind = "2d-grid" | "3d-scene" | "custom";

export interface MovementModuleDescriptor {
  id:string;
  kind:MovementModuleKind;
  label:string;
  version?:string;
}

export interface MovementSpatialUpdate {
  sourceId:string;
  targetId:string;
  distanceFeet:number;
  visible:boolean;
  cover:RuntimeCover;
  targetCanSeeAttacker:boolean;
}

/**
 * This command is intentionally module-facing and is not part of
 * SimpleVttAdapter. Core never originates one on its own.
 */
export interface MovementModuleCommand {
  moduleId:string;
  actorId:string;
  distanceFeet:number;
  spatialUpdates:MovementSpatialUpdate[];
  destinationMovesCloserToVisibleFrighteningSource?:boolean;
  visibleSourceIds?:string[];
}

export interface MovementModuleHost {
  apply(command:MovementModuleCommand):Promise<AppSnapshot>;
}
