import type { ActivityEntry, AppSnapshot, CharacterSheet, ResolutionView, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { applyResolutionEvents } from "./realEventApplyService";
import { projectResolutionEventsToActivity } from "./realActivityProjectionService";
import { recordRuntimeResolutionEvents } from "./runtimeResolutionEventHistory";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import { persistCharacterResolutionEvents } from "./resolutionCharacterWriteBackPort";
import { requiredSessionInstalledContent } from "./installedContentRuntimeAdapter";
import { catalogQualifiedId } from "./contentCatalogIdentity";
import { ACTIVE_RULES_PROFILE_RUNTIME } from "./activeRulesProfileRuntime";
import { resolveCommonPlayEntryPointOperations } from "../domain/commonPlayOperationRuntime";

interface AdapterState {
  sessionMode:SessionMode;
  scene:SceneVm;
  activeCharacter:CharacterSheet;
  resolution:ResolutionView|null;
  activity:ActivityEntry[];
  lastResolutionId:string|null;
  lastBefore:unknown;
  syncChar():void;
  getSnapshot():Promise<AppSnapshot>;
}

const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
const previousResolveAction=MockAdapter.prototype.resolveAction;

function syncCharacterResourcesFromRuntime(adapter:MockAdapter,internal:AdapterState) {
  const state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  const combatant=state?.combatants[internal.activeCharacter.id];
  if (!combatant) return;
  for (const characterResource of internal.activeCharacter.resources) {
    const runtimeResource=combatant.resources.find((resource)=>resource.id===characterResource.id);
    if (runtimeResource) characterResource.current=runtimeResource.current;
  }
}

function seedCharacterResources(adapter:MockAdapter,internal:AdapterState) {
  const state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  const combatant=state?.combatants[internal.activeCharacter.id];
  if (!state || !combatant) return undefined;
  const missing=internal.activeCharacter.resources.filter((resource)=>!combatant.resources.some((entry)=>entry.id===resource.id));
  if (!missing.length) return state;
  for (const resource of missing) combatant.resources.push({
    id:resource.id,
    label:resource.label,
    current:resource.current,
    maximum:resource.max,
    recovery:resource.recovery ? structuredClone(resource.recovery) : undefined,
  });
  const expected=state.revision;
  state.revision+=1;
  return commitAdapterTurnRuntimeState(adapter,internal.scene,expected,state)
    ? snapshotAdapterTurnRuntimeState(adapter,internal.scene)
    : undefined;
}

async function installedAction(adapter:MockAdapter,actionId:string) {
  const entries=await requiredSessionInstalledContent(adapter,[]);
  const entry=entries.find((candidate)=>catalogQualifiedId(candidate.contentId,candidate.sourceId,candidate.version)===actionId);
  const mechanic=entry?.mechanics?.[0];
  return entry && mechanic?.kind==="common-play" ? {entry,mechanic} : undefined;
}

MockAdapter.prototype.getSnapshot=async function getSnapshotWithInstalledCommonPlay() {
  const internal=this as unknown as AdapterState;
  syncCharacterResourcesFromRuntime(this,internal);
  return previousGetSnapshot.call(this);
};

MockAdapter.prototype.resolveAction=async function resolveInstalledCommonPlayAction(actionId:string,targetIds:string[]) {
  const selected=await installedAction(this,actionId);
  if (!selected) return previousResolveAction.call(this,actionId,targetIds);

  const internal=this as unknown as AdapterState;
  const actor=internal.activeCharacter;
  const state=internal.sessionMode==="initiative" ? seedCharacterResources(this,internal) : undefined;
  if (!state || state.clock.activeActorId!==actor.id || targetIds.length!==1 || targetIds[0]!==actor.id) return internal.getSnapshot();

  const definition=selected.mechanic.config;
  const entryPoint=definition.entryPoints[0];
  const resolutionId=`common-play.${Date.now()}.${Math.floor(Math.random()*1000)}`;
  const committed=resolveCommonPlayEntryPointOperations(ACTIVE_RULES_PROFILE_RUNTIME,state,definition,{
    resolutionId,
    actorId:actor.id,
    entryPointId:entryPoint.id,
  });
  if (committed.status==="rejected") return internal.getSnapshot();

  const projected=applyResolutionEvents(internal.scene,committed.events,actor.resources);
  if (projected.status==="rejected") return internal.getSnapshot();
  const writeBack=await persistCharacterResolutionEvents(this,committed.events,"forward");
  if (writeBack.status==="rejected") return internal.getSnapshot();
  if (!commitAdapterTurnRuntimeState(this,internal.scene,state.revision,committed.state)) {
    if (writeBack.changed) await persistCharacterResolutionEvents(this,committed.events,"inverse");
    return internal.getSnapshot();
  }

  internal.scene=projected.scene;
  internal.activeCharacter.resources=projected.resources;
  const actionName=selected.entry.nameKo || selected.entry.nameEn || selected.entry.contentId;
  const resolution:ResolutionView={
    id:resolutionId,
    actorId:actor.id,
    targetIds:[actor.id],
    actionId,
    actionName,
    rollKind:"effect",
    stage:"complete",
    authoritativeDice:[],
    saveResults:[],
    damageComponents:[],
    compact:`${actionName} 효과 적용`,
    detail:["설치된 Common Play 규칙 효과가 적용되었습니다."],
    provenance:[`${selected.entry.source} · ${selected.entry.contentId}`],
    calculatedOutcome:"규칙 효과 적용",
    finalOutcome:"규칙 효과 적용",
    stateChanges:projected.stateChanges,
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
  syncCharacterResourcesFromRuntime(this,internal);
  internal.syncChar();
  return internal.getSnapshot();
};
