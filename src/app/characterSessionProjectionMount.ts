import type { CharacterSheet, CharacterSummary, SceneVm } from "./contracts";
import type { MockAdapter } from "./mockAdapter";
import type { CharacterSessionProjectionReconstruction } from "./characterSessionProjectionReconstruction";
import type { CharacterSessionProjectionV1 } from "./characterSessionProjection";
import { deriveCharacterSkillActions } from "./characterSkillActionProjection";
import {
  mountCharacterSessionProjection,
  projectedCharacterForPeer,
  projectedCharacterIds,
  unmountAllCharacterSessionProjections,
  unmountCharacterSessionProjectionForPeer,
} from "./characterSessionProjectionRegistry";

type ProjectionMountAdapterState = {
  activeCharacter:CharacterSheet;
  characters:CharacterSummary[];
  scene:SceneVm;
};

export interface ProjectionResolutionContext {
  previousActiveCharacter:CharacterSheet;
  previousSelectedActorId:string;
  previousActionActorOrder:string[];
}

function internal(adapter:MockAdapter) {
  return adapter as unknown as ProjectionMountAdapterState;
}

function reorderActionsByActor(actions:SceneVm["actionsByActor"],preferredOrder:string[]) {
  const next:SceneVm["actionsByActor"]={};
  for (const actorId of preferredOrder) {
    if (actions[actorId]) next[actorId]=actions[actorId];
  }
  for (const [actorId,actorActions] of Object.entries(actions)) {
    if (!next[actorId]) next[actorId]=actorActions;
  }
  return next;
}

function projectedActions(reconstruction:Extract<CharacterSessionProjectionReconstruction,{status:"accepted"}>) {
  const actions=new Map(reconstruction.actions.map((action)=>[action.id,structuredClone(action)]));
  for (const action of deriveCharacterSkillActions(reconstruction.sheet)) actions.set(action.id,structuredClone(action));
  return [...actions.values()];
}

function canonical(value:unknown):unknown {
  if(Array.isArray(value)) return value.map(canonical);
  if(value&&typeof value==="object") {
    return Object.fromEntries(Object.entries(value as Record<string,unknown>)
      .sort(([left],[right])=>left.localeCompare(right))
      .map(([key,item])=>[key,canonical(item)]));
  }
  return value;
}

function sourceFingerprint(value:unknown) {
  return JSON.stringify(canonical(value));
}

function fullSourceFingerprint(projection:CharacterSessionProjectionV1) {
  return sourceFingerprint({
    rulesProfile:projection.rulesProfile,
    source:projection.source,
    sourceAuthority:projection.sourceAuthority,
    contentIdentities:projection.contentIdentities,
  });
}

function nonInventorySourceFingerprint(projection:CharacterSessionProjectionV1) {
  const {itemReferences:_,...source}=projection.source;
  return sourceFingerprint({
    rulesProfile:projection.rulesProfile,
    source,
    sourceAuthority:projection.sourceAuthority,
    contentIdentities:projection.contentIdentities.filter((identity)=>identity.category!=="item"),
  });
}

export function mountReconstructedCharacterSessionProjection(
  adapter:MockAdapter,
  peerId:string,
  reconstruction:CharacterSessionProjectionReconstruction,
) {
  if (reconstruction.status==="rejected") return reconstruction;
  const app=internal(adapter);
  const characterId=reconstruction.sheet.id;
  const durableCollision=app.characters.some((character)=>character.id===characterId);
  const sceneCollision=app.scene.entities.some((entity)=>entity.id===characterId);
  const priorPeerProjection=projectedCharacterForPeer(adapter,peerId);
  if (durableCollision && !priorPeerProjection) {
    return {status:"rejected" as const,error:`projected Character collides with host permanent Character: ${characterId}`};
  }
  if (sceneCollision && !priorPeerProjection && !durableCollision) {
    return {status:"rejected" as const,error:`projected Character collides with existing host Scene entity: ${characterId}`};
  }

  if (priorPeerProjection && priorPeerProjection.characterId!==characterId) {
    unmountReconstructedCharacterSessionProjection(adapter,peerId);
  }

  mountCharacterSessionProjection(adapter,{
    peerId,
    characterId,
    sourceRevision:reconstruction.projection.sourceRevision,
    runtimeRevision:reconstruction.projection.runtimeRevision,
    projection:structuredClone(reconstruction.projection),
    sheet:structuredClone(reconstruction.sheet),
  });
  app.scene.entities=[...app.scene.entities.filter((entity)=>entity.id!==characterId),structuredClone(reconstruction.entity)];
  app.scene.actionsByActor={...app.scene.actionsByActor,[characterId]:projectedActions(reconstruction)};
  app.scene.economyByActor={...app.scene.economyByActor,[characterId]:structuredClone(reconstruction.economy)};
  return {status:"accepted" as const,characterId};
}

/**
 * Replaces the durable portion of an already-mounted remote Character after its
 * owning client has committed a new Character generation. Session-local turn
 * economy, initiative, status labels and distance facts remain Host-owned.
 *
 * A forward source revision is accepted only when the non-inventory Character
 * source is byte-for-byte unchanged. This lets an owning Client durably add or
 * remove ItemInstances while preventing an inventory acknowledgement from also
 * changing class/build/rules authority.
 */
export function refreshReconstructedCharacterSessionProjection(
  adapter:MockAdapter,
  peerId:string,
  reconstruction:CharacterSessionProjectionReconstruction,
) {
  if (reconstruction.status==="rejected") return reconstruction;
  const app=internal(adapter);
  const mounted=projectedCharacterForPeer(adapter,peerId);
  if(!mounted) return {status:"rejected" as const,error:`peer has no mounted Character SessionProjection: ${peerId}`};
  if(mounted.characterId!==reconstruction.sheet.id){
    return {status:"rejected" as const,error:`projected Character identity changed during durable refresh: ${mounted.characterId} != ${reconstruction.sheet.id}`};
  }
  if(reconstruction.projection.sourceRevision<mounted.sourceRevision){
    return {status:"rejected" as const,error:`projected Character source revision moved backwards: ${mounted.sourceRevision} -> ${reconstruction.projection.sourceRevision}`};
  }
  if(reconstruction.projection.sourceRevision===mounted.sourceRevision){
    if(fullSourceFingerprint(reconstruction.projection)!==fullSourceFingerprint(mounted.projection)){
      return {status:"rejected" as const,error:`projected Character source changed without a source revision: ${mounted.characterId}`};
    }
  }else if(nonInventorySourceFingerprint(reconstruction.projection)!==nonInventorySourceFingerprint(mounted.projection)){
    return {status:"rejected" as const,error:`projected Character non-inventory source changed during inventory-capable durable refresh: ${mounted.characterId}`};
  }
  if(reconstruction.projection.runtimeRevision<mounted.runtimeRevision){
    return {status:"rejected" as const,error:`projected Character runtime revision moved backwards: ${mounted.runtimeRevision} -> ${reconstruction.projection.runtimeRevision}`};
  }

  const currentEntity=app.scene.entities.find((entity)=>entity.id===mounted.characterId);
  if(!currentEntity) return {status:"rejected" as const,error:`projected Character Scene entity is missing: ${mounted.characterId}`};

  mountCharacterSessionProjection(adapter,{
    peerId,
    characterId:mounted.characterId,
    sourceRevision:reconstruction.projection.sourceRevision,
    runtimeRevision:reconstruction.projection.runtimeRevision,
    projection:structuredClone(reconstruction.projection),
    sheet:structuredClone(reconstruction.sheet),
  });

  const durableEntity=structuredClone(reconstruction.entity);
  const refreshed={
    ...durableEntity,
    initiative:currentEntity.initiative,
    status:[...currentEntity.status],
    distance:currentEntity.distance,
  };
  app.scene.entities=app.scene.entities.map((entity)=>entity.id===mounted.characterId?refreshed:entity);
  app.scene.actionsByActor={...app.scene.actionsByActor,[mounted.characterId]:projectedActions(reconstruction)};
  if(!app.scene.economyByActor[mounted.characterId]){
    app.scene.economyByActor={...app.scene.economyByActor,[mounted.characterId]:structuredClone(reconstruction.economy)};
  }
  return {status:"accepted" as const,characterId:mounted.characterId};
}

export function activateProjectedCharacterResolutionContext(
  adapter:MockAdapter,
  peerId:string,
):{status:"accepted";context:ProjectionResolutionContext}|{status:"rejected";error:string} {
  const mounted=projectedCharacterForPeer(adapter,peerId);
  if (!mounted) return {status:"rejected",error:`peer has no mounted Character SessionProjection: ${peerId}`};
  const app=internal(adapter);
  const previousActionActorOrder=Object.keys(app.scene.actionsByActor);
  const context:ProjectionResolutionContext={
    previousActiveCharacter:structuredClone(app.activeCharacter),
    previousSelectedActorId:app.scene.selectedActorId,
    previousActionActorOrder,
  };
  app.activeCharacter=structuredClone(mounted.sheet);
  app.scene.selectedActorId=mounted.characterId;
  app.scene.actionsByActor=reorderActionsByActor(app.scene.actionsByActor,[
    mounted.characterId,
    ...previousActionActorOrder.filter((actorId)=>actorId!==mounted.characterId),
  ]);
  return {status:"accepted",context};
}

export function restoreProjectionResolutionContext(adapter:MockAdapter,context:ProjectionResolutionContext) {
  const app=internal(adapter);
  app.activeCharacter=structuredClone(context.previousActiveCharacter);
  app.scene.selectedActorId=context.previousSelectedActorId;
  app.scene.actionsByActor=reorderActionsByActor(app.scene.actionsByActor,context.previousActionActorOrder);
}

export function unmountReconstructedCharacterSessionProjection(adapter:MockAdapter,peerId:string) {
  const app=internal(adapter);
  const mounted=projectedCharacterForPeer(adapter,peerId);
  if (!mounted) return false;
  const characterId=mounted.characterId;
  if (app.activeCharacter.id===characterId) {
    throw new Error(`cannot unmount active projected Character before restoring its resolution context: ${characterId}`);
  }
  app.scene.entities=app.scene.entities.filter((entity)=>entity.id!==characterId);
  const actions={...app.scene.actionsByActor};
  delete actions[characterId];
  app.scene.actionsByActor=actions;
  const economy={...app.scene.economyByActor};
  delete economy[characterId];
  app.scene.economyByActor=economy;
  if (app.scene.currentActorId===characterId) app.scene.currentActorId=app.activeCharacter.id;
  if (app.scene.selectedActorId===characterId) app.scene.selectedActorId=app.scene.currentActorId;
  unmountCharacterSessionProjectionForPeer(adapter,peerId);
  return true;
}

export function unmountAllReconstructedCharacterSessionProjections(adapter:MockAdapter) {
  const app=internal(adapter);
  const characterIds=projectedCharacterIds(adapter);
  if (!characterIds.length) return 0;
  const projected=new Set(characterIds);
  if (projected.has(app.activeCharacter.id)) {
    throw new Error(`cannot clear SessionProjections while projected resolution context is active: ${app.activeCharacter.id}`);
  }
  app.scene.entities=app.scene.entities.filter((entity)=>!projected.has(entity.id));
  const actions={...app.scene.actionsByActor};
  const economy={...app.scene.economyByActor};
  for (const characterId of characterIds) {
    delete actions[characterId];
    delete economy[characterId];
  }
  app.scene.actionsByActor=actions;
  app.scene.economyByActor=economy;
  if (projected.has(app.scene.currentActorId)) app.scene.currentActorId=app.activeCharacter.id;
  if (projected.has(app.scene.selectedActorId)) app.scene.selectedActorId=app.scene.currentActorId;
  unmountAllCharacterSessionProjections(adapter);
  return characterIds.length;
}
