import "./installedContentContracts";
import type { AppSnapshot, CatalogEntry, CharacterSheet, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { catalogQualifiedId } from "./contentCatalogIdentity";
import { generatedBuiltinCatalog } from "./builtinCatalogRuntimeAdapter";
import { requiredSessionInstalledContent } from "./installedContentRuntimeAdapter";
import { parseInstalledCommonPlayActionId } from "./installedCommonPlayActionReference";
import { commitProductionRuntimeResolution } from "./runtimeResolutionCommit";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import {
  parseManualCommonPlayOperationDefinition,
  resolveCommonPlayEntryPointOperations,
  type CommonPlayOperationDefinition,
} from "../domain/commonPlayOperationRuntime";
import type { RulesRuntimeState } from "../domain/combatState";

interface AdapterState {
  sessionMode:SessionMode;
  scene:SceneVm;
  activeCharacter:CharacterSheet;
  getSnapshot():Promise<AppSnapshot>;
}

type CommonPlayProductionAction = {
  contentId:string;
  nameKo:string;
  nameEn:string;
  source:string;
  definition:CommonPlayOperationDefinition;
  entryPointId:string;
};

const previousResolveAction=MockAdapter.prototype.resolveAction;
const builtinCatalogOverrides=new WeakMap<MockAdapter,CatalogEntry[]>();
const cp=<T,>(value:T):T=>structuredClone(value);

export function setBuiltinCommonPlayCatalogForTests(adapter:MockAdapter,catalog:CatalogEntry[]|null) {
  if (catalog) builtinCatalogOverrides.set(adapter,cp(catalog));
  else builtinCatalogOverrides.delete(adapter);
}

function builtinCatalogFor(adapter:MockAdapter) {
  return builtinCatalogOverrides.get(adapter) ?? generatedBuiltinCatalog();
}

function builtinCommonPlayAction(adapter:MockAdapter,actionId:string):CommonPlayProductionAction|undefined {
  const entry=builtinCatalogFor(adapter).find((candidate)=>(candidate.contentId??candidate.id)===actionId);
  if (!entry) return undefined;
  const mechanics=(entry.mechanics??[]).filter((candidate)=>candidate.kind==="common-play");
  if (!mechanics.length) return undefined;
  const candidates=mechanics.flatMap((mechanic,index)=>{
    const definition=parseManualCommonPlayOperationDefinition(mechanic.config,`Builtin Common Play ${entry.contentId??entry.id} mechanic ${index}`);
    return definition.entryPoints.map((entryPoint)=>({
      contentId:entry.contentId??entry.id,
      nameKo:entry.nameKo,
      nameEn:entry.nameEn,
      source:entry.source,
      definition,
      entryPointId:entryPoint.id,
    }));
  });
  if (candidates.length!==1) {
    throw new Error(`Builtin Common Play action ${actionId} must resolve to exactly one manual entry point, got ${candidates.length}`);
  }
  return candidates[0];
}

async function installedCommonPlayAction(adapter:MockAdapter,actionId:string):Promise<CommonPlayProductionAction|undefined> {
  const reference=parseInstalledCommonPlayActionId(actionId);
  if (!reference) return undefined;
  const installedEntries=await requiredSessionInstalledContent(adapter,[]);
  const entry=installedEntries.find((candidate)=>catalogQualifiedId(candidate.contentId,candidate.sourceId,candidate.version)===reference.catalogId);
  const mechanic=entry?.mechanics?.find((candidate)=>candidate.kind==="common-play"&&candidate.config.id===reference.mechanicId);
  const entryPoint=mechanic?.config.entryPoints.find((candidate)=>candidate.id===reference.entryPointId);
  if (!entry||!mechanic||!entryPoint) return undefined;
  return {
    contentId:entry.contentId,
    nameKo:entry.nameKo,
    nameEn:entry.nameEn,
    source:entry.source,
    definition:mechanic.config,
    entryPointId:entryPoint.id,
  };
}

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

MockAdapter.prototype.resolveAction=async function resolveCommonPlayProductionAction(actionId:string,targetIds:string[]) {
  const installed=parseInstalledCommonPlayActionId(actionId);
  const action=installed
    ? await installedCommonPlayAction(this,actionId)
    : builtinCommonPlayAction(this,actionId);
  if (!action) return previousResolveAction.call(this,actionId,targetIds);

  const internal=this as unknown as AdapterState;
  const actor=internal.activeCharacter;
  let state=internal.sessionMode==="initiative" ? snapshotAdapterTurnRuntimeState(this,internal.scene) : undefined;
  if (state) state=seedReferencedResources(this,internal,state,action.definition);
  if (!state||state.clock.activeActorId!==actor.id||targetIds.length!==1||targetIds[0]!==actor.id) return internal.getSnapshot();

  const resolutionId=`common-play.${Date.now()}.${Math.floor(Math.random()*1000)}`;
  const committed=resolveCommonPlayEntryPointOperations(SIMPLEVTT_APP_RULES_PROFILE,state,action.definition,{
    resolutionId,
    actorId:actor.id,
    entryPointId:action.entryPointId,
  });
  const projectedAction=internal.scene.actionsByActor[actor.id]?.find((candidate)=>candidate.id===actionId);
  return commitProductionRuntimeResolution(this,state,committed,{
    resolutionId,
    actionId,
    actionName:projectedAction?.name||action.nameKo||action.nameEn,
    actorId:actor.id,
    targetIds:[actor.id],
    targetNames:[actor.name],
    compact:"Common Play 규칙 적용",
    detail:[`${action.definition.id} · ${action.entryPointId}`],
    provenance:[`${action.source} · ${action.contentId}`],
    calculatedOutcome:"규칙 효과 적용",
    finalOutcome:"규칙 효과 적용",
  });
};
