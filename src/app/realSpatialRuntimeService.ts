import "./spatialRuntimeContracts";
import type { SceneVm } from "./contracts";
import { setSpatialRelation, spatialPairKey, type SpatialRelationVm } from "./spatialRuntimeContracts";

const REFERENCE_RELATIONS:Array<Omit<SpatialRelationVm,"provenance">> = [
  { sourceId:"char.aelar", targetId:"combatant.goblin-a", distanceFeet:22, visible:true, cover:"none", targetCanSeeAttacker:true },
  { sourceId:"char.aelar", targetId:"combatant.goblin-b", distanceFeet:35, visible:true, cover:"none", targetCanSeeAttacker:true },
  { sourceId:"char.aelar", targetId:"combatant.wolf", distanceFeet:18, visible:true, cover:"none", targetCanSeeAttacker:true },
  { sourceId:"char.aelar", targetId:"combatant.training-guardian", distanceFeet:20, visible:true, cover:"none", targetCanSeeAttacker:true },
];

function addSymmetricReference(scene:SceneVm,relation:Omit<SpatialRelationVm,"provenance">) {
  const provenance=`runtime:spatial:${scene.id}:reference-fixture`;
  const forward={ ...relation, provenance };
  const reverse={
    sourceId:relation.targetId,
    targetId:relation.sourceId,
    distanceFeet:relation.distanceFeet,
    visible:relation.visible,
    cover:relation.cover,
    targetCanSeeAttacker:relation.targetCanSeeAttacker,
    provenance,
  };
  if (!scene.spatialByPair?.[spatialPairKey(forward.sourceId,forward.targetId)]) setSpatialRelation(scene,forward);
  if (!scene.spatialByPair?.[spatialPairKey(reverse.sourceId,reverse.targetId)]) setSpatialRelation(scene,reverse);
}

export function ensureReferenceSpatialRuntime(scene:SceneVm) {
  scene.spatialByPair ??={};
  if (scene.id!=="scene.ruined-gate") return scene.spatialByPair;
  for (const relation of REFERENCE_RELATIONS) addSymmetricReference(scene,relation);
  return scene.spatialByPair;
}

export function runtimeSpatialRelation(scene:SceneVm,sourceId:string,targetId:string):SpatialRelationVm {
  ensureReferenceSpatialRuntime(scene);
  const relation=scene.spatialByPair?.[spatialPairKey(sourceId,targetId)];
  if (!relation) throw new Error(`missing pairwise spatial runtime fact: ${sourceId} -> ${targetId}`);
  return { ...relation };
}
