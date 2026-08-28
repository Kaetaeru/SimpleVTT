import "./installedContentContracts";
import type { AppSnapshot, CatalogEntry, CharacterSheet, DamageComponentView, SceneVm, SessionMode } from "./contracts";
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
  parseCommonPlayDamageDiceFormula,
  resolveCommonPlayEntryPointOperations,
  type CommonPlayOperationDefinition,
} from "../domain/commonPlayOperationRuntime";
import type { RulesRuntimeState } from "../domain/combatState";
import type { D20TestResult } from "../domain/d20";
import type { DamageResolution, HealingResolution } from "../domain/damage";
import type { DamageRollResolution } from "../domain/damageRoll";
import type { TargetingFactInput } from "../domain/targeting";

interface AdapterState {
  sessionMode:SessionMode;
  scene:SceneVm;
  activeCharacter:CharacterSheet;
  d20(actionId:string,index?:number):number;
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

function hpTargetId(target:string|undefined,actorId:string,selectedTargetId:string) {
  return target==="target"?selectedTargetId:actorId;
}

function commonPlayTargetFact(actor:SceneVm["entities"][number],target:SceneVm["entities"][number]):TargetingFactInput {
  return {
    id:target.id,
    kind:"creature",
    relation:target.id===actor.id?"self":target.side===actor.side?"ally":"enemy",
  };
}

function damageDiceFaces(
  internal:AdapterState,
  actionId:string,
  entryPoint:CommonPlayOperationDefinition["entryPoints"][number],
  startingDrawIndex:number,
) {
  const faces:Record<number,number[]>={};
  let drawIndex=startingDrawIndex;
  for(const [operationIndex,operation] of entryPoint.operations.entries()) {
    if(operation.kind!=="damage.apply"||typeof operation.amount!=="string") continue;
    const formula=parseCommonPlayDamageDiceFormula(operation.amount);
    faces[operationIndex]=Array.from({length:formula.count},()=>{
      const limit=20-(20%formula.sides);
      let face:number;
      do face=internal.d20(actionId,drawIndex++); while(face>limit);
      return ((face-1)%formula.sides)+1;
    });
  }
  return faces;
}

function hpPresentation(
  entryPoint:CommonPlayOperationDefinition["entryPoints"][number],
  committed:Extract<ReturnType<typeof resolveCommonPlayEntryPointOperations>,{status:"committed"}>,
  resolutionId:string,
) {
  const damageComponents:DamageComponentView[]=[];
  const dice:number[]=[];
  let damage=0;
  let healing=0;
  let hasHealing=false;
  for(const [index,operation] of entryPoint.operations.entries()) {
    const operationId=`${resolutionId}:operation:${index}`;
    if(operation.kind==="damage.apply") {
      const result=committed.results[operationId] as DamageResolution;
      damage+=result.finalDamage;
      damageComponents.push({
        type:result.damageType,
        roll:typeof operation.amount==="string"?operation.amount:String(operation.amount.value),
        raw:result.raw,
        adjusted:result.finalDamage,
        source:"Common Play · generic Resolver",
      });
      const roll=committed.results[`${operationId}:roll`] as DamageRollResolution|undefined;
      if(roll) dice.push(...roll.dice.flatMap((component)=>component.selectedFaces));
    }
    if(operation.kind==="healing.apply") {
      hasHealing=true;
      healing+=(committed.results[operationId] as HealingResolution).restored;
    }
  }
  if(!damageComponents.length&&!hasHealing) return undefined;
  const outcome=[damageComponents.length?`${damage} 피해`:"",hasHealing?`${healing} HP 회복`:""].filter(Boolean).join(" · ");
  return {
    rollKind:(damageComponents.length?"damage":"healing") as "damage"|"healing",
    authoritativeDice:dice,
    rollTotal:damageComponents.length?damage:healing,
    damageComponents,
    outcome,
  };
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
  if (!state||state.clock.activeActorId!==actor.id) return internal.getSnapshot();

  const resolutionId=`common-play.${Date.now()}.${Math.floor(Math.random()*1000)}`;
  const entryPoint=action.definition.entryPoints.find((candidate)=>candidate.id===action.entryPointId)!;
  const hasTargeting=entryPoint.targeting!==undefined;
  if(!hasTargeting&&targetIds.length!==1) return internal.getSnapshot();
  const selectedTargetId=targetIds[0];
  const actorEntity=internal.scene.entities.find((candidate)=>candidate.id===actor.id);
  if(!actorEntity||!state.combatants[actor.id]) return internal.getSnapshot();
  const selectedTargets=targetIds.map((id)=>internal.scene.entities.find((candidate)=>candidate.id===id));
  if(selectedTargets.some((target,index)=>!target||!state.combatants[targetIds[index]])) return internal.getSnapshot();
  const selectedTarget=selectedTargets[0];
  const projectedAction=internal.scene.actionsByActor[actor.id]?.find((candidate)=>candidate.id===actionId);
  const needsSelectedTarget=entryPoint.operations.some((operation)=>(operation.kind==="damage.apply"||operation.kind==="healing.apply")&&operation.target==="target");
  if(hasTargeting) {
    if(projectedAction&&(!projectedAction.available||targetIds.some((id)=>!projectedAction.eligibleTargetIds.includes(id)))) return internal.getSnapshot();
  } else if(needsSelectedTarget) {
    if(!selectedTarget||projectedAction&&(!projectedAction.available||!projectedAction.eligibleTargetIds.includes(selectedTargetId))) return internal.getSnapshot();
  } else if(selectedTargetId!==actor.id) return internal.getSnapshot();

  const d20Faces=entryPoint.test?[internal.d20(actionId,0),internal.d20(actionId,1)]:undefined;
  const committed=resolveCommonPlayEntryPointOperations(SIMPLEVTT_APP_RULES_PROFILE,state,action.definition,{
    resolutionId,
    actorId:actor.id,
    entryPointId:action.entryPointId,
    targetId:selectedTargetId,
    targetingTargets:hasTargeting?selectedTargets.map((target)=>commonPlayTargetFact(actorEntity,target!)):undefined,
    creatureKinds:Object.fromEntries([
      [actor.id,actorEntity.kind==="character"?"character":"monster"],
      ...selectedTargets.map((target)=>[target!.id,target!.kind==="character"?"character":"monster"] as const),
    ]),
    damageDiceFaces:damageDiceFaces(internal,actionId,entryPoint,d20Faces?.length??0),
    ...(entryPoint.test?{d20:{
      faces:d20Faces!,
      targetId:selectedTargetId,
    }}:{}),
  });
  if(committed.status==="rejected") return internal.getSnapshot();
  const roll=committed.results[`${resolutionId}:test`] as D20TestResult|undefined;
  const hp=hpPresentation(entryPoint,committed,resolutionId);
  const affectedTargetIds=[...new Set(entryPoint.operations
    .filter((operation)=>operation.kind==="damage.apply"||operation.kind==="healing.apply")
    .map((operation)=>hpTargetId(operation.target,actor.id,selectedTargetId)))];
  const presentationTargetIds=affectedTargetIds.length?affectedTargetIds:[selectedTargetId];
  const presentationTargets=presentationTargetIds.map((id)=>internal.scene.entities.find((candidate)=>candidate.id===id)!);
  const outcome=hp?.outcome??(roll?roll.outcome:"규칙 효과 적용");
  return commitProductionRuntimeResolution(this,state,committed,{
    resolutionId,
    actionId,
    actionName:projectedAction?.name||action.nameKo||action.nameEn,
    actorId:actor.id,
    targetIds:presentationTargetIds,
    targetNames:presentationTargets.map((target)=>target.name),
    compact:hp?.outcome??(roll?`d20 ${roll.natural} ${roll.modifier>=0?"+":"-"} ${Math.abs(roll.modifier)} = ${roll.total} vs ${roll.target} · ${roll.outcome}`:"Common Play 규칙 적용"),
    detail:[`${action.definition.id} · ${action.entryPointId}`,...(roll?[`${roll.family} · ${roll.rollState} · ${roll.outcome}`]:[]),...committed.events.filter((event)=>event.kind==="damage"||event.kind==="healing").map((event)=>event.summary)],
    provenance:[`${action.source} · ${action.contentId}`],
    calculatedOutcome:outcome,
    finalOutcome:outcome,
    rollKind:hp?.rollKind??(roll?(roll.family==="attack-roll"?"attack":roll.family==="saving-throw"?"save":"check"):undefined),
    authoritativeDice:hp?.authoritativeDice??(roll?.rollState==="normal"?[roll.natural]:roll?.dice.faces),
    rollTotal:hp?.rollTotal??roll?.total,
    attackTotal:roll?.family==="attack-roll"?roll.total:undefined,
    damageComponents:hp?.damageComponents,
  });
};
