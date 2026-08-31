import type { AppSnapshot, CharacterSheet, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { catalogQualifiedId } from "./contentCatalogIdentity";
import { parseInstalledCommonPlayActionId, parseZoneMembershipCommonPlayActionId } from "./installedCommonPlayActionReference";
import { requiredSessionInstalledContent } from "./installedContentRuntimeAdapter";
import { commitProductionRuntimeResolution } from "./runtimeResolutionCommit";
import { snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { lowerCommonPlay, parseCommonPlayDefinition } from "../domain/commonPlayDefinitionRuntime";
import { resolveCommonPlayZoneActivation, resolveCommonPlayZoneEvent, resolveCommonPlayZoneMembershipChange } from "../domain/commonPlayZoneRuntime";

export interface AuthoritativeSpatialZoneMembershipFact {
  artifactId:string;
  subjectId:string;
  present:boolean;
  provenance:string;
}

export interface AuthoritativeSpatialZoneStayFact {
  artifactId:string;
  subjectId:string;
  provenance:string;
}

export interface AuthoritativeSpatialZoneMembershipProvider {
  placementRefForActivation?(input:{actionId:string;actorId:string}):string|undefined;
}

interface AdapterState {
  sessionMode:SessionMode;
  scene:SceneVm;
  activeCharacter:CharacterSheet;
  getSnapshot():Promise<AppSnapshot>;
}

type PendingSpatialFact=
  | {actionId:string;kind:"membership";fact:AuthoritativeSpatialZoneMembershipFact}
  | {actionId:string;kind:"stay";fact:AuthoritativeSpatialZoneStayFact};

const previousResolveAction=MockAdapter.prototype.resolveAction;
const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
const spatialProviders=new WeakMap<MockAdapter,AuthoritativeSpatialZoneMembershipProvider>();
const pendingFacts=new WeakMap<MockAdapter,PendingSpatialFact>();

export function registerAuthoritativeSpatialZoneMembershipProvider(
  adapter:MockAdapter,
  provider:AuthoritativeSpatialZoneMembershipProvider={},
) {
  spatialProviders.set(adapter,provider);
}

export function unregisterAuthoritativeSpatialZoneMembershipProvider(adapter:MockAdapter) {
  spatialProviders.delete(adapter);
  pendingFacts.delete(adapter);
}

function spatialFactActionId(kind:"membership"|"stay",artifactId:string) {
  return `common-play-zone-spatial-${kind}:${encodeURIComponent(artifactId)}:${Date.now()}:${Math.floor(Math.random()*1000)}`;
}

export async function submitAuthoritativeSpatialZoneMembershipFact(
  adapter:MockAdapter,
  fact:AuthoritativeSpatialZoneMembershipFact,
) {
  if (!spatialProviders.has(adapter)) throw new Error("authoritative spatial Zone membership provider is not registered");
  if (!fact.artifactId||!fact.subjectId||!fact.provenance.trim()) throw new Error("spatial Zone membership fact requires artifactId, subjectId, and provenance");
  const actionId=spatialFactActionId("membership",fact.artifactId);
  pendingFacts.set(adapter,{actionId,kind:"membership",fact:structuredClone(fact)});
  try {
    return await adapter.resolveAction(actionId,[fact.subjectId]);
  } finally {
    if (pendingFacts.get(adapter)?.actionId===actionId) pendingFacts.delete(adapter);
  }
}

export async function submitAuthoritativeSpatialZoneStayFact(
  adapter:MockAdapter,
  fact:AuthoritativeSpatialZoneStayFact,
) {
  if (!spatialProviders.has(adapter)) throw new Error("authoritative spatial Zone membership provider is not registered");
  if (!fact.artifactId||!fact.subjectId||!fact.provenance.trim()) throw new Error("spatial Zone stay fact requires artifactId, subjectId, and provenance");
  const actionId=spatialFactActionId("stay",fact.artifactId);
  pendingFacts.set(adapter,{actionId,kind:"stay",fact:structuredClone(fact)});
  try {
    return await adapter.resolveAction(actionId,[fact.subjectId]);
  } finally {
    if (pendingFacts.get(adapter)?.actionId===actionId) pendingFacts.delete(adapter);
  }
}

async function installedZoneAction(adapter:MockAdapter,actionId:string) {
  const reference=parseInstalledCommonPlayActionId(actionId);
  if (!reference) return undefined;
  const installedEntries=await requiredSessionInstalledContent(adapter,[]);
  const entry=installedEntries.find((candidate)=>catalogQualifiedId(candidate.contentId,candidate.sourceId,candidate.version)===reference.catalogId);
  const mechanic=entry?.mechanics?.find((candidate)=>candidate.kind==="common-play"&&candidate.config.id===reference.mechanicId);
  const entryPoint=mechanic?.config.entryPoints?.find((candidate)=>candidate.id===reference.entryPointId);
  if (!entry||!mechanic||!entryPoint) return undefined;
  const canonical=parseCommonPlayDefinition(mechanic.config,`Installed spatial Zone ${entry.contentId} · ${mechanic.config.id}`);
  const lowered=lowerCommonPlay(canonical,entryPoint.id);
  return lowered.kind==="zone"?{entry,lowered,entryPointId:entryPoint.id}:undefined;
}

async function resolveSpatialZoneActivation(adapter:MockAdapter,actionId:string,targetIds:string[]) {
  const action=await installedZoneAction(adapter,actionId);
  if (!action) return undefined;
  const internal=adapter as unknown as AdapterState;
  const state=internal.sessionMode==="initiative"?snapshotAdapterTurnRuntimeState(adapter,internal.scene):undefined;
  const actorId=state?.clock.activeActorId;
  if (!state||!actorId||targetIds.length!==1||targetIds[0]!==actorId||!state.combatants[actorId]) return internal.getSnapshot();
  const actor=internal.scene.entities.find((candidate)=>candidate.id===actorId);
  if (!actor) return internal.getSnapshot();
  const placementRef=spatialProviders.get(adapter)?.placementRefForActivation?.({actionId,actorId});
  if(placementRef!==undefined&&!placementRef.trim()) throw new Error("authoritative spatial Zone placementRef must be non-empty when provided");
  const resolutionId=`common-play.${Date.now()}.${Math.floor(Math.random()*1000)}`;
  const committed=resolveCommonPlayZoneActivation(SIMPLEVTT_APP_RULES_PROFILE,state,action.lowered.definition,{
    resolutionId,
    actorId,
    entryPointId:action.entryPointId,
    membershipAuthority:"spatial",
    ...(placementRef!==undefined?{placementRef}:{}),
    actionKind:action.entry.category==="spell"?"magic":"other",
  });
  if (committed.status==="rejected") return internal.getSnapshot();
  const actionName=action.entry.nameKo||action.entry.nameEn;
  return commitProductionRuntimeResolution(adapter,state,committed,{
    resolutionId,
    actionId,
    actionName,
    actorId,
    targetIds:[actorId],
    targetNames:[actor.name],
    compact:"Common Play 규칙 적용",
    detail:[`${action.lowered.definition.id} · ${action.entryPointId}`,...committed.events.map((event)=>event.summary)],
    provenance:[`${action.entry.source} · ${action.entry.contentId}`,"authoritative spatial Zone membership provider"],
    calculatedOutcome:"규칙 효과 적용",
    finalOutcome:"규칙 효과 적용",
  });
}

async function resolveSpatialMembershipFact(
  adapter:MockAdapter,
  actionId:string,
  fact:AuthoritativeSpatialZoneMembershipFact,
) {
  const internal=adapter as unknown as AdapterState;
  const state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  const artifact=state?.artifacts?.find((candidate)=>candidate.id===fact.artifactId&&candidate.artifactKind==="zone");
  const membership=state?.zoneMemberships?.find((candidate)=>candidate.artifactId===fact.artifactId);
  const target=internal.scene.entities.find((candidate)=>candidate.id===fact.subjectId);
  if (!state||!artifact?.sourceActorId||membership?.authority!=="spatial"||!target||!state.combatants[target.id]) return internal.getSnapshot();
  const found=await installedZoneActionByDefinition(adapter,artifact.sourceId);
  if (!found) return internal.getSnapshot();
  const resolutionId=`common-play-zone-spatial-membership.${Date.now()}.${Math.floor(Math.random()*1000)}`;
  const committed=resolveCommonPlayZoneMembershipChange(SIMPLEVTT_APP_RULES_PROFILE,state,found.lowered.definition,{
    id:resolutionId,
    artifactId:artifact.id,
    subjectId:target.id,
    subjectCreatureKind:target.kind==="character"?"character":"monster",
    authority:"spatial",
    present:fact.present,
  });
  if (committed.status==="no-match"||committed.status==="rejected") return internal.getSnapshot();
  const actionName=`공간 판정 · 구역 ${fact.present?"포함":"제외"}`;
  return commitProductionRuntimeResolution(adapter,state,committed,{
    resolutionId,
    actionId,
    actionName,
    actorId:artifact.sourceActorId,
    targetIds:[target.id],
    targetNames:[target.name],
    compact:`${target.name} · ${artifact.templateId} ${fact.present?"포함":"제외"}`,
    detail:[`${artifact.sourceId} · ${artifact.templateId}`,fact.present?"zone.entered":"zone.left"],
    provenance:[fact.provenance,"Common Play zone · authoritative spatial membership"],
    calculatedOutcome:fact.present?"구역 포함":"구역 제외",
    finalOutcome:fact.present?"구역 포함":"구역 제외",
  });
}

async function resolveSpatialStayFact(
  adapter:MockAdapter,
  actionId:string,
  fact:AuthoritativeSpatialZoneStayFact,
) {
  const internal=adapter as unknown as AdapterState;
  const state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  const artifact=state?.artifacts?.find((candidate)=>candidate.id===fact.artifactId&&candidate.artifactKind==="zone");
  const membership=state?.zoneMemberships?.find((candidate)=>candidate.artifactId===fact.artifactId);
  const target=internal.scene.entities.find((candidate)=>candidate.id===fact.subjectId);
  if (!state||!artifact?.sourceActorId||membership?.authority!=="spatial"||!membership.memberIds.includes(fact.subjectId)||!target||!state.combatants[target.id]) return internal.getSnapshot();
  const found=await installedZoneActionByDefinition(adapter,artifact.sourceId);
  if (!found) return internal.getSnapshot();
  const resolutionId=`common-play-zone-spatial-stay.${Date.now()}.${Math.floor(Math.random()*1000)}`;
  const committed=resolveCommonPlayZoneEvent(SIMPLEVTT_APP_RULES_PROFILE,state,found.lowered.definition,{
    id:resolutionId,
    kind:"zone.stay",
    artifactId:artifact.id,
    subjectId:target.id,
    subjectCreatureKind:target.kind==="character"?"character":"monster",
  });
  if (committed.status==="no-match"||committed.status==="rejected") return internal.getSnapshot();
  return commitProductionRuntimeResolution(adapter,state,committed,{
    resolutionId,
    actionId,
    actionName:"공간 판정 · 구역 유지",
    actorId:artifact.sourceActorId,
    targetIds:[target.id],
    targetNames:[target.name],
    compact:`${target.name} · ${artifact.templateId} 유지`,
    detail:[`${artifact.sourceId} · ${artifact.templateId}`,"zone.stay"],
    provenance:[fact.provenance,"Common Play zone · authoritative spatial stay"],
    calculatedOutcome:"구역 유지",
    finalOutcome:"구역 유지",
  });
}

async function installedZoneActionByDefinition(adapter:MockAdapter,definitionId:string) {
  for (const entry of await requiredSessionInstalledContent(adapter,[])) {
    for (const mechanic of entry.mechanics??[]) {
      if (mechanic.kind!=="common-play"||mechanic.config.id!==definitionId) continue;
      const canonical=parseCommonPlayDefinition(mechanic.config,`Installed spatial Zone ${entry.contentId} · ${definitionId}`);
      for (const entryPoint of canonical.entryPoints??[]) {
        const lowered=lowerCommonPlay(canonical,entryPoint.id);
        if (lowered.kind==="zone") return {entry,lowered,entryPointId:entryPoint.id};
      }
    }
  }
  return undefined;
}

function removeManualControlsForSpatialZones(adapter:MockAdapter,snapshot:AppSnapshot) {
  const state=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene);
  if (!state) return snapshot;
  const spatialArtifactIds=new Set((state.zoneMemberships??[]).filter((membership)=>membership.authority==="spatial").map((membership)=>membership.artifactId));
  if (!spatialArtifactIds.size) return snapshot;
  const filterScene=(scene:SceneVm)=>{
    for (const [actorId,actions] of Object.entries(scene.actionsByActor)) {
      scene.actionsByActor[actorId]=actions.filter((action)=>{
        const reference=parseZoneMembershipCommonPlayActionId(action.id);
        return !reference||!spatialArtifactIds.has(reference.artifactId);
      });
    }
  };
  filterScene(snapshot.scene);
  filterScene((adapter as unknown as AdapterState).scene);
  return snapshot;
}

MockAdapter.prototype.getSnapshot=async function getSnapshotWithoutManualSpatialZoneControls() {
  return removeManualControlsForSpatialZones(this,await previousGetSnapshot.call(this));
};

MockAdapter.prototype.resolveAction=async function resolveAuthoritativeSpatialZoneAction(actionId:string,targetIds:string[]) {
  const pending=pendingFacts.get(this);
  if (pending?.actionId===actionId&&targetIds.length===1&&targetIds[0]===pending.fact.subjectId) {
    return pending.kind==="stay"
      ? resolveSpatialStayFact(this,actionId,pending.fact)
      : resolveSpatialMembershipFact(this,actionId,pending.fact);
  }
  if (spatialProviders.has(this)) {
    const spatialActivation=await resolveSpatialZoneActivation(this,actionId,targetIds);
    if (spatialActivation) return spatialActivation;
  }
  return previousResolveAction.call(this,actionId,targetIds);
};
