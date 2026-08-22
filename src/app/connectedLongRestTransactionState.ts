import type {
  ConnectedLongRestCharacterRevision,
  ConnectedLongRestCommitPreflight,
} from "./connectedLongRestPreflight";

export type ConnectedLongRestTransactionState =
  | {phase:"approved";preflight:ConnectedLongRestCommitPreflight}
  | {phase:"owner-prepared";preflight:ConnectedLongRestCommitPreflight;preparationId:string}
  | {phase:"committed";preflight:ConnectedLongRestCommitPreflight;preparationId:string;campaignCommitId:string}
  | {phase:"complete";preflight:ConnectedLongRestCommitPreflight;preparationId:string;campaignCommitId:string}
  | {phase:"aborted";preflight:ConnectedLongRestCommitPreflight;reason:string};

export interface ConnectedLongRestOwnerPrepared {
  transactionId:string;
  ownerParticipantId:string;
  character:ConnectedLongRestCharacterRevision;
  preparationId:string;
}

export interface ConnectedLongRestGlobalCommit {
  transactionId:string;
  campaignCommitId:string;
  /** Present on production/recovery messages so a restarted owner can locate its durable preparation. */
  ownerParticipantId?:string;
  character?:ConnectedLongRestCharacterRevision;
  preparationId?:string;
}

export interface ConnectedLongRestOwnerMaterialized {
  transactionId:string;
  ownerParticipantId:string;
  character:ConnectedLongRestCharacterRevision;
  preparationId:string;
}

function required(value:string,label:string) {
  const normalized=value.trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function sameCharacter(left:ConnectedLongRestCharacterRevision,right:ConnectedLongRestCharacterRevision) {
  return left.characterId===right.characterId
    &&left.sourceRevision===right.sourceRevision
    &&left.runtimeRevision===right.runtimeRevision;
}

function assertOwnerIdentity(
  preflight:ConnectedLongRestCommitPreflight,
  input:{transactionId:string;ownerParticipantId:string;character:ConnectedLongRestCharacterRevision},
) {
  if (required(input.transactionId,"Long Rest transactionId")!==preflight.transactionId) throw new Error("Long Rest transaction mismatch");
  if (required(input.ownerParticipantId,"Long Rest ownerParticipantId")!==preflight.ownerParticipantId) throw new Error("Long Rest owner mismatch");
  if (!sameCharacter(input.character,preflight.character)) throw new Error("Long Rest Character revision mismatch");
}

export function beginConnectedLongRestTransaction(
  preflight:ConnectedLongRestCommitPreflight,
):ConnectedLongRestTransactionState {
  return {phase:"approved",preflight:structuredClone(preflight)};
}

export function recordConnectedLongRestOwnerPrepared(
  state:ConnectedLongRestTransactionState,
  prepared:ConnectedLongRestOwnerPrepared,
):ConnectedLongRestTransactionState {
  if (state.phase!=="approved") throw new Error(`Long Rest owner prepare is invalid during ${state.phase}`);
  assertOwnerIdentity(state.preflight,prepared);
  return {
    phase:"owner-prepared",
    preflight:structuredClone(state.preflight),
    preparationId:required(prepared.preparationId,"Long Rest preparationId"),
  };
}

export function abortConnectedLongRestTransaction(
  state:ConnectedLongRestTransactionState,
  reason:string,
):ConnectedLongRestTransactionState {
  if (state.phase==="committed"||state.phase==="complete") {
    throw new Error("Committed Long Rest cannot be aborted; finish owner materialization by recovery");
  }
  if (state.phase==="aborted") return structuredClone(state);
  return {
    phase:"aborted",
    preflight:structuredClone(state.preflight),
    reason:required(reason,"Long Rest abort reason"),
  };
}

export function commitConnectedLongRestTransaction(
  state:ConnectedLongRestTransactionState,
  commit:ConnectedLongRestGlobalCommit,
):ConnectedLongRestTransactionState {
  if (state.phase!=="owner-prepared") throw new Error(`Long Rest global commit requires owner-prepared state, received ${state.phase}`);
  if (required(commit.transactionId,"Long Rest transactionId")!==state.preflight.transactionId) throw new Error("Long Rest transaction mismatch");
  if(commit.ownerParticipantId!==undefined&&required(commit.ownerParticipantId,"Long Rest ownerParticipantId")!==state.preflight.ownerParticipantId) throw new Error("Long Rest global commit owner mismatch");
  if(commit.character!==undefined&&!sameCharacter(commit.character,state.preflight.character)) throw new Error("Long Rest global commit Character revision mismatch");
  if(commit.preparationId!==undefined&&required(commit.preparationId,"Long Rest preparationId")!==state.preparationId) throw new Error("Long Rest global commit preparation mismatch");
  return {
    phase:"committed",
    preflight:structuredClone(state.preflight),
    preparationId:state.preparationId,
    campaignCommitId:required(commit.campaignCommitId,"Long Rest campaignCommitId"),
  };
}

export function recordConnectedLongRestOwnerMaterialized(
  state:ConnectedLongRestTransactionState,
  materialized:ConnectedLongRestOwnerMaterialized,
):ConnectedLongRestTransactionState {
  if (state.phase!=="committed") throw new Error(`Long Rest owner materialization requires committed state, received ${state.phase}`);
  assertOwnerIdentity(state.preflight,materialized);
  if (required(materialized.preparationId,"Long Rest preparationId")!==state.preparationId) throw new Error("Long Rest preparation mismatch");
  return {
    phase:"complete",
    preflight:structuredClone(state.preflight),
    preparationId:state.preparationId,
    campaignCommitId:state.campaignCommitId,
  };
}

export type ConnectedLongRestRecoveryAction =
  | "request-owner-prepare"
  | "resume-or-abort-precommit"
  | "resend-global-commit"
  | "none";

export function connectedLongRestRecoveryAction(state:ConnectedLongRestTransactionState):ConnectedLongRestRecoveryAction {
  if (state.phase==="approved") return "request-owner-prepare";
  if (state.phase==="owner-prepared") return "resume-or-abort-precommit";
  if (state.phase==="committed") return "resend-global-commit";
  return "none";
}
