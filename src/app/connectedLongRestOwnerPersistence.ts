import type { CharacterSheet } from "./contracts";
import type { CharacterLibraryDocumentV1, CharacterLibraryStore } from "./persistenceContracts";
import { prepareCharacterLibraryGeneration } from "./characterCampaignCompoundPersistence";
import { projectCharacterLongRest, type CharacterLongRestProjection } from "./characterLongRestProjection";
import type { ConnectedLongRestCommitPreflight } from "./connectedLongRestPreflight";
import type { ConnectedLongRestOwnerPrepared } from "./connectedLongRestTransactionState";
import type {
  ConnectedLongRestOwnerPreparationStore,
  ConnectedLongRestOwnerPreparationResult,
} from "./connectedLongRestOwnerPreparationStore";

export interface ConnectedLongRestOwnerPreparedCandidate {
  prepared:ConnectedLongRestOwnerPrepared;
  preparation:ConnectedLongRestOwnerPreparationResult;
  candidate:CharacterLongRestProjection;
}

function assertCurrentCharacter(preflight:ConnectedLongRestCommitPreflight,current:CharacterSheet) {
  if(current.id!==preflight.character.characterId) throw new Error("connected Long Rest active Character identity changed");
  if((current.sourceRevision??0)!==preflight.character.sourceRevision) throw new Error("connected Long Rest Character source revision is stale");
  if((current.runtimeRevision??0)!==preflight.character.runtimeRevision) throw new Error("connected Long Rest Character runtime revision is stale");
}

/**
 * Owner-side durable preparation. The canonical Rest candidate is encoded into
 * the next immutable Character-library generation, but the preparation store
 * keeps that generation invisible until the Host announces global commit.
 */
export async function prepareConnectedLongRestOwnerCandidate(input:{
  preflight:ConnectedLongRestCommitPreflight;
  currentDocument:CharacterLibraryDocumentV1;
  currentCharacter:CharacterSheet;
  characterStore:CharacterLibraryStore;
  preparationStore:ConnectedLongRestOwnerPreparationStore;
}):Promise<ConnectedLongRestOwnerPreparedCandidate> {
  assertCurrentCharacter(input.preflight,input.currentCharacter);
  const candidate=projectCharacterLongRest(input.currentCharacter);
  const write=await prepareCharacterLibraryGeneration(
    input.currentDocument,
    input.characterStore,
    [candidate.sheet],
    input.currentDocument.activeCharacterId,
  );
  const preparationId=`${input.preflight.transactionId}:character:${write.nextGeneration}`;
  const preparation=await input.preparationStore.prepare({
    transactionId:input.preflight.transactionId,
    preparationId,
    write,
  });
  if(preparation.phase==="aborted") throw new Error("connected Long Rest Character preparation was already aborted");
  return {
    prepared:{
      transactionId:input.preflight.transactionId,
      ownerParticipantId:input.preflight.ownerParticipantId,
      character:structuredClone(input.preflight.character),
      preparationId,
    },
    preparation,
    candidate,
  };
}

export function materializeConnectedLongRestOwnerCandidate(
  preparationStore:ConnectedLongRestOwnerPreparationStore,
  prepared:ConnectedLongRestOwnerPrepared,
) {
  return preparationStore.materialize({
    transactionId:prepared.transactionId,
    preparationId:prepared.preparationId,
  });
}

export function abortConnectedLongRestOwnerCandidate(
  preparationStore:ConnectedLongRestOwnerPreparationStore,
  prepared:ConnectedLongRestOwnerPrepared,
) {
  return preparationStore.abort({
    transactionId:prepared.transactionId,
    preparationId:prepared.preparationId,
  });
}
