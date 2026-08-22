import type { CharacterSessionProjectionV1 } from "./characterSessionProjection";
import type {
  ConnectedLongRestCommitPreflight,
  ConnectedLongRestOffer,
  ConnectedLongRestOwnerDecision,
} from "./connectedLongRestPreflight";
import type {
  ConnectedLongRestGlobalCommit,
  ConnectedLongRestOwnerMaterialized,
  ConnectedLongRestOwnerPrepared,
} from "./connectedLongRestTransactionState";

export type ConnectedLongRestWireMessage =
  | { type:"long-rest-offer"; offer:ConnectedLongRestOffer }
  | { type:"long-rest-decision"; decision:ConnectedLongRestOwnerDecision }
  | { type:"long-rest-prepare-authorized"; preflight:ConnectedLongRestCommitPreflight }
  | { type:"long-rest-owner-prepared"; prepared:ConnectedLongRestOwnerPrepared }
  | { type:"long-rest-global-commit"; commit:ConnectedLongRestGlobalCommit }
  | { type:"long-rest-owner-materialized"; materialized:ConnectedLongRestOwnerMaterialized; projection:CharacterSessionProjectionV1 }
  | {
      type:"long-rest-abort";
      transactionId:string;
      reason:string;
      /** Present after owner prepare so a restarted owner can close its durable marker. */
      ownerParticipantId?:string;
      character?:ConnectedLongRestOffer["character"];
      preparationId?:string;
    };

export type DecodeConnectedLongRestWireResult =
  | { status:"ok"; message:ConnectedLongRestWireMessage }
  | { status:"rejected"; error:string };

type JsonRecord=Record<string,unknown>;

const isRecord=(value:unknown):value is JsonRecord=>typeof value==="object"&&value!==null&&!Array.isArray(value);
const isString=(value:unknown):value is string=>typeof value==="string"&&value.trim().length>0;
const isRevision=(value:unknown):value is number=>Number.isInteger(value)&&Number(value)>=0;

function isCharacterRevision(value:unknown) {
  return isRecord(value)
    &&isString(value.characterId)
    &&isRevision(value.sourceRevision)
    &&isRevision(value.runtimeRevision);
}

function isProjectionEnvelope(value:unknown):value is CharacterSessionProjectionV1 {
  return isRecord(value)
    &&value.schemaId==="simplevtt.character-session-projection"
    &&value.schemaVersion===1
    &&isString(value.characterId)
    &&isRevision(value.sourceRevision)
    &&isRevision(value.runtimeRevision)
    &&isRecord(value.rulesProfile)
    &&isRecord(value.source)
    &&isRecord(value.sourceAuthority)
    &&isRecord(value.runtime)
    &&Array.isArray(value.contentIdentities);
}

function isOptions(value:unknown) {
  return isRecord(value)
    &&isRevision(value.advanceMinutes)
    &&typeof value.consumeRations==="boolean";
}

function isOffer(value:unknown):value is ConnectedLongRestOffer {
  return isRecord(value)
    &&isString(value.transactionId)
    &&isString(value.sessionId)
    &&isString(value.campaignId)
    &&isRevision(value.campaignRevision)
    &&isString(value.ownerParticipantId)
    &&isCharacterRevision(value.character)
    &&isOptions(value.options);
}

function isDecision(value:unknown):value is ConnectedLongRestOwnerDecision {
  return isRecord(value)
    &&isString(value.transactionId)
    &&isString(value.sessionId)
    &&isString(value.ownerParticipantId)
    &&isCharacterRevision(value.character)
    &&typeof value.accepted==="boolean";
}

function isPreflight(value:unknown):value is ConnectedLongRestCommitPreflight {
  return isRecord(value)
    &&isString(value.transactionId)
    &&isString(value.sessionId)
    &&isString(value.campaignId)
    &&isRevision(value.expectedCampaignRevision)
    &&isString(value.ownerParticipantId)
    &&isCharacterRevision(value.character)
    &&isOptions(value.options);
}

function isOwnerPrepared(value:unknown):value is ConnectedLongRestOwnerPrepared {
  return isRecord(value)
    &&isString(value.transactionId)
    &&isString(value.ownerParticipantId)
    &&isCharacterRevision(value.character)
    &&isString(value.preparationId);
}

function isGlobalCommit(value:unknown):value is ConnectedLongRestGlobalCommit {
  if(!isRecord(value)||!isString(value.transactionId)||!isString(value.campaignCommitId)) return false;
  const recovery=[value.ownerParticipantId,value.character,value.preparationId];
  const hasRecovery=recovery.some((entry)=>entry!==undefined);
  if(!hasRecovery) return true;
  return isString(value.ownerParticipantId)&&isCharacterRevision(value.character)&&isString(value.preparationId);
}

function isOwnerMaterialized(value:unknown):value is ConnectedLongRestOwnerMaterialized {
  return isRecord(value)
    &&isString(value.transactionId)
    &&isString(value.ownerParticipantId)
    &&isCharacterRevision(value.character)
    &&isString(value.preparationId);
}

function hasValidAbortRecoveryIdentity(value:JsonRecord) {
  const recovery=[value.ownerParticipantId,value.character,value.preparationId];
  const hasRecovery=recovery.some((entry)=>entry!==undefined);
  if(!hasRecovery) return true;
  return isString(value.ownerParticipantId)&&isCharacterRevision(value.character)&&isString(value.preparationId);
}

export function validateConnectedLongRestWireMessage(value:unknown):ConnectedLongRestWireMessage|string {
  if (!isRecord(value)||!isString(value.type)) return "connected Long Rest wire message must be an object with a type";
  if (value.type==="long-rest-offer") {
    if (!isOffer(value.offer)) return "invalid long-rest-offer message";
    return value as ConnectedLongRestWireMessage;
  }
  if (value.type==="long-rest-decision") {
    if (!isDecision(value.decision)) return "invalid long-rest-decision message";
    return value as ConnectedLongRestWireMessage;
  }
  if (value.type==="long-rest-prepare-authorized") {
    if (!isPreflight(value.preflight)) return "invalid long-rest-prepare-authorized message";
    return value as ConnectedLongRestWireMessage;
  }
  if (value.type==="long-rest-owner-prepared") {
    if (!isOwnerPrepared(value.prepared)) return "invalid long-rest-owner-prepared message";
    return value as ConnectedLongRestWireMessage;
  }
  if (value.type==="long-rest-global-commit") {
    if (!isGlobalCommit(value.commit)) return "invalid long-rest-global-commit message";
    return value as ConnectedLongRestWireMessage;
  }
  if (value.type==="long-rest-owner-materialized") {
    if (!isOwnerMaterialized(value.materialized)||!isProjectionEnvelope(value.projection)) return "invalid long-rest-owner-materialized message";
    if (value.projection.characterId!==value.materialized.character.characterId) return "long-rest-owner-materialized projection Character mismatch";
    return value as ConnectedLongRestWireMessage;
  }
  if (value.type==="long-rest-abort") {
    if (!isString(value.transactionId)||!isString(value.reason)||!hasValidAbortRecoveryIdentity(value)) return "invalid long-rest-abort message";
    return value as ConnectedLongRestWireMessage;
  }
  return `unknown connected Long Rest wire message type: ${value.type}`;
}

export function encodeConnectedLongRestWireMessage(message:ConnectedLongRestWireMessage) {
  return JSON.stringify(message);
}

export function decodeConnectedLongRestWireMessage(raw:string):DecodeConnectedLongRestWireResult {
  let value:unknown;
  try {
    value=JSON.parse(raw);
  } catch(error) {
    return {status:"rejected",error:`invalid connected Long Rest JSON: ${error instanceof Error?error.message:String(error)}`};
  }
  const validated=validateConnectedLongRestWireMessage(value);
  if (typeof validated==="string") return {status:"rejected",error:validated};
  return {status:"ok",message:validated};
}
