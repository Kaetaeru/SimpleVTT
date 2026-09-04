import type { CatalogEntry, CharacterSummary } from "./contracts";
import type { MockAdapter } from "./mockAdapter";
import type { SessionCompatibilityManifest } from "./connectedSessionProtocol";
import type { CharacterSessionProjectionV1 } from "./characterSessionProjection";
import { reconstructCharacterSessionProjectionV1 } from "./characterSessionProjectionReconstruction";
import { mountReconstructedCharacterSessionProjection } from "./characterSessionProjectionMount";
import {
  projectedCharacterById,
  rebindCharacterSessionProjectionPeer,
  refreshProjectedCharacterPortrait,
} from "./characterSessionProjectionRegistry";
import { refreshSessionCharacterInventoryProjection } from "./sessionInventoryProjectionPort";

export type HostCharacterProjectionHandshake =
  | {status:"accepted";mode:"host-known"|"mounted"|"rebound";characterId?:string}
  | {status:"rejected";error:string};

type ProjectionHandshakeAdapterState={
  characters:CharacterSummary[];
  catalog:CatalogEntry[];
};

function internal(adapter:MockAdapter) {
  return adapter as unknown as ProjectionHandshakeAdapterState;
}

function projectionMatchesManifest(manifest:SessionCompatibilityManifest,projection:CharacterSessionProjectionV1) {
  const character=manifest.character;
  if (!character) return "Character SessionProjection requires Character revision metadata in hello manifest";
  if (character.characterId!==projection.characterId) return `projection Character ID does not match hello manifest: ${projection.characterId} != ${character.characterId}`;
  if (character.sourceRevision!==projection.sourceRevision) return `projection source revision does not match hello manifest: ${projection.sourceRevision} != ${character.sourceRevision}`;
  if (character.runtimeRevision!==projection.runtimeRevision) return `projection runtime revision does not match hello manifest: ${projection.runtimeRevision} != ${character.runtimeRevision}`;
  if (manifest.rulesProfileId!==projection.rulesProfile.id) return `projection rules profile does not match hello manifest: ${projection.rulesProfile.id} != ${manifest.rulesProfileId}`;
  return undefined;
}

function sourceFingerprintValue(projection:CharacterSessionProjectionV1):unknown {
  return JSON.parse(JSON.stringify({
    sourceRevision:projection.sourceRevision,
    rulesProfile:projection.rulesProfile,
    source:projection.source,
    sourceAuthority:projection.sourceAuthority,
    contentIdentities:projection.contentIdentities,
  })) as unknown;
}

function sourceFingerprint(projection:CharacterSessionProjectionV1) {
  return JSON.stringify(sourceFingerprintValue(projection));
}

function firstMismatchPath(left:unknown,right:unknown,path=""):string|undefined {
  if (Object.is(left,right)) return undefined;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return path || "projection";
    if (left.length!==right.length) return `${path || "projection"}.length`;
    for (let index=0;index<left.length;index+=1) {
      const mismatch=firstMismatchPath(left[index],right[index],`${path}[${index}]`);
      if (mismatch) return mismatch;
    }
    return undefined;
  }
  if (left!==null && right!==null && typeof left==="object" && typeof right==="object") {
    const leftRecord=left as Record<string,unknown>;
    const rightRecord=right as Record<string,unknown>;
    const keys=[...new Set([...Object.keys(leftRecord),...Object.keys(rightRecord)])].sort((a,b)=>a.localeCompare(b,"en"));
    for (const key of keys) {
      const childPath=path ? `${path}.${key}` : key;
      if (!(key in leftRecord) || !(key in rightRecord)) return childPath;
      const mismatch=firstMismatchPath(leftRecord[key],rightRecord[key],childPath);
      if (mismatch) return mismatch;
    }
    return undefined;
  }
  return path || "projection";
}

function refreshHostInventoryProjection(
  adapter:MockAdapter,
  reconstruction:Extract<ReturnType<typeof reconstructCharacterSessionProjectionV1>,{status:"accepted"}>,
) {
  refreshSessionCharacterInventoryProjection(adapter,{
    characterId:reconstruction.sheet.id,
    characterName:reconstruction.sheet.name,
    revision:reconstruction.projection.runtimeRevision,
    goldGp:reconstruction.sheet.goldGp??0,
    items:structuredClone(reconstruction.sheet.items),
  });
}

export function acceptHostCharacterSessionProjection(
  adapter:MockAdapter,
  peerId:string,
  manifest:SessionCompatibilityManifest,
  projection?:CharacterSessionProjectionV1,
):HostCharacterProjectionHandshake {
  const character=manifest.character;
  if (!character) return {status:"accepted",mode:"host-known"};

  const app=internal(adapter);
  const existingProjection=projectedCharacterById(adapter,character.characterId);
  if (existingProjection) {
    if (!projection) return {status:"rejected",error:`reconnect for projected Character requires SessionProjection: ${character.characterId}`};
    const manifestError=projectionMatchesManifest(manifest,projection);
    if (manifestError) return {status:"rejected",error:manifestError};
    const reconstructed=reconstructCharacterSessionProjectionV1(projection,app.catalog);
    if (reconstructed.status==="rejected") return reconstructed;
    if (sourceFingerprint(reconstructed.projection)!==sourceFingerprint(existingProjection.projection)) {
      const mismatchPath=firstMismatchPath(
        sourceFingerprintValue(existingProjection.projection),
        sourceFingerprintValue(reconstructed.projection),
      ) ?? "projection";
      return {status:"rejected",error:`projected Character source/content changed during connected session: ${character.characterId} (${mismatchPath})`};
    }
    if (!rebindCharacterSessionProjectionPeer(adapter,character.characterId,peerId)) {
      return {status:"rejected",error:`failed to rebind projected Character peer: ${character.characterId}`};
    }
    refreshProjectedCharacterPortrait(adapter,character.characterId,reconstructed.projection.portrait);
    refreshHostInventoryProjection(adapter,reconstructed);
    return {status:"accepted",mode:"rebound",characterId:character.characterId};
  }

  if (app.characters.some((entry)=>entry.id===character.characterId)) {
    if (!projection) {
      return {status:"accepted",mode:"host-known",characterId:character.characterId};
    }
    const manifestError=projectionMatchesManifest(manifest,projection);
    if (manifestError) return {status:"rejected",error:manifestError};
    const reconstructed=reconstructCharacterSessionProjectionV1(projection,app.catalog);
    if (reconstructed.status==="rejected") return reconstructed;
    const mounted=mountReconstructedCharacterSessionProjection(adapter,peerId,reconstructed,{
      allowDurableCharacterIdCollision:true,
    });
    if (mounted.status==="rejected") return mounted;
    refreshHostInventoryProjection(adapter,reconstructed);
    return {status:"accepted",mode:"mounted",characterId:mounted.characterId};
  }

  if (!projection) {
    return {status:"rejected",error:`host does not know Character ${character.characterId}; a validated Character SessionProjection is required`};
  }
  const manifestError=projectionMatchesManifest(manifest,projection);
  if (manifestError) return {status:"rejected",error:manifestError};
  const reconstructed=reconstructCharacterSessionProjectionV1(projection,app.catalog);
  if (reconstructed.status==="rejected") return reconstructed;
  const mounted=mountReconstructedCharacterSessionProjection(adapter,peerId,reconstructed);
  if (mounted.status==="rejected") return mounted;
  refreshHostInventoryProjection(adapter,reconstructed);
  return {status:"accepted",mode:"mounted",characterId:mounted.characterId};
}
