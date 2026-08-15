import "./phase09RealRuntimeStatAdapter";
import "./combatantRuntimeContracts";
import "./lifeRuntimeContracts";
import type { ActionVm, ActivityEntry, AppSnapshot, CharacterSheet, CharacterSummary, ResolutionView, SceneEntity, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { consumeAdapterInterruptEvents } from "./phase09RealTurnRuntimeAdapter";
import { resolveAtomicAttackTransaction, type AtomicAttackTransactionResult } from "./realAttackTransactionService";
import { projectResolutionEventsToActivity } from "./realActivityProjectionService";
import { undoResolutionEvents } from "./realEventUndoService";
import { phase09DeterministicAttackFaces, resolveRuntimeAttackFact, resolveRuntimeTargetingFact } from "./realRuntimeAttackFactProvider";
import { clearPendingManualMovementReaction, manualMovementReactionFor, type PendingManualMovementReaction } from "./manualMovementReactionRuntime";
import type { ResolutionEvent } from "../domain/resolutionTypes";

interface BeforeState {
  scene:AppSnapshot["scene"];
  activeCharacter:CharacterSheet;
  characters:CharacterSummary[];
}

interface RuntimeAttackAdapterState {
  action(id:string):ActionVm|undefined;
  entity(id:string):SceneEntity|undefined;
  syncChar():void;
  resolution:ResolutionView|null;
  scene:AppSnapshot["scene"];
  activeCharacter:CharacterSheet;
  characters:CharacterSummary[];
  sessionMode:SessionMode;
  activity:ActivityEntry[];
  before:BeforeState|null;
  lastBefore:BeforeState|null;
  lastResolutionId:string|null;
  getSnapshot():Promise<AppSnapshot>;
}

interface CommittedEventHistory {
  resolutionId:string;
  events:ResolutionEvent[];
}

const pending = new WeakMap<MockAdapter,Extract<AtomicAttackTransactionResult,{ status:"committed" }>>();
const committedEventHistory = new WeakMap<MockAdapter,CommittedEventHistory>();
const previousAdvance = MockAdapter.prototype.advanceResolution;
const previousUndo = MockAdapter.prototype.undoLastResolution;

function manualFor(adapter:MockAdapter,action:ActionVm|undefined,resolution:ResolutionView|undefined|null) {
  if (!action || !resolution || resolution.targetIds.length!==1) return undefined;
  return manualMovementReactionFor(adapter,action.actorId,action.id,resolution.targetIds[0]);
}

function isRuntimeAtomicAttack(action:ActionVm|undefined,manual?:PendingManualMovementReaction) {
  return Boolean(action)
    && action!.resolutionKind === "attack"
    && (Boolean(manual) || action!.id === "action.shortbow" || Boolean(action!.runtimeAttack))
    && !action!.itemCost
    && !action!.resourceCost;
}

function reject(adapter:MockAdapter,internal:RuntimeAttackAdapterState,error:string) {
  const resolution = internal.resolution;
  clearPendingManualMovementReaction(adapter);
  if (!resolution) return;
  if (internal.before) {
    internal.scene = structuredClone(internal.before.scene);
    internal.activeCharacter = structuredClone(internal.before.activeCharacter);
    internal.characters = structuredClone(internal.before.characters);
  }
  resolution.stateChanges = [];
  resolution.detail.push(`runtime attack transaction 거부: ${error}`);
  resolution.finalOutcome = `적용 거부: ${error}`;
  resolution.provenance.push("Phase 09 · canonical/runtime attack fact + authoritative targeting fact · explicit reject");
  resolution.stage = "complete";
  resolution.canAdvance = false;
  resolution.nextLabel = undefined;
  internal.before = null;
}

function build(
  adapter:MockAdapter,
  internal:RuntimeAttackAdapterState,
  action:ActionVm,
  resolution:ResolutionView,
  manual?:PendingManualMovementReaction,
):AtomicAttackTransactionResult {
  const actor = internal.entity(action.actorId);
  const target = internal.entity(resolution.targetIds[0]);
  const actorEconomy = internal.scene.economyByActor[action.actorId];
  const targetEconomy = target ? internal.scene.economyByActor[target.id] : undefined;
  const attackD20Face = resolution.authoritativeDice[0];
  const effectiveTargetAc = manual?.baseTargetAc ?? resolution.targetAc;
  if (!actor || !target || !actorEconomy || !targetEconomy || attackD20Face === undefined || resolution.attackTotal === undefined || effectiveTargetAc === undefined || !resolution.attackOutcome) {
    return { status:"rejected", error:"runtime atomic attack is missing authoritative actor/target/roll state" };
  }
  try {
    const attackFact = resolveRuntimeAttackFact(action,phase09DeterministicAttackFaces(action));
    const targetingFact = manual?.targetingFact ?? resolveRuntimeTargetingFact(internal.scene,action.actorId,target.id);
    const transaction = resolveAtomicAttackTransaction({
      resolutionId:`${resolution.id}:runtime-atomic`,
      action,
      actor,
      target,
      actorEconomy,
      targetEconomy,
      initiativeMode:internal.sessionMode === "initiative",
      activeTurnActorId:manual?.provokerId,
      reaction:manual ? {
        trigger:manual.triggerId,
        optionId:manual.optionId,
        source:manual.source,
      } : undefined,
      attackD20Face,
      effectiveTargetAc,
      attackFact,
      targetingFact,
      expectedPreview:{
        total:resolution.attackTotal,
        outcome:resolution.attackOutcome,
        critical:resolution.critical === true,
      },
    });
    if (transaction.status === "committed") transaction.provenance.push(...targetingFact.provenance);
    return transaction;
  } catch (error) {
    return { status:"rejected", error:error instanceof Error ? error.message : String(error) };
  }
}

function apply(internal:RuntimeAttackAdapterState,resolution:ResolutionView,transaction:Extract<AtomicAttackTransactionResult,{ status:"committed" }>) {
  const target = internal.entity(resolution.targetIds[0]);
  if (!target) return false;
  target.hp = transaction.targetHp;
  target.tempHp = transaction.targetTempHp;
  target.runtimeLife=structuredClone(transaction.targetLife);
  internal.scene.economyByActor[resolution.actorId] = { ...transaction.actorEconomy };
  resolution.stateChanges.push(...transaction.stateChanges);
  resolution.provenance.push(...transaction.provenance);
  resolution.damageComponents = transaction.damageComponent ? [transaction.damageComponent] : [];
  if (transaction.damageComponent) {
    resolution.compact = `${resolution.attackTotal} vs AC ${resolution.targetAc} — ${resolution.attackOutcome}${resolution.critical ? " · 치명타" : ""} · ${transaction.damageComponent.adjusted} ${transaction.damageComponent.type} 피해`;
  }
  resolution.calculatedOutcome = resolution.compact;
  if (!resolution.adjudicated) resolution.finalOutcome = resolution.compact;
  return true;
}

function finalize(adapter:MockAdapter,internal:RuntimeAttackAdapterState,transaction:Extract<AtomicAttackTransactionResult,{ status:"committed" }>) {
  const resolution = internal.resolution;
  if (!resolution) return;
  const events=[
    ...consumeAdapterInterruptEvents(adapter,resolution.id),
    ...transaction.events.map((event)=>structuredClone(event)),
  ];
  resolution.stage = "complete";
  resolution.canAdvance = false;
  resolution.nextLabel = undefined;
  internal.syncChar();
  internal.activity.unshift(projectResolutionEventsToActivity({
    resolution,
    events,
    actorName:internal.entity(resolution.actorId)?.name ?? resolution.actorId,
    targetNames:resolution.targetIds.map((id) => internal.entity(id)?.name ?? id),
  }));
  committedEventHistory.set(adapter,{
    resolutionId:resolution.id,
    events:events.map((event) => structuredClone(event)),
  });
  internal.lastBefore = internal.before ? structuredClone(internal.before) : null;
  internal.lastResolutionId = resolution.id;
  internal.before = null;
  clearPendingManualMovementReaction(adapter);
}

MockAdapter.prototype.advanceResolution = async function advanceResolutionWithRuntimeAttackFacts() {
  const internal = this as unknown as RuntimeAttackAdapterState;
  const resolution = internal.resolution;
  const action = resolution ? internal.action(resolution.actionId) : undefined;
  const manual = manualFor(this,action,resolution);
  if (!resolution || !isRuntimeAtomicAttack(action,manual) || resolution.adjudicated) return previousAdvance.call(this);

  if (resolution.stage === "attack-result") {
    const transaction = build(this,internal,action!,resolution,manual);
    if (transaction.status === "rejected") {
      pending.delete(this);
      committedEventHistory.delete(this);
      reject(this,internal,transaction.error);
      return internal.getSnapshot();
    }
    if (resolution.attackOutcome === "빗나감") {
      apply(internal,resolution,transaction);
      finalize(this,internal,transaction);
      return internal.getSnapshot();
    }
    pending.set(this,transaction);
    resolution.stage = "damage-animation";
    resolution.rollKind = "damage";
    resolution.authoritativeDice = [...transaction.damageFaces];
    resolution.canAdvance = true;
    resolution.nextLabel = "피해 적용";
    return internal.getSnapshot();
  }

  if (resolution.stage === "damage-animation") {
    const transaction = pending.get(this);
    pending.delete(this);
    if (!transaction) {
      reject(this,internal,"missing staged runtime atomic attack transaction");
      return internal.getSnapshot();
    }
    if (!apply(internal,resolution,transaction)) {
      reject(this,internal,"runtime atomic attack target disappeared before projection");
      return internal.getSnapshot();
    }
    finalize(this,internal,transaction);
    return internal.getSnapshot();
  }

  return previousAdvance.call(this);
};

MockAdapter.prototype.undoLastResolution = async function undoLastResolutionFromDomainEvents() {
  const internal=this as unknown as RuntimeAttackAdapterState;
  const history=committedEventHistory.get(this);
  if (!history || internal.lastResolutionId !== history.resolutionId) return previousUndo.call(this);
  const undone=undoResolutionEvents(internal.scene,history.events);
  if (undone.status === "rejected") {
    if (internal.resolution) {
      internal.resolution.detail.push(`Event-native Undo 거부: ${undone.error}`);
      internal.resolution.finalOutcome=`Undo 거부: ${undone.error}`;
    }
    return internal.getSnapshot();
  }
  internal.scene=undone.scene;
  internal.syncChar();
  internal.activity=internal.activity.map((entry)=>entry.id===history.resolutionId ? { ...entry, reversed:true } : entry);
  internal.activity.unshift({
    id:`phase09.event-undo.${Date.now()}.${Math.floor(Math.random()*1000)}`,
    time:"지금",
    actor:"시스템",
    title:"Resolution 되돌림",
    summary:history.resolutionId,
    detail:[`ResolutionEvent ${history.events.length}개 역순 적용`,`Before snapshot 미사용`],
    stateChanges:undone.stateChanges,
    correction:true,
    undoOf:history.resolutionId,
  });
  internal.resolution=null;
  internal.lastBefore=null;
  internal.lastResolutionId=null;
  committedEventHistory.delete(this);
  return internal.getSnapshot();
};
