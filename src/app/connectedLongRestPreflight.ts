import type { CharacterSessionProjectionV1 } from "./characterSessionProjection";

export interface ConnectedLongRestCharacterRevision {
  characterId:string;
  sourceRevision:number;
  runtimeRevision:number;
}

export interface ConnectedLongRestOptions {
  advanceMinutes:number;
  consumeRations:boolean;
}

export interface ConnectedLongRestOffer {
  transactionId:string;
  sessionId:string;
  campaignId:string;
  campaignRevision:number;
  ownerParticipantId:string;
  character:ConnectedLongRestCharacterRevision;
  options:ConnectedLongRestOptions;
}

export interface ConnectedLongRestOwnerDecision {
  transactionId:string;
  sessionId:string;
  ownerParticipantId:string;
  character:ConnectedLongRestCharacterRevision;
  accepted:boolean;
}

export interface ConnectedLongRestCurrentAuthority {
  sessionId:string;
  campaignId:string;
  campaignRevision:number;
  registeredOwnerParticipantId:string;
  projection:CharacterSessionProjectionV1;
}

export interface ConnectedLongRestCommitPreflight {
  transactionId:string;
  sessionId:string;
  campaignId:string;
  expectedCampaignRevision:number;
  ownerParticipantId:string;
  character:ConnectedLongRestCharacterRevision;
  options:ConnectedLongRestOptions;
}

export type ConnectedLongRestPreflightResult =
  | {status:"ready";preflight:ConnectedLongRestCommitPreflight}
  | {status:"declined";transactionId:string}
  | {status:"rejected";error:string};

function nonEmpty(value:string,label:string) {
  if (!value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function revision(value:number,label:string) {
  if (!Number.isInteger(value)||value<0) throw new Error(`${label} must be a non-negative integer`);
  return value;
}

function validateCharacter(value:ConnectedLongRestCharacterRevision,label:string):ConnectedLongRestCharacterRevision {
  return {
    characterId:nonEmpty(value.characterId,`${label}.characterId`),
    sourceRevision:revision(value.sourceRevision,`${label}.sourceRevision`),
    runtimeRevision:revision(value.runtimeRevision,`${label}.runtimeRevision`),
  };
}

function sameCharacter(left:ConnectedLongRestCharacterRevision,right:ConnectedLongRestCharacterRevision) {
  return left.characterId===right.characterId
    &&left.sourceRevision===right.sourceRevision
    &&left.runtimeRevision===right.runtimeRevision;
}

/**
 * Pure connected Long Rest ownership/revision gate.
 *
 * This function deliberately performs no Character/Campaign mutation and does
 * not claim a distributed commit. A later durable prepare/commit coordinator may
 * proceed only from a `ready` result so Host Campaign state and the remote
 * Character owner agree on the exact preview revisions first.
 */
export function preflightConnectedLongRest(
  offer:ConnectedLongRestOffer,
  decision:ConnectedLongRestOwnerDecision,
  current:ConnectedLongRestCurrentAuthority,
):ConnectedLongRestPreflightResult {
  try {
    const normalizedOffer={
      transactionId:nonEmpty(offer.transactionId,"Long Rest transactionId"),
      sessionId:nonEmpty(offer.sessionId,"Long Rest sessionId"),
      campaignId:nonEmpty(offer.campaignId,"Long Rest campaignId"),
      campaignRevision:revision(offer.campaignRevision,"Long Rest campaignRevision"),
      ownerParticipantId:nonEmpty(offer.ownerParticipantId,"Long Rest ownerParticipantId"),
      character:validateCharacter(offer.character,"Long Rest offer character"),
      options:{
        advanceMinutes:revision(offer.options.advanceMinutes,"Long Rest advanceMinutes"),
        consumeRations:offer.options.consumeRations,
      },
    };
    if (typeof normalizedOffer.options.consumeRations!=="boolean") throw new Error("Long Rest consumeRations must be boolean");

    const decisionTransactionId=nonEmpty(decision.transactionId,"Long Rest decision transactionId");
    const decisionSessionId=nonEmpty(decision.sessionId,"Long Rest decision sessionId");
    const decisionOwner=nonEmpty(decision.ownerParticipantId,"Long Rest decision ownerParticipantId");
    const decisionCharacter=validateCharacter(decision.character,"Long Rest decision character");
    if (decisionTransactionId!==normalizedOffer.transactionId) throw new Error("Long Rest decision transaction mismatch");
    if (decisionSessionId!==normalizedOffer.sessionId) throw new Error("Long Rest decision session mismatch");
    if (decisionOwner!==normalizedOffer.ownerParticipantId) throw new Error("Long Rest decision owner mismatch");
    if (!sameCharacter(decisionCharacter,normalizedOffer.character)) throw new Error("Long Rest decision Character revision mismatch");
    if (typeof decision.accepted!=="boolean") throw new Error("Long Rest decision accepted must be boolean");
    if (!decision.accepted) return {status:"declined",transactionId:normalizedOffer.transactionId};

    const currentSessionId=nonEmpty(current.sessionId,"current sessionId");
    const currentCampaignId=nonEmpty(current.campaignId,"current campaignId");
    const currentOwner=nonEmpty(current.registeredOwnerParticipantId,"current ownerParticipantId");
    const currentCampaignRevision=revision(current.campaignRevision,"current campaignRevision");
    if (currentSessionId!==normalizedOffer.sessionId) throw new Error("Long Rest offer session is stale");
    if (currentCampaignId!==normalizedOffer.campaignId) throw new Error("Long Rest offer Campaign is stale");
    if (currentCampaignRevision!==normalizedOffer.campaignRevision) throw new Error("Long Rest offer Campaign revision is stale");
    if (currentOwner!==normalizedOffer.ownerParticipantId) throw new Error("Long Rest Character owner changed");
    const projectedCharacter:ConnectedLongRestCharacterRevision={
      characterId:current.projection.characterId,
      sourceRevision:current.projection.sourceRevision,
      runtimeRevision:current.projection.runtimeRevision,
    };
    if (!sameCharacter(projectedCharacter,normalizedOffer.character)) throw new Error("Long Rest Character projection revision is stale");

    return {
      status:"ready",
      preflight:{
        transactionId:normalizedOffer.transactionId,
        sessionId:normalizedOffer.sessionId,
        campaignId:normalizedOffer.campaignId,
        expectedCampaignRevision:normalizedOffer.campaignRevision,
        ownerParticipantId:normalizedOffer.ownerParticipantId,
        character:structuredClone(normalizedOffer.character),
        options:structuredClone(normalizedOffer.options),
      },
    };
  } catch(error) {
    return {status:"rejected",error:error instanceof Error?error.message:String(error)};
  }
}
