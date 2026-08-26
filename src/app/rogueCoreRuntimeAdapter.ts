import "./progressionContracts";
import type { ActionVm, ActivityEntry, AppSnapshot, CharacterSheet, ResolutionView, SceneEntity, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { clearRuntimeResolutionEventHistory } from "./runtimeResolutionEventHistory";

export const ROGUE_CLASS_ID="dnd.srd521.class.rogue";
export const CUNNING_DASH_ACTION_ID="action.rogue.cunning-action.dash";
export const CUNNING_DISENGAGE_ACTION_ID="action.rogue.cunning-action.disengage";
export const CUNNING_HIDE_ACTION_ID="action.rogue.cunning-action.hide";
export const UNCANNY_DODGE_REACTION_ID="reaction.rogue.uncanny-dodge";

const ROGUE_ACTION_IDS=new Set([CUNNING_DASH_ACTION_ID,CUNNING_DISENGAGE_ACTION_ID,CUNNING_HIDE_ACTION_ID]);

type AdapterState={
  sessionMode:SessionMode;
  scene:SceneVm;
  activeCharacter:CharacterSheet;
  activity:ActivityEntry[];
  resolution:ResolutionView|null;
  lastResolutionId:string|null;
  _undoPreviewArmed?:boolean;
  getSnapshot():Promise<AppSnapshot>;
};

const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
const previousAdvanceResolution=MockAdapter.prototype.advanceResolution;
const previousRespondToInterrupt=MockAdapter.prototype.respondToInterrupt;
const previousUndoLastResolution=MockAdapter.prototype.undoLastResolution;
const uncannyResolutionIds=new WeakMap<MockAdapter,string>();
const rogueUndoResolutionIds=new WeakMap<MockAdapter,string>();

function rogueLevel(character:CharacterSheet) {
  return character.classLevels?.find((entry)=>entry.classId===ROGUE_CLASS_ID)?.level??0;
}

function sourceAction(scene:SceneVm,actorId:string,id:string) {
  return scene.actionsByActor[actorId]?.find((entry)=>entry.id===id);
}

function cunningAction(source:ActionVm|undefined,id:string,name:string):ActionVm|undefined {
  if(!source)return undefined;
  return {
    ...structuredClone(source),
    id,
    name,
    economy:"추가 행동",
    details:[
      ...source.details.filter((entry)=>entry.label!=="비용"),
      {label:"비용",value:"추가 행동 1"},
      {label:"출처",value:"SRD 5.2.1 · Rogue · Cunning Action"},
    ],
  };
}

function skillBonus(character:CharacterSheet,label:string) {
  const value=character.skills.find((entry)=>entry.startsWith(label));
  return Number(value?.match(/([+-]\d+)$/)?.[1]??0);
}

function cunningDisengageAction(character:CharacterSheet):ActionVm {
  return {
    id:CUNNING_DISENGAGE_ACTION_ID,
    actorId:character.id,
    name:"교활한 행동 · 이탈",
    category:"basic",
    target:"self",
    economy:"추가 행동",
    resolutionKind:"no-roll",
    summary:"이동 중 기회 공격을 유발하지 않음",
    available:true,
    eligibleTargetIds:[],
    details:[
      {label:"대상",value:"자신"},
      {label:"효과",value:"이번 턴 이동 중 기회 공격을 유발하지 않음"},
      {label:"비용",value:"추가 행동 1"},
      {label:"출처",value:"SRD 5.2.1 · Rogue · Cunning Action"},
    ],
  };
}

function cunningHideAction(character:CharacterSheet):ActionVm {
  const bonus=skillBonus(character,"은신");
  const signed=bonus>=0?`+${bonus}`:String(bonus);
  return {
    id:CUNNING_HIDE_ACTION_ID,
    actorId:character.id,
    name:"교활한 행동 · 숨기",
    category:"basic",
    target:"none",
    economy:"추가 행동",
    resolutionKind:"ability-check",
    summary:`민첩(은신) ${signed}`,
    available:true,
    eligibleTargetIds:[],
    checkBonus:bonus,
    details:[
      {label:"판정",value:"민첩(은신)"},
      {label:"보너스",value:signed},
      {label:"비용",value:"추가 행동 1"},
      {label:"출처",value:"SRD 5.2.1 · Rogue · Cunning Action"},
    ],
  };
}

function rogueActions(snapshot:AppSnapshot):ActionVm[] {
  const character=snapshot.activeCharacter;
  if(rogueLevel(character)<2)return [];
  const scene=snapshot.scene;
  return [
    cunningAction(sourceAction(scene,character.id,"action.dash"),CUNNING_DASH_ACTION_ID,"교활한 행동 · 질주"),
    cunningDisengageAction(character),
    cunningHideAction(character),
  ].filter((entry):entry is ActionVm=>Boolean(entry));
}

function projectActions(scene:SceneVm,actorId:string,actions:ActionVm[]) {
  const current=(scene.actionsByActor[actorId]??[]).filter((entry)=>!ROGUE_ACTION_IDS.has(entry.id));
  scene.actionsByActor[actorId]=[...current,...actions.map((entry)=>structuredClone(entry))];
}

function projectUncannyDodge(scene:SceneVm,character:CharacterSheet) {
  const entity=scene.entities.find((entry)=>entry.id===character.id);
  if(!entity)return;
  entity.reactions=entity.reactions.filter((entry)=>entry.id!==UNCANNY_DODGE_REACTION_ID);
  if(rogueLevel(character)<5)return;
  entity.reactions.push({
    id:UNCANNY_DODGE_REACTION_ID,
    name:"기묘한 회피",
    trigger:"볼 수 있는 공격자에게 공격이 명중할 때",
    cost:"반응 1",
    effect:"이번 공격 피해 절반",
    source:"SRD 5.2.1 · Rogue · Uncanny Dodge",
  });
}

MockAdapter.prototype.getSnapshot=async function getSnapshotWithRogueCoreActions(){
  const internal=this as unknown as AdapterState;
  const snapshot=await previousGetSnapshot.call(this);
  const actorId=snapshot.activeCharacter.id;
  const actions=rogueActions(snapshot);
  projectActions(internal.scene,actorId,actions);
  projectActions(snapshot.scene,actorId,actions);
  projectUncannyDodge(internal.scene,internal.activeCharacter);
  projectUncannyDodge(snapshot.scene,snapshot.activeCharacter);
  return snapshot;
};

function addStatus(entity:SceneEntity|undefined,status:string,resolution:ResolutionView) {
  if(!entity||entity.status.includes(status))return;
  entity.status.push(status);
  resolution.stateChanges.push(`${entity.name} 상태 추가: ${status}`);
}

function markSnapshotUndo(adapter:MockAdapter,resolutionId:string) {
  clearRuntimeResolutionEventHistory(adapter);
  rogueUndoResolutionIds.set(adapter,resolutionId);
}

function projectUncannyDodgeActivity(internal:AdapterState,resolution:ResolutionView) {
  const detail=resolution.detail.find((entry)=>entry.startsWith("기묘한 회피:"));
  const activity=internal.activity.find((entry)=>entry.id===resolution.id);
  if(detail&&activity&&!activity.detail.includes(detail))activity.detail.push(detail);
}

MockAdapter.prototype.respondToInterrupt=async function respondToRogueUncannyDodge(accept:boolean){
  const internal=this as unknown as AdapterState;
  const resolution=internal.resolution;
  const accepted=Boolean(accept&&resolution?.interrupt?.id===UNCANNY_DODGE_REACTION_ID);
  const resolutionId=accepted?resolution!.id:undefined;
  const snapshot=await previousRespondToInterrupt.call(this,accept);
  if(resolutionId)uncannyResolutionIds.set(this,resolutionId);
  return snapshot;
};

MockAdapter.prototype.advanceResolution=async function advanceRogueCoreResolution(){
  const internal=this as unknown as AdapterState;
  const resolution=internal.resolution;
  if(!resolution)return previousAdvanceResolution.call(this);

  if(resolution.stage==="effect-preview"&&ROGUE_ACTION_IDS.has(resolution.actionId)) {
    const actor=internal.scene.entities.find((entry)=>entry.id===resolution.actorId);
    const economy=internal.scene.economyByActor[resolution.actorId];
    if(resolution.actionId===CUNNING_DASH_ACTION_ID&&economy) {
      const before=economy.movementMax;
      economy.movementMax+=internal.activeCharacter.speed;
      economy.movement+=internal.activeCharacter.speed;
      resolution.stateChanges.push(`이동 가능량 ${before} → ${economy.movementMax}`);
      resolution.finalOutcome="질주 적용";
    } else if(resolution.actionId===CUNNING_DISENGAGE_ACTION_ID) {
      addStatus(actor,"이탈",resolution);
      resolution.finalOutcome="이탈 적용";
    }
  }

  const uncanny=uncannyResolutionIds.get(this)===resolution.id&&(resolution.stage==="attack-result"||resolution.stage==="damage-animation");
  const action=uncanny
    ? Object.values(internal.scene.actionsByActor).flat().find((entry)=>entry.id===resolution.actionId)
    : undefined;
  const damage=action?.damage?.[0];
  const originalAverage=damage?.average;
  if(uncanny&&damage&&originalAverage!==undefined) {
    const multiplier=resolution.critical?2:1;
    const raw=originalAverage*multiplier;
    const reduced=Math.floor(raw/2);
    damage.average=reduced/multiplier;
    const detail=`기묘한 회피: 피해 ${raw} → ${reduced}`;
    if(!resolution.detail.includes(detail))resolution.detail.push(detail);
  }

  try {
    const snapshot=await previousAdvanceResolution.call(this);
    if(snapshot.resolution?.id===resolution.id&&snapshot.resolution.stage==="complete") {
      const uncannyComplete=uncannyResolutionIds.get(this)===resolution.id;
      if(ROGUE_ACTION_IDS.has(resolution.actionId)||uncannyComplete) {
        if(uncannyComplete)projectUncannyDodgeActivity(internal,resolution);
        markSnapshotUndo(this,resolution.id);
        uncannyResolutionIds.delete(this);
      }
    }
    return originalAverage!==undefined?internal.getSnapshot():snapshot;
  } finally {
    if(damage&&originalAverage!==undefined)damage.average=originalAverage;
  }
};

MockAdapter.prototype.undoLastResolution=async function undoRogueCoreResolution(){
  const internal=this as unknown as AdapterState;
  const resolutionId=rogueUndoResolutionIds.get(this);
  rogueUndoResolutionIds.delete(this);
  if(resolutionId&&internal.lastResolutionId===resolutionId)internal._undoPreviewArmed=true;
  return previousUndoLastResolution.call(this);
};
