import "./concentrationSaveRuntimeContracts";
import "./phase09RealRuntimeAttackAdapter";
import type {
  ActionVm,
  ActivityEntry,
  AppSnapshot,
  CharacterSheet,
  CharacterSummary,
  CombatantDefinitionVm,
  ResolutionView,
  SceneEntity,
  SessionMode,
} from "./contracts";
import type { ConcentrationSaveVm } from "./concentrationSaveRuntimeContracts";
import { MockAdapter } from "./mockAdapter";
import { consumeAdapterInterruptEvents } from "./phase09RealTurnRuntimeAdapter";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import { resolveAtomicAttackTransaction, type AtomicAttackTransactionResult } from "./realAttackTransactionService";
import { projectResolutionEventsToActivity } from "./realActivityProjectionService";
import {
  phase09DeterministicAttackFaces,
  resolveRuntimeAttackFact,
  resolveRuntimeTargetingFact,
} from "./realRuntimeAttackFactProvider";
import { resolveRuntimeSaveModifier } from "./realRuntimeStatProvider";
import {
  clearPendingManualMovementReaction,
  manualMovementReactionFor,
  type PendingManualMovementReaction,
} from "./manualMovementReactionRuntime";
import { runtimeResolutionEventHistories } from "./runtimeResolutionEventHistory";
import { resolveDamageRoll } from "../domain/damageRoll";
import type { ConcentrationCheckResolution } from "../domain/concentration";

interface BeforeState {
  scene:AppSnapshot["scene"];
  activeCharacter:CharacterSheet;
  characters:CharacterSummary[];
}

interface ConcentrationAdapterState {
  action(id:string):ActionVm|undefined;
  entity(id:string):SceneEntity|undefined;
  syncChar():void;
  resolution:ResolutionView|null;
  scene:AppSnapshot["scene"];
  activeCharacter:CharacterSheet;
  characters:CharacterSummary[];
  combatantDefinitions:CombatantDefinitionVm[];
  sessionMode:SessionMode;
  activity:ActivityEntry[];
  before:BeforeState|null;
  lastBefore:BeforeState|null;
  lastResolutionId:string|null;
  getSnapshot():Promise<AppSnapshot>;
}

type CommittedAttack=Extract<AtomicAttackTransactionResult,{ status:"committed" }>;
type RuntimeAttackFact=ReturnType<typeof resolveRuntimeAttackFact>;
type RuntimeTargetingFact=ReturnType<typeof resolveRuntimeTargetingFact>;
type RuntimeSaveFact=ReturnType<typeof resolveRuntimeSaveModifier>;

interface PendingConcentrationPrompt {
  resolutionId:string;
  targetId:string;
  concentrationGroupId:string;
  runtimeRevision:number;
  attackD20Face:number;
  effectiveTargetAc:number;
  expectedPreview:{ total:number;outcome:"명중"|"빗나감";critical:boolean };
  attackFact:RuntimeAttackFact;
  targetingFact:RuntimeTargetingFact;
  saveFact:RuntimeSaveFact;
  manual?:PendingManualMovementReaction;
}

const prompts=new WeakMap<MockAdapter,PendingConcentrationPrompt>();
const pendingTransactions=new WeakMap<MockAdapter,CommittedAttack>();
const previousAdvance=MockAdapter.prototype.advanceResolution;

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

function reject(adapter:MockAdapter,internal:ConcentrationAdapterState,error:string,restoreBefore=true) {
  const resolution=internal.resolution;
  prompts.delete(adapter);
  pendingTransactions.delete(adapter);
  clearPendingManualMovementReaction(adapter);
  if (!resolution) return;
  if (restoreBefore && internal.before) {
    internal.scene=structuredClone(internal.before.scene);
    internal.activeCharacter=structuredClone(internal.before.activeCharacter);
    internal.characters=structuredClone(internal.before.characters);
  }
  resolution.stateChanges=[];
  resolution.detail.push(`concentration save workflow 거부: ${error}`);
  resolution.finalOutcome=`적용 거부: ${error}`;
  resolution.provenance.push("Phase 09 · authoritative concentration-save workflow · explicit reject");
  resolution.stage="complete";
  resolution.canAdvance=false;
  resolution.nextLabel=undefined;
  internal.before=null;
}

function buildRequest(
  internal:ConcentrationAdapterState,
  resolution:ResolutionView,
  action:ActionVm,
  prompt:Omit<PendingConcentrationPrompt,"saveFact"|"concentrationGroupId"|"runtimeRevision">,
  runtimeState:NonNullable<ReturnType<typeof snapshotAdapterTurnRuntimeState>>,
  face?:number,
) {
  const actor=internal.entity(action.actorId);
  const target=internal.entity(prompt.targetId);
  const actorEconomy=actor ? internal.scene.economyByActor[actor.id] : undefined;
  const targetEconomy=target ? internal.scene.economyByActor[target.id] : undefined;
  if (!actor || !target || !actorEconomy || !targetEconomy) {
    return { status:"rejected" as const,error:"concentration attack is missing authoritative actor/target/economy state" };
  }
  return resolveAtomicAttackTransaction({
    resolutionId:`${resolution.id}:runtime-atomic`,
    action,
    actor,
    target,
    actorEconomy,
    targetEconomy,
    initiativeMode:true,
    activeTurnActorId:prompt.manual?.provokerId,
    reaction:prompt.manual ? {
      trigger:prompt.manual.triggerId,
      optionId:prompt.manual.optionId,
      source:prompt.manual.source,
    } : undefined,
    attackD20Face:prompt.attackD20Face,
    effectiveTargetAc:prompt.effectiveTargetAc,
    attackFact:structuredClone(prompt.attackFact),
    targetingFact:structuredClone(prompt.targetingFact),
    runtimeState,
    expectedPreview:{ ...prompt.expectedPreview },
    concentrationCheck:face === undefined ? undefined : {
      dice:{
        id:`${resolution.id}:concentration-d20`,
        purpose:`${target.name} Concentration saving throw`,
        sides:20,
        faces:[face],
      },
      modifierContributions:[{
        source:(prompt as PendingConcentrationPrompt).saveFact.source,
        value:(prompt as PendingConcentrationPrompt).saveFact.modifier,
      }],
    },
  });
}

function preparePrompt(
  adapter:MockAdapter,
  internal:ConcentrationAdapterState,
  action:ActionVm,
  resolution:ResolutionView,
  manual?:PendingManualMovementReaction,
) {
  const target=internal.entity(resolution.targetIds[0]);
  const runtimeState=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  const attackD20Face=resolution.authoritativeDice[0];
  const effectiveTargetAc=manual?.baseTargetAc ?? resolution.targetAc;
  if (!target || !runtimeState || attackD20Face===undefined || effectiveTargetAc===undefined || resolution.attackTotal===undefined || !resolution.attackOutcome) {
    return { status:"delegate" as const };
  }
  const concentration=runtimeState.concentration[target.id];
  if (!concentration) return { status:"delegate" as const };

  try {
    const attackFact=resolveRuntimeAttackFact(action,phase09DeterministicAttackFaces(action));
    const targetingFact=manual?.targetingFact ?? resolveRuntimeTargetingFact(internal.scene,action.actorId,target.id);
    const base={
      resolutionId:resolution.id,
      targetId:target.id,
      attackD20Face,
      effectiveTargetAc,
      expectedPreview:{
        total:resolution.attackTotal,
        outcome:resolution.attackOutcome,
        critical:resolution.critical===true,
      },
      attackFact,
      targetingFact,
      manual,
    };
    const probe=buildRequest(internal,resolution,action,base,runtimeState);
    if (probe.status==="committed") return { status:"delegate" as const };
    if (!probe.error.includes("requires fixed concentration-check input")) return { status:"delegate" as const };

    const saveFact=resolveRuntimeSaveModifier(target,internal.activeCharacter,"con",internal.combatantDefinitions);
    const damageRoll=resolveDamageRoll({
      dice:attackFact.damageDice,
      flat:attackFact.flatDamage,
      critical:resolution.critical===true,
    });
    const prompt:PendingConcentrationPrompt={
      ...base,
      concentrationGroupId:concentration.groupId,
      runtimeRevision:runtimeState.revision,
      saveFact,
    };
    prompts.set(adapter,prompt);
    resolution.concentrationSave={
      targetId:target.id,
      targetName:target.name,
      ability:"con",
      modifier:saveFact.modifier,
      modifierSource:saveFact.source,
    };
    resolution.stage="damage-animation";
    resolution.rollKind="damage";
    resolution.authoritativeDice=damageRoll.dice.flatMap((entry)=>entry.selectedFaces);
    resolution.canAdvance=true;
    resolution.nextLabel="집중 내성 준비";
    resolution.detail.push("피해 transaction은 아직 커밋되지 않았습니다. 집중 내성 d20 입력 후 동일 transaction으로 적용합니다.");
    return { status:"staged" as const };
  } catch(error) {
    return { status:"rejected" as const,error:error instanceof Error ? error.message : String(error) };
  }
}

function checkFromTransaction(transaction:CommittedAttack,targetId:string) {
  const event=transaction.events.find((entry)=>
    (entry.kind==="damage" || entry.kind==="compound-damage") && entry.targetId===targetId,
  );
  return (event?.result as { concentrationCheck?:ConcentrationCheckResolution }|undefined)?.concentrationCheck;
}

function applyTransaction(
  internal:ConcentrationAdapterState,
  resolution:ResolutionView,
  transaction:CommittedAttack,
) {
  const target=internal.entity(resolution.targetIds[0]);
  if (!target) return false;
  target.hp=transaction.targetHp;
  target.tempHp=transaction.targetTempHp;
  target.runtimeLife=structuredClone(transaction.targetLife);
  internal.scene.economyByActor[resolution.actorId]={ ...transaction.actorEconomy };
  resolution.stateChanges.push(...transaction.stateChanges);
  resolution.provenance.push(...transaction.provenance);
  resolution.damageComponents=transaction.damageComponent ? [transaction.damageComponent] : [];
  if (transaction.damageComponent) {
    resolution.compact=`${resolution.attackTotal} vs AC ${resolution.targetAc} — ${resolution.attackOutcome}${resolution.critical ? " · 치명타" : ""} · ${transaction.damageComponent.adjusted} ${transaction.damageComponent.type} 피해`;
  }
  resolution.calculatedOutcome=resolution.compact;
  if (!resolution.adjudicated) resolution.finalOutcome=resolution.compact;
  return true;
}

function finalize(
  adapter:MockAdapter,
  internal:ConcentrationAdapterState,
  transaction:CommittedAttack,
) {
  const resolution=internal.resolution;
  if (!resolution) return;
  const events=[
    ...consumeAdapterInterruptEvents(adapter,resolution.id),
    ...transaction.events.map((event)=>structuredClone(event)),
  ];
  resolution.stage="complete";
  resolution.canAdvance=false;
  resolution.nextLabel=undefined;
  internal.syncChar();
  internal.activity.unshift(projectResolutionEventsToActivity({
    resolution,
    events,
    actorName:internal.entity(resolution.actorId)?.name ?? resolution.actorId,
    targetNames:resolution.targetIds.map((id)=>internal.entity(id)?.name ?? id),
  }));
  runtimeResolutionEventHistories.set(adapter,{
    resolutionId:resolution.id,
    events:events.map((event)=>structuredClone(event)),
  });
  internal.lastBefore=internal.before ? structuredClone(internal.before) : null;
  internal.lastResolutionId=resolution.id;
  internal.before=null;
  prompts.delete(adapter);
  pendingTransactions.delete(adapter);
  clearPendingManualMovementReaction(adapter);
}

MockAdapter.prototype.advanceResolution=async function advanceResolutionWithConcentrationSave() {
  const internal=this as unknown as ConcentrationAdapterState;
  const resolution=internal.resolution;
  const action=resolution ? internal.action(resolution.actionId) : undefined;
  const manual=manualFor(this,action,resolution);
  if (!resolution || !isRuntimeAtomicAttack(action,manual) || resolution.adjudicated || internal.sessionMode!=="initiative") {
    return previousAdvance.call(this);
  }

  if (resolution.stage==="attack-result" && resolution.attackOutcome==="명중") {
    const prepared=preparePrompt(this,internal,action!,resolution,manual);
    if (prepared.status==="staged") return internal.getSnapshot();
    if (prepared.status==="rejected") {
      reject(this,internal,prepared.error);
      return internal.getSnapshot();
    }
    return previousAdvance.call(this);
  }

  const prompt=prompts.get(this);
  if (!prompt || prompt.resolutionId!==resolution.id) return previousAdvance.call(this);

  if (resolution.stage==="damage-animation") {
    resolution.stage="save-animation";
    resolution.rollKind="save";
    resolution.authoritativeDice=[];
    resolution.canAdvance=false;
    resolution.nextLabel=undefined;
    resolution.detail.push(`${resolution.concentrationSave?.targetName ?? prompt.targetId}의 건강(Constitution) 집중 내성 d20 입력 대기`);
    return internal.getSnapshot();
  }

  if (resolution.stage==="save-animation" && resolution.concentrationSave?.natural!==undefined) {
    const transaction=pendingTransactions.get(this);
    if (!transaction) {
      reject(this,internal,"missing staged concentration-save attack transaction",false);
      return internal.getSnapshot();
    }
    if (!transaction.runtimeState || transaction.runtimeInputRevision===undefined) {
      reject(this,internal,"concentration-save transaction is missing authoritative runtime state",false);
      return internal.getSnapshot();
    }
    const committed=commitAdapterTurnRuntimeState(
      this,
      internal.scene,
      transaction.runtimeInputRevision,
      transaction.runtimeState,
    );
    if (!committed) {
      reject(this,internal,"turn runtime revision changed before concentration-save commit",false);
      return internal.getSnapshot();
    }
    if (!applyTransaction(internal,resolution,transaction)) {
      reject(this,internal,"concentration-save target disappeared before projection",false);
      return internal.getSnapshot();
    }
    finalize(this,internal,transaction);
    return internal.getSnapshot();
  }

  return previousAdvance.call(this);
};

MockAdapter.prototype.submitConcentrationSaveD20=async function submitConcentrationSaveD20(face:number) {
  const internal=this as unknown as ConcentrationAdapterState;
  const resolution=internal.resolution;
  const prompt=prompts.get(this);
  if (!resolution || !prompt || prompt.resolutionId!==resolution.id || resolution.stage!=="save-animation" || resolution.concentrationSave?.natural!==undefined) {
    return internal.getSnapshot();
  }
  if (!Number.isInteger(face) || face<1 || face>20) {
    reject(this,internal,`invalid concentration d20 face: ${face}`);
    return internal.getSnapshot();
  }

  const runtimeState=snapshotAdapterTurnRuntimeState(this,internal.scene);
  if (!runtimeState || runtimeState.revision!==prompt.runtimeRevision) {
    reject(this,internal,"turn runtime revision changed while concentration save awaited input",false);
    return internal.getSnapshot();
  }
  if (runtimeState.concentration[prompt.targetId]?.groupId!==prompt.concentrationGroupId) {
    reject(this,internal,"concentration state changed while save awaited input",false);
    return internal.getSnapshot();
  }

  const action=internal.action(resolution.actionId);
  if (!action) {
    reject(this,internal,"concentration-save action disappeared before input commit",false);
    return internal.getSnapshot();
  }
  const transaction=buildRequest(internal,resolution,action,prompt,runtimeState,face);
  if (transaction.status==="rejected") {
    reject(this,internal,transaction.error,false);
    return internal.getSnapshot();
  }
  const check=checkFromTransaction(transaction,prompt.targetId);
  if (!check?.test) {
    reject(this,internal,"authoritative damage transaction did not return a concentration d20 result",false);
    return internal.getSnapshot();
  }

  pendingTransactions.set(this,transaction);
  const view:ConcentrationSaveVm={
    targetId:prompt.targetId,
    targetName:resolution.concentrationSave?.targetName ?? prompt.targetId,
    ability:"con",
    modifier:check.test.modifier,
    modifierSource:prompt.saveFact.source,
    natural:check.test.natural,
    total:check.test.total,
    dc:check.dc,
    outcome:check.maintained ? "성공" : "실패",
  };
  resolution.concentrationSave=view;
  resolution.stage="save-animation";
  resolution.rollKind="save";
  resolution.authoritativeDice=[check.test.natural];
  resolution.canAdvance=true;
  resolution.nextLabel="집중 내성 적용";
  resolution.detail.push(
    `집중 내성: d20 ${check.test.natural} ${check.test.modifier>=0 ? "+" : ""}${check.test.modifier} = ${check.test.total} vs DC ${check.dc} · ${view.outcome}`,
  );
  return internal.getSnapshot();
};
