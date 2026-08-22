import type { ActionVm, AppRole, AppSnapshot, CharacterSheet, ResolutionView, SceneEntity, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import {
  clearReadyActionConfiguration,
  readyActionConfigurationFor,
  readyActionConfigurationsFor,
  READY_MOVEMENT_ACTION_ID,
  setReadyActionConfiguration,
  type ReadyActionConfiguration,
} from "./standardActionReadyState";

type ReadyReactionState={
  role:AppRole;
  sessionMode:SessionMode;
  scene:SceneVm;
  activeCharacter:CharacterSheet;
  getSnapshot():Promise<AppSnapshot>;
  entity(id:string):SceneEntity|undefined;
  resolution:ResolutionView|null;
};

const READY_TRIGGER_ID="action.standard.ready.trigger";
const previousResolveAction=MockAdapter.prototype.resolveAction;
const previousAdvanceResolution=MockAdapter.prototype.advanceResolution;
const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
const pendingReadyResolution=new WeakMap<MockAdapter,{resolutionId:string;config:ReadyActionConfiguration;started:boolean}>();

declare module "./mockAdapter" {
  interface MockAdapter {
    configureReadyAction(command:ReadyActionConfiguration):Promise<AppSnapshot>;
  }
}

function actorAction(internal:ReadyReactionState,actorId:string,actionId:string) {
  return internal.scene.actionsByActor[actorId]?.find((action)=>action.id===actionId);
}

function contextualReadyConfiguration(adapter:MockAdapter,internal:ReadyReactionState) {
  const candidates=[internal.scene.selectedActorId,internal.scene.currentActorId,internal.activeCharacter?.id];
  for (const actorId of candidates) {
    if (!actorId) continue;
    const config=readyActionConfigurationFor(adapter,actorId);
    if (config) return config;
  }
  return readyActionConfigurationFor(adapter);
}

async function withActorActionPriority<T>(internal:ReadyReactionState,actorId:string,operation:()=>Promise<T>) {
  const actorActions=internal.scene.actionsByActor[actorId];
  if (!actorActions) return operation();
  const previous=internal.scene.actionsByActor;
  const prioritized:SceneVm["actionsByActor"]={ [actorId]:actorActions };
  for (const [id,actions] of Object.entries(previous)) {
    if (id!==actorId) prioritized[id]=actions;
  }
  internal.scene.actionsByActor=prioritized;
  try { return await operation(); }
  finally { internal.scene.actionsByActor=previous; }
}

function readyReactionAvailable(internal:ReadyReactionState,actorId:string) {
  const actor=internal.scene.entities.find((entity)=>entity.id===actorId&&entity.status.includes("준비 행동"));
  return Boolean(actor&&internal.scene.economyByActor[actor.id]?.reaction);
}

function readyTriggerAction(config:ReadyActionConfiguration,prepared:ActionVm|undefined,available:boolean):ActionVm {
  const movement=config.actionId===READY_MOVEMENT_ACTION_ID;
  const preparedName=movement?"이동":prepared?.name??"준비 행동";
  return {
    id:READY_TRIGGER_ID,
    actorId:config.actorId,
    name:`발동 · ${preparedName}`,
    category:"basic",
    target:movement?"self":prepared?.target??"self",
    economy:"반응",
    resolutionKind:"no-roll",
    summary:`${config.trigger} → ${preparedName}`,
    available,
    disabledReason:available?undefined:"반응을 사용할 수 없습니다.",
    eligibleTargetIds:movement?[config.actorId]:[...(prepared?.eligibleTargetIds??[])],
    details:[
      {label:"트리거",value:config.trigger,source:"Ready configuration"},
      {label:"준비 행동",value:preparedName,source:"Ready configuration"},
    ],
  };
}

function projectReadyTriggers(adapter:MockAdapter,internal:ReadyReactionState,snapshot:AppSnapshot) {
  for (const config of readyActionConfigurationsFor(adapter)) {
    const actor=snapshot.scene.entities.find((entity)=>entity.id===config.actorId);
    if (!actor?.status.includes("준비 행동")) continue;
    const actions=snapshot.scene.actionsByActor[config.actorId]??=[];
    const prepared=config.actionId===READY_MOVEMENT_ACTION_ID
      ? undefined
      : actions.find((action)=>action.id===config.actionId&&action.id!==READY_TRIGGER_ID);
    if (config.actionId!==READY_MOVEMENT_ACTION_ID&&!prepared) continue;
    const projected=readyTriggerAction(config,prepared,readyReactionAvailable(internal,config.actorId));
    const existing=actions.findIndex((action)=>action.id===READY_TRIGGER_ID);
    if (existing>=0) actions[existing]=projected;
    else actions.push(projected);
    snapshot.scene.actionsByActor[config.actorId]=actions;
  }
}

MockAdapter.prototype.configureReadyAction=async function configureReadyAction(command:ReadyActionConfiguration) {
  const internal=this as unknown as ReadyReactionState;
  const prepared=actorAction(internal,command.actorId,command.actionId);
  const movement=command.actionId===READY_MOVEMENT_ACTION_ID;
  if ((!movement&&(!prepared||prepared.actorId!==command.actorId||prepared.id.startsWith("action.standard.ready")))||!internal.entity(command.actorId)) return internal.getSnapshot();
  setReadyActionConfiguration(this,{...command,trigger:command.trigger.trim()||"DM이 선언한 트리거"});
  return withActorActionPriority(internal,command.actorId,()=>this.resolveAction("action.standard.ready",[command.actorId]));
};

MockAdapter.prototype.getSnapshot=async function getSnapshotWithReadyReactionAvailability() {
  const snapshot=await previousGetSnapshot.call(this);
  const internal=this as unknown as ReadyReactionState;
  projectReadyTriggers(this,internal,snapshot);
  return snapshot;
};

MockAdapter.prototype.resolveAction=async function resolveReadyActionAsReaction(actionId:string,targetIds:string[]) {
  if (actionId!==READY_TRIGGER_ID) return previousResolveAction.call(this,actionId,targetIds);
  const internal=this as unknown as ReadyReactionState;
  const config=contextualReadyConfiguration(this,internal);
  if (!config) return internal.getSnapshot();
  const trigger=actorAction(internal,config.actorId,READY_TRIGGER_ID);
  const prepared=config.actionId===READY_MOVEMENT_ACTION_ID
    ? trigger
    : actorAction(internal,config.actorId,config.actionId);
  if (!trigger||!prepared||!readyReactionAvailable(internal,config.actorId)) return internal.getSnapshot();

  // The core player-turn gate normally rejects every off-turn action. A prepared
  // action is the explicit exception: it is manually triggered and spends Reaction.
  const previousRole=internal.role;
  if (internal.sessionMode==="initiative"&&previousRole==="player") internal.role="dm";
  try {
    const previousEconomy=prepared.economy;
    prepared.economy="반응";
    try {
      await withActorActionPriority(internal,config.actorId,()=>previousResolveAction.call(
        this,
        prepared.id,
        config.actionId===READY_MOVEMENT_ACTION_ID?[config.actorId]:targetIds,
      ));
    }
    finally { prepared.economy=previousEconomy; }
  } finally {
    internal.role=previousRole;
  }
  if (internal.resolution) pendingReadyResolution.set(this,{resolutionId:internal.resolution.id,config,started:false});
  return internal.getSnapshot();
};

MockAdapter.prototype.advanceResolution=async function advancePreparedActionAsReaction() {
  const internal=this as unknown as ReadyReactionState;
  const pending=pendingReadyResolution.get(this);
  if (!pending||internal.resolution?.id!==pending.resolutionId) return previousAdvanceResolution.call(this);
  const prepared=pending.config.actionId===READY_MOVEMENT_ACTION_ID
    ? actorAction(internal,pending.config.actorId,READY_TRIGGER_ID)
    : actorAction(internal,pending.config.actorId,pending.config.actionId);
  if (!prepared) return previousAdvanceResolution.call(this);
  const previousEconomy=prepared.economy;
  prepared.economy="반응";
  const actor=internal.entity(pending.config.actorId);
  if (!pending.started&&actor?.status.includes("준비 행동")) {
    actor.status=actor.status.filter((status)=>status!=="준비 행동");
    internal.resolution.stateChanges.push(`${actor.name} 상태 제거: 준비 행동 · ${pending.config.trigger} 발생`);
    if (pending.config.actionId===READY_MOVEMENT_ACTION_ID) {
      internal.resolution.stateChanges.push(`${actor.name} 이동 실행 선언 · 전투맵 모듈 미연결 시 위치 변화 없음`);
      internal.resolution.finalOutcome="준비한 이동을 반응으로 선언";
      internal.resolution.compact=internal.resolution.finalOutcome;
    }
    pending.started=true;
    clearReadyActionConfiguration(this,pending.config.actorId);
  }
  try {
    const snapshot=await withActorActionPriority(internal,pending.config.actorId,()=>previousAdvanceResolution.call(this));
    if (snapshot.resolution?.stage==="complete") pendingReadyResolution.delete(this);
    return snapshot;
  }
  finally {
    prepared.economy=previousEconomy;
  }
};
