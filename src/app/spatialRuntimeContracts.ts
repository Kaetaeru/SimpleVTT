import type { SceneVm } from "./contracts";

export type RuntimeCover = "none"|"half"|"three-quarters"|"total";

export interface SpatialRelationVm {
  sourceId:string;
  targetId:string;
  distanceFeet:number;
  visible:boolean;
  cover:RuntimeCover;
  targetCanSeeAttacker:boolean;
  provenance:string;
}

declare module "./contracts" {
  interface SceneVm {
    spatialByPair?:Record<string,SpatialRelationVm>;
  }
}

export function spatialPairKey(sourceId:string,targetId:string) {
  return `${sourceId}=>${targetId}`;
}

export function setSpatialRelation(scene:SceneVm,relation:SpatialRelationVm) {
  if (!Number.isFinite(relation.distanceFeet) || relation.distanceFeet<0) throw new Error("spatial relation distanceFeet must be non-negative");
  scene.spatialByPair ??={};
  scene.spatialByPair[spatialPairKey(relation.sourceId,relation.targetId)]={ ...relation };
}
