import "./phase09RealTurnRuntimeAdapter";
import type { ActivityEntry, AppSnapshot, SceneEntity, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { projectRuntimeEventsToActivity } from "./realActivityProjectionService";
import { advanceTurnRuntimeLifecycle } from "./realTurnLifecycleService";
import { projectTurnRuntimeToScene, synchronizeTurnRuntimeFromScene } from "./realTurnRuntimeService";
import { recordRuntimeResolutionEvents } from "./runtimeResolutionEventHistory";
import { clearReadyActionConfiguration, readyActionConfigurationFor, readyActionConfigurationsFor } from "./standardActionReadyState";
import { turnRuntimeSessions } from "./turnRuntimeSessionRegistry";
import { compileInstalledCommonPlayZoneTurnOperations, installedCommonPlayZoneDefinitions } from "./commonPlayZoneTurnComposition";
import { compileInstalledCommonPlayActorTurnRuleOperations, installedCommonPlayActorTurnRuleBindings } from "./commonPlayActorTurnRuleComposition";
import type { ResolutionEvent } from "../domain/resolutionTypes";

interface EffectAwareTurnAdapterState {
  sessionMode:SessionMode;
  scene:SceneVm;
  activity:ActivityEntry[];
  lastResolutionId:string|null;
  lastBefore:unknown;
  getSnapshot():Promise<AppSnapshot>;
  d20(actionId:string,index?:number):number;
}

export interface AdapterTurnLifecycleUndo {
  resolutionId:string;
  activityId:string;
  events:ResolutionEvent[];
}

const previousEndTurn=MockAdapter.prototype.endTurn;
const previousEndInitiative=MockAdapter.prototype.endInitiative;
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

function authoritativeRechargeFace(adapter:MockAdapter,actionId:string,sides:number,drawIndex:{value:number}) {
  const internal=adapter as unknown as EffectAwareTurnAdapterState;
  const limit=20-(20%sides);
  let face:number;
  do face=internal.d20(actionId,drawIndex.value++); while(face>limit);
  return ((face-1)%sides)+1;
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
  const actorTurnRules=await installedCommonPlayActorTurnRuleBindings(this,session.state);
  const rechargeDrawIndex={value:0};
  const advanced=advanceTurnRuntimeLifecycle(session,(boundary)=>[
    ...compileInstalledCommonPlayZoneTurnOperations(
      boundary.state,zoneDefinitions,{
        id:boundary.resolutionId,kind:boundary.kind==="turn-start"?"zone.turn-start":"zone.turn-end",actorId:boundary.actorId,
        subjectCreatureKind:internal.scene.entities.find((entity)=>entity.id===boundary.actorId)?.kind==="character"?"character":"monster",
      },
    ),
    ...compileInstalledCommonPlayActorTurnRuleOperations(boundary.state,actorTurnRules,{
      id:boundary.resolutionId,kind:boundary.kind,actorId:boundary.actorId,
      rechargeDieFace:(_ruleId,_operationIndex,sides)=>authoritativeRechargeFace(this,`${boundary.resolutionId}:recharge`,sides,rechargeDrawIndex),
    }),
  ]);
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
    id:advanced.resolutionId,
    actorName:"시스템",
    title:"턴 종료",
    summary:`→ ${next?.name ?? advanced.activeActorId}`,
    events:advanced.events,
  });
  activity.detail.push(`RulesRuntimeState revision ${session.state.revision}`);
  activity.stateChanges.push(...standardActionChanges);
  internal.activity.unshift(activity);
  recordRuntimeResolutionEvents(this,advanced.resolutionId,advanced.events);
  internal.lastResolutionId=advanced.resolutionId;
  internal.lastBefore=null;
  turnLifecycleUndo.set(this,{
    resolutionId:advanced.resolutionId,
    activityId:activity.id,
    events:advanced.events.map((event)=>structuredClone(event)),
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