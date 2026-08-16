import "./spellcastingRuntimeContracts";
import type { AppSnapshot, ResolutionView, SceneEntity } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { projectRuntimeEventsToActivity } from "./realActivityProjectionService";
import { recordRuntimeResolutionEvents } from "./runtimeResolutionEventHistory";
import { selectedCombatSpellSlot } from "./spellcastingRuntimeSelection";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { spellcastingTurnStateChange, type SpellcastingTurnSnapshot } from "../domain/runtimeStateChange";
import { resolveSpellCast, type SpellCasterContext, type SpellCastResolution, type SpellCastTarget } from "../domain/spellcasting";
import { spellMechanicById } from "../domain/spellMechanics";
import type { ResolutionEvent } from "../domain/resolutionTypes";
import type { RulesRuntimeState } from "../domain/combatState";

const FIRE_BOLT_ACTION="action.fire-bolt";
const MAGIC_MISSILE_ACTION="action.magic-missile";
const SUPPORTED_ACTIONS=new Set([FIRE_BOLT_ACTION,MAGIC_MISSILE_ACTION]);

type Internal={
  scene:AppSnapshot["scene"];
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
  const distance=actorId===targetId ? 0 : Number.parseInt(target.distance??"",10);
  if (!Number.isFinite(distance)) throw new Error(`production spell target has no authoritative distance: ${actorId} -> ${targetId}`);
  return {
    id:target.id,
    kind:"creature",
    relation:relation(actor,target),
    distanceFeet:distance,
    visible:true,
    cover:"none",
    ac:target.ac,
    creatureKind:target.kind==="character" ? "character" : "monster",
    saveModifiers:{},
    targetCanSeeCaster:true,
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

function spellDice(adapter:MockAdapter,actionId:string,spellId:string,slotLevel:number|undefined) {
  if (actionId===FIRE_BOLT_ACTION) {
    const attackFace=d20(adapter,actionId,0);
    const damageFace=boundedFace(adapter,actionId,1,10);
    return {
      authoritative:[attackFace,damageFace],
      request:{
        attack:{id:`${spellId}:attack`,purpose:`${spellId} spell attack`,sides:20,faces:[attackFace]},
        effectFaces:[damageFace],
      },
    };
  }
  const count=3+Math.max(0,(slotLevel??1)-1);
  const projectileFaces=Array.from({length:count},(_,index)=>boundedFace(adapter,actionId,index,4));
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
  if (!SUPPORTED_ACTIONS.has(actionId)) return previousResolveAction.call(this,actionId,targetIds);

  const internal=this as unknown as Internal;
  const snapshot=await this.getSnapshot();
  const sourceAction=(snapshot.scene.actionsByActor[snapshot.activeCharacter.id]??[]).find((entry)=>entry.id===actionId);
  const metadata=sourceAction?.spellCast;
  const runtime=snapshotAdapterTurnRuntimeState(this,internal.scene);
  const caster=sourceAction ? casterFromHud(snapshot,sourceAction.actorId) : undefined;
  const definition=metadata ? spellMechanicById(metadata.spellId) : undefined;
  if (!sourceAction||!metadata||metadata.runtimeSupport!=="combat-executable"||!runtime||!caster||!definition) {
    return previousResolveAction.call(this,actionId,targetIds);
  }

  const selected=selectedCombatSpellSlot(sourceAction.actorId,metadata.baseLevel||1);
  const slotLevel=metadata.baseLevel===0 ? undefined : Math.max(metadata.baseLevel,selected);
  const turnId=currentTurnId(runtime);
  let targets:SpellCastTarget[];
  try {
    targets=targetIds.map((targetId)=>targetFacts(internal,sourceAction.actorId,targetId));
  } catch(error) {
    internal.resolution=resolutionFromCast(sourceAction.name,actionId,sourceAction.actorId,targetIds,slotLevel,{
      status:"rejected",state:runtime,spellId:metadata.spellId,slotLevel,
      error:error instanceof Error?error.message:String(error),events:[],results:{},
    },[]);
    return this.getSnapshot();
  }

  const dice=spellDice(this,actionId,metadata.spellId,slotLevel);
  const result=resolveSpellCast(SIMPLEVTT_APP_RULES_PROFILE,definition,runtime,{
    id:`production-spell-cast.${metadata.spellId}.${Date.now()}`,
    actorId:sourceAction.actorId,
    spellId:metadata.spellId,
    source:metadata.castSource,
    expectedRevision:runtime.revision,
    caster,targets,slotLevel,
    componentsSatisfied:true,
    useActionEconomy:true,
    turnId,
    dice:dice.request,
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
