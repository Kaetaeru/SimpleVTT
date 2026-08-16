import type { CharacterSheet } from "./contracts";
import type { MockAdapter } from "./mockAdapter";
import type { CharacterSessionProjectionV1 } from "./characterSessionProjection";

export interface MountedCharacterSessionProjection {
  peerId:string;
  characterId:string;
  sourceRevision:number;
  runtimeRevision:number;
  projection:CharacterSessionProjectionV1;
  sheet:CharacterSheet;
}

type RegistryState = {
  byCharacterId:Map<string,MountedCharacterSessionProjection>;
  byPeerId:Map<string,string>;
};

const registries=new WeakMap<MockAdapter,RegistryState>();

function stateFor(adapter:MockAdapter) {
  let state=registries.get(adapter);
  if (!state) {
    state={ byCharacterId:new Map(),byPeerId:new Map() };
    registries.set(adapter,state);
  }
  return state;
}

export function mountCharacterSessionProjection(
  adapter:MockAdapter,
  mounted:MountedCharacterSessionProjection,
) {
  const state=stateFor(adapter);
  const existingCharacter=state.byPeerId.get(mounted.peerId);
  if (existingCharacter && existingCharacter!==mounted.characterId) {
    state.byCharacterId.delete(existingCharacter);
  }
  const existing=state.byCharacterId.get(mounted.characterId);
  if (existing && existing.peerId!==mounted.peerId) {
    throw new Error(`projected Character is already owned by another peer: ${mounted.characterId}`);
  }
  state.byPeerId.set(mounted.peerId,mounted.characterId);
  state.byCharacterId.set(mounted.characterId,structuredClone(mounted));
}

export function rebindCharacterSessionProjectionPeer(adapter:MockAdapter,characterId:string,peerId:string) {
  const state=registries.get(adapter);
  const mounted=state?.byCharacterId.get(characterId);
  if (!state || !mounted) return undefined;
  state.byPeerId.delete(mounted.peerId);
  const rebound={...mounted,peerId};
  state.byCharacterId.set(characterId,structuredClone(rebound));
  state.byPeerId.set(peerId,characterId);
  return structuredClone(rebound);
}

export function unmountCharacterSessionProjectionForPeer(adapter:MockAdapter,peerId:string) {
  const state=registries.get(adapter);
  if (!state) return;
  const characterId=state.byPeerId.get(peerId);
  if (!characterId) return;
  state.byPeerId.delete(peerId);
  state.byCharacterId.delete(characterId);
}

export function unmountAllCharacterSessionProjections(adapter:MockAdapter) {
  registries.delete(adapter);
}

export function projectedCharacterForPeer(adapter:MockAdapter,peerId:string) {
  const state=registries.get(adapter);
  const characterId=state?.byPeerId.get(peerId);
  if (!state || !characterId) return undefined;
  const mounted=state.byCharacterId.get(characterId);
  return mounted ? structuredClone(mounted) : undefined;
}

export function projectedCharacterById(adapter:MockAdapter,characterId:string) {
  const mounted=registries.get(adapter)?.byCharacterId.get(characterId);
  return mounted ? structuredClone(mounted) : undefined;
}

export function isEphemeralSessionProjectionCharacter(adapter:MockAdapter,characterId:string) {
  return registries.get(adapter)?.byCharacterId.has(characterId) ?? false;
}

export function replaceProjectedCharacterSheet(adapter:MockAdapter,sheet:CharacterSheet) {
  const state=registries.get(adapter);
  const mounted=state?.byCharacterId.get(sheet.id);
  if (!state || !mounted) return false;
  state.byCharacterId.set(sheet.id,{
    ...mounted,
    runtimeRevision:sheet.runtimeRevision ?? mounted.runtimeRevision,
    sheet:structuredClone(sheet),
  });
  return true;
}

export function projectedCharacterIds(adapter:MockAdapter) {
  return [...(registries.get(adapter)?.byCharacterId.keys() ?? [])].sort();
}
