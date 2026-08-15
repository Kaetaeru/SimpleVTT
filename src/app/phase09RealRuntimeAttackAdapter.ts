import "./phase09RealRuntimeStatAdapter";
import type { ActionVm, ActivityEntry, AppSnapshot, CharacterSheet, CharacterSummary, ResolutionView, SceneEntity, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { resolveAtomicAttackTransaction, type AtomicAttackTransactionResult } from "./realAttackTransactionService";
import { projectResolutionEventsToActivity } from "./realActivityProjectionService";
import { phase09DeterministicAttackFaces, resolveRuntimeAttackFact, resolveRuntimeTargetingFact } from "./realRuntimeAttackFactProvider";

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

const pending = new WeakMap<MockAdapter,Extract<AtomicAttackTransactionResult,{ status:"committed" }>>();
const previousAdvance = MockAdapter.prototype.advanceResolution;

function isRuntimeAtomicAttack(action:ActionVm|undefined) {
  return action?.id === "action.shortbow"
    && action.resolutionKind === "attack"
    && !action.itemCost
    && !action.resourceCost;
}

function reject(internal:RuntimeAttackAdapterState,error:string) {
  const resolution = internal.resolution;
  if (!resolution) return;
  if (internal.before) {
    internal.scene = structuredClone(internal.before.scene);
    internal.activeCharacter = structuredClone(internal.before.activeCharacter);
    internal.characters = structuredClone(internal.before.characters);
  }
  resolution.stateChanges = [];
  resolution.detail.push(`runtime attack transaction 거부: ${error}`);
  resolution.finalOutcome = `적용 거부: ${error}`;
  resolution.provenance.push("Phase 09 · canonical weapon + runtime scene targeting provider · explicit reject");
  resolution.stage = "complete";
  resolution.canAdvance = false;
  resolution.nextLabel = undefined;
  internal.before = null;
}

function build(internal:RuntimeAttackAdapterState,action:ActionVm,resolution:ResolutionView):AtomicAttackTransactionResult {
  const actor = internal.entity(action.actorId);
  const target = internal.entity(resolution.targetIds[0]);
  const actorEconomy = internal.scene.economyByActor[action.actorId];
  const targetEconomy = target ? internal.scene.economyByActor[target.id] : undefined;
  const attackD20Face = resolution.authoritativeDice[0];
  if (!actor || !target || !actorEconomy || !targetEconomy || attackD20Face === undefined || resolution.attackTotal === undefined || resolution.targetAc === undefined || !resolution.attackOutcome) {
    return { status:"rejected", error:"runtime atomic attack is missing authoritative actor/target/roll state" };
  }
  try {
    const attackFact = resolveRuntimeAttackFact(action,phase09DeterministicAttackFaces(action));
    const targetingFact = resolveRuntimeTargetingFact(target);
    const transaction = resolveAtomicAttackTransaction({
      resolutionId:`${resolution.id}:runtime-atomic`,
      action,
      actor,
      target,
      actorEconomy,
      targetEconomy,
      initiativeMode:internal.sessionMode === "initiative",
      attackD20Face,
      effectiveTargetAc:resolution.targetAc,
      attackFact,
      targetingFact,
      expectedPreview:{
        total:resolution.attackTotal,
        outcome:resolution.attackOutcome,
        critical:resolution.critical === true,
      },
    });
    if (transaction.status === "committed") {
      transaction.provenance.push(`runtime:scene:${target.id}:distance:${targetingFact.distanceFeet}ft`);
      transaction.provenance.push("runtime:scene:visibility:visible:no-cover:mutual-sight");
    }
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

function finalize(internal:RuntimeAttackAdapterState,transaction:Extract<AtomicAttackTransactionResult,{ status:"committed" }>) {
  const resolution = internal.resolution;
  if (!resolution) return;
  resolution.stage = "complete";
  resolution.canAdvance = false;
  resolution.nextLabel = undefined;
  internal.syncChar();
  internal.activity.unshift(projectResolutionEventsToActivity({
    resolution,
    events:transaction.events,
    actorName:internal.entity(resolution.actorId)?.name ?? resolution.actorId,
    targetNames:resolution.targetIds.map((id) => internal.entity(id)?.name ?? id),
  }));
  internal.lastBefore = internal.before ? structuredClone(internal.before) : null;
  internal.lastResolutionId = resolution.id;
  internal.before = null;
}

MockAdapter.prototype.advanceResolution = async function advanceResolutionWithRuntimeAttackFacts() {
  const internal = this as unknown as RuntimeAttackAdapterState;
  const resolution = internal.resolution;
  const action = resolution ? internal.action(resolution.actionId) : undefined;
  if (!resolution || !isRuntimeAtomicAttack(action) || resolution.adjudicated) {
    return previousAdvance.call(this);
  }

  if (resolution.stage === "attack-result") {
    const transaction = build(internal,action!,resolution);
    if (transaction.status === "rejected") {
      pending.delete(this);
      reject(internal,transaction.error);
      return internal.getSnapshot();
    }
    if (resolution.attackOutcome === "빗나감") {
      apply(internal,resolution,transaction);
      finalize(internal,transaction);
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
      reject(internal,"missing staged runtime atomic attack transaction");
      return internal.getSnapshot();
    }
    if (!apply(internal,resolution,transaction)) {
      reject(internal,"runtime atomic attack target disappeared before projection");
      return internal.getSnapshot();
    }
    finalize(internal,transaction);
    return internal.getSnapshot();
  }

  return previousAdvance.call(this);
};
