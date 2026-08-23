import type { MockAdapter } from "./mockAdapter";
import type { ConnectedLongRestGlobalCommit, ConnectedLongRestOwnerMaterialized } from "./connectedLongRestTransactionState";
import type { ConnectedLongRestWireMessage } from "./connectedLongRestWire";
import { TauriConnectedLongRestOwnerPreparationStore } from "./connectedLongRestOwnerPreparationStore";
import { createPlatformCharacterLibraryStore, isTauriCharacterLibraryRuntime } from "./tauriCharacterLibraryStore";
import { setCharacterLibraryStoreForTests } from "./characterLibraryRuntimeAdapter";
import { buildCharacterSessionProjectionV1 } from "./characterSessionProjection";

function requiredRecoveryIdentity(commit:ConnectedLongRestGlobalCommit) {
  if(!commit.ownerParticipantId||!commit.character||!commit.preparationId){
    throw new Error("connected Long Rest global commit is missing owner restart recovery identity");
  }
  return {
    ownerParticipantId:commit.ownerParticipantId,
    character:structuredClone(commit.character),
    preparationId:commit.preparationId,
  };
}

function requiredAbortRecoveryIdentity(abort:Extract<ConnectedLongRestWireMessage,{type:"long-rest-abort"}>) {
  if(!abort.ownerParticipantId||!abort.character||!abort.preparationId){
    throw new Error("connected Long Rest abort is missing owner restart recovery identity");
  }
  return {
    ownerParticipantId:abort.ownerParticipantId,
    character:structuredClone(abort.character),
    preparationId:abort.preparationId,
  };
}

/**
 * Process-restart path for the owning Player. The durable Character preparation
 * marker is the source of truth; no in-memory offer/decision record is required.
 * The global commit carries only the identity needed to locate and verify that
 * exact preparation. Materialization remains idempotent in the Rust store.
 */
export async function recoverRestartedConnectedLongRestOwnerAfterGlobalCommit(
  adapter:MockAdapter,
  commit:ConnectedLongRestGlobalCommit,
) {
  if(!isTauriCharacterLibraryRuntime()) throw new Error("connected Long Rest owner restart recovery requires durable Tauri persistence");
  const identity=requiredRecoveryIdentity(commit);
  const before=await adapter.getSnapshot();
  if(before.activeCharacter.id!==identity.character.characterId) throw new Error("connected Long Rest restart recovery Character identity does not match the active owner Character");
  if((before.activeCharacter.sourceRevision??0)!==identity.character.sourceRevision) throw new Error("connected Long Rest restart recovery Character source revision changed");
  if((before.activeCharacter.runtimeRevision??0)<identity.character.runtimeRevision) throw new Error("connected Long Rest restart recovery Character runtime revision is older than the prepared revision");
  if(commit.ownerParticipantId!==`client:${before.activeCharacter.id}`) throw new Error("connected Long Rest restart recovery owner identity does not match the active Character");

  const preparationStore=new TauriConnectedLongRestOwnerPreparationStore();
  await preparationStore.materialize({transactionId:commit.transactionId,preparationId:identity.preparationId});

  const characterStore=createPlatformCharacterLibraryStore();
  setCharacterLibraryStoreForTests(adapter,characterStore);
  const snapshot=await adapter.getSnapshot();
  if(snapshot.activeCharacter.id!==identity.character.characterId) throw new Error("connected Long Rest restart recovery rehydrated a different Character");
  if((snapshot.activeCharacter.runtimeRevision??0)<=identity.character.runtimeRevision) throw new Error("connected Long Rest restart recovery did not materialize a newer Character runtime revision");
  const projection=buildCharacterSessionProjectionV1(snapshot.activeCharacter,snapshot.catalog);
  const materialized:ConnectedLongRestOwnerMaterialized={
    transactionId:commit.transactionId,
    ownerParticipantId:identity.ownerParticipantId,
    character:identity.character,
    preparationId:identity.preparationId,
  };
  return {materialized,projection,snapshot};
}

/**
 * Pre-global restart path. The Host has durably proven that Campaign commit did
 * not happen, so a restarted owner may close only the exact staged Character
 * preparation. The Rust marker/sidecar is authoritative: an already-aborted
 * preparation stays idempotently abortable even if later legitimate Character
 * writes advanced the runtime revision after the first cleanup.
 */
export async function recoverRestartedConnectedLongRestOwnerAbort(
  adapter:MockAdapter,
  abort:Extract<ConnectedLongRestWireMessage,{type:"long-rest-abort"}>,
) {
  if(!isTauriCharacterLibraryRuntime()) throw new Error("connected Long Rest owner restart abort recovery requires durable Tauri persistence");
  const identity=requiredAbortRecoveryIdentity(abort);
  const before=await adapter.getSnapshot();
  if(before.activeCharacter.id!==identity.character.characterId) throw new Error("connected Long Rest abort recovery Character identity does not match the active owner Character");
  if((before.activeCharacter.sourceRevision??0)!==identity.character.sourceRevision) throw new Error("connected Long Rest abort recovery Character source revision changed");
  if(identity.ownerParticipantId!==`client:${before.activeCharacter.id}`) throw new Error("connected Long Rest abort recovery owner identity does not match the active Character");
  const beforeRuntimeRevision=before.activeCharacter.runtimeRevision??0;

  const preparationStore=new TauriConnectedLongRestOwnerPreparationStore();
  const result=await preparationStore.abort({transactionId:abort.transactionId,preparationId:identity.preparationId});
  if(result.phase!=="aborted") throw new Error(`connected Long Rest abort recovery did not close the preparation: ${result.phase}`);

  const snapshot=await adapter.getSnapshot();
  if(snapshot.activeCharacter.id!==identity.character.characterId) throw new Error("connected Long Rest abort recovery changed the active Character identity");
  if((snapshot.activeCharacter.runtimeRevision??0)!==beforeRuntimeRevision) throw new Error("connected Long Rest abort recovery exposed or changed a Character generation");
  return {result,snapshot};
}
