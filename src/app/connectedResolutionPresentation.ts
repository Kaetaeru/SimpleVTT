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

export interface ConnectedResolutionDicePresentationV1 {
  faces:number[];
  selectedIndices:number[];
  discardedIndices:number[];
  selection:"all"|"highest"|"lowest"|"explicit"|"unknown";
  total?:number;
  modifier?:number;
}

export interface ConnectedResolutionTimelineEntryV1 {
  key:"roll"|"result"|"interrupt-wait"|"damage"|"effect"|"complete";
  label:string;
  terminal:boolean;
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
  dice:ConnectedResolutionDicePresentationV1;
  timeline:ConnectedResolutionTimelineEntryV1[];
  activityLink:{resolutionId:string};
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

function dicePresentation(resolution:ResolutionView,action:ActionVm|undefined):ConnectedResolutionDicePresentationV1 {
  const faces=[...resolution.authoritativeDice];
  const total=resolution.attackTotal??resolution.rollTotal;
  const baseModifier=resolution.rollKind==="attack"?action?.attackBonus:resolution.rollKind==="check"?action?.checkBonus:undefined;
  const expectedNatural=total!==undefined&&baseModifier!==undefined?total-baseModifier:undefined;
  const text=[resolution.finalOutcome,...resolution.detail,...resolution.provenance].join(" ").toLowerCase();
  const selection=text.includes("불리")||text.includes("disadvantage")?"lowest"
    :text.includes("유리")||text.includes("advantage")?"highest"
    :faces.length<=1?"all"
    :expectedNatural!==undefined&&faces.includes(expectedNatural)?"explicit"
    :"unknown";
  let selectedIndices:number[];
  if(selection==="highest"){
    const selected=Math.max(...faces);
    selectedIndices=[faces.indexOf(selected)];
  }else if(selection==="lowest"){
    const selected=Math.min(...faces);
    selectedIndices=[faces.indexOf(selected)];
  }else if(selection==="explicit"){
    selectedIndices=[faces.indexOf(expectedNatural!)];
  }else if(selection==="all"){
    selectedIndices=faces.map((_,index)=>index);
  }else selectedIndices=[];
  const selectedSet=new Set(selectedIndices);
  return {
    faces,
    selectedIndices,
    discardedIndices:selection==="unknown"?[]:faces.map((_,index)=>index).filter((index)=>!selectedSet.has(index)),
    selection,
    total,
    modifier:total!==undefined&&selectedIndices.length===1?total-faces[selectedIndices[0]]:baseModifier,
  };
}

function timelineEntry(resolution:ResolutionView):ConnectedResolutionTimelineEntryV1 {
  if(resolution.stage==="roll-animation"||resolution.stage==="save-animation") return {key:"roll",label:resolution.rollKind==="save"?"내성 굴림":"판정 굴림",terminal:false};
  if(resolution.stage==="attack-result"||resolution.stage==="save-result") return {key:"result",label:resolution.finalOutcome,terminal:false};
  if(resolution.stage==="interrupt") return {key:"interrupt-wait",label:"응답 대기",terminal:false};
  if(resolution.stage==="damage-animation") return {key:"damage",label:"피해 굴림",terminal:false};
  if(resolution.stage==="effect-preview") return {key:"effect",label:resolution.finalOutcome,terminal:false};
  return {key:"complete",label:resolution.finalOutcome,terminal:true};
}

export function buildConnectedResolutionPresentation(
  snapshot:AppSnapshot,
  presentationSequence:number,
  delivery:"live"|"catchup"="live",
  previousTimeline:ConnectedResolutionTimelineEntryV1[]=[],
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
  if(resolution.stage==="interrupt"){
    publicResolution.compact="비공개 반응 응답 대기";
    publicResolution.detail=[];
    publicResolution.provenance=[];
    publicResolution.calculatedOutcome="응답 대기";
    publicResolution.finalOutcome="응답 대기";
    publicResolution.stateChanges=[];
  }
  if(resolution.stage==="save-animation"&&resolution.concentrationSave?.natural===undefined){
    publicResolution.concentrationSave=undefined;
    publicResolution.compact="비공개 집중 내성 입력 대기";
    publicResolution.detail=[];
    publicResolution.provenance=[];
    publicResolution.calculatedOutcome="응답 대기";
    publicResolution.finalOutcome="응답 대기";
    publicResolution.stateChanges=[];
  }
  const currentTimeline=timelineEntry(resolution);
  const last=previousTimeline.at(-1);
  const timeline=last?.key===currentTimeline.key&&last.label===currentTimeline.label
    ? previousTimeline.map((entry)=>({...entry}))
    :[...previousTimeline.map((entry)=>({...entry})),currentTimeline];
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
    dice:dicePresentation(resolution,action),
    timeline,
    activityLink:{resolutionId:resolution.id},
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

function isDice(value:unknown) {
  if(!isRecord(value)||!Array.isArray(value.faces)||!value.faces.every((face)=>Number.isInteger(face))) return false;
  const faces=value.faces;
  if(!Array.isArray(value.selectedIndices)||!value.selectedIndices.every((index)=>Number.isInteger(index)&&index>=0&&index<faces.length)) return false;
  if(!Array.isArray(value.discardedIndices)||!value.discardedIndices.every((index)=>Number.isInteger(index)&&index>=0&&index<faces.length)) return false;
  if(!["all","highest","lowest","explicit","unknown"].includes(String(value.selection))) return false;
  if(!isOptionalNumber(value.total)||!isOptionalNumber(value.modifier)) return false;
  const selected=new Set(value.selectedIndices as number[]);
  const discarded=new Set(value.discardedIndices as number[]);
  return selected.size===value.selectedIndices.length&&discarded.size===value.discardedIndices.length
    &&[...selected].every((index)=>!discarded.has(index));
}

function isTimeline(value:unknown) {
  return Array.isArray(value)&&value.length>0&&value.every((entry)=>isRecord(entry)
    &&["roll","result","interrupt-wait","damage","effect","complete"].includes(String(entry.key))
    &&typeof entry.label==="string"&&typeof entry.terminal==="boolean"
    &&Object.keys(entry).every((key)=>key==="key"||key==="label"||key==="terminal"));
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
  const valid=value.schemaId===CONNECTED_RESOLUTION_PRESENTATION_SCHEMA_ID
    &&value.schemaVersion===CONNECTED_RESOLUTION_PRESENTATION_SCHEMA_VERSION
    &&isString(value.resolutionId)&&Number.isInteger(value.presentationSequence)&&Number(value.presentationSequence)>=0
    &&(value.delivery==="live"||value.delivery==="catchup")
    &&isRecord(value.audience)&&value.audience.scope==="public"&&Object.keys(value.audience).length===1
    &&isEntityLabel(value.actor)&&Array.isArray(value.targets)&&value.targets.every(isEntityLabel)
    &&isResolution(value.resolution)&&value.resolution.id===value.resolutionId
    &&(value.action===undefined||isAction(value.action))
    &&isDice(value.dice)&&isTimeline(value.timeline)
    &&isRecord(value.activityLink)&&value.activityLink.resolutionId===value.resolutionId
    &&Object.keys(value.activityLink).length===1;
  if(!valid) return false;
  const presentation=value as unknown as ConnectedResolutionPresentationV1;
  return presentation.actor.id===presentation.resolution.actorId
    &&presentation.targets.map((entry)=>entry.id).join("\u0000")===presentation.resolution.targetIds.join("\u0000")
    &&presentation.dice.faces.join("\u0000")===presentation.resolution.authoritativeDice.join("\u0000")
    &&(presentation.action===undefined||(presentation.action.id===presentation.resolution.actionId&&presentation.action.actorId===presentation.resolution.actorId))
    &&presentation.timeline.slice(0,-1).every((entry)=>!entry.terminal)
    &&presentation.timeline.at(-1)!.terminal===(presentation.resolution.stage==="complete");
}
