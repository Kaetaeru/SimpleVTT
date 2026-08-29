import "./phase09RealTurnRuntimeAdapter";
import type { ActivityEntry, AppSnapshot, SceneEntity, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { projectRuntimeEventsToActivity } from "./realActivityProjectionService";
import { advanceTurnRuntimeLifecycle } from "./realTurnLifecycleService";
import { applyResolutionEvents } from "./realEventApplyService";
import { projectTurnRuntimeToScene, synchronizeTurnRuntimeFromScene } from "./realTurnRuntimeService";
import { clearReadyActionConfiguration, readyActionConfigurationFor, readyActionConfigurationsFor } from "./standardActionReadyState";
import { turnRuntimeSessions } from "./turnRuntimeSessionRegistry";
import { compileInstalledCommonPlayZoneTurnOperations, installedCommonPlayZoneDefinitions } from "./commonPlayZoneTurnComposition";
import { inverseResolutionEvents } from "./resolutionEventUndo";
import type { ResolutionEvent } from "../domain/resolutionTypes";

interface EffectAwareTurnAdapterState {
  sessionMode:SessionMode;
  scene:SceneVm;
  activity:ActivityEntry[];
  getSnapshot():Promise<AppSnapshot>;
}

export interface AdapterTurnLifecycleUndo {
  resolutionId:string;
  activityId:string;
  events:ResolutionEvent[];
}

const previousEndTurn=MockAdapter.prototype.endTurn;
const previousEndInitiative=MockAdapter.prototype.endInitiative;
const previousUndoLastResolution=MockAdapter.prototype.undoLastResolution;
const turnLifecycleEvents=new WeakMap<MockAdapter,ResolutionEvent[]>();
const turnLifecycleUndo=new WeakMap<MockAdapter,AdapterTurnLifecycleUndo>();

const END_OF_TURN_STATUSES=["이탈"] as const;
const START_OF_TURN_STATUSES=["회피","준비 행동"] as const;

function clearStatuses(entity:SceneEntity|undefined,statuses:readonly string[]) {
  if (!entity) return [];
  const removed=statuses.filter((status)=>entity.status.includes(status));
  if (removed.length>0) entity.status=entity.status.filter((status)=>!removed.includes(status));
  return removed.map((status)=>`${entity.name} 상태 제거: ${status}`);
}

function readyExpiresAtTurnStart(adapter:MockAdapter,entity:SceneEntity|undefined) {
  if (!entity) return false;
  const ready=readyActionConfigurationFor(adapter,entity.id);
  return Boolean(ready&&entity.status.includes("준비 행동"));
}

function eventId() {
  return `phase09.turn-lifecycle.${Date.now()}.${Math.floor(Math.random()*1000)}`;
}

export function consumeAdapterTurnLifecycleEvents(adapter:MockAdapter) {
  const events=turnLifecycleEvents.get(adapter)??[];
  turnLifecycleEvents.delete(adapter);
  return events.map((event)=>structuredClone(event));
}

export function peekAdapterTurnLifecycleUndo(adapter:MockAdapter):AdapterTurnLifecycleUndo|undefined {
  const undo=turnLifecycleUndo.get(adapter);
  return undo?structuredClone(undo):undefined;
}

MockAdapter.prototype.endTurn=async function endTurnThroughDomainLifecycle() {
  const internal=this as unknown as EffectAwareTurnAdapterState;
  const session=turnRuntimeSessions.get(this);
  turnLifecycleEvents.delete(this);
  if (internal.sessionMode!=="initiative" || !session) return previousEndTurn.call(this);

  const endingActor=internal.scene.entities.find((entity)=>entity.id===internal.scene.currentActorId);
  synchronizeTurnRuntimeFromScene(session,internal.scene);
  const zoneDefinitions=await installedCommonPlayZoneDefinitions(this,session.state);
  const advanced=advanceTurnRuntimeLifecycle(session,(boundary)=>compileInstalledCommonPlayZoneTurnOperations(
    boundary.state,zoneDefinitions,{
      id:boundary.resolutionId,kind:boundary.kind==="turn-start"?"zone.turn-start":"zone.turn-end",actorId:boundary.actorId,
      subjectCreatureKind:internal.scene.entities.find((entity)=>entity.id===boundary.actorId)?.kind==="character"?"character":"monster",
    },
  ));
  if (advanced.status==="rejected") {
    internal.activity.unshift({
      id:eventId(),
      time:"지금",
      actor:"시스템",
      title:"턴 종료 거부",
      summary:advanced.error,
      detail:["Domain end-turn / begin-turn lifecycle transaction rejected"],
      stateChanges:[],
      correction:true,
    });
    return internal.getSnapshot();
  }

  turnLifecycleEvents.set(this,advanced.events.map((event)=>structuredClone(event)));
  projectTurnRuntimeToScene(session,internal.scene);
  const next=internal.scene.entities.find((entity)=>entity.id===advanced.activeActorId);
  const readyExpires=readyExpiresAtTurnStart(this,next);
  const standardActionChanges=[
    ...clearStatuses(endingActor,END_OF_TURN_STATUSES),
    ...clearStatuses(next,START_OF_TURN_STATUSES),
  ];
  if (readyExpires&&next) clearReadyActionConfiguration(this,next.id);
  const activity=projectRuntimeEventsToActivity({
    id:eventId(),
    actorName:"시스템",
    title:"턴 종료",
    summary:`→ ${next?.name ?? advanced.activeActorId}`,
    events:advanced.events,
  });
  activity.detail.push(`RulesRuntimeState revision ${session.state.revision}`);
  activity.stateChanges.push(...standardActionChanges);
  internal.activity.unshift(activity);
  turnLifecycleUndo.set(this,{
    resolutionId:advanced.resolutionId,
    activityId:activity.id,
    events:advanced.events.map((event)=>structuredClone(event)),
  });
  return internal.getSnapshot();
};

MockAdapter.prototype.undoLastResolution=async function undoTurnLifecycleResolution() {
  const internal=this as unknown as EffectAwareTurnAdapterState;
  const session=turnRuntimeSessions.get(this);
  const undo=turnLifecycleUndo.get(this);
  if (!session||!undo||internal.activity[0]?.id!==undo.activityId) return previousUndoLastResolution.call(this);

  const inverse=inverseResolutionEvents(undo.events,`undo.${undo.resolutionId}.local`);
  const applied=applyResolutionEvents(internal.scene,inverse,[],[],session.state);
  if (applied.status==="rejected"||!applied.runtimeState) {
    internal.activity.unshift({
      id:eventId(),time:"지금",actor:"시스템",title:"Resolution 되돌림 거부",summary:undo.resolutionId,
      detail:[applied.status==="rejected"?applied.error:"turn lifecycle Undo did not return runtime state"],stateChanges:[],correction:true,
    });
    return internal.getSnapshot();
  }

  session.state=applied.runtimeState;
  internal.scene=applied.scene;
  projectTurnRuntimeToScene(session,internal.scene);
  turnLifecycleUndo.delete(this);
  internal.activity.unshift({
    id:eventId(),time:"지금",actor:"시스템",title:"Resolution 되돌림",summary:undo.resolutionId,
    detail:["Authoritative turn lifecycle ResolutionEvents 역적용"],stateChanges:applied.stateChanges,correction:true,undoOf:undo.resolutionId,
  });
  return internal.getSnapshot();
};

MockAdapter.prototype.endInitiative=async function endInitiativeClearingStandardActionStatuses() {
  const internal=this as unknown as EffectAwareTurnAdapterState;
  turnLifecycleUndo.delete(this);
  const hadReady=readyActionConfigurationsFor(this).length>0;
  const changes=internal.scene.entities.flatMap((entity)=>clearStatuses(entity,[...END_OF_TURN_STATUSES,...START_OF_TURN_STATUSES]));
  if (hadReady) clearReadyActionConfiguration(this);
  const snapshot=await previousEndInitiative.call(this);
  if (changes.length>0) {
    const entry=internal.activity[0];
    if (entry?.title==="이니셔티브 종료") entry.stateChanges.push(...changes);
  }
  return changes.length>0 ? internal.getSnapshot() : snapshot;
};