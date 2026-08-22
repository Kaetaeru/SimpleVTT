import type { ActionVm, AppRole, AppSnapshot, ResolutionView, SceneEntity, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { clearReadyActionConfiguration, readyActionConfigurationFor, setReadyActionConfiguration, type ReadyActionConfiguration } from "./standardActionReadyState";

type ReadyReactionState={
  role:AppRole;
  sessionMode:SessionMode;
  scene:SceneVm;
  getSnapshot():Promise<AppSnapshot>;
  action(id:string):ActionVm|undefined;
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

MockAdapter.prototype.configureReadyAction=async function configureReadyAction(command:ReadyActionConfiguration) {
  const internal=this as unknown as ReadyReactionState;
  const prepared=internal.action(command.actionId);
  if (!prepared||prepared.actorId!==command.actorId||prepared.id.startsWith("action.standard.ready")) return internal.getSnapshot();
  setReadyActionConfiguration(this,{...command,trigger:command.trigger.trim()||"DM이 선언한 트리거"});
  return this.resolveAction("action.standard.ready",[command.actorId]);
};

function readyReactionAvailable(internal:ReadyReactionState,actorId:string) {
  const actor=internal.scene.entities.find((entity)=>entity.id===actorId&&entity.status.includes("준비 행동"));
  return Boolean(actor&&internal.scene.economyByActor[actor.id]?.reaction);
}

MockAdapter.prototype.getSnapshot=async function getSnapshotWithReadyReactionAvailability() {
  const snapshot=await previousGetSnapshot.call(this);
  const internal=this as unknown as ReadyReactionState;
  for (const actions of Object.values(snapshot.scene.actionsByActor)) {
    const trigger=actions.find((action)=>action.id===READY_TRIGGER_ID);
    if (trigger&&readyReactionAvailable(internal,trigger.actorId)) {
      trigger.available=true;
      trigger.disabledReason=undefined;
    }
  }
  return snapshot;
};

MockAdapter.prototype.resolveAction=async function resolveReadyActionAsReaction(actionId:string,targetIds:string[]) {
  if (actionId!==READY_TRIGGER_ID) return previousResolveAction.call(this,actionId,targetIds);
  const internal=this as unknown as ReadyReactionState;
  const trigger=Object.values(internal.scene.actionsByActor).flat().find((action)=>action.id===READY_TRIGGER_ID);
  const config=readyActionConfigurationFor(this);
  const prepared=config?internal.action(config.actionId):undefined;
  if (!trigger||!config||!prepared||!readyReactionAvailable(internal,trigger.actorId)) return internal.getSnapshot();

  // The core player-turn gate normally rejects every off-turn action. A prepared
  // action is the explicit exception: it is manually triggered and spends Reaction.
  const previousRole=internal.role;
  if (internal.sessionMode==="initiative"&&previousRole==="player") internal.role="dm";
  try {
    const previousEconomy=prepared.economy;
    prepared.economy="반응";
    try { await previousResolveAction.call(this,prepared.id,targetIds); }
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
  const prepared=internal.action(pending.config.actionId);
  if (!prepared) return previousAdvanceResolution.call(this);
  const previousEconomy=prepared.economy;
  prepared.economy="반응";
  const actor=internal.entity(pending.config.actorId);
  if (!pending.started&&actor?.status.includes("준비 행동")) {
    actor.status=actor.status.filter((status)=>status!=="준비 행동");
    internal.resolution.stateChanges.push(`${actor.name} 상태 제거: 준비 행동 · ${pending.config.trigger} 발생`);
    pending.started=true;
    clearReadyActionConfiguration(this);
  }
  try {
    const snapshot=await previousAdvanceResolution.call(this);
    if (snapshot.resolution?.stage==="complete") pendingReadyResolution.delete(this);
    return snapshot;
  }
  finally {
    prepared.economy=previousEconomy;
  }
};
