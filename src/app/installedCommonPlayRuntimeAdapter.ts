import type { AppSnapshot, CatalogEntry, CharacterSheet, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { catalogQualifiedId } from "./contentCatalogIdentity";
import { requiredSessionInstalledContent } from "./installedContentRuntimeAdapter";
import { parseInstalledCommonPlayActionId } from "./installedCommonPlayActionReference";
import { commitProductionRuntimeResolution } from "./runtimeResolutionCommit";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { resolveCommonPlayEntryPointOperations, type CommonPlayOperationDefinition } from "../domain/commonPlayOperationRuntime";
import type { RulesRuntimeState } from "../domain/combatState";
import type { InstalledCatalogEntryV1, InstalledCommonPlayMechanicV1 } from "./installedContentContracts";

interface AdapterState {
  sessionMode:SessionMode;
  scene:SceneVm;
  activeCharacter:CharacterSheet;
  getSnapshot():Promise<AppSnapshot>;
}

interface ResolvedCommonPlayAction {
  entry:CatalogEntry|InstalledCatalogEntryV1;
  mechanic:InstalledCommonPlayMechanicV1;
  entryPointId:string;
}

const previousResolveAction=MockAdapter.prototype.resolveAction;

function referencedResourceIds(definition:CommonPlayOperationDefinition) {
  const ids=new Set((definition.payments??[]).map((payment)=>payment.resource));
  for (const entryPoint of definition.entryPoints) {
    for (const operation of entryPoint.operations) {
      if (operation.kind==="resource.change") ids.add(operation.resource);
    }
  }
  return [...ids];
}

function seedReferencedResources(
  adapter:MockAdapter,
  internal:AdapterState,
  state:RulesRuntimeState,
  definition:CommonPlayOperationDefinition,
) {
  const combatant=state.combatants[internal.activeCharacter.id];
  if (!combatant) return undefined;
  const missing=referencedResourceIds(definition)
    .map((id)=>internal.activeCharacter.resources.find((resource)=>resource.id===id))
    .filter((resource)=>resource&&!combatant.resources.some((entry)=>entry.id===resource.id));
  if (!missing.length) return state;
  for (const resource of missing) combatant.resources.push({
    id:resource!.id,
    label:resource!.label,
    current:resource!.current,
    maximum:resource!.max,
    recovery:resource!.recovery ? structuredClone(resource!.recovery) : undefined,
  });
  const expected=state.revision;
  state.revision+=1;
  return commitAdapterTurnRuntimeState(adapter,internal.scene,expected,state)
    ? snapshotAdapterTurnRuntimeState(adapter,internal.scene)
    : undefined;
}

function builtinAliasAction(snapshot:AppSnapshot,actionId:string):ResolvedCommonPlayAction|null {
  const matches=snapshot.catalog.flatMap((entry)=>entry.scope==="builtin"
    ? (entry.mechanics??[]).flatMap((mechanic)=>{
      if (mechanic.kind!=="common-play"||mechanic.id!==actionId) return [];
      const manual=mechanic.config.entryPoints.filter((entryPoint)=>entryPoint.invocation==="manual");
      return manual.length===1 ? [{entry,mechanic,entryPointId:manual[0].id}] : [];
    })
    : []);
  return matches.length===1 ? matches[0] : null;
}

async function referencedAction(
  adapter:MockAdapter,
  internal:AdapterState,
  actionId:string,
):Promise<ResolvedCommonPlayAction|null> {
  const reference=parseInstalledCommonPlayActionId(actionId);
  if (!reference) return builtinAliasAction(await internal.getSnapshot(),actionId);

  const installedEntries=await requiredSessionInstalledContent(adapter,[]);
  const installedEntry=installedEntries.find((candidate)=>catalogQualifiedId(candidate.contentId,candidate.sourceId,candidate.version)===reference.catalogId);
  const builtinEntry=installedEntry
    ? undefined
    : (await internal.getSnapshot()).catalog.find((candidate)=>candidate.scope==="builtin"&&candidate.id===reference.catalogId);
  const entry=installedEntry??builtinEntry;
  const mechanic=entry?.mechanics?.find((candidate)=>candidate.kind==="common-play"&&candidate.config.id===reference.mechanicId);
  const entryPoint=mechanic?.config.entryPoints.find((candidate)=>candidate.id===reference.entryPointId);
  return entry&&mechanic&&entryPoint ? {entry,mechanic,entryPointId:entryPoint.id} : null;
}

MockAdapter.prototype.resolveAction=async function resolveInstalledCommonPlayAction(actionId:string,targetIds:string[]) {
  const internal=this as unknown as AdapterState;
  const resolved=await referencedAction(this,internal,actionId);
  if (!resolved) return previousResolveAction.call(this,actionId,targetIds);

  const {entry,mechanic,entryPointId}=resolved;
  const actor=internal.activeCharacter;
  let state=internal.sessionMode==="initiative" ? snapshotAdapterTurnRuntimeState(this,internal.scene) : undefined;
  if (state) state=seedReferencedResources(this,internal,state,mechanic.config);
  if (!state||state.clock.activeActorId!==actor.id||targetIds.some((id)=>id!==actor.id)) return internal.getSnapshot();

  const resolutionId=`common-play.${Date.now()}.${Math.floor(Math.random()*1000)}`;
  const committed=resolveCommonPlayEntryPointOperations(SIMPLEVTT_APP_RULES_PROFILE,state,mechanic.config,{
    resolutionId,
    actorId:actor.id,
    entryPointId,
  });
  return commitProductionRuntimeResolution(this,state,committed,{
    resolutionId,
    actionId,
    actionName:entry.nameKo||entry.nameEn,
    actorId:actor.id,
    targetIds:[actor.id],
    targetNames:[actor.name],
    compact:"Common Play 규칙 적용",
    detail:[`${mechanic.config.id} · ${entryPointId}`],
    provenance:[`${entry.source} · ${entry.contentId}`],
    calculatedOutcome:"규칙 효과 적용",
    finalOutcome:"규칙 효과 적용",
  });
};
