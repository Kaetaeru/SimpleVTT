import "./phase09RealTurnRuntimeAdapter";
import type { ActivityEntry, AppSnapshot, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { projectRuntimeEventsToActivity } from "./realActivityProjectionService";
import { advanceTurnRuntimeLifecycle } from "./realTurnLifecycleService";
import { projectTurnRuntimeToScene, synchronizeTurnRuntimeFromScene } from "./realTurnRuntimeService";
import { turnRuntimeSessions } from "./turnRuntimeSessionRegistry";

interface EffectAwareTurnAdapterState {
  sessionMode:SessionMode;
  scene:SceneVm;
  activity:ActivityEntry[];
  getSnapshot():Promise<AppSnapshot>;
}

const previousEndTurn=MockAdapter.prototype.endTurn;

function eventId() {
  return `phase09.turn-lifecycle.${Date.now()}.${Math.floor(Math.random()*1000)}`;
}

MockAdapter.prototype.endTurn=async function endTurnThroughDomainLifecycle() {
  const internal=this as unknown as EffectAwareTurnAdapterState;
  const session=turnRuntimeSessions.get(this);
  if (internal.sessionMode!=="initiative" || !session) return previousEndTurn.call(this);

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
  const activity=projectRuntimeEventsToActivity({
    id:eventId(),
    actorName:"시스템",
    title:"턴 종료",
    summary:`→ ${next?.name ?? advanced.activeActorId}`,
    events:advanced.events,
  });
  activity.detail.push(`RulesRuntimeState revision ${session.state.revision}`);
  internal.activity.unshift(activity);
  return internal.getSnapshot();
};
