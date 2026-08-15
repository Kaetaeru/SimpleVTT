import "./phase09RealNoRollDamageAdapter";
import type { ActivityEntry, AppSnapshot, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import {
  advanceTurnRuntimeSession,
  createTurnRuntimeSession,
  projectTurnRuntimeToScene,
  setTurnRuntimeActiveActor,
  synchronizeTurnRuntimeFromScene,
  type TurnRuntimeSession,
} from "./realTurnRuntimeService";

interface Phase09TurnAdapterState {
  sessionMode:SessionMode;
  scene:SceneVm;
  activity:ActivityEntry[];
  getSnapshot():Promise<AppSnapshot>;
}

const sessions=new WeakMap<MockAdapter,TurnRuntimeSession>();
const suppressProjection=new WeakSet<MockAdapter>();
const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
const previousAdvanceResolution=MockAdapter.prototype.advanceResolution;
const previousRespondToInterrupt=MockAdapter.prototype.respondToInterrupt;
const previousSetCurrentActor=MockAdapter.prototype.setCurrentActor;
const previousLoadReferenceScenario=MockAdapter.prototype.loadReferenceScenario;

function eventId(kind:string) {
  return `phase09.${kind}.${Date.now()}.${Math.floor(Math.random()*1000)}`;
}

function project(adapter:MockAdapter,internal:Phase09TurnAdapterState) {
  const session=sessions.get(adapter);
  if (session) projectTurnRuntimeToScene(session,internal.scene);
}

function syncFromScene(adapter:MockAdapter,internal:Phase09TurnAdapterState) {
  const session=sessions.get(adapter);
  if (!session) return;
  synchronizeTurnRuntimeFromScene(session,internal.scene);
  projectTurnRuntimeToScene(session,internal.scene);
}

MockAdapter.prototype.getSnapshot=async function getSnapshotFromTurnRuntime() {
  const internal=this as unknown as Phase09TurnAdapterState;
  if (!suppressProjection.has(this)) project(this,internal);
  return previousGetSnapshot.call(this);
};

MockAdapter.prototype.startInitiative=async function startInitiativeWithTurnRuntime() {
  const internal=this as unknown as Phase09TurnAdapterState;
  internal.sessionMode="initiative";
  const session=createTurnRuntimeSession(internal.scene);
  sessions.set(this,session);
  projectTurnRuntimeToScene(session,internal.scene);
  const current=internal.scene.entities.find((entity)=>entity.id===internal.scene.currentActorId);
  internal.activity.unshift({
    id:eventId("initiative-start"),
    time:"지금",
    actor:"DM",
    title:"이니셔티브 시작",
    summary:"1라운드",
    detail:[`RulesRuntimeState revision ${session.state.revision}`],
    stateChanges:[`Current Actor = ${current?.name ?? internal.scene.currentActorId}`],
  });
  return this.getSnapshot();
};

MockAdapter.prototype.endInitiative=async function endInitiativeWithTurnRuntime() {
  const internal=this as unknown as Phase09TurnAdapterState;
  sessions.delete(this);
  internal.sessionMode="freeform";
  internal.activity.unshift({
    id:eventId("initiative-end"),
    time:"지금",
    actor:"DM",
    title:"이니셔티브 종료",
    summary:"자유 진행으로 전환",
    detail:["Phase 09 turn runtime session released"],
    stateChanges:["Turn-bound economy 숨김"],
  });
  return this.getSnapshot();
};

MockAdapter.prototype.endTurn=async function endTurnWithTurnRuntime() {
  const internal=this as unknown as Phase09TurnAdapterState;
  if (internal.sessionMode!=="initiative") return this.getSnapshot();
  const session=sessions.get(this) ?? createTurnRuntimeSession(internal.scene);
  sessions.set(this,session);
  synchronizeTurnRuntimeFromScene(session,internal.scene);
  advanceTurnRuntimeSession(session);
  projectTurnRuntimeToScene(session,internal.scene);
  const next=internal.scene.entities.find((entity)=>entity.id===internal.scene.currentActorId);
  internal.activity.unshift({
    id:eventId("turn-end"),
    time:"지금",
    actor:"시스템",
    title:"턴 종료",
    summary:`→ ${next?.name ?? internal.scene.currentActorId}`,
    detail:[`RulesRuntimeState revision ${session.state.revision}`],
    stateChanges:[`Current Actor = ${internal.scene.currentActorId}`],
  });
  return this.getSnapshot();
};

MockAdapter.prototype.setSessionMode=async function setSessionModeWithTurnRuntime(mode:SessionMode) {
  if (mode==="initiative") return this.startInitiative();
  return this.endInitiative();
};

MockAdapter.prototype.setCurrentActor=async function setCurrentActorWithTurnRuntime(id:string) {
  const internal=this as unknown as Phase09TurnAdapterState;
  const session=sessions.get(this);
  if (!session) return previousSetCurrentActor.call(this,id);
  if (setTurnRuntimeActiveActor(session,id)) projectTurnRuntimeToScene(session,internal.scene);
  return this.getSnapshot();
};

MockAdapter.prototype.advanceResolution=async function advanceResolutionWithTurnRuntimeSync() {
  const internal=this as unknown as Phase09TurnAdapterState;
  suppressProjection.add(this);
  try {
    await previousAdvanceResolution.call(this);
  } finally {
    suppressProjection.delete(this);
  }
  syncFromScene(this,internal);
  return this.getSnapshot();
};

MockAdapter.prototype.respondToInterrupt=async function respondToInterruptWithTurnRuntimeSync(accept:boolean) {
  const internal=this as unknown as Phase09TurnAdapterState;
  suppressProjection.add(this);
  try {
    await previousRespondToInterrupt.call(this,accept);
  } finally {
    suppressProjection.delete(this);
  }
  syncFromScene(this,internal);
  return this.getSnapshot();
};

MockAdapter.prototype.loadReferenceScenario=async function loadReferenceScenarioWithTurnRuntime(
  id:"attack"|"critical"|"reaction"|"multi-save"|"typed-damage",
) {
  const internal=this as unknown as Phase09TurnAdapterState;
  suppressProjection.add(this);
  try {
    await previousLoadReferenceScenario.call(this,id);
  } finally {
    suppressProjection.delete(this);
  }
  if (internal.sessionMode==="initiative") {
    const session=createTurnRuntimeSession(internal.scene);
    sessions.set(this,session);
    projectTurnRuntimeToScene(session,internal.scene);
  }
  return this.getSnapshot();
};
