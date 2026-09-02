import "./spellcastingRuntimeContracts";
import type { ActionVm, AppSnapshot, CharacterSheet, ResolutionView, SceneEntity } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { selectedCombatSpellSlot } from "./spellcastingRuntimeSelection";
import { ensureAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { spellcastingTurnStateChange, type SpellcastingTurnSnapshot } from "../domain/runtimeStateChange";
import { compileInterruptedSpellCast, compileSpellCast, resolveCompiledSpellCast, type SpellCasterContext, type SpellCastRequest, type SpellCastResolution, type SpellCastTarget } from "../domain/spellcasting";
import { normalizedSpellDefinitionById } from "../domain/spellExecutionCatalog";
import type { SpellMechanicDefinition } from "../domain/spellcasting";
import type { ResolutionEvent, ResolutionOperation } from "../domain/resolutionTypes";
import type { RulesRuntimeState } from "../domain/combatState";
import { resolveRuntimeTargetingFact } from "./realRuntimeAttackFactProvider";
import { isExecutableSpellRuntimeSupport } from "./spellcastingRuntimeContracts";
import { allocationEntriesFromTargetSequence, resolveCommonPlayAllocation } from "../domain/commonPlayAllocationRuntime";
import { prepareCharacterSpellComponents, spellPaymentRuntimeContext, stripSpellPaymentRuntimeResources } from "./spellComponentInventoryRuntime";
import { activeCastingProcess, advanceCastingProcess, beginCastingProcess, cancelCastingProcessOperations } from "../domain/commonPlayCastingProcessRuntime";
import { resolvePendingResolution } from "../domain/resolution";
import { commitProductionRuntimeResolution } from "./runtimeResolutionCommit";
import { projectedCharacterById } from "./characterSessionProjectionRegistry";
import { resolveRuntimeSaveModifier } from "./realRuntimeStatProvider";
import type { AbilityKey } from "../domain/conditions";
import type { D20TestResult } from "../domain/d20";
import { spellRuntimeDice } from "./spellRuntimeDice";

type Internal={
  scene:AppSnapshot["scene"];
  sessionMode:AppSnapshot["sessionMode"];
  resolution:ResolutionView|null;
  activity:AppSnapshot["activity"];
  activeCharacter:AppSnapshot["activeCharacter"];
  characters:AppSnapshot["characters"];
  combatantDefinitions:AppSnapshot["combatantDefinitions"];
  lastBefore?:unknown;
  lastResolutionId?:string|null;
  getSnapshot():Promise<AppSnapshot>;
};

const previousResolveAction=MockAdapter.prototype.resolveAction;
const previousRespondToInterrupt=MockAdapter.prototype.respondToInterrupt;

function relation(actor:SceneEntity,target:SceneEntity):SpellCastTarget["relation"] {
  if (actor.id===target.id) return "self";
  return actor.side===target.side ? "ally" : "enemy";
}

function isCharacterSheet(value:AppSnapshot["characters"][number]|undefined):value is CharacterSheet {
  return Boolean(value&&"abilities" in value&&"items" in value&&"resources" in value);
}

function sheetForActor(adapter:MockAdapter,internal:Internal,actorId:string) {
  if(internal.activeCharacter.id===actorId)return internal.activeCharacter;
  const projected=projectedCharacterById(adapter,actorId)?.sheet;
  if(projected)return projected;
  const local=internal.characters.find((entry)=>entry.id===actorId);
  return isCharacterSheet(local)?local:undefined;
}

function targetFacts(adapter:MockAdapter,internal:Internal,actorId:string,targetId:string,saveAbility?:AbilityKey):SpellCastTarget {
  const actor=internal.scene.entities.find((entry)=>entry.id===actorId);
  const target=internal.scene.entities.find((entry)=>entry.id===targetId);
  if (!actor||!target) throw new Error(`production spell target not found: ${targetId}`);
  const spatial=resolveRuntimeTargetingFact(internal.scene,actorId,targetId);
  return {
    id:target.id,
    kind:"creature",
    relation:relation(actor,target),
    distanceFeet:spatial.distanceFeet,
    visible:spatial.visible,
    cover:spatial.cover,
    ac:target.ac,
    creatureKind:target.kind==="character" ? "character" : "monster",
    saveModifiers:saveAbility?{[saveAbility]:resolveRuntimeSaveModifier(target,sheetForActor(adapter,internal,target.id)??internal.activeCharacter,saveAbility,internal.combatantDefinitions).modifier}:{},
    targetCanSeeCaster:spatial.targetCanSeeAttacker,
  };
}

function spellSaveAbility(definition:SpellMechanicDefinition):AbilityKey|undefined {
  return definition.primary.kind==="save-damage"||definition.primary.kind==="save-compound-damage"||definition.primary.kind==="save-effect"
    ?definition.primary.saveAbility
    :undefined;
}

function casterFromHud(snapshot:AppSnapshot,actorId:string,levelOverride?:number):SpellCasterContext|undefined {
  const hud=snapshot.scene.spellcastingByActor?.[actorId];
  const level=snapshot.activeCharacter.id===actorId
    ? snapshot.activeCharacter.level
    : snapshot.characters.find((entry)=>entry.id===actorId)?.level??levelOverride;
  if (!hud||!level) return undefined;
  return {
    characterLevel:level,
    spellAttackModifier:hud.spellAttackModifier,
    spellSaveDc:hud.spellSaveDc,
    spellcastingAbilityModifier:hud.spellcastingAbilityModifier,
    preparedSpellIds:[...hud.preparedSpellIds],
    alwaysPreparedSpellIds:[...hud.alwaysPreparedSpellIds],
    cantripSpellIds:[...hud.cantripSpellIds],
    ritualSpellIds:[...(hud.ritualSpellIds??[])],
    slotResourceIds:Object.fromEntries(hud.slots.map((slot)=>[slot.level,`spell-slot-${slot.level}`])),
  };
}

function currentTurnId(runtime:RulesRuntimeState) {
  return runtime.clock.activeActorId ? `${runtime.clock.round}:${runtime.clock.activeActorId}` : undefined;
}

function eventHistory(
  input:RulesRuntimeState,
  result:Extract<SpellCastResolution,{status:"committed"}>,
  actorId:string,
  turnId:string|undefined,
  slotLevel:number|undefined,
):ResolutionEvent[] {
  const events=result.events.map((event)=>structuredClone(event));
  if (!turnId||slotLevel===undefined||!events.length) return events;
  const before=input.spellcastingTurn ? structuredClone(input.spellcastingTurn) as SpellcastingTurnSnapshot : undefined;
  const after=result.state.spellcastingTurn ? structuredClone(result.state.spellcastingTurn) as SpellcastingTurnSnapshot : undefined;
  if (JSON.stringify(before)===JSON.stringify(after)) return events;
  const provenance=[{
    source:`spellcasting-turn:${turnId}`,
    status:"applied" as const,
    reason:`${actorId} expended a spell slot on ${turnId}`,
  }];
  const last=events[events.length-1];
  last.stateChanges.push(spellcastingTurnStateChange(actorId,before,after,provenance));
  last.provenance.push(...provenance);
  return events;
}

function saveResultsFromCast(
  result:Extract<SpellCastResolution,{status:"committed"}>,
  targetIds:string[],
  targetNames:string[],
):ResolutionView["saveResults"] {
  return targetIds.flatMap((targetId,index)=>{
    const save=Object.entries(result.results)
      .find(([key,value])=>key.endsWith(`:save:${targetId}`)&&(value as D20TestResult|undefined)?.family==="saving-throw")?.[1] as D20TestResult|undefined;
    if(!save)return [];
    return [{
      targetId,
      targetName:targetNames[index]??targetId,
      d20:save.natural,
      total:save.total,
      dc:save.target,
      outcome:save.outcome==="success"?"성공" as const:"실패" as const,
    }];
  });
}

function resolutionFromCast(
  actionName:string,
  actionId:string,
  actorId:string,
  targetIds:string[],
  slotLevel:number|undefined,
  result:SpellCastResolution,
  authoritativeDice:number[],
  targetNames:string[]=targetIds,
):ResolutionView {
  if (result.status==="rejected") {
    return {
      id:`production-spell-rejected.${Date.now()}`,
      actorId,targetIds,actionId,actionName,
      rollKind:"effect",stage:"complete",authoritativeDice,
      saveResults:[],damageComponents:[],
      compact:`시전 거부 · ${result.error}`,
      detail:[result.error],
      provenance:["Phase 14 · production spell authority · atomic rejection"],
      calculatedOutcome:"시전 거부",finalOutcome:"시전 거부",stateChanges:[],adjudicated:false,canAdvance:false,
    };
  }
  const outcome=result.events.at(-1)?.summary??"주문 적용";
  const saveResults=saveResultsFromCast(result,targetIds,targetNames);
  return {
    id:result.events[0]?.resolutionId??`production-spell.${Date.now()}`,
    actorId,targetIds,actionId,actionName,
    rollKind:saveResults.length?"save":"effect",stage:"complete",authoritativeDice,
    saveResults,damageComponents:[],
    compact:`${actionName}${slotLevel?` · ${slotLevel}레벨 슬롯`:""} · ${outcome}`,
    detail:result.events.map((event)=>event.summary),
    provenance:[...new Set(result.events.flatMap((event)=>event.provenance.map((entry)=>entry.source)))],
    calculatedOutcome:outcome,finalOutcome:outcome,
    stateChanges:result.events.flatMap((event)=>event.stateChanges.map((change)=>`${event.summary} · ${change.kind}`)),
    adjudicated:false,canAdvance:false,
  };
}

type SpellInterruptionCandidate={action:ActionVm;definition:SpellMechanicDefinition};
type PendingSpellInterruption={
  resolutionId:string;
  actionId:string;
  actionName:string;
  actorId:string;
  targetIds:string[];
  slotLevel:number|undefined;
  turnId:string|undefined;
  authoritativeDice:number[];
  definition:SpellMechanicDefinition;
  request:SpellCastRequest;
  cleanupOperations:ResolutionOperation[];
  inputState:RulesRuntimeState;
  workingState:RulesRuntimeState;
  events:ResolutionEvent[];
  candidates:SpellInterruptionCandidate[];
  candidateIndex:number;
  resolveOriginal:(state:RulesRuntimeState)=>SpellCastResolution;
};

const pendingSpellInterruptions=new WeakMap<MockAdapter,PendingSpellInterruption>();

function observableSpellComponents(definition:SpellMechanicDefinition,action:ActionVm) {
  if(action.spellCast?.castSource==="item")return false;
  const components=definition.components;
  return Boolean(components&&(components.verbal||components.somatic||components.material||(components.materials?.length??0)>0));
}

function interruptionCandidates(adapter:MockAdapter,internal:Internal,snapshot:AppSnapshot,sourceAction:ActionVm,sourceDefinition:SpellMechanicDefinition,state:RulesRuntimeState) {
  if(!observableSpellComponents(sourceDefinition,sourceAction))return [];
  const candidates:SpellInterruptionCandidate[]=[];
  for(const action of Object.values(snapshot.scene.actionsByActor).flat()) {
    if(action.actorId===sourceAction.actorId||!action.spellCast)continue;
    const definition=normalizedSpellDefinitionById(action.spellCast.spellId);
    if(!definition?.castingInterruption)continue;
    const reactor=internal.scene.entities.find((entry)=>entry.id===action.actorId);
    const caster=internal.scene.entities.find((entry)=>entry.id===sourceAction.actorId);
    const sheet=reactor?sheetForActor(adapter,internal,reactor.id):undefined;
    if(!reactor||!caster||!sheet||!casterFromHud(snapshot,reactor.id,sheet.level))continue;
    if(internal.sessionMode==="initiative"&&!state.combatants[reactor.id]?.economy.reaction)continue;
    const spatial=resolveRuntimeTargetingFact(internal.scene,reactor.id,caster.id);
    if(!spatial.visible||(definition.targeting.rangeFeet!==undefined&&spatial.distanceFeet>definition.targeting.rangeFeet))continue;
    candidates.push({action:structuredClone(action),definition});
  }
  return candidates.sort((left,right)=>`${left.action.actorId}:${left.action.id}`.localeCompare(`${right.action.actorId}:${right.action.id}`,"en"));
}

function counterSlotLevel(action:ActionVm) {
  const metadata=action.spellCast!;
  return metadata.baseLevel===0||metadata.castSource==="item"||metadata.castSource==="feature"||metadata.castSource==="ritual"
    ?undefined
    :Math.max(metadata.baseLevel,selectedCombatSpellSlot(action.actorId,metadata.baseLevel||1));
}

function resolveCounterCast(adapter:MockAdapter,internal:Internal,pending:PendingSpellInterruption,candidate:SpellInterruptionCandidate) {
  const snapshot=internal.getSnapshot();
  return snapshot.then((currentSnapshot)=>{
    const sheet=sheetForActor(adapter,internal,candidate.action.actorId);
    const caster=casterFromHud(currentSnapshot,candidate.action.actorId,sheet?.level);
    if(!sheet||!caster)throw new Error("spell interruption responder lost spellcasting authority");
    const slotLevel=counterSlotLevel(candidate.action);
    const target=targetFacts(adapter,internal,candidate.action.actorId,pending.actorId,spellSaveAbility(candidate.definition));
    const preparation=candidate.definition.components&&candidate.action.spellCast?.castSource!=="item"
      ?prepareCharacterSpellComponents({character:sheet,requirements:candidate.definition.components,status:internal.scene.entities.find((entry)=>entry.id===candidate.action.actorId)?.status??[],targetCount:1})
      :undefined;
    const dice=spellRuntimeDice(adapter,candidate.action.id,candidate.definition,slotLevel,caster.characterLevel,[pending.actorId]);
    const turnId=internal.sessionMode==="initiative"?currentTurnId(pending.workingState):undefined;
    const request:SpellCastRequest={
      id:`${pending.resolutionId}:counter:${pending.candidateIndex}`,
      actorId:candidate.action.actorId,spellId:candidate.action.spellCast!.spellId,source:candidate.action.spellCast!.castSource,
      expectedRevision:pending.workingState.revision,caster,targets:[target],slotLevel,
      componentContext:preparation?.context,useActionEconomy:internal.sessionMode==="initiative",turnId,dice:dice.request,
    };
    const payments=spellPaymentRuntimeContext({state:pending.workingState,character:sheet,actorId:candidate.action.actorId,consumed:preparation?.resolution.consumed??[],itemCost:candidate.action.itemCost});
    const compilation=compileSpellCast(candidate.definition,payments.state,request);
    compilation.pending.operations=[...payments.operations,...compilation.pending.operations];
    const result=resolveCompiledSpellCast(SIMPLEVTT_APP_RULES_PROFILE,payments.state,request,compilation);
    if(result.status==="rejected")return {status:"rejected" as const,error:result.error};
    stripSpellPaymentRuntimeResources(result.state,candidate.action.actorId,payments.resourceIds);
    const events=eventHistory(pending.workingState,result,candidate.action.actorId,turnId,slotLevel);
    const save=result.results[`${request.id}:save:${pending.actorId}`] as D20TestResult|undefined;
    return {status:"committed" as const,state:result.state,events,countered:save?.outcome==="failure",candidate};
  });
}

function setInterruptionPrompt(internal:Internal,pending:PendingSpellInterruption,candidate:SpellInterruptionCandidate) {
  const responder=internal.scene.entities.find((entry)=>entry.id===candidate.action.actorId);
  internal.resolution={
    id:pending.resolutionId,actorId:pending.actorId,targetIds:[...pending.targetIds],actionId:pending.actionId,actionName:pending.actionName,
    rollKind:"effect",stage:"interrupt",authoritativeDice:[],saveResults:[],damageComponents:[],
    compact:`${pending.actionName} · 주문 차단 반응 대기`,detail:["반응 확정 전에는 어느 주문 비용이나 효과도 적용하지 않습니다."],
    provenance:["SRD 5.2.1 · visible component spell cast interruption"],calculatedOutcome:"반응 대기",finalOutcome:"반응 대기",stateChanges:[],adjudicated:false,canAdvance:false,
    interrupt:{id:`${pending.resolutionId}:counter:${pending.candidateIndex}`,responderId:candidate.action.actorId,responderName:responder?.name??candidate.action.actorId,trigger:`${pending.actionName} 시전`,optionName:candidate.action.name,cost:candidate.action.itemCost?"아이템 사용":"반응 + 주문 슬롯",effect:"대상 시전자는 건강 내성에 실패하면 주문 효과를 잃고 슬롯은 보존합니다.",source:"SRD 5.2.1 · Counterspell"},
  };
}

async function finishInterruptedSpell(adapter:MockAdapter,pending:PendingSpellInterruption,countered:boolean) {
  const internal=adapter as unknown as Internal;
  let result:SpellCastResolution;
  if(countered) {
    const request={...pending.request,expectedRevision:pending.workingState.revision};
    const committed=resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,pending.workingState,compileInterruptedSpellCast(pending.definition,request,pending.cleanupOperations));
    result=committed.status==="committed"
      ?{status:"committed",state:committed.state,spellId:request.spellId,slotLevel:request.slotLevel,events:committed.events,results:committed.results,consumedMaterials:[]}
      :{status:"rejected",state:pending.workingState,spellId:request.spellId,slotLevel:request.slotLevel,error:committed.error,failedOperationId:committed.failedOperationId,events:[],results:{}};
  } else result=pending.resolveOriginal(pending.workingState);
  const targetNames=pending.targetIds.map((id)=>internal.scene.entities.find((entry)=>entry.id===id)?.name??id);
  internal.resolution=resolutionFromCast(pending.actionName,pending.actionId,pending.actorId,pending.targetIds,pending.slotLevel,result,pending.authoritativeDice,targetNames);
  if(result.status==="rejected")return internal.getSnapshot();
  const originalEvents=eventHistory(pending.workingState,result,pending.actorId,pending.turnId,countered?undefined:pending.slotLevel);
  const events=[...pending.events,...originalEvents];
  const committedState={...result.state,revision:pending.inputState.revision+1};
  if(countered&&internal.resolution){
    internal.resolution.compact=`${pending.actionName} · 주문 차단됨`;
    internal.resolution.calculatedOutcome="주문 차단됨";
    internal.resolution.finalOutcome="주문 차단됨";
    internal.resolution.detail.push("원래 시전 슬롯은 소모되지 않았습니다.");
  }
  return commitProductionRuntimeResolution(adapter,pending.inputState,{status:"committed",state:committedState,events,results:result.results},{
    resolutionId:internal.resolution!.id,actionId:pending.actionId,actionName:pending.actionName,actorId:pending.actorId,targetIds:pending.targetIds,
    targetNames,compact:internal.resolution!.compact,
    detail:internal.resolution!.detail,provenance:internal.resolution!.provenance,calculatedOutcome:internal.resolution!.calculatedOutcome,
    finalOutcome:internal.resolution!.finalOutcome,rollKind:internal.resolution!.rollKind,authoritativeDice:pending.authoritativeDice,
    saveResults:internal.resolution!.saveResults,
  });
}

async function offerNextSpellInterruption(adapter:MockAdapter,pending:PendingSpellInterruption) {
  const internal=adapter as unknown as Internal;
  const candidate=pending.candidates[pending.candidateIndex++];
  if(!candidate){pendingSpellInterruptions.delete(adapter);return finishInterruptedSpell(adapter,pending,false);}
  pendingSpellInterruptions.set(adapter,pending);
  setInterruptionPrompt(internal,pending,candidate);
  return internal.getSnapshot();
}

MockAdapter.prototype.resolveAction=async function resolveProductionSpell(actionId,targetIds) {
  const internal=this as unknown as Internal;
  const currentAction=Object.values(internal.scene.actionsByActor).flat().find((entry)=>entry.id===actionId);
  if (currentAction&&!currentAction.spellCast) return previousResolveAction.call(this,actionId,targetIds);
  let snapshot=await this.getSnapshot();
  let sourceAction=(snapshot.scene.actionsByActor[snapshot.activeCharacter.id]??[]).find((entry)=>entry.id===actionId);
  let metadata=sourceAction?.spellCast;
  if (!sourceAction||!metadata||!isExecutableSpellRuntimeSupport(metadata.runtimeSupport)) return previousResolveAction.call(this,actionId,targetIds);
  if (!snapshotAdapterTurnRuntimeState(this,internal.scene)) {
    ensureAdapterTurnRuntimeState(this,internal.scene);
    snapshot=await this.getSnapshot();
    sourceAction=(snapshot.scene.actionsByActor[snapshot.activeCharacter.id]??[]).find((entry)=>entry.id===actionId);
    metadata=sourceAction?.spellCast;
  }
  const runtime=snapshotAdapterTurnRuntimeState(this,internal.scene);
  const caster=sourceAction ? casterFromHud(snapshot,sourceAction.actorId) : undefined;
  const definition=metadata ? normalizedSpellDefinitionById(metadata.spellId) : undefined;
  if (!sourceAction||!metadata||!isExecutableSpellRuntimeSupport(metadata.runtimeSupport)||!runtime||!caster||!definition) {
    return previousResolveAction.call(this,actionId,targetIds);
  }
  if(definition.castingInterruption){
    internal.resolution=resolutionFromCast(sourceAction.name,actionId,sourceAction.actorId,targetIds,undefined,{
      status:"rejected",state:runtime,spellId:metadata.spellId,error:"이 주문은 유효한 주문 시전 트리거에서만 반응으로 사용할 수 있습니다.",events:[],results:{},
    },[]);
    return this.getSnapshot();
  }

  const ritual=metadata.castSource==="ritual";
  const slotless=ritual||metadata.castSource==="item"||metadata.castSource==="feature";
  const selected=selectedCombatSpellSlot(sourceAction.actorId,metadata.baseLevel||1);
  const slotLevel=metadata.baseLevel===0||slotless ? undefined : Math.max(metadata.baseLevel,selected);
  const turnId=internal.sessionMode==="initiative"?currentTurnId(runtime):undefined;
  const projectileCount=definition.primary.kind==="automatic-projectiles"?definition.primary.baseProjectiles+Math.max(0,(slotLevel??definition.baseLevel)-definition.baseLevel)*(definition.primary.projectilesPerSlotAboveBase??0):0;
  const allocation=projectileCount?resolveCommonPlayAllocation({
    id:`${metadata.spellId}:projectile-allocation`,idempotencyKey:`${metadata.spellId}:${runtime.revision}:projectile-allocation`,
    expectedRevision:runtime.revision,authority:internal.sessionMode==="initiative"?"actor-owner":"dm",responderId:sourceAction.actorId,
    plan:{units:{value:projectileCount},minimumPerTarget:1,maximumPerTarget:projectileCount,totalMustMatch:true},
    candidateTargetIds:[...new Set(targetIds)],allocations:allocationEntriesFromTargetSequence(targetIds),
  },runtime.revision):undefined;
  if(allocation&&allocation.status!=="resolved") {
    internal.resolution=resolutionFromCast(sourceAction.name,actionId,sourceAction.actorId,targetIds,slotLevel,{
      status:"rejected",state:runtime,spellId:metadata.spellId,slotLevel,error:allocation.reason,events:[],results:{},
    },[]);
    return this.getSnapshot();
  }
  const uniqueTargetIds=allocation&&allocation.status==="resolved"?allocation.allocations.map((entry)=>entry.targetId):targetIds;
  let targets:SpellCastTarget[];
  try {
    targets=uniqueTargetIds.map((targetId)=>targetFacts(this,internal,sourceAction.actorId,targetId,spellSaveAbility(definition)));
  } catch(error) {
    internal.resolution=resolutionFromCast(sourceAction.name,actionId,sourceAction.actorId,targetIds,slotLevel,{
      status:"rejected",state:runtime,spellId:metadata.spellId,slotLevel,
      error:error instanceof Error?error.message:String(error),events:[],results:{},
    },[]);
    return this.getSnapshot();
  }

  let componentPreparation;
  try {
    componentPreparation=definition.components&&metadata.castSource!=="item"?prepareCharacterSpellComponents({
      character:internal.activeCharacter,requirements:definition.components,
      status:internal.scene.entities.find((entry)=>entry.id===sourceAction.actorId)?.status??[],targetCount:Math.max(1,uniqueTargetIds.length),
    }):undefined;
  } catch(error) {
    internal.resolution=resolutionFromCast(sourceAction.name,actionId,sourceAction.actorId,targetIds,slotLevel,{
      status:"rejected",state:runtime,spellId:metadata.spellId,slotLevel,error:error instanceof Error?error.message:String(error),events:[],results:{},
    },[]);
    return this.getSnapshot();
  }
  const requestBase={
    id:`production-spell-cast.${metadata.spellId}.${Date.now()}`,
    actorId:sourceAction.actorId,
    spellId:metadata.spellId,
    source:metadata.castSource,
    expectedRevision:runtime.revision,
    caster,targets,slotLevel,
    componentContext:componentPreparation?.context,
    useActionEconomy:internal.sessionMode==="initiative",
    turnId,
  };
  let result:SpellCastResolution;
  let authoritativeDice:number[]=[];
  let counterable=false;
  let interruptionRequest:SpellCastRequest|undefined;
  let interruptionCleanup:ResolutionOperation[]=[];
  let resolveOriginal:((state:RulesRuntimeState)=>SpellCastResolution)|undefined;
  const castingDurationSeconds=ritual?(definition.castingDurationSeconds??6)+600:definition.castingDurationSeconds;
  const castingKind=ritual?"ritual" as const:"long-cast" as const;
  const casting=castingDurationSeconds?activeCastingProcess(runtime,sourceAction.actorId,metadata.spellId,castingKind):undefined;
  if(castingDurationSeconds&&!casting) {
    const pending=beginCastingProcess({state:runtime,id:`${requestBase.id}:process`,actorId:sourceAction.actorId,definitionId:metadata.spellId,kind:castingKind,requiredSeconds:castingDurationSeconds,useActionEconomy:requestBase.useActionEconomy,replaceActive:true});
    const committed=resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,runtime,pending);
    result=committed.status==="committed"
      ? {status:"committed",state:committed.state,spellId:metadata.spellId,events:committed.events,results:committed.results,consumedMaterials:[]}
      : {status:"rejected",state:runtime,spellId:metadata.spellId,error:committed.error,failedOperationId:committed.failedOperationId,events:[],results:{}};
  } else if(casting) {
    const progress=advanceCastingProcess({state:runtime,id:`${requestBase.id}:progress`,actorId:sourceAction.actorId,definitionId:metadata.spellId,elapsedSeconds:6,useActionEconomy:requestBase.useActionEconomy});
    if(progress.activity.status!=="completed") {
      const committed=resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,runtime,{id:`${requestBase.id}:progress`,actorId:sourceAction.actorId,sourceId:metadata.spellId,expectedRevision:runtime.revision,operations:progress.operations});
      result=committed.status==="committed"
        ? {status:"committed",state:committed.state,spellId:metadata.spellId,events:committed.events,results:committed.results,consumedMaterials:[]}
        : {status:"rejected",state:runtime,spellId:metadata.spellId,error:committed.error,failedOperationId:committed.failedOperationId,events:[],results:{}};
    } else {
      const dice=spellRuntimeDice(this,actionId,definition,slotLevel,caster.characterLevel,uniqueTargetIds);
      authoritativeDice=dice.authoritative;
      const projectileAllocations=allocation?.status==="resolved"?allocation.allocations.map((entry)=>({targetId:entry.targetId,count:entry.units})):undefined;
      interruptionCleanup=cancelCastingProcessOperations(casting.effect,sourceAction.actorId,"casting completed");
      interruptionRequest={...requestBase,dice:dice.request,projectileAllocations};
      resolveOriginal=(state)=>{
        const request={...interruptionRequest!,expectedRevision:state.revision};
        try {
          const materials=spellPaymentRuntimeContext({state,character:internal.activeCharacter,actorId:sourceAction.actorId,consumed:componentPreparation?.resolution.consumed??[],itemCost:sourceAction.itemCost});
          const compilation=compileSpellCast(definition,materials.state,request);
          compilation.pending.operations=[...interruptionCleanup,...materials.operations,...compilation.pending.operations];
          const resolved=resolveCompiledSpellCast(SIMPLEVTT_APP_RULES_PROFILE,materials.state,request,compilation);
          if(resolved.status==="committed")stripSpellPaymentRuntimeResources(resolved.state,sourceAction.actorId,materials.resourceIds);
          return resolved;
        } catch(error) {
          return {status:"rejected",state,spellId:metadata.spellId,slotLevel,error:error instanceof Error?error.message:String(error),events:[],results:{}};
        }
      };
      result=resolveOriginal(runtime);
      counterable=true;
    }
  } else {
    const dice=spellRuntimeDice(this,actionId,definition,slotLevel,caster.characterLevel,uniqueTargetIds);
    authoritativeDice=dice.authoritative;
    const projectileAllocations=allocation?.status==="resolved"?allocation.allocations.map((entry)=>({targetId:entry.targetId,count:entry.units})):undefined;
    interruptionRequest={...requestBase,dice:dice.request,projectileAllocations};
    resolveOriginal=(state)=>{
      const request={...interruptionRequest!,expectedRevision:state.revision};
      try {
        const materials=spellPaymentRuntimeContext({state,character:internal.activeCharacter,actorId:sourceAction.actorId,consumed:componentPreparation?.resolution.consumed??[],itemCost:sourceAction.itemCost});
        const compilation=compileSpellCast(definition,materials.state,request);
        compilation.pending.operations=[...materials.operations,...compilation.pending.operations];
        const resolved=resolveCompiledSpellCast(SIMPLEVTT_APP_RULES_PROFILE,materials.state,request,compilation);
        if(resolved.status==="committed")stripSpellPaymentRuntimeResources(resolved.state,sourceAction.actorId,materials.resourceIds);
        return resolved;
      } catch(error) {
        return {status:"rejected",state,spellId:metadata.spellId,slotLevel,error:error instanceof Error?error.message:String(error),events:[],results:{}};
      }
    };
    result=resolveOriginal(runtime);
    counterable=true;
  }
  const targetNames=targetIds.map((id)=>internal.scene.entities.find((entry)=>entry.id===id)?.name??id);
  internal.resolution=resolutionFromCast(sourceAction.name,actionId,sourceAction.actorId,targetIds,slotLevel,result,authoritativeDice,targetNames);
  if (result.status==="rejected") return this.getSnapshot();
  if(counterable&&resolveOriginal&&interruptionRequest){
    const candidates=interruptionCandidates(this,internal,snapshot,sourceAction,definition,runtime);
    if(candidates.length){
      return offerNextSpellInterruption(this,{
        resolutionId:internal.resolution.id,actionId,actionName:sourceAction.name,actorId:sourceAction.actorId,targetIds:[...targetIds],slotLevel,turnId,authoritativeDice:[...authoritativeDice],
        definition,request:interruptionRequest,cleanupOperations:interruptionCleanup,inputState:runtime,workingState:runtime,events:[],candidates,candidateIndex:0,resolveOriginal,
      });
    }
  }
  const events=eventHistory(runtime,result,sourceAction.actorId,turnId,slotLevel);
  return commitProductionRuntimeResolution(this,runtime,{status:"committed",state:result.state,events,results:result.results},{
    resolutionId:internal.resolution.id,actionId,actionName:sourceAction.name,actorId:sourceAction.actorId,targetIds,
    targetNames,
    compact:internal.resolution.compact,detail:internal.resolution.detail,provenance:internal.resolution.provenance,
    calculatedOutcome:internal.resolution.calculatedOutcome,finalOutcome:internal.resolution.finalOutcome,
    rollKind:internal.resolution.rollKind,authoritativeDice,rollTotal:internal.resolution.rollTotal,
    saveResults:internal.resolution.saveResults,
  });
};

MockAdapter.prototype.respondToInterrupt=async function respondToSpellInterruption(accept:boolean,selectedIds?:string[]) {
  const pending=pendingSpellInterruptions.get(this);
  const internal=this as unknown as Internal;
  if(!pending||internal.resolution?.id!==pending.resolutionId||internal.resolution.interrupt?.id!==`${pending.resolutionId}:counter:${pending.candidateIndex}`) {
    return previousRespondToInterrupt.call(this,accept,selectedIds);
  }
  if(selectedIds!==undefined)return internal.getSnapshot();
  const candidate=pending.candidates[pending.candidateIndex-1];
  if(!accept)return offerNextSpellInterruption(this,pending);
  try {
    const counter=await resolveCounterCast(this,internal,pending,candidate);
    if(counter.status==="rejected"){
      internal.resolution.detail.push(`주문 차단 거부: ${counter.error}`);
      return offerNextSpellInterruption(this,pending);
    }
    pending.workingState=counter.state;
    pending.events.push(...counter.events);
    if(counter.countered){pendingSpellInterruptions.delete(this);return finishInterruptedSpell(this,pending,true);}
    return offerNextSpellInterruption(this,pending);
  } catch(error) {
    internal.resolution.detail.push(`주문 차단 거부: ${error instanceof Error?error.message:String(error)}`);
    return offerNextSpellInterruption(this,pending);
  }
};
