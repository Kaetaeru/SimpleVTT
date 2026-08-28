import "./spellcastingRuntimeContracts";
import type { AppSnapshot, ResolutionView, SceneEntity } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { projectRuntimeEventsToActivity } from "./realActivityProjectionService";
import { recordRuntimeResolutionEvents } from "./runtimeResolutionEventHistory";
import { selectedCombatSpellSlot } from "./spellcastingRuntimeSelection";
import { commitAdapterTurnRuntimeState, ensureAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { spellcastingTurnStateChange, type SpellcastingTurnSnapshot } from "../domain/runtimeStateChange";
import { resolveSpellCast, spellMultiAttackCount, type SpellCasterContext, type SpellCastResolution, type SpellCastTarget } from "../domain/spellcasting";
import { spellMechanicById } from "../domain/spellMechanics";
import type { SpellMechanicDefinition } from "../domain/spellcasting";
import type { ResolutionEvent } from "../domain/resolutionTypes";
import type { RulesRuntimeState } from "../domain/combatState";
import { resolveRuntimeTargetingFact } from "./realRuntimeAttackFactProvider";
import { isExecutableSpellRuntimeSupport } from "./spellcastingRuntimeContracts";
import { allocationEntriesFromTargetSequence, resolveCommonPlayAllocation } from "../domain/commonPlayAllocationRuntime";

type Internal={
  scene:AppSnapshot["scene"];
  sessionMode:AppSnapshot["sessionMode"];
  resolution:ResolutionView|null;
  activity:AppSnapshot["activity"];
  lastBefore?:unknown;
  lastResolutionId?:string|null;
  getSnapshot():Promise<AppSnapshot>;
};

type DiceAdapter={d20(actionId:string,index?:number):number};

const previousResolveAction=MockAdapter.prototype.resolveAction;

function relation(actor:SceneEntity,target:SceneEntity):SpellCastTarget["relation"] {
  if (actor.id===target.id) return "self";
  return actor.side===target.side ? "ally" : "enemy";
}

function targetFacts(internal:Internal,actorId:string,targetId:string):SpellCastTarget {
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
    saveModifiers:{},
    targetCanSeeCaster:spatial.targetCanSeeAttacker,
  };
}

function casterFromHud(snapshot:AppSnapshot,actorId:string):SpellCasterContext|undefined {
  const hud=snapshot.scene.spellcastingByActor?.[actorId];
  const level=snapshot.activeCharacter.id===actorId
    ? snapshot.activeCharacter.level
    : snapshot.characters.find((entry)=>entry.id===actorId)?.level;
  if (!hud||!level) return undefined;
  return {
    characterLevel:level,
    spellAttackModifier:hud.spellAttackModifier,
    spellSaveDc:hud.spellSaveDc,
    spellcastingAbilityModifier:hud.spellcastingAbilityModifier,
    preparedSpellIds:[...hud.preparedSpellIds],
    alwaysPreparedSpellIds:[...hud.alwaysPreparedSpellIds],
    cantripSpellIds:[...hud.cantripSpellIds],
    slotResourceIds:Object.fromEntries(hud.slots.map((slot)=>[slot.level,`spell-slot-${slot.level}`])),
  };
}

function d20(adapter:MockAdapter,actionId:string,index:number) {
  return (adapter as unknown as DiceAdapter).d20(actionId,index);
}

function boundedFace(adapter:MockAdapter,actionId:string,index:number,sides:number) {
  return ((d20(adapter,actionId,index)-1)%sides)+1;
}

function formulaCount(definition:SpellMechanicDefinition,slotLevel:number|undefined,characterLevel:number) {
  if (definition.primary.kind!=="attack-damage"&&definition.primary.kind!=="save-damage"&&definition.primary.kind!=="healing"&&definition.primary.kind!=="temporary-hp") return 0;
  const formula=definition.primary.dice;
  const cantripSteps=formula.cantripScaling?[5,11,17].filter((level)=>characterLevel>=level).length:0;
  return formula.count+cantripSteps+Math.max(0,(slotLevel??definition.baseLevel)-definition.baseLevel)*(formula.dicePerSlotAboveBase??0);
}

function spellDice(adapter:MockAdapter,actionId:string,definition:SpellMechanicDefinition,slotLevel:number|undefined,characterLevel:number,targetIds:string[]) {
  const primary=definition.primary;
  if (primary.kind==="tracked-effect"||primary.kind==="full-healing") return {authoritative:[],request:{}};
  if (primary.kind==="power-word-kill") {
    const effectFaces=Array.from({length:primary.fallbackDamage.count},(_,index)=>boundedFace(adapter,actionId,index,primary.fallbackDamage.sides));
    return {authoritative:effectFaces,request:{effectFaces}};
  }
  if (primary.kind==="attack-damage") {
    const attackFace=d20(adapter,actionId,0);
    const count=formulaCount(definition,slotLevel,characterLevel);
    const effectFaces=Array.from({length:count},(_,index)=>boundedFace(adapter,actionId,index+1,primary.dice.sides));
    return {
      authoritative:[attackFace,...effectFaces],
      request:{
        attack:{id:`${definition.spellId}:attack`,purpose:`${definition.spellId} spell attack`,sides:20 as const,faces:[attackFace]},
        effectFaces,
      },
    };
  }
  if (primary.kind==="multi-attack-damage") {
    const attackCount=spellMultiAttackCount(definition,characterLevel,slotLevel);
    const facesPerAttack=primary.dicePerAttack.count;
    const attackInstances=Array.from({length:attackCount},(_,index)=>{
      const targetId=targetIds[index%targetIds.length];
      const offset=index*(facesPerAttack+1);
      const attackFace=d20(adapter,actionId,offset);
      const effectFaces=Array.from({length:facesPerAttack},(_,faceIndex)=>boundedFace(adapter,actionId,offset+faceIndex+1,primary.dicePerAttack.sides));
      return {targetId,attack:{id:`${definition.spellId}:attack:${index}`,purpose:`${definition.spellId} spell attack ${index+1}`,sides:20 as const,faces:[attackFace]},effectFaces};
    });
    return {authoritative:attackInstances.flatMap((entry)=>[entry.attack.faces[0],...entry.effectFaces]),request:{attackInstances}};
  }
  if (primary.kind==="save-damage") {
    const count=formulaCount(definition,slotLevel,characterLevel);
    const effectFaces=Array.from({length:count},(_,index)=>boundedFace(adapter,actionId,index,primary.dice.sides));
    const saves=Object.fromEntries(targetIds.map((targetId,index)=>[targetId,{id:`${definition.spellId}:save:${targetId}`,purpose:`${definition.spellId} saving throw`,sides:20 as const,faces:[d20(adapter,actionId,count+index)]}]));
    return {authoritative:[...effectFaces,...Object.values(saves).flatMap((save)=>save.faces)],request:{effectFaces,saves}};
  }
  if (primary.kind==="save-compound-damage") {
    let offset=0;
    const componentFaces=primary.components.map((component)=>{
      const count=component.dice.count+Math.max(0,(slotLevel??definition.baseLevel)-definition.baseLevel)*(component.dice.dicePerSlotAboveBase??0);
      const faces=Array.from({length:count},(_,index)=>boundedFace(adapter,actionId,offset+index,component.dice.sides));
      offset+=count;
      return faces;
    });
    const saves=Object.fromEntries(targetIds.map((targetId,index)=>[targetId,{id:`${definition.spellId}:save:${targetId}`,purpose:`${definition.spellId} saving throw`,sides:20 as const,faces:[d20(adapter,actionId,offset+index)]}]));
    return {authoritative:[...componentFaces.flat(),...Object.values(saves).flatMap((save)=>save.faces)],request:{componentFaces,saves}};
  }
  if (primary.kind==="healing"||primary.kind==="temporary-hp") {
    const count=formulaCount(definition,slotLevel,characterLevel);
    const effectFaces=Array.from({length:count},(_,index)=>boundedFace(adapter,actionId,index,primary.dice.sides));
    return {authoritative:[...effectFaces],request:{effectFaces}};
  }
  if (primary.kind==="save-effect") {
    const saves=Object.fromEntries(targetIds.map((targetId,index)=>[targetId,{id:`${definition.spellId}:save:${targetId}`,purpose:`${definition.spellId} saving throw`,sides:20 as const,faces:[d20(adapter,actionId,index)]}]));
    return {authoritative:Object.values(saves).flatMap((save)=>save.faces),request:{saves}};
  }
  const count=primary.baseProjectiles+Math.max(0,(slotLevel??definition.baseLevel)-definition.baseLevel)*(primary.projectilesPerSlotAboveBase??0);
  const projectileFaces=Array.from({length:count},(_,index)=>boundedFace(adapter,actionId,index,primary.projectileDice.sides));
  return {authoritative:[...projectileFaces],request:{projectileFaces}};
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

function resolutionFromCast(
  actionName:string,
  actionId:string,
  actorId:string,
  targetIds:string[],
  slotLevel:number|undefined,
  result:SpellCastResolution,
  authoritativeDice:number[],
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
  return {
    id:result.events[0]?.resolutionId??`production-spell.${Date.now()}`,
    actorId,targetIds,actionId,actionName,
    rollKind:"effect",stage:"complete",authoritativeDice,
    saveResults:[],damageComponents:[],
    compact:`${actionName}${slotLevel?` · ${slotLevel}레벨 슬롯`:""} · ${outcome}`,
    detail:result.events.map((event)=>event.summary),
    provenance:[...new Set(result.events.flatMap((event)=>event.provenance.map((entry)=>entry.source)))],
    calculatedOutcome:outcome,finalOutcome:outcome,
    stateChanges:result.events.flatMap((event)=>event.stateChanges.map((change)=>`${event.summary} · ${change.kind}`)),
    adjudicated:false,canAdvance:false,
  };
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
  const definition=metadata ? spellMechanicById(metadata.spellId) : undefined;
  if (!sourceAction||!metadata||!isExecutableSpellRuntimeSupport(metadata.runtimeSupport)||!runtime||!caster||!definition) {
    return previousResolveAction.call(this,actionId,targetIds);
  }

  const selected=selectedCombatSpellSlot(sourceAction.actorId,metadata.baseLevel||1);
  const slotLevel=metadata.baseLevel===0 ? undefined : Math.max(metadata.baseLevel,selected);
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
    targets=uniqueTargetIds.map((targetId)=>targetFacts(internal,sourceAction.actorId,targetId));
  } catch(error) {
    internal.resolution=resolutionFromCast(sourceAction.name,actionId,sourceAction.actorId,targetIds,slotLevel,{
      status:"rejected",state:runtime,spellId:metadata.spellId,slotLevel,
      error:error instanceof Error?error.message:String(error),events:[],results:{},
    },[]);
    return this.getSnapshot();
  }

  const dice=spellDice(this,actionId,definition,slotLevel,caster.characterLevel,uniqueTargetIds);
  const projectileAllocations=allocation?.status==="resolved"?allocation.allocations.map((entry)=>({targetId:entry.targetId,count:entry.units})):undefined;
  const result=resolveSpellCast(SIMPLEVTT_APP_RULES_PROFILE,definition,runtime,{
    id:`production-spell-cast.${metadata.spellId}.${Date.now()}`,
    actorId:sourceAction.actorId,
    spellId:metadata.spellId,
    source:metadata.castSource,
    expectedRevision:runtime.revision,
    caster,targets,slotLevel,
    componentsSatisfied:true,
    useActionEconomy:internal.sessionMode==="initiative",
    turnId,
    dice:dice.request,
    projectileAllocations,
  });
  internal.resolution=resolutionFromCast(sourceAction.name,actionId,sourceAction.actorId,targetIds,slotLevel,result,dice.authoritative);
  if (result.status==="rejected") return this.getSnapshot();

  if (!commitAdapterTurnRuntimeState(this,internal.scene,runtime.revision,result.state)) {
    internal.resolution=resolutionFromCast(sourceAction.name,actionId,sourceAction.actorId,targetIds,slotLevel,{
      status:"rejected",state:runtime,spellId:metadata.spellId,slotLevel,
      error:"turn runtime revision changed before production spell commit",events:[],results:{},
    },dice.authoritative);
    return this.getSnapshot();
  }

  const events=eventHistory(runtime,result,sourceAction.actorId,turnId,slotLevel);
  const actorName=internal.scene.entities.find((entry)=>entry.id===sourceAction.actorId)?.name??sourceAction.actorId;
  internal.activity.unshift(projectRuntimeEventsToActivity({
    id:internal.resolution.id,
    actorName,
    title:`${sourceAction.name} 시전`,
    summary:internal.resolution.compact,
    events,
  }));
  recordRuntimeResolutionEvents(this,internal.resolution.id,events);
  internal.lastBefore=null;
  internal.lastResolutionId=internal.resolution.id;
  return this.getSnapshot();
};
