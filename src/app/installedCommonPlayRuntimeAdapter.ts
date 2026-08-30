import "./installedContentContracts";
import type { ActionVm, AppSnapshot, CatalogEntry, CharacterSheet, DamageComponentView, ResolutionView, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { catalogQualifiedId } from "./contentCatalogIdentity";
import { generatedBuiltinCatalog } from "./builtinCatalogRuntimeAdapter";
import { requiredSessionInstalledContent } from "./installedContentRuntimeAdapter";
import { installedCommonPlayActionId, parseInstalledCommonPlayActionId, parseRuntimeArtifactCommonPlayActionId, parseStoredInvocationCancelActionId, parseStoredInvocationCommonPlayActionId, parseZoneMembershipCommonPlayActionId, runtimeArtifactCommonPlayActionId, storedInvocationCancelActionId, storedInvocationCommonPlayActionId, zoneMembershipCommonPlayActionId } from "./installedCommonPlayActionReference";
import { commitProductionRuntimeResolution } from "./runtimeResolutionCommit";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import {
  parseCommonPlayDamageDiceFormula,
  compileCommonPlayEntryPointOperations,
  resolveCommonPlayEntryPointOperations,
  type CommonPlayOperationDefinition,
} from "../domain/commonPlayOperationRuntime";
import { lowerCommonPlay, parseCommonPlayDefinition, type LoweredCommonPlayEntryPoint } from "../domain/commonPlayDefinitionRuntime";
import { resolveCommonPlaySaveDamageEntryPoint } from "../domain/commonPlayEntryPointRuntime";
import { appendCommonPlayDamageTakenTriggers, resolveCommonPlayEffectActivation, type CommonPlayPersistentEffectDefinition } from "../domain/commonPlayEffectRuntime";
import { appendCommonPlaySemanticOutcomeEvents, appendCommonPlaySemanticOutcomeTriggers } from "../domain/commonPlaySemanticEventRuntime";
import { resolveCommonPlayZoneActivation, resolveCommonPlayZoneMembershipChange } from "../domain/commonPlayZoneRuntime";
import { resolveCommonPlayArtifactActivation } from "../domain/commonPlayArtifactRuntime";
import type { RulesRuntimeState } from "../domain/combatState";
import type { D20TestResult } from "../domain/d20";
import type { DamageResolution, HealingResolution } from "../domain/damage";
import type { DamageRollResolution } from "../domain/damageRoll";
import type { TargetingFactInput } from "../domain/targeting";
import { resolveCommonPlayStoredInvocationCancel, resolveCommonPlayStoredInvocationCapture, resolveCommonPlayStoredInvocationTrigger } from "../domain/commonPlayStoredInvocationRuntime";
import type { ReadyActionConfiguration } from "./standardActionReadyState";
import { resolvePendingResolution } from "../domain/resolution";

interface AdapterState {
  sessionMode:SessionMode;
  scene:SceneVm;
  activeCharacter:CharacterSheet;
  resolution:ResolutionView|null;
  d20(actionId:string,index?:number):number;
  getSnapshot():Promise<AppSnapshot>;
}

type CommonPlayProductionAction = {
  contentId:string;
  category:CatalogEntry["category"];
  nameKo:string;
  nameEn:string;
  source:string;
  lowered:LoweredCommonPlayEntryPoint;
  entryPointId:string;
};

const previousResolveAction=MockAdapter.prototype.resolveAction;
const previousRespondToInterrupt=MockAdapter.prototype.respondToInterrupt;
const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
const previousConfigureReadyAction=MockAdapter.prototype.configureReadyAction;
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
    const canonical=parseCommonPlayDefinition(mechanic.config,`Builtin Common Play ${entry.contentId??entry.id} mechanic ${index}`);
    return (canonical.entryPoints??[]).map((entryPoint)=>{
      const lowered=lowerCommonPlay(canonical,entryPoint.id);
      return {
      contentId:entry.contentId??entry.id,
      category:entry.category,
      nameKo:entry.nameKo,
      nameEn:entry.nameEn,
      source:entry.source,
      lowered,
      entryPointId:entryPoint.id,
      };
    });
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
  const entryPoint=mechanic?.config.entryPoints?.find((candidate)=>candidate.id===reference.entryPointId);
  if (!entry||!mechanic||!entryPoint) return undefined;
  const lowered=lowerCommonPlay(mechanic.config,entryPoint.id);
  return {
    contentId:entry.contentId,
    category:entry.category,
    nameKo:entry.nameKo,
    nameEn:entry.nameEn,
    source:entry.source,
    lowered,
    entryPointId:entryPoint.id,
  };
}

async function commonPlayAction(adapter:MockAdapter,actionId:string) {
  return parseInstalledCommonPlayActionId(actionId)
    ? installedCommonPlayAction(adapter,actionId)
    : builtinCommonPlayAction(adapter,actionId);
}

function referencedResourceIds(definition:CommonPlayOperationDefinition) {
  const ids=new Set((definition.payments??[]).flatMap((payment)=>payment.kind==="resource"?[payment.resource]:[]));
  for (const entryPoint of definition.entryPoints) {
    for (const operation of entryPoint.operations) {
      if (operation.kind==="resource.change") ids.add(operation.resource);
    }
  }
  return [...ids];
}

async function storedInvocationDefinitionActionId(adapter:MockAdapter,definitionId:string,entryPointId:string) {
  const entries=await requiredSessionInstalledContent(adapter,[]);
  for(const entry of entries) {
    const mechanic=entry.mechanics?.find((candidate)=>candidate.kind==="common-play"&&candidate.config.id===definitionId&&candidate.config.entryPoints?.some((point)=>point.id===entryPointId));
    if(mechanic) return installedCommonPlayActionId({
      catalogId:catalogQualifiedId(entry.contentId,entry.sourceId,entry.version),mechanicId:definitionId,entryPointId,
    });
  }
  return undefined;
}

async function installedZoneDefinitionAction(adapter:MockAdapter,definitionId:string) {
  for(const entry of await requiredSessionInstalledContent(adapter,[])) {
    const mechanic=entry.mechanics?.find((candidate)=>candidate.kind==="common-play"&&candidate.config.id===definitionId);
    if(!mechanic) continue;
    const canonical=parseCommonPlayDefinition(mechanic.config);
    for(const point of canonical.entryPoints??[]) {
      const lowered=lowerCommonPlay(canonical,point.id);
      if(lowered.kind!=="zone") continue;
      const definitionActionId=installedCommonPlayActionId({
        catalogId:catalogQualifiedId(entry.contentId,entry.sourceId,entry.version),mechanicId:definitionId,entryPointId:point.id,
      });
      return {definitionActionId,action:await commonPlayAction(adapter,definitionActionId)};
    }
  }
  return undefined;
}

async function installedPersistentEffectDefinitions(adapter:MockAdapter) {
  const definitions=new Map<string,CommonPlayPersistentEffectDefinition>();
  for(const entry of await requiredSessionInstalledContent(adapter,[])) {
    for(const mechanic of entry.mechanics??[]) {
      if(mechanic.kind!=="common-play") continue;
      const canonical=parseCommonPlayDefinition(mechanic.config);
      for(const point of canonical.entryPoints??[]) {
        const lowered=lowerCommonPlay(canonical,point.id);
        if(lowered.kind==="effect") definitions.set(lowered.definition.id,lowered.definition);
      }
    }
  }
  return [...definitions.values()];
}

function projectedArtifactAction(
  actionId:string,
  actorId:string,
  action:CommonPlayProductionAction,
  scene:SceneVm,
  state:RulesRuntimeState,
):ActionVm {
  const entryPoint=action.lowered.definition.entryPoints.find((candidate)=>candidate.id===action.entryPointId)!;
  const operations=entryPoint.operations as Array<{kind:string;target?:string}>;
  const targeting=(entryPoint as {targeting?:{min?:number;max?:number}}).targeting;
  const payments=(action.lowered.definition as {payments?:CommonPlayOperationDefinition["payments"]}).payments;
  const payment=payments?.find((candidate)=>candidate.kind==="economy");
  const economy=payment?.kind==="economy"
    ?payment.bucket==="action"?"행동":payment.bucket==="bonus-action"?"추가 행동":"반응"
    :"없음";
  const targeted=action.lowered.kind==="save-damage"||targeting!==undefined||operations.some((operation)=>(operation.kind==="damage.apply"||operation.kind==="healing.apply")&&operation.target==="target");
  const multi=action.lowered.kind==="save-damage"||Boolean(targeting&&(targeting.max??1)>1);
  const eligibleTargetIds=targeted
    ?scene.entities.filter((entity)=>state.combatants[entity.id]).map((entity)=>entity.id)
    :[actorId];
  const combatant=state.combatants[actorId];
  const slotAvailable=payment?.kind!=="economy"?true:payment.bucket==="action"?combatant.economy.action:payment.bucket==="bonus-action"?combatant.economy.bonusAction:combatant.economy.reaction;
  const resourcesAvailable=(payments??[]).every((candidate)=>candidate.kind!=="resource"||combatant.resources.some((resource)=>resource.id===candidate.resource&&resource.current>=Number(candidate.amount.value)));
  const active=state.clock.activeActorId===actorId;
  const test="test" in entryPoint?entryPoint.test:undefined;
  const resolutionKind:ActionVm["resolutionKind"]=action.lowered.kind==="save-damage"?"saving-throw"
    :test?.kind==="attack-roll"?"attack":test?.kind==="ability-check"?"ability-check":test?.kind==="saving-throw"?"saving-throw"
    :operations.some((operation)=>operation.kind==="damage.apply")?"no-roll-damage"
    :operations.some((operation)=>operation.kind==="healing.apply")?"healing":"no-roll";
  return {
    id:runtimeArtifactCommonPlayActionId(actorId,actionId),actorId,
    name:action.nameKo||action.nameEn,category:action.category==="spell"?"magic":"basic",
    target:targeted?"any":"self",economy,resolutionKind,
    summary:`${action.lowered.definition.id} · ${action.entryPointId}`,
    available:active&&slotAvailable&&resourcesAvailable,
    disabledReason:active?(slotAvailable?(resourcesAvailable?undefined:"자원 부족"): `${economy} 사용 불가`):"현재 턴 아님",
    eligibleTargetIds,
    ...(multi?{maxTargets:targeting?.max??eligibleTargetIds.length}:{}),
    details:[{label:"출처",value:`${action.source} · ${action.contentId}`}],
  };
}

async function projectRuntimeArtifactActions(adapter:MockAdapter,snapshot:AppSnapshot) {
  const state=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene);
  if(!state) return;
  for(const [actorId,actions] of Object.entries(snapshot.scene.actionsByActor)) {
    snapshot.scene.actionsByActor[actorId]=actions.filter((action)=>!parseStoredInvocationCommonPlayActionId(action.id)&&!parseStoredInvocationCancelActionId(action.id)&&!parseZoneMembershipCommonPlayActionId(action.id));
  }
  for(const [actorId,actions] of Object.entries((adapter as unknown as AdapterState).scene.actionsByActor)) {
    (adapter as unknown as AdapterState).scene.actionsByActor[actorId]=actions.filter((action)=>!parseStoredInvocationCommonPlayActionId(action.id)&&!parseStoredInvocationCancelActionId(action.id)&&!parseZoneMembershipCommonPlayActionId(action.id));
  }
  for(const artifact of state.artifacts??[]) {
    const actor=artifact.artifactKind==="actor"?artifact.actor:undefined;
    if(!actor||!snapshot.scene.entities.some((entity)=>entity.id===actor.combatantId)) continue;
    if(snapshot.role!=="dm"&&actor.controllerId!==snapshot.activeCharacter.id) {
      delete snapshot.scene.actionsByActor[actor.combatantId];
      continue;
    }
    const actions=(await Promise.all(actor.actionDefinitionIds.map(async(actionId)=>{
      const action=await commonPlayAction(adapter,actionId);
      return action?projectedArtifactAction(actionId,actor.combatantId,action,snapshot.scene,state):undefined;
    }))).filter((action):action is ActionVm=>Boolean(action));
    snapshot.scene.actionsByActor[actor.combatantId]=actions;
    (adapter as unknown as AdapterState).scene.actionsByActor[actor.combatantId]=cp(actions);
  }
  for(const artifact of state.artifacts??[]) {
    const stored=artifact.artifactKind==="stored-invocation"?artifact.storedInvocation:undefined;
    if(!stored||snapshot.role!=="dm"&&stored.ownerActorId!==snapshot.activeCharacter.id) continue;
    const definitionActionId=await storedInvocationDefinitionActionId(adapter,stored.definitionId,stored.entryPointId);
    const action=definitionActionId?await commonPlayAction(adapter,definitionActionId):undefined;
    if(!definitionActionId||!action||action.lowered.kind!=="operations") continue;
    const projected=projectedArtifactAction(definitionActionId,stored.ownerActorId,action,snapshot.scene,state);
    const available=Boolean(state.combatants[stored.ownerActorId]?.economy.reaction);
    const triggerAction:ActionVm={
      ...projected,id:storedInvocationCommonPlayActionId(artifact.id,definitionActionId),economy:"반응",available,
      disabledReason:available?undefined:"반응을 사용할 수 없습니다.",
      summary:`${String(artifact.metadata?.triggerLabel??"저장된 조건 충족")} → ${projected.name}`,
      details:[{label:"저장된 호출",value:`${stored.definitionId} · ${stored.entryPointId}`,source:"Common Play stored invocation"},...projected.details],
    };
    const cancelAction:ActionVm={
      id:storedInvocationCancelActionId(artifact.id),actorId:stored.ownerActorId,name:`취소 · ${projected.name}`,
      category:"basic",target:"self",economy:"없음",resolutionKind:"no-roll",summary:"저장된 호출을 발동하지 않고 취소합니다.",
      available:true,eligibleTargetIds:[stored.ownerActorId],details:[{label:"저장된 호출",value:`${stored.definitionId} · ${stored.entryPointId}`,source:"Common Play stored invocation"}],
    };
    for(const scene of [snapshot.scene,(adapter as unknown as AdapterState).scene]) {
      const actions=scene.actionsByActor[stored.ownerActorId]??[];
      actions.push(cp(triggerAction),cp(cancelAction));
      scene.actionsByActor[stored.ownerActorId]=actions;
    }
  }
  for(const artifact of state.artifacts??[]) {
    if(artifact.artifactKind!=="zone"||!artifact.sourceActorId||!state.combatants[artifact.sourceActorId]) continue;
    if(snapshot.role!=="dm"&&artifact.sourceActorId!==snapshot.activeCharacter.id) continue;
    const found=await installedZoneDefinitionAction(adapter,artifact.sourceId);
    if(!found?.action||found.action.lowered.kind!=="zone") continue;
    const members=new Set((state.zoneMemberships??[]).find((membership)=>membership.artifactId===artifact.id)?.memberIds??[]);
    const candidates=snapshot.scene.entities.filter((entity)=>state.combatants[entity.id]);
    const membershipActions:ActionVm[]=[true,false].map((present)=>{
      const eligibleTargetIds=candidates.filter((candidate)=>members.has(candidate.id)!==present).map((candidate)=>candidate.id);
      return {
        id:zoneMembershipCommonPlayActionId(artifact.id,found.definitionActionId,present),
        actorId:artifact.sourceActorId!,name:`${present?"구역에 포함":"구역에서 제외"} · ${artifact.templateId}`,
        category:"basic",target:"any",economy:"없음",resolutionKind:"no-roll",
        summary:`${artifact.templateId}의 수동 membership을 변경합니다.`,available:eligibleTargetIds.length>0,
        disabledReason:eligibleTargetIds.length?undefined:"변경할 대상 없음",eligibleTargetIds,
        details:[{label:"구역",value:`${artifact.sourceId} · ${artifact.templateId}`,source:"Common Play zone"}],
      };
    });
    for(const scene of [snapshot.scene,(adapter as unknown as AdapterState).scene]) {
      const actions=scene.actionsByActor[artifact.sourceActorId]??[];
      actions.push(...cp(membershipActions));
      scene.actionsByActor[artifact.sourceActorId]=actions;
    }
  }
}

MockAdapter.prototype.getSnapshot=async function getSnapshotWithRuntimeArtifactActions() {
  const snapshot=await previousGetSnapshot.call(this);
  await projectRuntimeArtifactActions(this,snapshot);
  return snapshot;
};

MockAdapter.prototype.configureReadyAction=async function configureInstalledCommonPlayStoredInvocation(command:ReadyActionConfiguration) {
  const reference=parseInstalledCommonPlayActionId(command.actionId);
  const action=reference?await commonPlayAction(this,command.actionId):undefined;
  if(!reference||!action||action.lowered.kind!=="operations") return previousConfigureReadyAction.call(this,command);
  const internal=this as unknown as AdapterState;
  const state=snapshotAdapterTurnRuntimeState(this,internal.scene);
  if(!state||state.clock.activeActorId!==command.actorId||!state.combatants[command.actorId]) return internal.getSnapshot();
  const resolutionId=`common-play-ready.${Date.now()}.${Math.floor(Math.random()*1000)}`;
  const committed=resolveCommonPlayStoredInvocationCapture(SIMPLEVTT_APP_RULES_PROFILE,state,{
    resolutionId,actorId:command.actorId,definitionId:action.lowered.definition.id,entryPointId:action.entryPointId,
    definitionRevision:reference.catalogId,binding:"live",
    trigger:{op:"eq",left:{ref:"trigger.declared"},right:{value:true}},
    metadata:{triggerLabel:command.trigger.trim()||"DM이 선언한 트리거"},
    captureOperations:[{id:`${resolutionId}:action`,kind:"use-economy",actorId:command.actorId,slot:"action",actionKind:"other"}],
  });
  if(committed.status==="rejected") return failAction(internal,command.actorId,"action.standard.ready","준비",[command.actorId],resolutionId,committed.error);
  return commitProductionRuntimeResolution(this,state,committed,{
    resolutionId,actionId:"action.standard.ready",actionName:"준비",actorId:command.actorId,targetIds:[command.actorId],
    targetNames:[internal.scene.entities.find((entity)=>entity.id===command.actorId)?.name??command.actorId],
    compact:`${command.trigger.trim()||"트리거"} → ${action.nameKo||action.nameEn} 준비`,
    detail:[`${action.lowered.definition.id} · ${action.entryPointId}`,"행동 사용 · 저장된 호출 생성"],
    provenance:[`${action.source} · ${action.contentId}`],calculatedOutcome:"준비 완료",finalOutcome:"준비 완료",
  });
};

function operationDefinition(action:CommonPlayProductionAction) {
  return action.lowered.kind==="operations"?action.lowered.definition:undefined;
}

function seedReferencedResources(
  adapter:MockAdapter,
  internal:AdapterState,
  state:RulesRuntimeState,
  definition:CommonPlayOperationDefinition|undefined,
) {
  if(!definition) return state;
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

interface PreparedCommonPlayAction {
  internal:AdapterState;
  state:RulesRuntimeState;
  actor:{id:string;name:string};
  actorEntity:SceneVm["entities"][number];
  selectedTargetId:string;
  selectedTargets:SceneVm["entities"];
  projectedAction:SceneVm["actionsByActor"][string][number]|undefined;
}

function prepareCommonPlayAction(
  adapter:MockAdapter,
  actionId:string,
  targetIds:string[],
  action:CommonPlayProductionAction,
  actorIdOverride?:string,
  allowOffTurn=false,
):PreparedCommonPlayAction|undefined {
  const internal=adapter as unknown as AdapterState;
  const projectedAction=Object.values(internal.scene.actionsByActor).flat().find((candidate)=>candidate.id===actionId);
  const actorId=actorIdOverride??projectedAction?.actorId??internal.activeCharacter.id;
  if(actorIdOverride&&projectedAction?.actorId!==actorIdOverride) return undefined;
  const actorEntity=internal.scene.entities.find((candidate)=>candidate.id===actorId);
  if(!actorEntity) return undefined;
  const actor={id:actorId,name:actorEntity.name};
  let state=internal.sessionMode==="initiative" ? snapshotAdapterTurnRuntimeState(adapter,internal.scene) : undefined;
  if (state&&actor.id===internal.activeCharacter.id) state=seedReferencedResources(adapter,internal,state,operationDefinition(action));
  if (!state||!allowOffTurn&&state.clock.activeActorId!==actor.id) return undefined;

  const entryPoint=action.lowered.definition.entryPoints.find((candidate)=>candidate.id===action.entryPointId);
  if(!entryPoint) return undefined;
  const portableEntry=entryPoint as {targeting?:{min?:number;max?:number;where?:{op:string;ref:string;value:string}};operations:Array<{kind:string;target?:string}>};
  const hasTargeting=portableEntry.targeting!==undefined;
  if(!hasTargeting&&targetIds.length!==1) return undefined;
  const selectedTargetId=targetIds[0];
  if(!actorEntity||!state.combatants[actor.id]) return undefined;
  const selectedTargets=targetIds.map((id)=>internal.scene.entities.find((candidate)=>candidate.id===id));
  if(selectedTargets.some((target,index)=>!target||!state!.combatants[targetIds[index]])) return undefined;
  const needsSelectedTarget=action.lowered.kind==="operations"&&portableEntry.operations.some((operation)=>(operation.kind==="damage.apply"||operation.kind==="healing.apply")&&operation.target==="target");
  if(hasTargeting) {
    const targeting=portableEntry.targeting!;
    if(targetIds.length<(targeting.min??1)||targetIds.length>(targeting.max??targetIds.length)) return undefined;
    if(targeting.where?.op==="relation-matches"&&targeting.where.ref==="relation"&&selectedTargets.some((target)=>commonPlayTargetFact(actorEntity,target!).relation!==targeting.where!.value)) return undefined;
    if(projectedAction&&(!projectedAction.available||targetIds.some((id)=>!projectedAction.eligibleTargetIds.includes(id)))) return undefined;
  } else if(needsSelectedTarget) {
    if(!selectedTargets[0]||projectedAction&&(!projectedAction.available||!projectedAction.eligibleTargetIds.includes(selectedTargetId))) return undefined;
  } else if(selectedTargetId!==actor.id) return undefined;
  return {internal,state,actor,actorEntity,selectedTargetId,selectedTargets:selectedTargets as SceneVm["entities"],projectedAction};
}

async function executeStoredInvocationAction(
  adapter:MockAdapter,
  actionId:string,
  targetIds:string[],
  artifactId:string,
  definitionActionId:string,
) {
  const internal=adapter as unknown as AdapterState;
  const state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  const artifact=state?.artifacts?.find((candidate)=>candidate.id===artifactId&&candidate.artifactKind==="stored-invocation");
  const stored=artifact?.storedInvocation;
  const action=await commonPlayAction(adapter,definitionActionId);
  if(!state||!stored||!action||action.lowered.kind!=="operations") return internal.getSnapshot();
  const prepared=prepareCommonPlayAction(adapter,actionId,targetIds,action,stored.ownerActorId,true);
  if(!prepared) return internal.getSnapshot();
  const resolutionId=`common-play-stored.${Date.now()}.${Math.floor(Math.random()*1000)}`;
  let invocation;
  try {
    invocation=compileCommonPlayEntryPointOperations(
      SIMPLEVTT_APP_RULES_PROFILE,state,action.lowered.definition,
      operationExecutionInput(internal,definitionActionId,action,prepared,resolutionId),
    );
  } catch(error) {
    return failAction(internal,stored.ownerActorId,actionId,action.nameKo||action.nameEn,targetIds,resolutionId,error instanceof Error?error.message:String(error));
  }
  const committed=resolveCommonPlayStoredInvocationTrigger(SIMPLEVTT_APP_RULES_PROFILE,state,{
    resolutionId,artifactId,expectedRevision:state.revision,definitionRevision:stored.definitionRevision,
    eventFacts:{"event.kind":"manual-trigger","trigger.declared":true},invocation,
  });
  if(committed.status==="no-match") return failAction(internal,stored.ownerActorId,actionId,action.nameKo||action.nameEn,targetIds,resolutionId,committed.reason);
  if(committed.status==="rejected") return failAction(internal,stored.ownerActorId,actionId,action.nameKo||action.nameEn,targetIds,resolutionId,committed.error);
  const targets=targetIds.map((id)=>internal.scene.entities.find((candidate)=>candidate.id===id)).filter((target):target is SceneVm["entities"][number]=>Boolean(target));
  return commitProductionRuntimeResolution(adapter,state,committed,{
    resolutionId,actionId,actionName:`발동 · ${action.nameKo||action.nameEn}`,actorId:stored.ownerActorId,
    targetIds:[...targetIds],targetNames:targets.map((target)=>target.name),
    compact:`저장된 호출 발동 · ${action.nameKo||action.nameEn}`,
    detail:[`${stored.definitionId} · ${stored.entryPointId}`,"반응 사용 · 저장된 호출 1회 소비"],
    provenance:[`${action.source} · ${action.contentId}`],calculatedOutcome:"저장된 호출 발동",finalOutcome:"저장된 호출 발동",
  });
}

async function cancelStoredInvocationAction(adapter:MockAdapter,actionId:string,artifactId:string) {
  const internal=adapter as unknown as AdapterState;
  const state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  const artifact=state?.artifacts?.find((candidate)=>candidate.id===artifactId&&candidate.artifactKind==="stored-invocation");
  if(!state||!artifact?.storedInvocation) return internal.getSnapshot();
  const resolutionId=`common-play-stored-cancel.${Date.now()}.${Math.floor(Math.random()*1000)}`;
  const committed=resolveCommonPlayStoredInvocationCancel(SIMPLEVTT_APP_RULES_PROFILE,state,{resolutionId,artifactId,expectedRevision:state.revision});
  if(committed.status==="no-match") return failAction(internal,artifact.storedInvocation.ownerActorId,actionId,"저장된 호출 취소",[artifact.storedInvocation.ownerActorId],resolutionId,committed.reason);
  if(committed.status==="rejected") return failAction(internal,artifact.storedInvocation.ownerActorId,actionId,"저장된 호출 취소",[artifact.storedInvocation.ownerActorId],resolutionId,committed.error);
  return commitProductionRuntimeResolution(adapter,state,committed,{
    resolutionId,actionId,actionName:"저장된 호출 취소",actorId:artifact.storedInvocation.ownerActorId,
    targetIds:[artifact.storedInvocation.ownerActorId],targetNames:[internal.scene.entities.find((entity)=>entity.id===artifact.storedInvocation!.ownerActorId)?.name??artifact.storedInvocation.ownerActorId],
    compact:"저장된 호출 취소",detail:[`${artifact.storedInvocation.definitionId} · ${artifact.storedInvocation.entryPointId}`],
    provenance:["Common Play stored invocation"],calculatedOutcome:"취소",finalOutcome:"취소",
  });
}

function rollFaces(internal:AdapterState,actionId:string,count:number,sides:number,start=0) {
  const limit=20-(20%sides);
  let drawIndex=start;
  return Array.from({length:count},()=>{
    let face:number;
    do face=internal.d20(actionId,drawIndex++); while(face>limit);
    return ((face-1)%sides)+1;
  });
}

function operationExecutionInput(
  internal:AdapterState,
  actionId:string,
  action:CommonPlayProductionAction,
  prepared:PreparedCommonPlayAction,
  resolutionId:string,
  interactionId?:string,
):import("../domain/commonPlayOperationRuntime").CommonPlayOperationExecutionInput {
  if(action.lowered.kind!=="operations") throw new Error("stored invocation payload requires an operations lowerer");
  const {actor,actorEntity,selectedTargetId,selectedTargets}=prepared;
  const entryPoint=action.lowered.definition.entryPoints.find((candidate)=>candidate.id===action.entryPointId)!;
  const d20Faces=entryPoint.test?[internal.d20(actionId,0),internal.d20(actionId,1)]:undefined;
  const movementFactAnswers=Object.fromEntries(entryPoint.operations.flatMap((operation,index)=>{
    if(operation.kind!=="movement.relocate"||!operation.destinationFact) return [];
    const subject=operation.destinationFact.subject==="actor"||operation.destinationFact.subject==="self"?actor.id:operation.destinationFact.subject;
    return [[index,{
      queryId:operation.destinationFact.id,fact:operation.destinationFact.fact,subject,
      value:`manual:${resolutionId}:${index}`,resolutionId,provenance:{kind:"authority" as const,responderId:actor.id},
    }]];
  }));
  return {
    resolutionId,actorId:actor.id,entryPointId:action.entryPointId,targetId:selectedTargetId,
    targetingTargets:entryPoint.targeting?selectedTargets.map((target)=>commonPlayTargetFact(actorEntity,target)):undefined,
    creatureKinds:Object.fromEntries([
      [actor.id,actorEntity.kind==="character"?"character":"monster"],
      ...selectedTargets.map((target)=>[target.id,target.kind==="character"?"character":"monster"] as const),
    ]),
    damageDiceFaces:damageDiceFaces(internal,actionId,entryPoint,d20Faces?.length??0),
    ...(Object.keys(movementFactAnswers).length?{movementFactAnswers}:{}),
    ...(entryPoint.test?{d20:{faces:d20Faces!,targetId:selectedTargetId}}:{}),
    actionKind:entryPoint.test?.kind==="attack-roll"?"attack" as const:action.category==="spell"?"magic" as const:"other" as const,
    ...(interactionId?{interactionResponse:{interactionId,accepted:true as const}}:{}),
  };
}

async function executeCommonPlayAction(
  adapter:MockAdapter,
  actionId:string,
  action:CommonPlayProductionAction,
  prepared:PreparedCommonPlayAction,
  resolutionId:string,
  interactionId?:string,
) {
  const {internal,state,actor,actorEntity,selectedTargetId,selectedTargets,projectedAction}=prepared;
  const lowered=action.lowered;
  const actionKind=action.category==="spell"?"magic" as const:"other" as const;
  let committed;
  let operationEntryPoint:CommonPlayOperationDefinition["entryPoints"][number]|undefined;
  if(lowered.kind==="operations") {
    const entryPoint=lowered.definition.entryPoints.find((candidate)=>candidate.id===action.entryPointId)!;
    operationEntryPoint=entryPoint;
    const pending=compileCommonPlayEntryPointOperations(SIMPLEVTT_APP_RULES_PROFILE,state,lowered.definition,operationExecutionInput(internal,actionId,action,prepared,resolutionId,interactionId));
    const effectDefinitions=await installedPersistentEffectDefinitions(adapter);
    const damagePending=appendCommonPlayDamageTakenTriggers(
      state,effectDefinitions,pending,actorEntity.kind==="character"?"character":"monster",
    );
    const automaticPending=appendCommonPlaySemanticOutcomeTriggers(
      state,effectDefinitions,damagePending,Object.fromEntries(internal.scene.entities.map((entity)=>[entity.id,entity.kind==="character"?"character":"monster"])),
    );
    committed=appendCommonPlaySemanticOutcomeEvents(
      automaticPending,
      resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,state,automaticPending),
    );
  } else if(lowered.kind==="save-damage") {
    const entryPoint=lowered.definition.entryPoints.find((candidate)=>candidate.id===action.entryPointId)!;
    const damage=parseCommonPlayDamageDiceFormula(entryPoint.operations[0].amount);
    const saves=selectedTargets.map((target,index)=>({
      facts:commonPlayTargetFact(actorEntity,target),
      creatureKind:(target.kind==="character"?"character":"monster") as "character"|"monster",
      save:{faces:[internal.d20(actionId,index)]},
    }));
    committed=resolveCommonPlaySaveDamageEntryPoint(SIMPLEVTT_APP_RULES_PROFILE,state,lowered.definition,{
      resolutionId,actorId:actor.id,entryPointId:action.entryPointId,targets:saves,
      damageFaces:rollFaces(internal,actionId,damage.count,damage.sides,selectedTargets.length),
      actionKind,
    });
  } else if(lowered.kind==="effect") {
    committed=resolveCommonPlayEffectActivation(SIMPLEVTT_APP_RULES_PROFILE,state,lowered.definition,{resolutionId,actorId:actor.id,entryPointId:action.entryPointId,actionKind});
  } else if(lowered.kind==="zone") {
    committed=resolveCommonPlayZoneActivation(SIMPLEVTT_APP_RULES_PROFILE,state,lowered.definition,{resolutionId,actorId:actor.id,entryPointId:action.entryPointId,membershipAuthority:"manual",actionKind});
  } else {
    committed=resolveCommonPlayArtifactActivation(SIMPLEVTT_APP_RULES_PROFILE,state,lowered.definition,{resolutionId,actorId:actor.id,entryPointId:action.entryPointId,actionKind});
  }
  if(committed.status==="rejected") return {status:"rejected" as const,error:committed.error,snapshot:await internal.getSnapshot()};
  const roll=committed.results[`${resolutionId}:test`] as D20TestResult|undefined;
  const hp=operationEntryPoint?hpPresentation(operationEntryPoint,committed,resolutionId):undefined;
  const affectedTargetIds=operationEntryPoint?[...new Set(operationEntryPoint.operations
    .filter((operation)=>operation.kind==="damage.apply"||operation.kind==="healing.apply")
    .map((operation)=>hpTargetId(operation.target,actor.id,selectedTargetId)))]:lowered.kind==="save-damage"?[...selectedTargets.map((target)=>target.id)]:[];
  const presentationTargetIds=affectedTargetIds.length?affectedTargetIds:operationEntryPoint?.targeting?selectedTargets.map((target)=>target.id):lowered.kind==="save-damage"?selectedTargets.map((target)=>target.id):[selectedTargetId];
  const presentationTargets=presentationTargetIds.map((id)=>internal.scene.entities.find((candidate)=>candidate.id===id)!);
  const outcome=hp?.outcome??(roll?roll.outcome:"규칙 효과 적용");
  return {status:"committed" as const,snapshot:await commitProductionRuntimeResolution(adapter,state,committed,{
    resolutionId,
    actionId,
    actionName:projectedAction?.name||action.nameKo||action.nameEn,
    actorId:actor.id,
    targetIds:presentationTargetIds,
    targetNames:presentationTargets.map((target)=>target.name),
    compact:hp?.outcome??(roll?`d20 ${roll.natural} ${roll.modifier>=0?"+":"-"} ${Math.abs(roll.modifier)} = ${roll.total} vs ${roll.target} · ${roll.outcome}`:"Common Play 규칙 적용"),
    detail:[`${lowered.definition.id} · ${action.entryPointId}`,...(roll?[`${roll.family} · ${roll.rollState} · ${roll.outcome}`]:[]),...committed.events.map((event)=>event.summary)],
    provenance:[`${action.source} · ${action.contentId}`],
    calculatedOutcome:outcome,
    finalOutcome:outcome,
    rollKind:hp?.rollKind??(roll?(roll.family==="attack-roll"?"attack":roll.family==="saving-throw"?"save":"check"):undefined),
    authoritativeDice:hp?.authoritativeDice??(roll?.rollState==="normal"?[roll.natural]:roll?.dice.faces),
    rollTotal:hp?.rollTotal??roll?.total,
    attackTotal:roll?.family==="attack-roll"?roll.total:undefined,
    damageComponents:hp?.damageComponents,
  })};
}

function finishInteraction(internal:AdapterState,resolution:ResolutionView,message:string) {
  resolution.interrupt=undefined;
  resolution.stage="complete";
  resolution.canAdvance=false;
  resolution.nextLabel=undefined;
  resolution.compact=message;
  resolution.detail.push(message);
  resolution.calculatedOutcome=message;
  resolution.finalOutcome=message;
  return internal.getSnapshot();
}

function failAction(internal:AdapterState,actorId:string,actionId:string,actionName:string,targetIds:string[],resolutionId:string,error:string) {
  internal.resolution={
    id:resolutionId,actorId,targetIds,actionId,actionName,rollKind:"effect",stage:"complete",
    authoritativeDice:[],saveResults:[],damageComponents:[],compact:`Common Play 적용 거부: ${error}`,
    detail:[error],provenance:[],calculatedOutcome:"적용 거부",finalOutcome:"적용 거부",stateChanges:[],adjudicated:false,canAdvance:false,
  };
  return internal.getSnapshot();
}

async function changeZoneMembership(
  adapter:MockAdapter,
  actionId:string,
  targetIds:string[],
  reference:NonNullable<ReturnType<typeof parseZoneMembershipCommonPlayActionId>>,
) {
  const internal=adapter as unknown as AdapterState;
  const state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  const artifact=state?.artifacts?.find((candidate)=>candidate.id===reference.artifactId&&candidate.artifactKind==="zone");
  const action=await commonPlayAction(adapter,reference.definitionActionId);
  const target=targetIds.length===1?internal.scene.entities.find((candidate)=>candidate.id===targetIds[0]):undefined;
  const baseSnapshot=await previousGetSnapshot.call(adapter);
  const resolutionId=`common-play-zone-membership.${Date.now()}.${Math.floor(Math.random()*1000)}`;
  const actionName=`구역 ${reference.present?"포함":"제외"}`;
  if(!state||!artifact?.sourceActorId||!action||action.lowered.kind!=="zone"||action.lowered.definition.id!==artifact.sourceId||!target||!state.combatants[target.id]
    ||baseSnapshot.role!=="dm"&&artifact.sourceActorId!==baseSnapshot.activeCharacter.id) {
    return failAction(internal,artifact?.sourceActorId??internal.activeCharacter.id,actionId,actionName,targetIds,resolutionId,"현재 Zone, 대상 또는 조작 권한을 재검증할 수 없습니다.");
  }
  const committed=resolveCommonPlayZoneMembershipChange(SIMPLEVTT_APP_RULES_PROFILE,state,action.lowered.definition,{
    id:resolutionId,artifactId:artifact.id,subjectId:target.id,
    subjectCreatureKind:target.kind==="character"?"character":"monster",authority:"manual",present:reference.present,
  });
  if(committed.status==="no-match") return failAction(internal,artifact.sourceActorId,actionId,actionName,targetIds,resolutionId,committed.reason);
  if(committed.status==="rejected") return failAction(internal,artifact.sourceActorId,actionId,actionName,targetIds,resolutionId,committed.error);
  return commitProductionRuntimeResolution(adapter,state,committed,{
    resolutionId,actionId,actionName,actorId:artifact.sourceActorId,targetIds:[target.id],targetNames:[target.name],
    compact:`${target.name} · ${artifact.templateId} ${reference.present?"포함":"제외"}`,
    detail:[`${artifact.sourceId} · ${artifact.templateId}`,reference.present?"zone.entered":"zone.left"],
    provenance:["Common Play zone"],calculatedOutcome:reference.present?"구역 포함":"구역 제외",finalOutcome:reference.present?"구역 포함":"구역 제외",
  });
}

MockAdapter.prototype.resolveAction=async function resolveCommonPlayProductionAction(actionId:string,targetIds:string[]) {
  const zoneMembershipReference=parseZoneMembershipCommonPlayActionId(actionId);
  if(zoneMembershipReference) return changeZoneMembership(this,actionId,targetIds,zoneMembershipReference);
  const storedInvocationCancelReference=parseStoredInvocationCancelActionId(actionId);
  if(storedInvocationCancelReference) return cancelStoredInvocationAction(this,actionId,storedInvocationCancelReference.artifactId);
  const storedInvocationReference=parseStoredInvocationCommonPlayActionId(actionId);
  if(storedInvocationReference) return executeStoredInvocationAction(this,actionId,targetIds,storedInvocationReference.artifactId,storedInvocationReference.definitionActionId);
  const runtimeArtifactReference=parseRuntimeArtifactCommonPlayActionId(actionId);
  const definitionActionId=runtimeArtifactReference?.definitionActionId??actionId;
  const action=await commonPlayAction(this,definitionActionId);
  if (!action) return previousResolveAction.call(this,actionId,targetIds);
  const prepared=prepareCommonPlayAction(this,actionId,targetIds,action,runtimeArtifactReference?.actorId);
  if(!prepared) return (this as unknown as AdapterState).getSnapshot();
  const resolutionId=`common-play.${Date.now()}.${Math.floor(Math.random()*1000)}`;
  const interaction=action.lowered.kind==="operations"
    ?action.lowered.definition.entryPoints.find((candidate)=>candidate.id===action.entryPointId)?.interaction
    :undefined;
  if(!interaction) {
    const result=await executeCommonPlayAction(this,actionId,action,prepared,resolutionId);
    return result.status==="rejected"
      ?failAction(prepared.internal,prepared.actor.id,actionId,prepared.projectedAction?.name||action.nameKo||action.nameEn,targetIds,resolutionId,result.error)
      :result.snapshot;
  }

  const actionName=prepared.projectedAction?.name||action.nameKo||action.nameEn;
  prepared.internal.resolution={
    id:resolutionId,
    actorId:prepared.actor.id,
    targetIds:[...targetIds],
    actionId,
    actionName,
    rollKind:"effect",
    stage:"interrupt",
    authoritativeDice:[],
    saveResults:[],
    damageComponents:[],
    compact:`${actionName} · 반응 사용 확인`,
    detail:[`${action.lowered.definition.id} · ${action.entryPointId}`,"승인 전에는 비용과 효과를 적용하지 않습니다."],
    provenance:[`${action.source} · ${action.contentId}`],
    calculatedOutcome:"승인 대기",
    finalOutcome:"승인 대기",
    stateChanges:[],
    adjudicated:false,
    interrupt:{
      id:interaction.id,
      responderId:prepared.actor.id,
      responderName:prepared.actor.name,
      trigger:`${actionName} 사용 선언`,
      optionName:actionName,
      cost:"반응 1",
      effect:"승인 시 선언된 Common Play 효과를 적용합니다.",
      source:action.source,
    },
    canAdvance:false,
  };
  return prepared.internal.getSnapshot();
};

MockAdapter.prototype.respondToInterrupt=async function respondToCommonPlayInteraction(accept:boolean) {
  const internal=this as unknown as AdapterState;
  const resolution=internal.resolution;
  const interrupt=resolution?.interrupt;
  if(!resolution||resolution.stage!=="interrupt"||!interrupt) return previousRespondToInterrupt.call(this,accept);

  const runtimeArtifactReference=parseRuntimeArtifactCommonPlayActionId(resolution.actionId);
  const definitionActionId=runtimeArtifactReference?.definitionActionId??resolution.actionId;
  const installedReference=parseInstalledCommonPlayActionId(definitionActionId);
  const action=await commonPlayAction(this,definitionActionId);
  if(!action) return installedReference
    ? finishInteraction(internal,resolution,"Common Play 상호작용 재검증 실패")
    : previousRespondToInterrupt.call(this,accept);
  if(action.lowered.kind!=="operations") return previousRespondToInterrupt.call(this,accept);
  const entryPoint=action.lowered.definition.entryPoints.find((candidate)=>candidate.id===action.entryPointId);
  if(!entryPoint?.interaction||entryPoint.interaction.id!==interrupt.id) return previousRespondToInterrupt.call(this,accept);
  const projected=Object.values(internal.scene.actionsByActor).flat().find((candidate)=>candidate.id===resolution.actionId&&candidate.actorId===resolution.actorId);
  if(resolution.actorId!==internal.activeCharacter.id&&!projected) {
    return finishInteraction(internal,resolution,"Common Play 상호작용 재검증 실패");
  }
  if(!accept) return finishInteraction(internal,resolution,"Common Play 상호작용 거절");

  const prepared=prepareCommonPlayAction(this,resolution.actionId,resolution.targetIds,action,runtimeArtifactReference?.actorId);
  if(!prepared) return finishInteraction(internal,resolution,"Common Play 상호작용 현재 권한 재검증 실패");
  const result=await executeCommonPlayAction(this,resolution.actionId,action,prepared,resolution.id,interrupt.id);
  if(result.status==="rejected") return finishInteraction(internal,resolution,`Common Play 상호작용 적용 거부: ${result.error}`);
  return result.snapshot;
};
