import type { ActionVm, AppSnapshot, DamageSpecVm, ResolutionView } from "./contracts";

export const CONNECTED_RESOLUTION_PRESENTATION_SCHEMA_ID="simplevtt.connected-resolution-presentation" as const;
export const CONNECTED_RESOLUTION_PRESENTATION_SCHEMA_VERSION=1 as const;

export interface ConnectedResolutionActionPresentationV1 {
  id:string;
  actorId:string;
  name:string;
  category:ActionVm["category"];
  target:ActionVm["target"];
  resolutionKind:ActionVm["resolutionKind"];
  summary:string;
  attackBonus?:number;
  checkBonus?:number;
  saveDc?:number;
  saveAbility?:string;
  damage?:DamageSpecVm[];
  healing?:{dice:string;flat:number;average:number};
  saveHalf?:boolean;
}

export interface ConnectedResolutionPresentationV1 {
  schemaId:typeof CONNECTED_RESOLUTION_PRESENTATION_SCHEMA_ID;
  schemaVersion:typeof CONNECTED_RESOLUTION_PRESENTATION_SCHEMA_VERSION;
  resolutionId:string;
  presentationSequence:number;
  delivery:"live"|"catchup";
  audience:{scope:"public"};
  actor:{id:string;label:string};
  targets:Array<{id:string;label:string}>;
  resolution:ResolutionView;
  action?:ConnectedResolutionActionPresentationV1;
}

function presentationAction(action:ActionVm|undefined):ConnectedResolutionActionPresentationV1|undefined {
  if (!action) return undefined;
  return {
    id:action.id,
    actorId:action.actorId,
    name:action.name,
    category:action.category,
    target:action.target,
    resolutionKind:action.resolutionKind,
    summary:action.summary,
    attackBonus:action.attackBonus,
    checkBonus:action.checkBonus,
    saveDc:action.saveDc,
    saveAbility:action.saveAbility,
    damage:action.damage?.map((entry)=>({...entry})),
    healing:action.healing?{...action.healing}:undefined,
    saveHalf:action.saveHalf,
  };
}

export function actionFromConnectedPresentation(action:ConnectedResolutionActionPresentationV1|undefined):ActionVm|undefined {
  if (!action) return undefined;
  return {
    ...structuredClone(action),
    economy:"없음",
    available:false,
    disabledReason:"원격 Host 권위 연출 전용",
    eligibleTargetIds:[],
    details:[],
  };
}

export function buildConnectedResolutionPresentation(
  snapshot:AppSnapshot,
  presentationSequence:number,
  delivery:"live"|"catchup"="live",
):ConnectedResolutionPresentationV1|null {
  const resolution=snapshot.resolution;
  if (!resolution||!Number.isInteger(presentationSequence)||presentationSequence<0) return null;
  const action=Object.values(snapshot.scene.actionsByActor).flat().find((entry)=>entry.id===resolution.actionId);
  const actor=snapshot.scene.entities.find((entry)=>entry.id===resolution.actorId);
  const publicResolution:ResolutionView={
    ...structuredClone(resolution),
    interrupt:undefined,
    canAdvance:false,
    nextLabel:undefined,
  };
  return {
    schemaId:CONNECTED_RESOLUTION_PRESENTATION_SCHEMA_ID,
    schemaVersion:CONNECTED_RESOLUTION_PRESENTATION_SCHEMA_VERSION,
    resolutionId:resolution.id,
    presentationSequence,
    delivery,
    audience:{scope:"public"},
    actor:{id:resolution.actorId,label:actor?.name??resolution.actorId},
    targets:resolution.targetIds.map((id)=>({id,label:snapshot.scene.entities.find((entry)=>entry.id===id)?.name??id})),
    resolution:publicResolution,
    action:presentationAction(action),
  };
}

type JsonRecord=Record<string,unknown>;
const isRecord=(value:unknown):value is JsonRecord=>typeof value==="object"&&value!==null&&!Array.isArray(value);
const isString=(value:unknown):value is string=>typeof value==="string"&&value.length>0;
const isOptionalNumber=(value:unknown)=>value===undefined||typeof value==="number";

function isDamage(value:unknown) {
  return isRecord(value)&&typeof value.type==="string"&&isString(value.dice)
    &&typeof value.flat==="number"&&typeof value.average==="number";
}

function isAction(value:unknown) {
  if (!isRecord(value)) return false;
  return isString(value.id)&&isString(value.actorId)&&isString(value.name)&&typeof value.summary==="string"
    &&["basic","weapon","magic"].includes(String(value.category))
    &&["self","ally","enemy","any","none","multi-enemy"].includes(String(value.target))
    &&["attack","ability-check","saving-throw","healing","no-roll","no-roll-damage"].includes(String(value.resolutionKind))
    &&isOptionalNumber(value.attackBonus)&&isOptionalNumber(value.checkBonus)&&isOptionalNumber(value.saveDc)
    &&(value.saveAbility===undefined||typeof value.saveAbility==="string")
    &&(value.damage===undefined||(Array.isArray(value.damage)&&value.damage.every(isDamage)))
    &&(value.healing===undefined||(isRecord(value.healing)&&isString(value.healing.dice)&&typeof value.healing.flat==="number"&&typeof value.healing.average==="number"))
    &&(value.saveHalf===undefined||typeof value.saveHalf==="boolean");
}

function isEntityLabel(value:unknown) {
  return isRecord(value)&&isString(value.id)&&isString(value.label)&&Object.keys(value).every((key)=>key==="id"||key==="label");
}

function isResolution(value:unknown):value is ResolutionView {
  if (!isRecord(value)) return false;
  return isString(value.id)&&isString(value.actorId)&&Array.isArray(value.targetIds)&&value.targetIds.every(isString)
    &&isString(value.actionId)&&isString(value.actionName)
    &&["attack","check","save","damage","healing","effect"].includes(String(value.rollKind))
    &&["roll-animation","attack-result","interrupt","save-animation","save-result","damage-animation","effect-preview","complete"].includes(String(value.stage))
    &&Array.isArray(value.authoritativeDice)&&value.authoritativeDice.every((entry)=>Number.isInteger(entry))
    &&Array.isArray(value.saveResults)&&Array.isArray(value.damageComponents)
    &&typeof value.compact==="string"&&Array.isArray(value.detail)&&value.detail.every((entry)=>typeof entry==="string")
    &&Array.isArray(value.provenance)&&value.provenance.every((entry)=>typeof entry==="string")
    &&typeof value.calculatedOutcome==="string"&&typeof value.finalOutcome==="string"
    &&Array.isArray(value.stateChanges)&&value.stateChanges.every((entry)=>typeof entry==="string")
    &&typeof value.adjudicated==="boolean"&&typeof value.canAdvance==="boolean"
    &&value.interrupt===undefined&&value.nextLabel===undefined;
}

export function isConnectedResolutionPresentation(value:unknown):value is ConnectedResolutionPresentationV1 {
  if (!isRecord(value)) return false;
  return value.schemaId===CONNECTED_RESOLUTION_PRESENTATION_SCHEMA_ID
    &&value.schemaVersion===CONNECTED_RESOLUTION_PRESENTATION_SCHEMA_VERSION
    &&isString(value.resolutionId)&&Number.isInteger(value.presentationSequence)&&Number(value.presentationSequence)>=0
    &&(value.delivery==="live"||value.delivery==="catchup")
    &&isRecord(value.audience)&&value.audience.scope==="public"&&Object.keys(value.audience).length===1
    &&isEntityLabel(value.actor)&&Array.isArray(value.targets)&&value.targets.every(isEntityLabel)
    &&isResolution(value.resolution)&&value.resolution.id===value.resolutionId
    &&(value.action===undefined||isAction(value.action));
}
