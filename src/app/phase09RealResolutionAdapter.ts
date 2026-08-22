import "./progressionPhase08RogueThiefAdapter";
import type {
  ActionVm,
  ActivityEntry,
  AppSnapshot,
  CharacterSheet,
  CharacterSummary,
  DamageComponentView,
  ResolutionView,
  SceneEntity,
  SessionMode,
} from "./contracts";
import { MockAdapter } from "./mockAdapter";
import {
  commitFreeformSpellSlot,
  restoreFreeformSpellSlot,
  type FreeformSpellSlotChange,
} from "./spellcastingRuntimeAdapter";
import {
  phase09ReferenceAttackFact,
  phase09ReferenceHealingFact,
  phase09ReferenceSaveModifier,
  phase09ReferenceTargetingFact,
} from "./phase09ReferenceRulesFacts";
import {
  resolveAtomicAttackTransaction,
  type AtomicAttackTransactionResult,
} from "./realAttackTransactionService";
import { resolveActionCostTransaction } from "./realActionCostService";
import { resolveSceneDamage, resolveSceneHealing } from "./realHealthService";
import { resolveHealingRollResolution } from "./realHealingRollService";
import { resolveAttackRollResolution, resolveOpenAbilityCheckResolution } from "./realResolutionService";
import { resolveSavingThrowResolution } from "./realSavingThrowService";

interface Phase09BeforeSnapshot {
  scene:AppSnapshot["scene"];
  activeCharacter:CharacterSheet;
  characters:CharacterSummary[];
}

interface Phase09ResolutionAdapterState {
  action(id:string):ActionVm|undefined;
  entity(id:string):SceneEntity|undefined;
  availability(action:ActionVm):{ available:boolean; reason?:string };
  eligible(action:ActionVm):string[];
  capture():void;
  d20(actionId:string,index?:number):number;
  commit(action:ActionVm):void;
  syncChar():void;
  resolution:ResolutionView|null;
  scene:AppSnapshot["scene"];
  activeCharacter:CharacterSheet;
  characters:CharacterSummary[];
  sessionMode:SessionMode;
  activity:ActivityEntry[];
  before:Phase09BeforeSnapshot|null;
  lastBefore:Phase09BeforeSnapshot|null;
  lastResolutionId:string|null;
  getSnapshot():Promise<AppSnapshot>;
}

interface FreeformSpellSlotHistory {
  resolutionId:string;
  change:FreeformSpellSlotChange;
}

const pendingAtomicAttacks = new WeakMap<MockAdapter,Extract<AtomicAttackTransactionResult,{ status:"committed" }>>();
const freeformSpellSlotHistories = new WeakMap<MockAdapter,FreeformSpellSlotHistory>();
const REAL_HEALING_ACTION_IDS = new Set(["action.second-wind","action.healing-word","action.healing-potion"]);
const HELPED_STATUS = "도움 받음";
const HIDDEN_STATUS = "숨음";
const DODGING_STATUS = "회피";
const READY_STATUS = "준비 행동";

function isDexteritySave(action:ActionVm) {
  return ["dex","dexterity","민첩"].includes(String(action.saveAbility??"").toLowerCase());
}

function removeStatus(entity:SceneEntity|undefined,status:string) {
  if (!entity?.status.includes(status)) return false;
  entity.status=entity.status.filter((entry)=>entry!==status);
  return true;
}

function resolutionId() {
  return `resolution.phase09.${Date.now()}.${Math.floor(Math.random() * 1000)}`;
}

function migratedResolutionAction(action:ActionVm) {
  return action.resolutionKind === "ability-check"
    || action.resolutionKind === "attack"
    || action.resolutionKind === "saving-throw"
    || (action.resolutionKind === "healing" && REAL_HEALING_ACTION_IDS.has(action.id));
}

function atomicAttackAction(action:ActionVm) {
  return action.id === "action.shortbow" && action.resolutionKind === "attack" && !action.itemCost && !action.resourceCost;
}

function finalizeWithoutAdditionalCosts(internal:Phase09ResolutionAdapterState) {
  const resolution = internal.resolution;
  if (!resolution) return;
  resolution.stage = "complete";
  resolution.canAdvance = false;
  resolution.nextLabel = undefined;
  internal.syncChar();
  internal.activity.unshift({
    id:resolution.id,
    time:"지금",
    actor:internal.entity(resolution.actorId)?.name ?? resolution.actorId,
    title:`${resolution.actionName} → ${resolution.targetIds.map((id) => internal.entity(id)?.name ?? id).join(", ") || "—"}`,
    summary:resolution.compact,
    detail:[...resolution.detail,...resolution.provenance.map((entry) => `출처: ${entry}`)],
    stateChanges:structuredClone(resolution.stateChanges),
  });
  internal.lastBefore = internal.before ? structuredClone(internal.before) : null;
  internal.lastResolutionId = resolution.id;
  internal.before = null;
}

function rejectAtomicAttack(internal:Phase09ResolutionAdapterState,error:string) {
  const resolution = internal.resolution;
  if (!resolution) return;
  if (internal.before) {
    internal.scene = structuredClone(internal.before.scene);
    internal.activeCharacter = structuredClone(internal.before.activeCharacter);
    internal.characters = structuredClone(internal.before.characters);
  }
  resolution.stateChanges = [];
  resolution.detail.push(`공격 transaction 거부: ${error}`);
  resolution.finalOutcome = `적용 거부: ${error}`;
  resolution.stage = "complete";
  resolution.canAdvance = false;
  resolution.nextLabel = undefined;
  internal.before = null;
}

function rejectCost(internal:Phase09ResolutionAdapterState,error:string) {
  const resolution=internal.resolution;
  if (!resolution) return;
  if (internal.before) {
    internal.scene=structuredClone(internal.before.scene);
    internal.activeCharacter=structuredClone(internal.before.activeCharacter);
    internal.characters=structuredClone(internal.before.characters);
  }
  resolution.stateChanges=[];
  resolution.detail.push(`비용 적용 거부: ${error}`);
  resolution.finalOutcome=`적용 거부: ${error}`;
  resolution.stage="complete";
  resolution.canAdvance=false;
  resolution.nextLabel=undefined;
  internal.before=null;
}

function buildAtomicAttack(
  internal:Phase09ResolutionAdapterState,
  action:ActionVm,
  resolution:ResolutionView,
):AtomicAttackTransactionResult {
  const actor = internal.entity(action.actorId);
  const target = internal.entity(resolution.targetIds[0]);
  const actorEconomy = internal.scene.economyByActor[action.actorId];
  const targetEconomy = target ? internal.scene.economyByActor[target.id] : undefined;
  const attackD20Face = resolution.authoritativeDice[0];
  if (!actor || !target || !actorEconomy || !targetEconomy || attackD20Face === undefined || resolution.attackTotal === undefined || resolution.targetAc === undefined || !resolution.attackOutcome) {
    return { status:"rejected", error:"atomic attack projection is missing authoritative actor/target/roll state" };
  }
  try {
    return resolveAtomicAttackTransaction({
      resolutionId:`${resolution.id}:atomic`,
      action,
      actor,
      target,
      actorEconomy,
      targetEconomy,
      initiativeMode:internal.sessionMode === "initiative",
      attackD20Face,
      effectiveTargetAc:resolution.targetAc,
      attackFact:phase09ReferenceAttackFact(action.id),
      targetingFact:phase09ReferenceTargetingFact(target.id),
      expectedPreview:{
        total:resolution.attackTotal,
        outcome:resolution.attackOutcome,
        critical:resolution.critical === true,
      },
    });
  } catch (error) {
    return { status:"rejected", error:error instanceof Error ? error.message : String(error) };
  }
}

function applyAtomicAttack(
  internal:Phase09ResolutionAdapterState,
  resolution:ResolutionView,
  transaction:Extract<AtomicAttackTransactionResult,{ status:"committed" }>,
) {
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

const oldResolveAction = MockAdapter.prototype.resolveAction;
const oldAdvanceResolution = MockAdapter.prototype.advanceResolution;
const oldUndoLastResolution = MockAdapter.prototype.undoLastResolution;
const phase09Prototype = MockAdapter.prototype as unknown as { commit(action:ActionVm):void };
const oldCommit = phase09Prototype.commit;

phase09Prototype.commit = function commitWithRealCosts(action:ActionVm) {
  const adapter=this as unknown as MockAdapter;
  const internal = this as unknown as Phase09ResolutionAdapterState;
  const resolution = internal.resolution;
  if (!resolution || action.itemCost) return oldCommit.call(this,action);
  const actor = internal.entity(action.actorId);
  const economy = internal.scene.economyByActor[action.actorId];
  if (!actor || !economy) return oldCommit.call(this,action);
  if (action.resourceCost && actor.id !== internal.activeCharacter.id) return oldCommit.call(this,action);

  const costs = resolveActionCostTransaction({
    resolutionId:resolution.id,
    action,
    actor,
    economy,
    resources:actor.id === internal.activeCharacter.id ? internal.activeCharacter.resources : [],
    initiativeMode:internal.sessionMode === "initiative",
  });
  if (costs.status === "rejected") {
    rejectCost(internal,costs.error);
    return;
  }

  const slotCommit=internal.sessionMode === "freeform"
    ? commitFreeformSpellSlot(adapter,action.id,action.actorId)
    : { status:"not-applicable" as const };
  if (slotCommit.status === "rejected") {
    rejectCost(internal,slotCommit.error);
    return;
  }

  internal.scene.economyByActor[action.actorId] = { ...costs.economy };
  if (actor.id === internal.activeCharacter.id) {
    internal.activeCharacter.resources = costs.resources.map((resource) => ({ ...resource }));
  }
  resolution.stateChanges.push(...costs.stateChanges);
  resolution.provenance.push(...costs.provenance);
  if (slotCommit.status === "committed") {
    resolution.stateChanges.push(slotCommit.stateChange);
    resolution.provenance.push(slotCommit.provenance);
  }
  resolution.stage = "complete";
  resolution.canAdvance = false;
  resolution.nextLabel = undefined;
  internal.syncChar();

  internal.activity.unshift({
    id:resolution.id,
    time:"지금",
    actor:internal.entity(resolution.actorId)?.name ?? resolution.actorId,
    title:`${resolution.actionName} → ${resolution.targetIds.map((id) => internal.entity(id)?.name ?? id).join(", ") || "—"}`,
    summary:resolution.compact,
    detail:[...resolution.detail,...resolution.provenance.map((entry) => `출처: ${entry}`)],
    stateChanges:structuredClone(resolution.stateChanges),
  });
  internal.lastBefore = internal.before ? structuredClone(internal.before) : null;
  internal.lastResolutionId = resolution.id;
  internal.before = null;
  if (slotCommit.status === "committed") {
    freeformSpellSlotHistories.set(adapter,{ resolutionId:resolution.id,change:slotCommit.change });
  }
};

MockAdapter.prototype.resolveAction = async function resolveActionWithRealRules(actionId:string,targetIds:string[]) {
  const internal = this as unknown as Phase09ResolutionAdapterState;
  const action = internal.action(actionId);
  if (!action || !migratedResolutionAction(action)) {
    return oldResolveAction.call(this,actionId,targetIds);
  }

  const availability = internal.availability(action);
  if (!availability.available) return internal.getSnapshot();
  const allowed = new Set(internal.eligible(action));
  if (targetIds.some((id) => !allowed.has(id))) return internal.getSnapshot();
  if (action.target === "multi-enemy" && targetIds.length > (action.maxTargets ?? Number.POSITIVE_INFINITY)) {
    return internal.getSnapshot();
  }

  if (action.resolutionKind === "attack") {
    if (targetIds.length !== 1) return internal.getSnapshot();
    const target = internal.entity(targetIds[0]);
    if (!target) return internal.getSnapshot();
    internal.capture();
    const actor=internal.entity(action.actorId);
    const revealed=removeStatus(actor,HIDDEN_STATUS);
    const helped=removeStatus(actor,HELPED_STATUS);
    const dodging=target.status.includes(DODGING_STATUS);
    const rollStateContributions=[
      ...(helped ? [{ source:"action:standard.help",state:"advantage" as const }] : []),
      ...(dodging ? [{ source:`condition:${DODGING_STATUS}:target`,state:"disadvantage" as const }] : []),
    ];
    internal.resolution = resolveAttackRollResolution({
      resolutionId:resolutionId(),
      action,
      target,
      diceFaces:rollStateContributions.length>0
        ? [internal.d20(action.id),internal.d20(`${action.id}:roll-state`,1)]
        : [internal.d20(action.id)],
      modifierContributions:[{
        source:`action:${action.id}:attack-bonus`,
        value:action.attackBonus ?? 0,
      }],
      rollStateContributions,
    });
    if (revealed) {
      internal.resolution.stateChanges.push(`${actor?.name??action.actorId} 상태 제거: ${HIDDEN_STATUS} · 공격 선언`);
      internal.resolution.provenance.push("condition:hidden · applied · attack declaration ends hidden state");
    }
    if (helped) {
      internal.resolution.stateChanges.push(`${actor?.name??action.actorId} 상태 제거: ${HELPED_STATUS} · 공격 판정에 유리점 적용`);
    }
    return internal.getSnapshot();
  }

  if (action.resolutionKind === "saving-throw") {
    const targets = targetIds.map((id) => {
      const target = internal.entity(id);
      if (!target) return undefined;
      const fact = phase09ReferenceSaveModifier(id,action.saveAbility ?? "내성");
      return {
        id,
        name:target.name,
        modifier:fact.modifier,
        modifierSource:fact.source,
        rollStateContributions:isDexteritySave(action)&&target.status.includes(DODGING_STATUS)
          ? [{ source:`condition:${DODGING_STATUS}:dexterity-save`,state:"advantage" as const }]
          : undefined,
      };
    });
    if (targets.some((target) => target === undefined)) return internal.getSnapshot();
    internal.capture();
    const primaryFaces=targetIds.map((_,index) => internal.d20(action.id,index));
    const typedTargets=targets as Array<{id:string; rollStateContributions?:unknown[]}>;
    internal.resolution = resolveSavingThrowResolution({
      resolutionId:resolutionId(),
      action,
      targets:targets as Array<{ id:string; name:string; modifier:number; modifierSource:string }>,
      diceFaces:primaryFaces,
      diceFacesByTarget:Object.fromEntries(typedTargets.flatMap((target,index)=>target.rollStateContributions?.length
        ? [[target.id,[primaryFaces[index],internal.d20(`${action.id}:dodge-save`,index)]]]
        : [])),
    });
    return internal.getSnapshot();
  }

  if (action.resolutionKind === "healing") {
    internal.capture();
    internal.resolution = resolveHealingRollResolution({
      resolutionId:resolutionId(),
      action,
      targetIds,
      healingFact:phase09ReferenceHealingFact(action.id),
    });
    return internal.getSnapshot();
  }

  internal.capture();
  const actor=internal.entity(action.actorId);
  const helped=removeStatus(actor,HELPED_STATUS);
  const checkLabel = action.details.find((entry) => entry.label === "판정")?.value ?? action.name;
  internal.resolution = resolveOpenAbilityCheckResolution({
    resolutionId:resolutionId(),
    action,
    diceFaces:helped
      ? [internal.d20(action.id),internal.d20(`${action.id}:help`,1)]
      : [internal.d20(action.id)],
    modifierContributions:[{
      source:`action:${action.id}:check-bonus`,
      value:action.checkBonus ?? 0,
    }],
    rollStateContributions:helped
      ? [{ source:"action:standard.help",state:"advantage" }]
      : undefined,
    checkLabel,
  });
  if (helped) {
    internal.resolution.stateChanges.push(`${actor?.name??action.actorId} 상태 제거: ${HELPED_STATUS} · 능력 판정에 유리점 적용`);
  }
  return internal.getSnapshot();
};

MockAdapter.prototype.advanceResolution = async function advanceResolutionWithRealHealth() {
  const internal = this as unknown as Phase09ResolutionAdapterState;
  const resolution = internal.resolution;
  if (!resolution) return oldAdvanceResolution.call(this);
  const action = internal.action(resolution.actionId);
  if (!action) return oldAdvanceResolution.call(this);

  if (resolution.stage==="roll-animation"&&resolution.rollKind==="check"&&action.id==="action.standard.hide.stealth") {
    const actor=internal.entity(action.actorId);
    const succeeded=(resolution.rollTotal??0)>=15;
    if(succeeded&&actor&&!actor.status.includes(HIDDEN_STATUS)) {
      actor.status.push(HIDDEN_STATUS);
      resolution.stateChanges.push(`${actor.name} 상태 추가: ${HIDDEN_STATUS} · DC 15 충족`);
    } else if(!succeeded&&removeStatus(actor,HIDDEN_STATUS)) {
      resolution.stateChanges.push(`${actor?.name??action.actorId} 상태 제거: ${HIDDEN_STATUS} · 숨기 실패`);
    }
    resolution.finalOutcome=`${resolution.rollTotal} · 숨기 ${succeeded ? "성공" : "실패"}`;
    resolution.compact=resolution.finalOutcome;
  }

  if (resolution.stage==="effect-preview"&&action.resolutionKind==="no-roll"&&action.id.startsWith("action.standard.")) {
    const actor=internal.entity(action.actorId);
    const target=internal.entity(resolution.targetIds[0]??action.actorId);
    const applyStatus=(entity:SceneEntity|undefined,status:string)=>{if(entity&&!entity.status.includes(status)){entity.status.push(status);resolution.stateChanges.push(`${entity.name} 상태 추가: ${status}`);}};
    if(action.id==="action.standard.disengage"){applyStatus(actor,"이탈");resolution.finalOutcome="이번 턴 기회 공격을 유발하지 않음";}
    else if(action.id==="action.standard.dodge"){applyStatus(actor,"회피");resolution.finalOutcome="다음 턴 시작까지 회피";}
    else if(action.id==="action.standard.help"){applyStatus(target,"도움 받음");resolution.finalOutcome=`${target?.name??"아군"} 지원`;}
    else if(action.id==="action.standard.ready"){applyStatus(actor,READY_STATUS);resolution.finalOutcome="트리거와 반응 행동 준비";}
    else if(action.id==="action.standard.ready.trigger"){
      if(removeStatus(actor,READY_STATUS)) resolution.stateChanges.push(`${actor?.name??action.actorId} 상태 제거: ${READY_STATUS} · 반응 발동`);
      resolution.finalOutcome="준비한 행동을 반응으로 발동";
    }
    else if(action.id==="action.standard.utilize"){resolution.stateChanges.push(`${actor?.name??action.actorId} 비마법 물체 사용 선언`);resolution.finalOutcome="물체 사용";}
    resolution.compact=resolution.finalOutcome;
    internal.commit(action);
    return internal.getSnapshot();
  }

  if (atomicAttackAction(action) && !resolution.adjudicated && resolution.stage === "attack-result") {
    const transaction = buildAtomicAttack(internal,action,resolution);
    if (transaction.status === "rejected") {
      pendingAtomicAttacks.delete(this);
      rejectAtomicAttack(internal,transaction.error);
      return internal.getSnapshot();
    }
    if (resolution.attackOutcome === "빗나감") {
      applyAtomicAttack(internal,resolution,transaction);
      finalizeWithoutAdditionalCosts(internal);
      return internal.getSnapshot();
    }
    pendingAtomicAttacks.set(this,transaction);
    resolution.stage = "damage-animation";
    resolution.rollKind = "damage";
    resolution.authoritativeDice = [...transaction.damageFaces];
    resolution.canAdvance = true;
    resolution.nextLabel = "피해 적용";
    return internal.getSnapshot();
  }

  if (atomicAttackAction(action) && !resolution.adjudicated && resolution.stage === "damage-animation") {
    const transaction = pendingAtomicAttacks.get(this);
    pendingAtomicAttacks.delete(this);
    if (!transaction) {
      rejectAtomicAttack(internal,"missing staged atomic attack transaction");
      return internal.getSnapshot();
    }
    if (!applyAtomicAttack(internal,resolution,transaction)) {
      rejectAtomicAttack(internal,"atomic attack target disappeared before projection");
      return internal.getSnapshot();
    }
    finalizeWithoutAdditionalCosts(internal);
    return internal.getSnapshot();
  }

  if (resolution.stage === "damage-animation" && action.resolutionKind === "attack") {
    const target = internal.entity(resolution.targetIds[0]);
    const damage = action.damage?.[0];
    if (!target || !damage) return oldAdvanceResolution.call(this);
    const raw = damage.average * (resolution.critical ? 2 : 1);
    const resolved = resolveSceneDamage(target,damage.type,raw);
    target.hp = resolved.nextHp;
    target.tempHp = resolved.nextTempHp;
    resolution.stateChanges.push(...resolved.stateChanges);
    resolution.provenance.push(...resolved.provenance);
    resolution.damageComponents = [resolved.component];
    resolution.compact = `${resolution.attackTotal} vs AC ${resolution.targetAc} — ${resolution.attackOutcome}${resolution.critical ? " · 치명타" : ""} · ${resolved.component.adjusted} ${resolved.component.type} 피해`;
    resolution.calculatedOutcome = resolution.compact;
    if (!resolution.adjudicated) resolution.finalOutcome = resolution.compact;
    internal.commit(action);
    return internal.getSnapshot();
  }

  if (resolution.stage === "damage-animation" && action.resolutionKind === "saving-throw") {
    const spec = action.damage?.[0];
    if (!spec) return oldAdvanceResolution.call(this);
    const components:DamageComponentView[] = [];
    for (const save of resolution.saveResults) {
      const target = internal.entity(save.targetId);
      if (!target) continue;
      const raw = save.outcome === "성공"
        ? (action.saveHalf ? Math.floor(spec.average / 2) : 0)
        : spec.average;
      const resolved = resolveSceneDamage(target,spec.type,raw);
      target.hp = resolved.nextHp;
      target.tempHp = resolved.nextTempHp;
      resolution.stateChanges.push(...resolved.stateChanges);
      resolution.provenance.push(...resolved.provenance.map((entry) => `${save.targetName} · ${entry}`));
      save.finalDamage = resolved.component.adjusted;
      components.push({ ...resolved.component, source:`${save.targetName} · ${resolved.component.source}` });
    }
    resolution.damageComponents = components;
    resolution.compact = resolution.saveResults
      .map((save) => `${save.targetName} ${save.outcome}${save.finalDamage !== undefined ? ` · ${save.finalDamage} 피해` : ""}`)
      .join(" / ");
    resolution.calculatedOutcome = resolution.compact;
    if (!resolution.adjudicated) resolution.finalOutcome = resolution.compact;
    internal.commit(action);
    return internal.getSnapshot();
  }

  if (resolution.stage === "effect-preview" && action.resolutionKind === "healing") {
    const target = internal.entity(resolution.targetIds[0]);
    if (!target) return oldAdvanceResolution.call(this);
    const resolved = resolveSceneHealing(target,resolution.rollTotal ?? 0);
    target.hp = resolved.nextHp;
    resolution.stateChanges.push(...resolved.stateChanges);
    resolution.provenance.push(...resolved.provenance);
    resolution.compact = `${target.name} ${resolved.restored} HP 회복`;
    resolution.calculatedOutcome = `${resolved.restored} HP 회복`;
    if (!resolution.adjudicated) resolution.finalOutcome = "회복 적용";
    internal.commit(action);
    return internal.getSnapshot();
  }

  return oldAdvanceResolution.call(this);
};

MockAdapter.prototype.undoLastResolution=async function undoWithFreeformSpellSlotRestore() {
  const internal=this as unknown as Phase09ResolutionAdapterState;
  const history=freeformSpellSlotHistories.get(this);
  const matches=Boolean(history && internal.lastResolutionId===history.resolutionId);
  const snapshot=await oldUndoLastResolution.call(this);
  if (!matches || !history || internal.lastResolutionId===history.resolutionId) return snapshot;
  const restored=restoreFreeformSpellSlot(this,history.change);
  if (restored.status==="rejected") {
    if (internal.resolution) {
      internal.resolution.detail.push(`Freeform spell-slot Undo 거부: ${restored.error}`);
      internal.resolution.finalOutcome=`Undo 거부: ${restored.error}`;
    }
    return internal.getSnapshot();
  }
  freeformSpellSlotHistories.delete(this);
  const undoEntry=internal.activity.find((entry)=>entry.undoOf===history.resolutionId);
  if (undoEntry) {
    undoEntry.detail.push("Freeform spell slot drift-check + restore");
    undoEntry.stateChanges.push(restored.stateChange);
  }
  return internal.getSnapshot();
};
