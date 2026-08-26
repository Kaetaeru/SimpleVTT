import "./phase09CombatantDefinitionRuntimeAdapter";
import type { ActivityEntry, AppSnapshot, ResolutionView, SceneVm, SessionMode } from "./contracts";
import type { MovementModuleCommand, MovementModuleHost } from "./movementRuntimeContracts";
import { MockAdapter } from "./mockAdapter";
import { applyMovementSpatialPlan, prepareMovementSpatialUpdates } from "./realSpatialRuntimeService";
import {
  addTurnRuntimeCombatant,
  advanceTurnRuntimeSession,
  createTurnRuntimeSession,
  projectTurnRuntimeToScene,
  resolveTurnRuntimeMovement,
  resolveTurnRuntimeReaction,
  setTurnRuntimeActiveActor,
  synchronizeTurnRuntimeFromScene,
} from "./realTurnRuntimeService";
import { turnRuntimeSessions } from "./turnRuntimeSessionRegistry";
import type { ResolutionEvent } from "../domain/resolutionTypes";

interface Phase09TurnAdapterState {
  sessionMode:SessionMode;
  scene:SceneVm;
  resolution:ResolutionView|null;
  activity:ActivityEntry[];
  getSnapshot():Promise<AppSnapshot>;
}

interface InterruptEventHistory {
  resolutionId:string;
  events:ResolutionEvent[];
}

const sessions=turnRuntimeSessions;
const suppressProjection=new WeakSet<MockAdapter>();
const interruptEvents=new WeakMap<MockAdapter,InterruptEventHistory>();
const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
const previousAdvanceResolution=MockAdapter.prototype.advanceResolution;
const previousRespondToInterrupt=MockAdapter.prototype.respondToInterrupt;
const previousSetCurrentActor=MockAdapter.prototype.setCurrentActor;
const previousLoadReferenceScenario=MockAdapter.prototype.loadReferenceScenario;
const previousInstantiateCombatant=MockAdapter.prototype.instantiateCombatant;

function eventId(kind:string) {
  return `phase09.${kind}.${Date.now()}.${Math.floor(Math.random()*1000)}`;
}

function project(adapter:MockAdapter,internal:Phase09TurnAdapterState) {
  const session=sessions.get(adapter);
  if (session) projectTurnRuntimeToScene(session,internal.scene);
}

function syncFromScene(adapter:MockAdapter,internal:Phase09TurnAdapterState) {
  const session=sessions.get(adapter);
  if (!session) return false;
  const changed=synchronizeTurnRuntimeFromScene(session,internal.scene);
  projectTurnRuntimeToScene(session,internal.scene);
  return changed;
}

function movementRejected(internal:Phase09TurnAdapterState,moduleId:string,actorId:string,error:string) {
  internal.activity.unshift({
    id:eventId("movement-module-rejected"),
    time:"지금",
    actor:internal.scene.entities.find((entity)=>entity.id===actorId)?.name ?? actorId,
    title:"이동 모듈 적용 거부",
    summary:error,
    detail:[`Movement module ${moduleId} · turn runtime/spatial transaction not committed`],
    stateChanges:[],
    correction:true,
  });
}

export function synchronizeAdapterTurnRuntime(adapter:MockAdapter) {
  return syncFromScene(adapter,adapter as unknown as Phase09TurnAdapterState);
}

export function projectAdapterTurnRuntime(adapter:MockAdapter) {
  project(adapter,adapter as unknown as Phase09TurnAdapterState);
}

export function consumeAdapterInterruptEvents(adapter:MockAdapter,resolutionId:string) {
  const history=interruptEvents.get(adapter);
  if (!history||history.resolutionId!==resolutionId) return [];
  interruptEvents.delete(adapter);
  return history.events.map((event)=>structuredClone(event));
}

export function appendAdapterInterruptEvents(adapter:MockAdapter,resolutionId:string,events:ResolutionEvent[]) {
  const current=interruptEvents.get(adapter);
  interruptEvents.set(adapter,{
    resolutionId,
    events:[...(current?.resolutionId===resolutionId?current.events:[]),...events].map((event)=>structuredClone(event)),
  });
}

/**
 * Optional movement-module host hook.
 * Core SimpleVTT never calls this function by itself and exposes no moveActor
 * method on SimpleVttAdapter. A map module owns coordinates/pathing and invokes
 * this hook only after it has produced the complete authoritative spatial set.
 */
export async function applyMovementModuleCommand(adapter:MockAdapter,command:MovementModuleCommand):Promise<AppSnapshot> {
  const internal=adapter as unknown as Phase09TurnAdapterState;
  const session=sessions.get(adapter);
  if (!session||internal.sessionMode!=="initiative") {
    movementRejected(internal,command.moduleId,command.actorId,"movement module requires an active initiative turn runtime");
    return adapter.getSnapshot();
  }

  let spatialPlan;
  try {
    spatialPlan=prepareMovementSpatialUpdates(internal.scene,command.actorId,command.spatialUpdates,command.moduleId);
  } catch(error) {
    movementRejected(internal,command.moduleId,command.actorId,error instanceof Error ? error.message : String(error));
    return adapter.getSnapshot();
  }

  const beforeMovement=internal.scene.economyByActor[command.actorId]?.movement;
  const movement=resolveTurnRuntimeMovement(session,{
    resolutionId:eventId("movement-module"),
    actorId:command.actorId,
    distanceFeet:command.distanceFeet,
    destinationMovesCloserToVisibleFrighteningSource:command.destinationMovesCloserToVisibleFrighteningSource,
    visibleSourceIds:command.visibleSourceIds,
  });
  if (movement.status==="rejected") {
    movementRejected(internal,command.moduleId,command.actorId,movement.error);
    return adapter.getSnapshot();
  }

  projectTurnRuntimeToScene(session,internal.scene);
  applyMovementSpatialPlan(internal.scene,spatialPlan);
  const actor=internal.scene.entities.find((entity)=>entity.id===command.actorId);
  const afterMovement=movement.economy.movement;
  internal.activity.unshift({
    id:eventId("movement-module-commit"),
    time:"지금",
    actor:actor?.name ?? actorId,
    title:"이동 모듈 적용",
    summary:`${command.distanceFeet}피트 이동`,
    detail:[
      `Movement module: ${command.moduleId}`,
      ...movement.events.flatMap((event,index)=>[
        `ResolutionEvent ${index+1}/${movement.events.length} · ${event.kind} · ${event.operationId}`,
        event.summary,
        ...event.provenance.map((entry)=>`출처: ${entry.source} · ${entry.status} · ${entry.reason}`),
      ]),
      ...spatialPlan.provenance.map((entry)=>`출처: ${entry}`),
    ],
    stateChanges:[
      ...(beforeMovement===undefined ? [] : [`${command.actorId} movement ${beforeMovement} → ${afterMovement}`]),
      ...spatialPlan.stateChanges,
    ],
  });
  return adapter.getSnapshot();
}

export function createMovementModuleHost(adapter:MockAdapter):MovementModuleHost {
  return { apply:(command)=>applyMovementModuleCommand(adapter,command) };
}

MockAdapter.prototype.getSnapshot=async function getSnapshotFromTurnRuntime() {
  const internal=this as unknown as Phase09TurnAdapterState;
  if (!suppressProjection.has(this)) syncFromScene(this,internal);
  return previousGetSnapshot.call(this);
};

MockAdapter.prototype.startInitiative=async function startInitiativeWithTurnRuntime() {
  const internal=this as unknown as Phase09TurnAdapterState;
  internal.sessionMode="initiative";
  interruptEvents.delete(this);
  const previousSession=sessions.get(this);
  const session=createTurnRuntimeSession(internal.scene);
  if (previousSession) {
    session.state.clock.elapsedSeconds=previousSession.state.clock.elapsedSeconds;
    session.state.effects=previousSession.state.effects
      .filter((effect)=>effect.expiry.kind!=="instant"&&effect.expiry.kind!=="turn-boundary")
      .map((effect)=>structuredClone(effect));
    session.state.concentration=structuredClone(previousSession.state.concentration);
  }
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
  interruptEvents.delete(this);
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

MockAdapter.prototype.respondToInterrupt=async function respondToInterruptWithTurnRuntime(accept:boolean) {
  const internal=this as unknown as Phase09TurnAdapterState;
  const session=sessions.get(this);
  const resolution=internal.resolution;
  const interrupt=resolution?.interrupt;
  if (!session||!resolution||!interrupt) return previousRespondToInterrupt.call(this,accept);

  if (!accept) {
    interruptEvents.delete(this);
    resolution.detail.push(`${interrupt.responderName} 반응 넘김`);
    resolution.interrupt=undefined;
    resolution.stage="attack-result";
    resolution.canAdvance=true;
    resolution.nextLabel=resolution.attackOutcome==="명중" ? "피해 굴림" : "판정 적용";
    return this.getSnapshot();
  }

  const reactor=internal.scene.entities.find((entity)=>entity.id===interrupt.responderId);
  const option=reactor?.reactions.find((entry)=>entry.id===interrupt.id);
  if (!reactor||!option) {
    resolution.detail.push(`Reaction runtime 거부: responder/option missing (${interrupt.responderId}/${interrupt.id})`);
    resolution.finalOutcome="Reaction 적용 거부";
    return this.getSnapshot();
  }

  const committed=resolveTurnRuntimeReaction(session,{
    resolutionId:resolution.id,
    reactorId:reactor.id,
    trigger:interrupt.trigger,
    option:{ id:option.id,source:option.source },
  });
  if (committed.status==="rejected") {
    resolution.detail.push(`Reaction runtime 거부: ${committed.error}`);
    resolution.finalOutcome=`Reaction 적용 거부: ${committed.error}`;
    return this.getSnapshot();
  }

  projectTurnRuntimeToScene(session,internal.scene);
  const bonus=option.acBonus ?? 0;
  const beforeAc=resolution.targetAc ?? reactor.ac;
  resolution.targetAc=beforeAc+bonus;
  resolution.attackOutcome=(resolution.attackTotal ?? 0)>=resolution.targetAc ? "명중" : "빗나감";
  resolution.finalOutcome=resolution.attackOutcome;
  resolution.compact=`${resolution.attackTotal} vs AC ${resolution.targetAc} — ${resolution.attackOutcome} · ${interrupt.optionName}`;
  resolution.detail.push(`${interrupt.responderName} ${interrupt.optionName}: AC ${beforeAc} → ${resolution.targetAc}`);
  resolution.detail.push(`RulesRuntimeState reaction commit · revision ${session.state.revision}`);
  resolution.stateChanges.push(`${reactor.name} 반응 사용`);
  resolution.provenance.push(...committed.events.flatMap((event)=>event.provenance.map((entry)=>`${entry.source} · ${entry.status} · ${entry.reason}`)));
  appendAdapterInterruptEvents(this,resolution.id,committed.events);
  resolution.interrupt=undefined;
  resolution.stage="attack-result";
  resolution.canAdvance=true;
  resolution.nextLabel=resolution.attackOutcome==="명중" ? "피해 굴림" : "판정 적용";
  return this.getSnapshot();
};

MockAdapter.prototype.instantiateCombatant=async function instantiateCombatantIntoTurnRuntime(definitionId:string) {
  const internal=this as unknown as Phase09TurnAdapterState;
  const beforeIds=new Set(internal.scene.entities.map((entity)=>entity.id));
  suppressProjection.add(this);
  try {
    await previousInstantiateCombatant.call(this,definitionId);
  } finally {
    suppressProjection.delete(this);
  }
  const added=internal.scene.entities.find((entity)=>!beforeIds.has(entity.id));
  const session=sessions.get(this);
  if (added && session && addTurnRuntimeCombatant(session,internal.scene,added.id)) {
    projectTurnRuntimeToScene(session,internal.scene);
    const activity=internal.activity.find((entry)=>entry.title==="컴배턴트 인스턴스 추가" && entry.summary===added.name);
    if (activity) {
      activity.detail.push(`RulesRuntimeState combatant materialized · revision ${session.state.revision}`);
      activity.stateChanges.push(`Runtime combatant ${added.id} 추가`);
    }
  }
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
  interruptEvents.delete(this);
  if (internal.sessionMode==="initiative") {
    const session=createTurnRuntimeSession(internal.scene);
    sessions.set(this,session);
    projectTurnRuntimeToScene(session,internal.scene);
  }
  return this.getSnapshot();
};
