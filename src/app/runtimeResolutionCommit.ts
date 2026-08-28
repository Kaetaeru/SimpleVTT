import type { ActivityEntry, AppSnapshot, CharacterSheet, ResolutionView, SceneVm } from "./contracts";
import type { RulesRuntimeState } from "../domain/combatState";
import type { ResolutionCommit } from "../domain/resolutionTypes";
import { MockAdapter } from "./mockAdapter";
import { applyResolutionEvents } from "./realEventApplyService";
import { projectResolutionEventsToActivity } from "./realActivityProjectionService";
import { recordRuntimeResolutionEvents } from "./runtimeResolutionEventHistory";
import { commitAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import { persistCharacterResolutionEvents } from "./resolutionCharacterWriteBackPort";

interface AdapterState {
  scene:SceneVm;
  activeCharacter:CharacterSheet;
  resolution:ResolutionView|null;
  activity:ActivityEntry[];
  lastResolutionId:string|null;
  lastBefore:unknown;
  syncChar():void;
  getSnapshot():Promise<AppSnapshot>;
}

export interface RuntimeResolutionPresentation {
  resolutionId:string;
  actionId:string;
  actionName:string;
  actorId:string;
  targetIds:string[];
  targetNames:string[];
  compact:string;
  detail:string[];
  provenance:string[];
  calculatedOutcome:string;
  finalOutcome:string;
}

export async function commitProductionRuntimeResolution(
  adapter:MockAdapter,
  state:RulesRuntimeState,
  committed:ResolutionCommit,
  presentation:RuntimeResolutionPresentation,
):Promise<AppSnapshot> {
  const internal=adapter as unknown as AdapterState;
  if (committed.status==="rejected") return internal.getSnapshot();

  const projected=applyResolutionEvents(internal.scene,committed.events,internal.activeCharacter.resources);
  if (projected.status==="rejected") return internal.getSnapshot();
  const writeBack=await persistCharacterResolutionEvents(adapter,committed.events,"forward");
  if (writeBack.status==="rejected") return internal.getSnapshot();
  if (!commitAdapterTurnRuntimeState(adapter,internal.scene,state.revision,committed.state)) {
    if (writeBack.changed) await persistCharacterResolutionEvents(adapter,committed.events,"inverse");
    return internal.getSnapshot();
  }

  internal.scene=projected.scene;
  internal.activeCharacter.resources=projected.resources;
  const resolution:ResolutionView={
    id:presentation.resolutionId,
    actorId:presentation.actorId,
    targetIds:presentation.targetIds,
    actionId:presentation.actionId,
    actionName:presentation.actionName,
    rollKind:"effect",
    stage:"complete",
    authoritativeDice:[],
    saveResults:[],
    damageComponents:[],
    compact:presentation.compact,
    detail:presentation.detail,
    provenance:presentation.provenance,
    calculatedOutcome:presentation.calculatedOutcome,
    finalOutcome:presentation.finalOutcome,
    stateChanges:projected.stateChanges,
    adjudicated:false,
    canAdvance:false,
  };
  internal.resolution=resolution;
  internal.activity.unshift(projectResolutionEventsToActivity({
    resolution,
    events:committed.events,
    actorName:internal.activeCharacter.name,
    targetNames:presentation.targetNames,
  }));
  internal.lastResolutionId=presentation.resolutionId;
  internal.lastBefore=null;
  recordRuntimeResolutionEvents(adapter,presentation.resolutionId,committed.events);
  internal.syncChar();
  return internal.getSnapshot();
}
