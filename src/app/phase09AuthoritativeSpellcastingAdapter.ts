import "./spellcastingRuntimeAdapter";
import "./phase09RealRuntimeAttackAdapter";
import "./classFeatureSpellRuntimeAdapter";
import "./spellcastingRuntimeContracts";
import type { AppSnapshot, ResolutionView, SceneEntity } from "./contracts";
import type { SpellcastingHudVm } from "./spellcastingRuntimeContracts";
import { MockAdapter } from "./mockAdapter";
import { projectRuntimeEventsToActivity } from "./realActivityProjectionService";
import { recordRuntimeResolutionEvents } from "./runtimeResolutionEventHistory";
import { selectedCombatSpellSlot } from "./spellcastingRuntimeSelection";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import type { RulesRuntimeState } from "../domain/combatState";
import { spellcastingTurnStateChange, type SpellcastingTurnSnapshot } from "../domain/runtimeStateChange";
import type { SpellCasterContext, SpellCastResolution, SpellCastTarget } from "../domain/spellcasting";
import { resolveSpellCast } from "../domain/spellcasting";
import { spellMechanicById } from "../domain/spellMechanics";
import type { ResolutionEvent } from "../domain/resolutionTypes";

const NO_SLOT="사용 가능한 주문 슬롯이 없습니다.";
const SLOT_ALREADY_USED="이번 턴에는 이미 주문 슬롯을 소비해 주문을 시전했습니다.";

interface AdapterInternalState {
  scene:AppSnapshot["scene"];
  sessionMode:AppSnapshot["sessionMode"];
  activeCharacter:AppSnapshot["activeCharacter"];
  characters:AppSnapshot["characters"];
  resolution:ResolutionView|null;
  activity:AppSnapshot["activity"];
  lastBefore?:unknown;
  lastResolutionId?:string|null;
  getSnapshot():Promise<AppSnapshot>;
}

const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
const previousResolveAction=MockAdapter.prototype.resolveAction;

function referenceDistance(actorId:string,targetId:string,target:SceneEntity) {
  if (actorId===targetId) return 0;
  const existing:Record<string,number>={
    "char.mira->char.aelar":25,
    "char.mira->combatant.goblin-a":28,
    "char.mira->combatant.goblin-b":38,
    "char.mira->combatant.wolf":20,
    "char.mira->combatant.training-guardian":24,
  };
  const fixed=existing[`${actorId}->${targetId}`];
  if (fixed!==undefined) return fixed;
  const parsed=Number.parseInt(target.distance ?? "",10);
  if (Number.isFinite(parsed)) return parsed;
  throw new Error(`reference geometry has no authoritative distance for ${actorId} -> ${targetId}`);
}

function relation(actor:SceneEntity,target:SceneEntity):SpellCastTarget["relation"] {
  if (actor.id===target.id) return "self";
  return actor.side===target.side ? "ally" : "enemy";
}

function targetFacts(internal:AdapterInternalState,actorId:string,targetId:string):SpellCastTarget {
  const actor=internal.scene.entities.find((entry)=>entry.id===actorId);
  const target=internal.scene.entities.find((entry)=>entry.id===targetId);
  if (!actor||!target) throw new Error(`reference scene target not found: ${targetId}`);
  return {
    id:target.id,
    kind:"creature",
    relation:relation(actor,target),
    distanceFeet:referenceDistance(actorId,targetId,target),
    visible:true,
    cover:"none",
    ac:target.ac,
    creatureKind:target.kind==="character" ? "character" : "monster",
    saveModifiers:{},
    targetCanSeeCaster:true,
  };
}

function actorLevel(snapshot:AppSnapshot,actorId:string) {
  if (snapshot.activeCharacter.id===actorId) return snapshot.activeCharacter.level;
  return snapshot.characters.find((entry)=>entry.id===actorId)?.level;
}

function casterFromHud(snapshot:AppSnapshot,actorId:string,hud:SpellcastingHudVm):SpellCasterContext|undefined {
  const level=actorLevel(snapshot,actorId);
  if (!level) return undefined;
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

function slotHud(state:RulesRuntimeState,actorId:string) {
  return (state.combatants[actorId]?.resources ?? [])
    .filter((resource)=>resource.id.startsWith("spell-slot-"))
    .map((resource)=>({
      level:Number(resource.id.slice("spell-slot-".length)),
      current:resource.current,
      max:resource.maximum,
    }))
    .filter((slot)=>Number.isInteger(slot.level)&&slot.level>0)
    .sort((left,right)=>left.level-right.level);
}

function currentTurnId(state:RulesRuntimeState) {
  return state.clock.activeActorId ? `${state.clock.round}:${state.clock.activeActorId}` : undefined;
}

function slottedSpellCastThisTurn(state:RulesRuntimeState,actorId:string) {
  const turnId=currentTurnId(state);
  return Boolean(turnId && state.spellcastingTurn?.turnId===turnId && state.spellcastingTurn.slottedCasterIds.includes(actorId));
}

function seedAuthoritativeSlots(
  adapter:MockAdapter,
  internal:AdapterInternalState,
  snapshot:AppSnapshot,
  actorId:string,
) {
  let state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  if (!state) return undefined;
  const combatant=state.combatants[actorId];
  const hud=snapshot.scene.spellcastingByActor?.[actorId];
  if (!combatant||!hud) return state;
  const missing=hud.slots.filter((slot)=>!combatant.resources.some((resource)=>resource.id===`spell-slot-${slot.level}`));
  if (!missing.length) return state;
  for (const slot of missing) {
    combatant.resources.push({
      id:`spell-slot-${slot.level}`,
      label:`${slot.level}레벨 주문 슬롯`,
      current:slot.current,
      maximum:slot.max,
      recovery:{ longRest:"all" },
    });
  }
  const expected=state.revision;
  state.revision=expected+1;
  if (!commitAdapterTurnRuntimeState(adapter,internal.scene,expected,state)) return undefined;
  return snapshotAdapterTurnRuntimeState(adapter,internal.scene);
}

function applyAuthoritativeHud(
  adapter:MockAdapter,
  internal:AdapterInternalState,
  snapshot:AppSnapshot,
) {
  const actorIds=Object.keys(snapshot.scene.spellcastingByActor ?? {});
  if (!actorIds.length) return snapshot;
  let runtime:RulesRuntimeState|undefined;
  for (const actorId of actorIds) {
    runtime=seedAuthoritativeSlots(adapter,internal,snapshot,actorId) ?? runtime;
    if (!runtime?.combatants[actorId]) continue;
    const hud=snapshot.scene.spellcastingByActor![actorId];
    hud.slots=slotHud(runtime,actorId);
    hud.slottedSpellCastThisTurn=slottedSpellCastThisTurn(runtime,actorId);
  }
  if (!runtime) return snapshot;

  for (const actions of Object.values(snapshot.scene.actionsByActor)) {
    for (const action of actions) {
      const metadata=action.spellCast;
      if (!metadata || metadata.runtimeSupport!=="combat-executable" || metadata.baseLevel===0) continue;
      const hud=snapshot.scene.spellcastingByActor?.[action.actorId];
      if (!hud) continue;
      const hasSlot=hud.slots.some((slot)=>slot.level>=metadata.baseLevel&&slot.current>0);
      const used=hud.slottedSpellCastThisTurn;
      if (!hasSlot) {
        action.available=false;
        action.disabledReason=NO_SLOT;
      } else if (used) {
        action.available=false;
        action.disabledReason=SLOT_ALREADY_USED;
      } else if (action.disabledReason===NO_SLOT||action.disabledReason===SLOT_ALREADY_USED) {
        action.available=true;
        action.disabledReason=undefined;
      }
    }
  }
  return snapshot;
}

function facesForHealingWord(slotLevel:number) {
  const count=2+Math.max(0,slotLevel-1)*2;
  const pattern=[3,4,2,3,4,2,3,4,2,3,4,2,3,4,2,3];
  return pattern.slice(0,count);
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
      id:`spell-rejected.${Date.now()}`,
      actorId,targetIds,actionId,actionName,
      rollKind:"effect",stage:"complete",authoritativeDice,
      saveResults:[],damageComponents:[],
      compact:`시전 거부 · ${result.error}`,
      detail:[result.error],
      provenance:["Phase 09 · authoritative TurnRuntimeSession spell cast · atomic rejection"],
      calculatedOutcome:"시전 거부",finalOutcome:"시전 거부",stateChanges:[],adjudicated:false,canAdvance:false,
    };
  }
  const healing=Object.values(result.results).find((entry)=>Boolean(entry&&typeof entry==="object"&&"restored" in (entry as Record<string,unknown>))) as { restored?:number }|undefined;
  const roll=Object.values(result.results).find((entry)=>Boolean(entry&&typeof entry==="object"&&"diceTotal" in (entry as Record<string,unknown>))) as { total?:number }|undefined;
  const outcome=healing?.restored!==undefined ? `${healing.restored} HP 회복` : result.events.at(-1)?.summary ?? "주문 적용";
  return {
    id:result.events[0]?.resolutionId ?? `spell.${Date.now()}`,
    actorId,targetIds,actionId,actionName,
    rollKind:healing ? "healing" : "effect",stage:"complete",authoritativeDice,
    rollTotal:roll?.total,saveResults:[],damageComponents:[],
    compact:`${actionName}${slotLevel ? ` · ${slotLevel}레벨 슬롯` : ""} · ${outcome}`,
    detail:result.events.map((event)=>event.summary),
    provenance:[...new Set(result.events.flatMap((event)=>event.provenance.map((entry)=>entry.source)))],
    calculatedOutcome:outcome,finalOutcome:outcome,
    stateChanges:result.events.flatMap((event)=>event.stateChanges.map((change)=>`${event.summary} · ${change.kind}`)),
    adjudicated:false,canAdvance:false,
  };
}

function eventHistoryForSpellCast(
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

MockAdapter.prototype.getSnapshot=async function getSnapshotWithAuthoritativeSpellcasting() {
  const snapshot=await previousGetSnapshot.call(this);
  const internal=this as unknown as AdapterInternalState;
  if (!snapshotAdapterTurnRuntimeState(this,internal.scene)) return snapshot;
  return applyAuthoritativeHud(this,internal,snapshot);
};

MockAdapter.prototype.resolveAction=async function resolveActionThroughAuthoritativeSpellRuntime(actionId,targetIds) {
  const internal=this as unknown as AdapterInternalState;
  const baseline=await previousGetSnapshot.call(this);
  const sourceAction=Object.values(baseline.scene.actionsByActor).flat().find((entry)=>entry.id===actionId);
  const metadata=sourceAction?.spellCast;
  const existingRuntime=snapshotAdapterTurnRuntimeState(this,internal.scene);
  if (!sourceAction || !metadata || metadata.runtimeSupport!=="combat-executable" || !existingRuntime) {
    return previousResolveAction.call(this,actionId,targetIds);
  }
  const runtime=seedAuthoritativeSlots(this,internal,baseline,sourceAction.actorId);
  const hud=baseline.scene.spellcastingByActor?.[sourceAction.actorId];
  const caster=hud ? casterFromHud(baseline,sourceAction.actorId,hud) : undefined;
  const definition=spellMechanicById(metadata.spellId);
  if (!runtime||!caster||!definition) return previousResolveAction.call(this,actionId,targetIds);

  const selected=selectedCombatSpellSlot(sourceAction.actorId,metadata.baseLevel||1);
  const slotLevel=metadata.baseLevel===0 ? undefined : Math.max(metadata.baseLevel,selected);
  const castId=`spell-cast.${metadata.spellId}.${Date.now()}`;
  const faces=metadata.spellId==="dnd.srd521.spell.healing-word" ? facesForHealingWord(slotLevel ?? 1) : [];
  let targets:SpellCastTarget[];
  try {
    targets=targetIds.map((targetId)=>targetFacts(internal,sourceAction.actorId,targetId));
  } catch(error) {
    internal.resolution=resolutionFromCast(sourceAction.name,actionId,sourceAction.actorId,targetIds,slotLevel,{
      status:"rejected",state:runtime,spellId:metadata.spellId,slotLevel,
      error:error instanceof Error ? error.message : String(error),events:[],results:{},
    },faces);
    return this.getSnapshot();
  }

  const turnId=currentTurnId(runtime);
  const result=resolveSpellCast(SIMPLEVTT_APP_RULES_PROFILE,definition,runtime,{
    id:castId,
    actorId:sourceAction.actorId,
    spellId:metadata.spellId,
    source:metadata.castSource,
    expectedRevision:runtime.revision,
    caster,targets,slotLevel,
    componentsSatisfied:true,
    useActionEconomy:true,
    turnId,
    dice:{ effectFaces:faces },
  });
  internal.resolution=resolutionFromCast(sourceAction.name,actionId,sourceAction.actorId,targetIds,slotLevel,result,faces);
  if (result.status==="rejected") return this.getSnapshot();
  if (!commitAdapterTurnRuntimeState(this,internal.scene,runtime.revision,result.state)) {
    internal.resolution=resolutionFromCast(sourceAction.name,actionId,sourceAction.actorId,targetIds,slotLevel,{
      status:"rejected",state:runtime,spellId:metadata.spellId,slotLevel,
      error:"turn runtime revision changed before spell cast commit",events:[],results:{},
    },faces);
    return this.getSnapshot();
  }

  const events=eventHistoryForSpellCast(runtime,result,sourceAction.actorId,turnId,slotLevel);
  const actorName=internal.scene.entities.find((entity)=>entity.id===sourceAction.actorId)?.name ?? sourceAction.actorId;
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
