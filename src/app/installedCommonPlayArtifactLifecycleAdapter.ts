import type { ActionVm, AppSnapshot, CharacterSheet, ResolutionView, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { requiredSessionInstalledContent } from "./installedContentRuntimeAdapter";
import { snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import { commitProductionRuntimeResolution } from "./runtimeResolutionCommit";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { parseCommonPlayDefinition, type CommonPlayDefinitionIR } from "../domain/commonPlayDefinitionRuntime";
import { commonPlayArtifactGrantedEntryPoints, resolveCommonPlayArtifactLifecycle } from "../domain/commonPlayArtifactLifecycleRuntime";

const PREFIX="artifact-lifecycle-common-play:";
const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
const previousResolveAction=MockAdapter.prototype.resolveAction;
const cp=<T,>(value:T):T=>structuredClone(value);

interface AdapterState {
  sessionMode:SessionMode;
  scene:SceneVm;
  activeCharacter:CharacterSheet;
  resolution:ResolutionView|null;
  getSnapshot():Promise<AppSnapshot>;
}

export function artifactLifecycleCommonPlayActionId(artifactId:string,entryPointId:string) {
  return `${PREFIX}${encodeURIComponent(artifactId)}#${encodeURIComponent(entryPointId)}`;
}

export function parseArtifactLifecycleCommonPlayActionId(actionId:string) {
  if(!actionId.startsWith(PREFIX)) return null;
  const parts=actionId.slice(PREFIX.length).split("#");
  if(parts.length!==2||parts.some((part)=>!part)) return null;
  try { return {artifactId:decodeURIComponent(parts[0]),entryPointId:decodeURIComponent(parts[1])}; }
  catch { return null; }
}

async function installedDefinition(adapter:MockAdapter,definitionId:string):Promise<CommonPlayDefinitionIR|undefined> {
  for(const entry of await requiredSessionInstalledContent(adapter,[])) {
    const mechanic=entry.mechanics?.find((candidate)=>candidate.kind==="common-play"&&candidate.config.id===definitionId);
    if(mechanic) return parseCommonPlayDefinition(mechanic.config);
  }
  return undefined;
}

function removeProjected(actions:ActionVm[]|undefined) {
  return (actions??[]).filter((action)=>!parseArtifactLifecycleCommonPlayActionId(action.id));
}

async function projectedActions(adapter:MockAdapter,snapshot:AppSnapshot) {
  const internal=adapter as unknown as AdapterState;
  const state=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene);
  if(!state) return snapshot;
  for(const [actorId,actions] of Object.entries(snapshot.scene.actionsByActor)) snapshot.scene.actionsByActor[actorId]=removeProjected(actions);
  for(const [actorId,actions] of Object.entries(internal.scene.actionsByActor)) internal.scene.actionsByActor[actorId]=removeProjected(actions);

  for(const artifact of state.artifacts??[]) {
    if((artifact.artifactKind!=="object"&&artifact.artifactKind!=="link")||!artifact.sourceActorId||!state.combatants[artifact.sourceActorId]) continue;
    if(snapshot.role!=="dm"&&snapshot.activeCharacter.id!==artifact.sourceActorId) continue;
    const definition=await installedDefinition(adapter,artifact.sourceId);
    if(!definition) continue;
    let entries;
    try { entries=commonPlayArtifactGrantedEntryPoints(state,definition,artifact.id); }
    catch { continue; }
    if(!entries.length) continue;
    const actorId=artifact.sourceActorId;
    const actorName=snapshot.scene.entities.find((entity)=>entity.id===actorId)?.name??actorId;
    const active=state.clock.activeActorId===actorId&&state.clock.phase!=="end";
    const additions:ActionVm[]=entries.map((entry)=>({
      id:artifactLifecycleCommonPlayActionId(artifact.id,entry.id),
      actorId,
      name:entry.id,
      category:"basic",
      target:"self",
      economy:"없음",
      resolutionKind:"no-roll",
      summary:`${artifact.templateId} · ${entry.id}`,
      available:active,
      disabledReason:active?undefined:"현재 턴 아님",
      eligibleTargetIds:[actorId],
      details:[
        {label:"Artifact",value:artifact.id,source:"Common Play artifact"},
        {label:"Source",value:`${definition.id} · ${actorName}`},
      ],
    }));
    snapshot.scene.actionsByActor[actorId]=[...removeProjected(snapshot.scene.actionsByActor[actorId]),...additions.map(cp)];
    internal.scene.actionsByActor[actorId]=[...removeProjected(internal.scene.actionsByActor[actorId]),...additions.map(cp)];
  }
  return snapshot;
}

MockAdapter.prototype.getSnapshot=async function getSnapshotWithArtifactLifecycleActions() {
  return projectedActions(this,await previousGetSnapshot.call(this));
};

MockAdapter.prototype.resolveAction=async function resolvePortableArtifactLifecycleAction(actionId:string,targetIds:string[]) {
  const reference=parseArtifactLifecycleCommonPlayActionId(actionId);
  if(!reference) return previousResolveAction.call(this,actionId,targetIds);
  const internal=this as unknown as AdapterState;
  const state=snapshotAdapterTurnRuntimeState(this,internal.scene);
  const artifact=state?.artifacts?.find((candidate)=>candidate.id===reference.artifactId&&(candidate.artifactKind==="object"||candidate.artifactKind==="link"));
  if(!state||!artifact?.sourceActorId||targetIds.length!==1||targetIds[0]!==artifact.sourceActorId||state.clock.activeActorId!==artifact.sourceActorId||state.clock.phase==="end") return internal.getSnapshot();
  const snapshot=await previousGetSnapshot.call(this);
  if(snapshot.role!=="dm"&&snapshot.activeCharacter.id!==artifact.sourceActorId) return internal.getSnapshot();
  const definition=await installedDefinition(this,artifact.sourceId);
  if(!definition) return internal.getSnapshot();
  let entries;
  try { entries=commonPlayArtifactGrantedEntryPoints(state,definition,artifact.id); }
  catch { return internal.getSnapshot(); }
  if(!entries.some((entry)=>entry.id===reference.entryPointId)) return internal.getSnapshot();
  const resolutionId=`common-play-artifact-lifecycle.${Date.now()}.${Math.floor(Math.random()*1000)}`;
  const committed=resolveCommonPlayArtifactLifecycle(SIMPLEVTT_APP_RULES_PROFILE,state,definition,{
    resolutionId,actorId:artifact.sourceActorId,artifactId:artifact.id,entryPointId:reference.entryPointId,
  });
  if(committed.status==="rejected") return internal.getSnapshot();
  const actorName=internal.scene.entities.find((entity)=>entity.id===artifact.sourceActorId)?.name??artifact.sourceActorId;
  const outcome=committed.events.map((event)=>event.summary).join(" · ")||"Artifact lifecycle applied";
  return commitProductionRuntimeResolution(this,state,committed,{
    resolutionId,
    actionId,
    actionName:reference.entryPointId,
    actorId:artifact.sourceActorId,
    targetIds:[artifact.sourceActorId],
    targetNames:[actorName],
    compact:outcome,
    detail:[`${definition.id} · ${artifact.templateId} · ${reference.entryPointId}`,...committed.events.map((event)=>event.summary)],
    provenance:["Common Play artifact granted entry point"],
    calculatedOutcome:outcome,
    finalOutcome:outcome,
  });
};
