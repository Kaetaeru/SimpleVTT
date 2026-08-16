import type { CharacterSheet, CharacterSummary, SceneVm } from "./contracts";
import type { MockAdapter } from "./mockAdapter";
import type { CharacterSessionProjectionReconstruction } from "./characterSessionProjectionReconstruction";
import {
  mountCharacterSessionProjection,
  projectedCharacterById,
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
  app.scene.actionsByActor={...app.scene.actionsByActor,[characterId]:structuredClone(reconstruction.actions)};
  app.scene.economyByActor={...app.scene.economyByActor,[characterId]:structuredClone(reconstruction.economy)};
  return {status:"accepted" as const,characterId};
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
  app.scene.entities=app.scene.entities.filter((entity)=>!projected.has(entity.id));
  const actions={...app.scene.actionsByActor};
  const economy={...app.scene.economyByActor};
  for (const characterId of characterIds) {
    delete actions[characterId];
    delete economy[characterId];
    const mounted=projectedCharacterById(adapter,characterId);
    if (mounted && app.activeCharacter.id===characterId) {
      const durable=app.characters.find((candidate)=>candidate.id!==characterId && "abilities" in candidate) as CharacterSheet|undefined;
      if (durable) app.activeCharacter=structuredClone(durable);
    }
  }
  app.scene.actionsByActor=actions;
  app.scene.economyByActor=economy;
  if (projected.has(app.scene.currentActorId)) app.scene.currentActorId=app.activeCharacter.id;
  if (projected.has(app.scene.selectedActorId)) app.scene.selectedActorId=app.scene.currentActorId;
  unmountAllCharacterSessionProjections(adapter);
  return characterIds.length;
}
