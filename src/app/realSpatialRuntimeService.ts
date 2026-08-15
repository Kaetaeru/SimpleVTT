import "./spatialRuntimeContracts";
import type { SceneVm } from "./contracts";
import type { MovementSpatialUpdate } from "./movementRuntimeContracts";
import { setSpatialRelation, spatialPairKey, type SpatialRelationVm } from "./spatialRuntimeContracts";

const REFERENCE_RELATIONS:Array<Omit<SpatialRelationVm,"provenance">> = [
  { sourceId:"char.aelar", targetId:"combatant.goblin-a", distanceFeet:22, visible:true, cover:"none", targetCanSeeAttacker:true },
  { sourceId:"char.aelar", targetId:"combatant.goblin-b", distanceFeet:35, visible:true, cover:"none", targetCanSeeAttacker:true },
  { sourceId:"char.aelar", targetId:"combatant.wolf", distanceFeet:18, visible:true, cover:"none", targetCanSeeAttacker:true },
  { sourceId:"char.aelar", targetId:"combatant.training-guardian", distanceFeet:20, visible:true, cover:"none", targetCanSeeAttacker:true },
];

export interface MovementSpatialPlan {
  actorId:string;
  updates:SpatialRelationVm[];
  stateChanges:string[];
  provenance:string[];
}

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

export function prepareMovementSpatialUpdates(
  scene:SceneVm,
  actorId:string,
  updates:MovementSpatialUpdate[],
):MovementSpatialPlan {
  ensureReferenceSpatialRuntime(scene);
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
    throw new Error(`movement requires complete tracked spatial updates for ${actorId}; missing ${missing.join(", ")}`);
  }

  const provenance=`runtime:spatial:${scene.id}:movement:${actorId}`;
  const normalized=[...provided.values()].map((update)=>({ ...update,provenance }));
  return {
    actorId,
    updates:normalized,
    stateChanges:normalized.flatMap((update)=>relationChanges(scene.spatialByPair?.[spatialPairKey(update.sourceId,update.targetId)],update)),
    provenance:[provenance,`complete tracked spatial set ${tracked.length}/${tracked.length}`],
  };
}

export function applyMovementSpatialPlan(scene:SceneVm,plan:MovementSpatialPlan) {
  for (const update of plan.updates) setSpatialRelation(scene,update);
  return plan;
}
