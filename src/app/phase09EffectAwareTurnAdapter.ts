import "./phase09RealTurnRuntimeAdapter";
import type { ActivityEntry, AppSnapshot, SceneEntity, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { projectRuntimeEventsToActivity } from "./realActivityProjectionService";
import { advanceTurnRuntimeLifecycle } from "./realTurnLifecycleService";
import { projectTurnRuntimeToScene, synchronizeTurnRuntimeFromScene } from "./realTurnRuntimeService";
import { clearReadyActionConfiguration, readyActionConfigurationFor } from "./standardActionReadyState";
import { turnRuntimeSessions } from "./turnRuntimeSessionRegistry";

interface EffectAwareTurnAdapterState {
  sessionMode:SessionMode;
  scene:SceneVm;
  activity:ActivityEntry[];
  getSnapshot():Promise<AppSnapshot>;
}

const previousEndTurn=MockAdapter.prototype.endTurn;
const previousEndInitiative=MockAdapter.prototype.endInitiative;

const END_OF_TURN_STATUSES=["이탈"] as const;
const START_OF_TURN_STATUSES=["회피","준비 행동"] as const;

function clearStatuses(entity:SceneEntity|undefined,statuses:readonly string[]) {
  if (!entity) return [];
  const removed=statuses.filter((status)=>entity.status.includes(status));
  if (removed.length>0) entity.status=entity.status.filter((status)=>!removed.includes(status));
  return removed.map((status)=>`${entity.name} 상태 제거: ${status}`);
}

function readyExpiresAtTurnStart(adapter:MockAdapter,entity:SceneEntity|undefined) {
  const ready=readyActionConfigurationFor(adapter);
  return Boolean(ready&&entity&&ready.actorId===entity.id&&entity.status.includes("준비 행동"));
}

function eventId() {
  return `phase09.turn-lifecycle.${Date.now()}.${Math.floor(Math.random()*1000)}`;
}

MockAdapter.prototype.endTurn=async function endTurnThroughDomainLifecycle() {
  const internal=this as unknown as EffectAwareTurnAdapterState;
  const session=turnRuntimeSessions.get(this);
  if (internal.sessionMode!=="initiative" || !session) return previousEndTurn.call(this);

  const endingActor=internal.scene.entities.find((entity)=>entity.id===internal.scene.currentActorId);
  synchronizeTurnRuntimeFromScene(session,internal.scene);
  const advanced=advanceTurnRuntimeLifecycle(session);
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

  projectTurnRuntimeToScene(session,internal.scene);
  const next=internal.scene.entities.find((entity)=>entity.id===advanced.activeActorId);
  const readyExpires=readyExpiresAtTurnStart(this,next);
  const standardActionChanges=[
    ...clearStatuses(endingActor,END_OF_TURN_STATUSES),
    ...clearStatuses(next,START_OF_TURN_STATUSES),
  ];
  if (readyExpires) clearReadyActionConfiguration(this);
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
  return internal.getSnapshot();
};

MockAdapter.prototype.endInitiative=async function endInitiativeClearingStandardActionStatuses() {
  const internal=this as unknown as EffectAwareTurnAdapterState;
  const ready=readyActionConfigurationFor(this);
  const changes=internal.scene.entities.flatMap((entity)=>clearStatuses(entity,[...END_OF_TURN_STATUSES,...START_OF_TURN_STATUSES]));
  if (ready) clearReadyActionConfiguration(this);
  const snapshot=await previousEndInitiative.call(this);
  if (changes.length>0) {
    const entry=internal.activity[0];
    if (entry?.title==="이니셔티브 종료") entry.stateChanges.push(...changes);
  }
  return changes.length>0 ? internal.getSnapshot() : snapshot;
};
