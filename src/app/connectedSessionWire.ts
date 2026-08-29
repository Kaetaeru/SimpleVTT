import type {
  ConnectedActionRequest,
  ConnectedSessionEvent,
  SessionCompatibilityManifest,
  SessionCompatibilityResult,
} from "./connectedSessionProtocol";
import type { CharacterSessionProjectionV1 } from "./characterSessionProjection";
import type { InterruptView } from "./contracts";
import type { ConnectedInterruptResponse } from "./connectedInterruptResponsePort";
import type { ConcentrationSaveVm } from "./concentrationSaveRuntimeContracts";
import type { ConnectedConcentrationResponse } from "./connectedConcentrationResponsePort";
import type { CommonPlayAuthorityFactRequest, CommonPlayAuthorityFactResponse } from "../domain/commonPlaySpatialFactRuntime";
import { isConnectedResolutionPresentation, type ConnectedResolutionPresentationV1 } from "./connectedResolutionPresentation";
import {
  validateConnectedLongRestWireMessage,
  type ConnectedLongRestWireMessage,
} from "./connectedLongRestWire";

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
  | { type:"resolution-presentation"; sessionId:string; presentation:ConnectedResolutionPresentationV1 }
  | { type:"resolution-interrupt-prompt"; sessionId:string; resolutionId:string; presentationSequence:number; interrupt:InterruptView }
  | { type:"resolution-interrupt-response"; response:ConnectedInterruptResponse }
  | { type:"resolution-concentration-prompt"; sessionId:string; resolutionId:string; presentationSequence:number; save:ConcentrationSaveVm }
  | { type:"resolution-concentration-response"; response:ConnectedConcentrationResponse }
  | { type:"common-play-fact-request"; sessionId:string; responderId:string; request:CommonPlayAuthorityFactRequest }
  | { type:"common-play-fact-response"; sessionId:string; response:CommonPlayAuthorityFactResponse }
  | { type:"session-ended"; sessionId:string; reason:string }
  | { type:"error"; code:string; message:string; hostCursor?:number }
  | ConnectedLongRestWireMessage;

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
    &&typeof value.movementMax==="number"
    &&(value.extraActions===undefined||(Array.isArray(value.extraActions)&&value.extraActions.every((entry)=>isRecord(entry)&&isString(entry.id)&&isString(entry.source)&&typeof entry.allowsMagicAction==="boolean")))
    &&(value.extraAttacks===undefined||(Array.isArray(value.extraAttacks)&&value.extraAttacks.every((entry)=>isRecord(entry)&&isString(entry.id)&&isString(entry.source))));
}

function isEconomyMap(value:unknown) {
  return isRecord(value)&&Object.values(value).every(isEconomy);
}

function isSceneEntity(value:unknown) {
  return isRecord(value)
    &&isString(value.id)
    &&isString(value.name)
    &&["ally","enemy","neutral"].includes(String(value.side))
    &&["character","combatant"].includes(String(value.kind))
    &&typeof value.hp==="number"
    &&typeof value.maxHp==="number"
    &&typeof value.tempHp==="number"
    &&typeof value.ac==="number"
    &&typeof value.initiative==="number"
    &&isStringArray(value.status)
    &&(value.distance===undefined||typeof value.distance==="string")
    &&isStringArray(value.resistances)
    &&isStringArray(value.immunities)
    &&isStringArray(value.vulnerabilities)
    &&Array.isArray(value.reactions)
    &&value.reactions.every(isRecord);
}

function isSceneTopology(value:unknown) {
  return isRecord(value)
    &&isString(value.sceneId)
    &&isString(value.sceneName)
    &&isCursor(value.round)
    &&typeof value.currentActorId==="string"
    &&Array.isArray(value.entities)
    &&value.entities.every(isSceneEntity)
    &&isEconomyMap(value.economyByActor);
}

function isRecoveryLockouts(value:unknown) {
  if (value===null) return true;
  if (!isRecord(value)) return false;
  if (!Object.keys(value).every((key)=>key==="shortRest"||key==="longRest")) return false;
  return (value.shortRest===undefined||isCursor(value.shortRest))
    &&(value.longRest===undefined||isCursor(value.longRest));
}

function isRecoveryLockoutChange(value:unknown) {
  return isRecord(value)
    &&Object.keys(value).every((key)=>key==="before"||key==="after")
    &&isRecoveryLockouts(value.before)
    &&isRecoveryLockouts(value.after);
}

function isRuntimeCombatant(value:unknown) {
  if(!isRecord(value)||!isString(value.id)||typeof value.baseSpeed!=="number"||!isRecord(value.life)||!isRecord(value.economy)) return false;
  const hp=isRecord(value.life.hp)?value.life.hp:undefined;
  const saves=isRecord(value.life.deathSaves)?value.life.deathSaves:undefined;
  return Boolean(hp&&saves
    &&typeof hp.current==="number"&&typeof hp.maximum==="number"&&typeof hp.temporary==="number"
    &&typeof saves.successes==="number"&&typeof saves.failures==="number"
    &&typeof value.life.stable==="boolean"&&typeof value.life.unconscious==="boolean"&&typeof value.life.dead==="boolean"
    &&typeof value.economy.action==="boolean"&&typeof value.economy.bonusAction==="boolean"&&typeof value.economy.reaction==="boolean"
    &&typeof value.economy.movement==="number"&&typeof value.economy.movementMaximum==="number"
    &&Array.isArray(value.resources)&&Array.isArray(value.hitDice));
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
  if (value.kind==="economy") {
    if (!["action","bonusAction","reaction","movement","movementMaximum","extraActions","extraAttacks"].includes(String(value.field))) return false;
    if (value.field!=="extraActions"&&value.field!=="extraAttacks") return value.before!==undefined&&value.after!==undefined;
    return [value.before,value.after].every((entries)=>Array.isArray(entries)&&entries.every((entry)=>isRecord(entry)&&isString(entry.id)&&isString(entry.source)&&(value.field!=="extraActions"||typeof entry.allowsMagicAction==="boolean")));
  }
  if (value.kind==="resource") return isString(value.resourceId)
    &&typeof value.before==="number"
    &&typeof value.after==="number"
    &&(value.recoveryLockouts===undefined||isRecoveryLockoutChange(value.recoveryLockouts));
  if (value.kind==="life") return ["stable","unconscious","dead"].includes(String(value.field))&&typeof value.before==="boolean"&&typeof value.after==="boolean";
  if (value.kind==="death-save") return ["successes","failures"].includes(String(value.field))&&typeof value.before==="number"&&typeof value.after==="number";
  if (value.kind==="effect") return isString(value.effectId)&&["added","updated","removed"].includes(String(value.operation));
  if (value.kind==="artifact") return isString(value.artifactId)&&["added","updated","removed"].includes(String(value.operation));
  if (value.kind==="combatant") return ["added","updated","removed"].includes(String(value.operation))
    &&(value.before===undefined||isRuntimeCombatant(value.before))
    &&(value.after===undefined||isRuntimeCombatant(value.after));
  if (value.kind==="zone-membership") return isString(value.artifactId)&&["added","updated","removed"].includes(String(value.operation));
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
    if (!isString(payload.resolutionId)||!isConnectedResolutionPresentation(payload.presentation)
      ||payload.presentation.resolutionId!==payload.resolutionId
      ||!Array.isArray(payload.resolutionEvents)||!payload.resolutionEvents.every(isResolutionEvent)) return false;
  } else if(payload.kind==="resolution-undo"){
    if(!isString(payload.undoId)||!isString(payload.undoOf)||!Array.isArray(payload.inverseResolutionEvents)||!payload.inverseResolutionEvents.every(isResolutionEvent))return false;
  } else if (payload.kind==="mode-transition") {
    if ((payload.sessionMode!=="freeform"&&payload.sessionMode!=="initiative")
      ||!isCursor(payload.round)||typeof payload.currentActorId!=="string"||!isEconomyMap(payload.economyByActor)) return false;
  } else if (payload.kind==="correction") {
    if (typeof payload.ruling!=="string"||!Array.isArray(payload.changes)||!payload.changes.every(isCorrectionChange)) return false;
    if (payload.resolutionId!==undefined&&!isString(payload.resolutionId)) return false;
  } else if (payload.kind==="participant") {
    if (!isString(payload.participantId)||!isString(payload.participantName)
      ||(payload.characterName!==undefined&&!isString(payload.characterName))
      ||!["connected","reconnecting","disconnected"].includes(String(payload.state))
      ||typeof payload.ready!=="boolean") return false;
  } else if (payload.kind==="scene-topology") {
    if (!isSceneTopology(payload.topology)) return false;
  } else if (payload.kind==="ready-action") {
    if (!isString(payload.actorId)||!isEconomy(payload.economy)||!['armed','cleared'].includes(String(payload.transition))) return false;
    const config=payload.configuration;
    if (payload.transition==="armed"&&(!isRecord(config)||!isString(config.actorId)||!isString(config.actionId)||!isString(config.trigger))) return false;
    if (config!==undefined&&(!isRecord(config)||!isString(config.actorId)||!isString(config.actionId)||!isString(config.trigger))) return false;
  } else return false;
  return (value.requestId===undefined||isString(value.requestId))&&(value.actorId===undefined||isString(value.actorId));
}

function isActionRequest(value:unknown):value is ConnectedActionRequest {
  if (!isRecord(value)) return false;
  const ready=value.readyConfiguration;
  const validReady=ready===undefined||(isRecord(ready)&&isString(ready.actorId)&&isString(ready.actionId)&&isString(ready.trigger));
  const manual=value.manualMovementReaction;
  const validManual=manual===undefined||(isRecord(manual)
    &&["opportunity-attack","other-reaction-attack"].includes(String(manual.kind))
    &&isString(manual.provokerId)&&isString(manual.reactorId)&&isString(manual.attackActionId)
    &&typeof manual.distanceFeet==="number"&&Number.isFinite(manual.distanceFeet)&&manual.distanceFeet>=0
    &&typeof manual.visibleAtTrigger==="boolean"&&["none","half","three-quarters","total"].includes(String(manual.coverAtTrigger))
    &&typeof manual.targetCanSeeReactorAtTrigger==="boolean"&&(manual.triggerLabel===undefined||isString(manual.triggerLabel)));
  return isString(value.sessionId)&&isString(value.requestId)&&isString(value.actorId)&&isString(value.actionId)
    &&isStringArray(value.targetIds)&&isCursor(value.knownEventCursor)&&isStringArray(value.capabilities)
    &&(value.character===undefined||isCharacterRevision(value.character))&&validReady&&validManual;
}

function isInterrupt(value:unknown):value is InterruptView {
  return isRecord(value)&&isString(value.id)&&isString(value.responderId)&&isString(value.responderName)
    &&isString(value.trigger)&&isString(value.optionName)&&isString(value.cost)&&isString(value.effect)&&isString(value.source)
    &&Object.keys(value).every((key)=>["id","responderId","responderName","trigger","optionName","cost","effect","source"].includes(key));
}

function isCommonPlayFactRequest(value:unknown):value is CommonPlayAuthorityFactRequest {
  if(!isRecord(value))return false;
  return isString(value.id)
    &&isString(value.queryId)
    &&isString(value.fact)
    &&(value.subject===undefined||isString(value.subject))
    &&["host","actor-owner","target-owner","dm"].includes(String(value.authority))
    &&["public","actor","dm","actor-and-dm","authority-only"].includes(String(value.visibility))
    &&["boolean","number","text","targets"].includes(String(value.inputType))
    &&["boolean","number","string","targets","destination"].includes(String(value.valueType))
    &&isCursor(value.expectedRevision)
    &&isString(value.resolutionId)
    &&isString(value.idempotencyKey);
}

function isCommonPlayFactResponse(value:unknown):value is CommonPlayAuthorityFactResponse {
  if(!isRecord(value)||!isString(value.requestId)||!isString(value.idempotencyKey)||!isCursor(value.expectedRevision)||!isString(value.responderId))return false;
  const answer=value.value;
  return typeof answer==="boolean"
    ||(typeof answer==="number"&&Number.isFinite(answer))
    ||isString(answer)
    ||(Array.isArray(answer)&&answer.every((entry)=>isString(entry)));
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
  if (value.type==="resolution-presentation") {
    if (!isString(value.sessionId)||!isConnectedResolutionPresentation(value.presentation)) return "invalid resolution-presentation message";
    return value as ConnectedWireMessage;
  }
  if(value.type==="resolution-interrupt-prompt"){
    if(!isString(value.sessionId)||!isString(value.resolutionId)||!isCursor(value.presentationSequence)||!isInterrupt(value.interrupt)) return "invalid resolution-interrupt-prompt message";
    return value as ConnectedWireMessage;
  }
  if(value.type==="resolution-interrupt-response"){
    const response=value.response;
    if(!isRecord(response)||!isString(response.sessionId)||!isString(response.resolutionId)||!isString(response.promptId)||typeof response.accept!=="boolean") return "invalid resolution-interrupt-response message";
    return value as ConnectedWireMessage;
  }
  if(value.type==="resolution-concentration-prompt"){
    const save=value.save;
    if(!isString(value.sessionId)||!isString(value.resolutionId)||!isCursor(value.presentationSequence)||!isRecord(save)||!isString(save.targetId)||!isString(save.targetName)||save.ability!=="con"||typeof save.modifier!=="number"||!isString(save.modifierSource)||save.natural!==undefined)return "invalid resolution-concentration-prompt message";
    return value as ConnectedWireMessage;
  }
  if(value.type==="resolution-concentration-response"){
    const response=value.response;
    if(!isRecord(response)||!isString(response.sessionId)||!isString(response.resolutionId)||!Number.isInteger(response.face)||Number(response.face)<1||Number(response.face)>20)return "invalid resolution-concentration-response message";
    return value as ConnectedWireMessage;
  }
  if(value.type==="common-play-fact-request"){
    if(!isString(value.sessionId)||!isString(value.responderId)||!isCommonPlayFactRequest(value.request))return "invalid Common Play fact request message";
    return value as ConnectedWireMessage;
  }
  if(value.type==="common-play-fact-response"){
    if(!isString(value.sessionId)||!isCommonPlayFactResponse(value.response))return "invalid Common Play fact response message";
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
  if (value.type.startsWith("long-rest-")) {
    const validated=validateConnectedLongRestWireMessage(value);
    return typeof validated==="string" ? validated : validated;
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
