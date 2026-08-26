import "./rogueCoreRuntimeAdapter";
import type { ActivityEntry, AppSnapshot, CharacterSheet, ResolutionView, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { projectResolutionEventsToActivity } from "./realActivityProjectionService";
import { projectTurnRuntimeToScene } from "./realTurnRuntimeService";
import { recordRuntimeResolutionEvents } from "./runtimeResolutionEventHistory";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState, turnRuntimeSessions } from "./turnRuntimeSessionRegistry";
import { resolvePendingResolution } from "../domain/resolution";
import { CUNNING_DISENGAGE_ACTION_ID, ROGUE_CLASS_ID } from "./rogueCoreRuntimeAdapter";

type AdapterState={
  sessionMode:SessionMode;
  scene:SceneVm;
  activeCharacter:CharacterSheet;
  resolution:ResolutionView|null;
  activity:ActivityEntry[];
  lastResolutionId:string|null;
  lastBefore:unknown;
  getSnapshot():Promise<AppSnapshot>;
};

const previousResolveAction=MockAdapter.prototype.resolveAction;

function rogueLevel(character:CharacterSheet) {
  return character.classLevels?.find((entry)=>entry.classId===ROGUE_CLASS_ID)?.level??0;
}

MockAdapter.prototype.resolveAction=async function resolveEventNativeCunningDisengage(actionId:string,targetIds:string[]){
  if(actionId!==CUNNING_DISENGAGE_ACTION_ID)return previousResolveAction.call(this,actionId,targetIds);
  const internal=this as unknown as AdapterState;
  if(internal.sessionMode!=="initiative")return previousResolveAction.call(this,actionId,targetIds);
  const snapshot=await internal.getSnapshot();
  const actor=internal.activeCharacter;
  if(rogueLevel(actor)<2||targetIds.length!==1||targetIds[0]!==actor.id)return snapshot;
  const state=snapshotAdapterTurnRuntimeState(this,internal.scene);
  const session=turnRuntimeSessions.get(this);
  if(!state||!session||state.clock.activeActorId!==actor.id||!state.combatants[actor.id])return snapshot;

  const resolutionId=`rogue.cunning-disengage.${Date.now()}.${Math.floor(Math.random()*1000)}`;
  const committed=resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,state,{
    id:resolutionId,
    actorId:actor.id,
    sourceId:CUNNING_DISENGAGE_ACTION_ID,
    expectedRevision:state.revision,
    operations:[
      {
        id:`${resolutionId}:bonus-action`,
        kind:"use-economy",
        actorId:actor.id,
        slot:"bonus-action",
        bonusActionGranted:true,
        actionKind:"other",
      },
      {
        id:`${resolutionId}:effect`,
        kind:"apply-effect",
        effect:{
          id:`${resolutionId}:disengage`,
          sourceId:CUNNING_DISENGAGE_ACTION_ID,
          sourceActorId:actor.id,
          targetId:actor.id,
          kind:"marker",
          tags:["rogue:cunning-action:disengage","opportunity-attack:no-provoke"],
          duration:{kind:"until-turn-boundary",actorId:actor.id,round:state.clock.round,boundary:"end"},
          metadata:{publicLabel:"이탈"},
        },
      },
    ],
  });
  if(committed.status==="rejected")return snapshot;
  if(!commitAdapterTurnRuntimeState(this,internal.scene,state.revision,committed.state))return snapshot;
  projectTurnRuntimeToScene(session,internal.scene);

  const resolution:ResolutionView={
    id:resolutionId,
    actorId:actor.id,
    targetIds:[actor.id],
    actionId:CUNNING_DISENGAGE_ACTION_ID,
    actionName:"교활한 행동 · 이탈",
    rollKind:"effect",
    stage:"complete",
    authoritativeDice:[],
    saveResults:[],
    damageComponents:[],
    compact:"이탈 적용",
    detail:["이번 턴 이동 중 기회 공격을 유발하지 않음"],
    provenance:["SRD 5.2.1 · Rogue · Cunning Action"],
    calculatedOutcome:"이탈 적용",
    finalOutcome:"이탈 적용",
    stateChanges:committed.events.flatMap((event)=>event.stateChanges.map((change)=>change.kind==="effect"?`${actor.name} 상태 추가: 이탈`:`${actor.name} 추가 행동 사용`)),
    adjudicated:false,
    canAdvance:false,
  };
  internal.resolution=resolution;
  internal.activity.unshift(projectResolutionEventsToActivity({
    resolution,
    events:committed.events,
    actorName:actor.name,
    targetNames:[actor.name],
  }));
  internal.lastResolutionId=resolutionId;
  internal.lastBefore=null;
  recordRuntimeResolutionEvents(this,resolutionId,committed.events);
  return internal.getSnapshot();
};
