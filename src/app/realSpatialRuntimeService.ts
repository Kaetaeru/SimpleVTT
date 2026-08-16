import "./spatialRuntimeContracts";
import type { SceneVm } from "./contracts";
import type { MovementSpatialUpdate } from "./movementRuntimeContracts";
import { setSpatialRelation, spatialPairKey, type SpatialRelationVm } from "./spatialRuntimeContracts";

export interface MovementSpatialPlan {
  actorId:string;
  updates:SpatialRelationVm[];
  stateChanges:string[];
  provenance:string[];
}

function sceneDistanceFeet(distance:string) {
  const match=distance.match(/(\d+(?:\.\d+)?)/);
  if (!match) return undefined;
  const feet=Number(match[1]);
  return Number.isFinite(feet)&&feet>=0?feet:undefined;
}

function addSymmetricSceneRelation(scene:SceneVm,sourceId:string,targetId:string,distanceFeet:number) {
  const provenance=`runtime:spatial:${scene.id}:scene-distance-baseline`;
  const forward:SpatialRelationVm={
    sourceId,
    targetId,
    distanceFeet,
    visible:true,
    cover:"none",
    targetCanSeeAttacker:true,
    provenance,
  };
  const reverse:SpatialRelationVm={
    sourceId:targetId,
    targetId:sourceId,
    distanceFeet,
    visible:true,
    cover:"none",
    targetCanSeeAttacker:true,
    provenance,
  };
  if (!scene.spatialByPair?.[spatialPairKey(sourceId,targetId)]) setSpatialRelation(scene,forward);
  if (!scene.spatialByPair?.[spatialPairKey(targetId,sourceId)]) setSpatialRelation(scene,reverse);
}

/**
 * The built-in theater-of-mind scene already carries a distance label on each
 * combatant. Materialize that scene-owned state into the pairwise runtime
 * contract for every live Character actor instead of binding targeting facts to
 * reference Character/combatant ids. External movement/map modules can replace
 * these pairwise facts later without core calculating coordinates, paths, LOS,
 * or cover.
 */
export function ensureReferenceSpatialRuntime(scene:SceneVm) {
  scene.spatialByPair ??={};
  if (scene.id!=="scene.ruined-gate") return scene.spatialByPair;
  const actors=scene.entities.filter((entity)=>entity.kind==="character");
  const combatants=scene.entities.filter((entity)=>entity.kind==="combatant");
  for (const actor of actors) {
    for (const target of combatants) {
      const distanceFeet=sceneDistanceFeet(target.distance);
      if (distanceFeet===undefined) continue;
      addSymmetricSceneRelation(scene,actor.id,target.id,distanceFeet);
    }
  }
  return scene.spatialByPair;
}

export function runtimeSpatialRelation(scene:SceneVm,sourceId:string,targetId:string):SpatialRelationVm {
  ensureReferenceSpatialRuntime(scene);
  const relation=scene.spatialByPair?.[spatialPairKey(sourceId,targetId)];
  if (!relation) throw new Error(`missing pairwise spatial runtime fact: ${sourceId} -> ${targetId}`);
  return { ...relation };
}

function validateMovementUpdate(scene:SceneVm,actorId:string,update:MovementSpatialUpdate) {
  if (update.sourceId===update.targetId) throw new Error("spatial movement update source and target must differ");
  if (update.sourceId!==actorId&&update.targetId!==actorId) {
    throw new Error(`spatial movement update must involve moving actor ${actorId}: ${update.sourceId} -> ${update.targetId}`);
  }
  if (!scene.entities.some((entry)=>entry.id===update.sourceId)) throw new Error(`spatial movement source is missing: ${update.sourceId}`);
  if (!scene.entities.some((entry)=>entry.id===update.targetId)) throw new Error(`spatial movement target is missing: ${update.targetId}`);
  if (!Number.isFinite(update.distanceFeet)||update.distanceFeet<0) throw new Error("spatial movement distanceFeet must be non-negative");
}

function relationChanges(before:SpatialRelationVm|undefined,after:SpatialRelationVm) {
  const pair=`${after.sourceId}->${after.targetId}`;
  if (!before) return [`${pair} spatial relation materialized at ${after.distanceFeet}ft`];
  const changes:string[]=[];
  if (before.distanceFeet!==after.distanceFeet) changes.push(`${pair} distance ${before.distanceFeet} → ${after.distanceFeet}ft`);
  if (before.visible!==after.visible) changes.push(`${pair} visible ${before.visible} → ${after.visible}`);
  if (before.cover!==after.cover) changes.push(`${pair} cover ${before.cover} → ${after.cover}`);
  if (before.targetCanSeeAttacker!==after.targetCanSeeAttacker) changes.push(`${pair} target-sight ${before.targetCanSeeAttacker} → ${after.targetCanSeeAttacker}`);
  return changes;
}

/**
 * Validates a complete post-move spatial snapshot supplied by an external map
 * module. Core does not calculate coordinates, paths, LOS, or cover itself.
 */
export function prepareMovementSpatialUpdates(
  scene:SceneVm,
  actorId:string,
  updates:MovementSpatialUpdate[],
  moduleId:string,
):MovementSpatialPlan {
  ensureReferenceSpatialRuntime(scene);
  if (!moduleId.trim()) throw new Error("movement module id is required");
  if (!scene.entities.some((entry)=>entry.id===actorId)) throw new Error(`moving actor is missing from scene: ${actorId}`);
  const provided=new Map<string,MovementSpatialUpdate>();
  for (const update of updates) {
    validateMovementUpdate(scene,actorId,update);
    const key=spatialPairKey(update.sourceId,update.targetId);
    if (provided.has(key)) throw new Error(`duplicate spatial movement update: ${key}`);
    provided.set(key,update);
  }

  const tracked=Object.values(scene.spatialByPair ?? {}).filter((relation)=>relation.sourceId===actorId||relation.targetId===actorId);
  const missing=tracked
    .map((relation)=>spatialPairKey(relation.sourceId,relation.targetId))
    .filter((key)=>!provided.has(key));
  if (missing.length>0) {
    throw new Error(`movement module must provide complete tracked spatial updates for ${actorId}; missing ${missing.join(", ")}`);
  }

  const provenance=`module:${moduleId}:spatial:${scene.id}:${actorId}`;
  const normalized=[...provided.values()].map((update)=>({ ...update,provenance }));
  return {
    actorId,
    updates:normalized,
    stateChanges:normalized.flatMap((update)=>relationChanges(scene.spatialByPair?.[spatialPairKey(update.sourceId,update.targetId)],update)),
    provenance:[provenance,`external movement module supplied complete tracked spatial set ${tracked.length}/${tracked.length}`],
  };
}

export function applyMovementSpatialPlan(scene:SceneVm,plan:MovementSpatialPlan) {
  for (const update of plan.updates) setSpatialRelation(scene,update);
  return scene;
}
