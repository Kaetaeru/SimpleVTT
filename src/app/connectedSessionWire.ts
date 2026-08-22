import type {
  ConnectedActionRequest,
  ConnectedSessionEvent,
  SessionCompatibilityManifest,
  SessionCompatibilityResult,
} from "./connectedSessionProtocol";
import type { CharacterSessionProjectionV1 } from "./characterSessionProjection";

export type ConnectedWireMessage =
  | {
      type:"hello";
      manifest:SessionCompatibilityManifest;
      participantId:string;
      participantName:string;
      knownEventCursor:number;
      projection?:CharacterSessionProjectionV1;
    }
  | {
      type:"hello-ack";
      sessionId:string;
      sessionName?:string;
      compatibility:SessionCompatibilityResult;
      hostCursor:number;
      events:ConnectedSessionEvent[];
    }
  | { type:"ready-intent"; sessionId:string; ready:boolean }
  | { type:"action-request"; request:ConnectedActionRequest }
  | { type:"catchup-request"; sessionId:string; afterCursor:number }
  | { type:"event-batch"; sessionId:string; afterCursor:number; events:ConnectedSessionEvent[] }
  | { type:"session-ended"; sessionId:string; reason:string }
  | { type:"error"; code:string; message:string; hostCursor?:number };

export type DecodeWireResult =
  | { status:"ok"; message:ConnectedWireMessage }
  | { status:"rejected"; error:string };

type JsonRecord=Record<string,unknown>;
const isRecord=(value:unknown):value is JsonRecord=>typeof value==="object"&&value!==null&&!Array.isArray(value);
const isString=(value:unknown):value is string=>typeof value==="string"&&value.length>0;
const isCursor=(value:unknown):value is number=>Number.isInteger(value)&&Number(value)>=0;
const isStringArray=(value:unknown):value is string[]=>Array.isArray(value)&&value.every((entry)=>typeof entry==="string");

function isProjectionEnvelope(value:unknown):value is CharacterSessionProjectionV1 {
  if (!isRecord(value)) return false;
  return value.schemaId==="simplevtt.character-session-projection"
    &&value.schemaVersion===1
    &&isString(value.characterId)
    &&isCursor(value.sourceRevision)
    &&isCursor(value.runtimeRevision)
    &&isRecord(value.rulesProfile)
    &&isRecord(value.source)
    &&isRecord(value.sourceAuthority)
    &&isRecord(value.runtime)
    &&Array.isArray(value.contentIdentities);
}

function isProvenanceArray(value:unknown) {
  return Array.isArray(value)&&value.every((entry)=>isRecord(entry)
    &&isString(entry.source)
    &&["applied","suppressed","superseded","failed"].includes(String(entry.status))
    &&typeof entry.reason==="string");
}

function isEconomy(value:unknown) {
  return isRecord(value)
    &&typeof value.action==="boolean"
    &&typeof value.bonusAction==="boolean"
    &&typeof value.reaction==="boolean"
    &&typeof value.movement==="number"
    &&typeof value.movementMax==="number";
}

function isEconomyMap(value:unknown) {
  return isRecord(value)&&Object.values(value).every(isEconomy);
}

function isCorrectionChange(value:unknown) {
  if (!isRecord(value)||!isString(value.kind)||!isString(value.targetId)) return false;
  if (value.kind==="hp") return typeof value.before==="number"&&typeof value.after==="number";
  if (value.kind==="status") return isStringArray(value.before)&&isStringArray(value.after);
  if (value.kind==="resource") return isString(value.resourceId)&&typeof value.before==="number"&&typeof value.after==="number";
  return false;
}

function isCharacterRevision(value:unknown) {
  if (!isRecord(value)) return false;
  return isString(value.characterId)&&isCursor(value.sourceRevision)&&isCursor(value.runtimeRevision);
}

function isManifest(value:unknown):value is SessionCompatibilityManifest {
  if (!isRecord(value)) return false;
  return isCursor(value.protocolVersion)&&isString(value.rulesProfileId)&&isStringArray(value.capabilities)
    && (value.character===undefined||isCharacterRevision(value.character));
}

function isCompatibility(value:unknown):value is SessionCompatibilityResult {
  if (!isRecord(value)||!isString(value.status)||!isString(value.message)) return false;
  return value.status==="compatible"||value.status==="warning"||value.status==="incompatible";
}

function isRuntimeStateChange(value:unknown) {
  if (!isRecord(value)||!isString(value.kind)||!isString(value.targetId)||!isProvenanceArray(value.provenance)) return false;
  if (value.lifetime!=="character-durable"&&value.lifetime!=="session-runtime") return false;
  if (value.writeBack!=="character"&&value.writeBack!=="session") return false;
  if (value.kind==="hp") return ["current","maximum","temporary"].includes(String(value.field))&&typeof value.before==="number"&&typeof value.after==="number";
  if (value.kind==="economy") return ["action","bonusAction","reaction","movement","movementMaximum","extraActions"].includes(String(value.field))&&value.before!==undefined&&value.after!==undefined;
  if (value.kind==="resource") return isString(value.resourceId)&&typeof value.before==="number"&&typeof value.after==="number";
  if (value.kind==="life") return ["stable","unconscious","dead"].includes(String(value.field))&&typeof value.before==="boolean"&&typeof value.after==="boolean";
  if (value.kind==="effect") return isString(value.effectId)&&["added","updated","removed"].includes(String(value.operation));
  if (value.kind==="concentration"||value.kind==="spellcasting-turn") return true;
  return false;
}

function isResolutionEvent(value:unknown) {
  if (!isRecord(value)) return false;
  return isString(value.id)&&isString(value.resolutionId)&&isString(value.operationId)&&isString(value.kind)
    &&isString(value.actorId)&&typeof value.summary==="string"&&isProvenanceArray(value.provenance)
    &&Array.isArray(value.stateChanges)&&value.stateChanges.every(isRuntimeStateChange);
}

function isConnectedEvent(value:unknown):value is ConnectedSessionEvent {
  if (!isRecord(value)||!isString(value.sessionId)||!isString(value.eventId)||!isCursor(value.sequence)||!isRecord(value.payload)) return false;
  const payload=value.payload;
  if (!isString(payload.kind)||!isStringArray(payload.stateChanges)||!isStringArray(payload.provenance)) return false;
  if (payload.kind==="resolution") {
    if (!isString(payload.resolutionId)||!Array.isArray(payload.resolutionEvents)||!payload.resolutionEvents.every(isResolutionEvent)) return false;
  } else if (payload.kind==="mode-transition") {
    if ((payload.sessionMode!=="freeform"&&payload.sessionMode!=="initiative")
      ||!isCursor(payload.round)||!isString(payload.currentActorId)||!isEconomyMap(payload.economyByActor)) return false;
  } else if (payload.kind==="correction") {
    if (typeof payload.ruling!=="string"||!Array.isArray(payload.changes)||!payload.changes.every(isCorrectionChange)) return false;
    if (payload.resolutionId!==undefined&&!isString(payload.resolutionId)) return false;
  } else if (payload.kind==="participant") {
    if (!isString(payload.participantId)||!isString(payload.participantName)
      ||(payload.characterName!==undefined&&!isString(payload.characterName))
      ||!["connected","reconnecting","disconnected"].includes(String(payload.state))
      ||typeof payload.ready!=="boolean") return false;
  } else return false;
  return (value.requestId===undefined||isString(value.requestId))&&(value.actorId===undefined||isString(value.actorId));
}

function isActionRequest(value:unknown):value is ConnectedActionRequest {
  if (!isRecord(value)) return false;
  const ready=value.readyConfiguration;
  const validReady=ready===undefined||(isRecord(ready)&&isString(ready.actorId)&&isString(ready.actionId)&&isString(ready.trigger));
  return isString(value.sessionId)&&isString(value.requestId)&&isString(value.actorId)&&isString(value.actionId)
    &&isStringArray(value.targetIds)&&isCursor(value.knownEventCursor)&&isStringArray(value.capabilities)
    &&(value.character===undefined||isCharacterRevision(value.character))&&validReady;
}

function validateMessage(value:unknown):ConnectedWireMessage|string {
  if (!isRecord(value)||!isString(value.type)) return "wire message must be an object with a type";
  if (value.type==="hello") {
    if (!isManifest(value.manifest)||!isString(value.participantId)||!isString(value.participantName)||!isCursor(value.knownEventCursor)
      ||(value.projection!==undefined&&!isProjectionEnvelope(value.projection))) return "invalid hello message";
    return value as ConnectedWireMessage;
  }
  if (value.type==="hello-ack") {
    if (!isString(value.sessionId)||(value.sessionName!==undefined&&!isString(value.sessionName))||!isCompatibility(value.compatibility)||!isCursor(value.hostCursor)||!Array.isArray(value.events)||!value.events.every(isConnectedEvent)) return "invalid hello-ack message";
    return value as ConnectedWireMessage;
  }
  if (value.type==="ready-intent") {
    if (!isString(value.sessionId)||typeof value.ready!=="boolean") return "invalid ready-intent message";
    return value as ConnectedWireMessage;
  }
  if (value.type==="action-request") {
    if (!isActionRequest(value.request)) return "invalid action-request message";
    return value as ConnectedWireMessage;
  }
  if (value.type==="catchup-request") {
    if (!isString(value.sessionId)||!isCursor(value.afterCursor)) return "invalid catchup-request message";
    return value as ConnectedWireMessage;
  }
  if (value.type==="event-batch") {
    if (!isString(value.sessionId)||!isCursor(value.afterCursor)||!Array.isArray(value.events)||!value.events.every(isConnectedEvent)) return "invalid event-batch message";
    return value as ConnectedWireMessage;
  }
  if (value.type==="session-ended") {
    if (!isString(value.sessionId)||!isString(value.reason)) return "invalid session-ended message";
    return value as ConnectedWireMessage;
  }
  if (value.type==="error") {
    if (!isString(value.code)||!isString(value.message)||(value.hostCursor!==undefined&&!isCursor(value.hostCursor))) return "invalid error message";
    return value as ConnectedWireMessage;
  }
  return `unknown wire message type: ${value.type}`;
}

export function encodeConnectedWireMessage(message:ConnectedWireMessage) {
  return JSON.stringify(message);
}

export function decodeConnectedWireMessage(raw:string):DecodeWireResult {
  let value:unknown;
  try {
    value=JSON.parse(raw);
  } catch(error) {
    return { status:"rejected",error:`invalid session JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  const validated=validateMessage(value);
  if (typeof validated==="string") return { status:"rejected",error:validated };
  return { status:"ok",message:validated };
}
