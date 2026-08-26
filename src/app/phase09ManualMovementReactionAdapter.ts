import "./phase09RealRuntimeAttackAdapter";
import "./manualMovementReactionContracts";
import type { ActionVm, ActivityEntry, AppSnapshot, ResolutionView, SceneEntity, SceneVm, SessionMode } from "./contracts";
import { isOpportunityAttackAction, type ManualMovementReactionCommand } from "./manualMovementReactionContracts";
import { MockAdapter } from "./mockAdapter";
import { clearPendingManualMovementReaction, setPendingManualMovementReaction } from "./manualMovementReactionRuntime";
import { resolveAttackRollResolution } from "./realResolutionService";
import { SRD_521_COVER_POLICY, coverBonus } from "../domain/targeting";

interface ManualMovementReactionAdapterState {
  sessionMode:SessionMode;
  scene:SceneVm;
  resolution:ResolutionView|null;
  activity:ActivityEntry[];
  capture():void;
  d20(actionId:string,index?:number):number;
  entity(id:string):SceneEntity|undefined;
  getSnapshot():Promise<AppSnapshot>;
}

const previousDismiss=MockAdapter.prototype.dismissResolution;

function eventId(kind:string) {
  return `phase09.${kind}.${Date.now()}.${Math.floor(Math.random()*1000)}`;
}

function triggerIdentity(command:ManualMovementReactionCommand) {
  if (command.kind==="opportunity-attack") {
    return {
      id:"movement:opportunity-attack",
      label:"기회공격 · 이동에 의한 도달거리 이탈",
      optionId:`manual-movement:opportunity-attack:${command.attackActionId}`,
    };
  }
  const label=command.triggerLabel?.trim();
  if (!label) throw new Error("기타 이동 반응 공격은 트리거 설명이 필요합니다.");
  return {
    id:"movement:manual-reaction-attack",
    label,
    optionId:`manual-movement:other-reaction-attack:${command.attackActionId}`,
  };
}

function reject(internal:ManualMovementReactionAdapterState,command:ManualMovementReactionCommand,error:string) {
  internal.activity.unshift({
    id:eventId("manual-movement-reaction-rejected"),
    time:"지금",
    actor:internal.entity(command.provokerId)?.name ?? command.provokerId,
    title:"이동 반응 입력 거부",
    summary:error,
    detail:["Core는 이동/트리거를 자동 추론하지 않으며, 수동 입력 fact가 rules validation을 통과해야 합니다."],
    stateChanges:[],
    correction:true,
  });
}

function validate(
  internal:ManualMovementReactionAdapterState,
  command:ManualMovementReactionCommand,
) {
  if (internal.sessionMode!=="initiative") throw new Error("이동 반응 입력은 Initiative에서만 사용할 수 있습니다.");
  if (internal.resolution) throw new Error("진행 중인 Resolution을 먼저 완료하거나 닫아야 합니다.");
  if (internal.scene.currentActorId!==command.provokerId) throw new Error(`이동 반응 입력은 현재 턴 Actor에 대해서만 선언할 수 있습니다. 현재 ${internal.scene.currentActorId}, 입력 ${command.provokerId}`);
  const provoker=internal.entity(command.provokerId);
  const reactor=internal.entity(command.reactorId);
  if (!provoker) throw new Error(`현재 턴 Actor가 없습니다: ${command.provokerId}`);
  if (!reactor) throw new Error(`반응자가 없습니다: ${command.reactorId}`);
  if (command.kind==="opportunity-attack"&&provoker.status.some((status)=>status==="이탈"||status.endsWith("이탈"))) throw new Error(`${provoker.name}은(는) 이탈 행동으로 기회공격을 유발하지 않습니다.`);
  if (reactor.id===provoker.id) throw new Error("이동 반응자는 현재 이동 Actor와 달라야 합니다.");
  if (reactor.side===provoker.side) throw new Error("현재 수동 반응 공격 경로는 적대 진영 사이에서만 허용합니다.");
  const economy=internal.scene.economyByActor[reactor.id];
  if (!economy?.reaction) throw new Error(`${reactor.name}은(는) 사용할 수 있는 Reaction이 없습니다.`);
  const action=internal.scene.actionsByActor[reactor.id]?.find((entry)=>entry.id===command.attackActionId);
  if (!action || action.actorId!==reactor.id) throw new Error(`반응 공격 Action이 없습니다: ${command.attackActionId}`);
  if (action.resolutionKind!=="attack") throw new Error(`반응 입력은 attack Action만 사용할 수 있습니다: ${action.id}`);
  if (action.itemCost || action.resourceCost) throw new Error("추가 Item/Resource 비용이 있는 수동 반응 공격은 아직 지원하지 않습니다.");
  if (command.kind==="opportunity-attack"&&!isOpportunityAttackAction(action)) throw new Error("기회공격에는 도달거리 10피트 이하의 근접 공격이 필요합니다.");
  if (!Number.isFinite(command.distanceFeet) || command.distanceFeet<0) throw new Error("트리거 순간 거리는 0 이상의 유한한 피트 값이어야 합니다.");
  return { provoker,reactor,action };
}

function targetingProvenance(command:ManualMovementReactionCommand,triggerId:string) {
  return [
    `manual:movement-reaction:${triggerId}:declared-by-current-turn-controller:${command.provokerId}`,
    `manual:movement-reaction:reactor:${command.reactorId}:action:${command.attackActionId}`,
    `manual:movement-reaction:target-facts:distance:${command.distanceFeet}ft:visible:${command.visibleAtTrigger}:cover:${command.coverAtTrigger}:target-sight:${command.targetCanSeeReactorAtTrigger}`,
  ];
}

MockAdapter.prototype.declareManualMovementReaction=async function declareManualMovementReaction(command:ManualMovementReactionCommand) {
  const internal=this as unknown as ManualMovementReactionAdapterState;
  clearPendingManualMovementReaction(this);
  try {
    const { provoker,reactor,action }=validate(internal,command);
    const trigger=triggerIdentity(command);
    const provenance=targetingProvenance(command,trigger.id);
    const acBonus=coverBonus(SRD_521_COVER_POLICY,command.coverAtTrigger);
    const previewTarget={ ...provoker,ac:provoker.ac+acBonus };
    internal.capture();
    internal.resolution=resolveAttackRollResolution({
      resolutionId:eventId("manual-movement-reaction"),
      action,
      target:previewTarget,
      diceFaces:[internal.d20(action.id)],
      modifierContributions:[{
        source:`action:${action.id}:attack-bonus`,
        value:action.attackBonus ?? 0,
      }],
    });
    internal.resolution.actionName=`${trigger.label} · ${action.name}`;
    internal.resolution.detail.unshift(`현재 턴 조종자 수동 입력 · ${trigger.label}`);
    internal.resolution.detail.push(`트리거 순간 입력 · 거리 ${command.distanceFeet}피트 · 시야 ${command.visibleAtTrigger ? "보임" : "안 보임"} · 엄폐 ${command.coverAtTrigger}`);
    internal.resolution.provenance.push(...provenance);
    if (command.coverAtTrigger!=="none") {
      internal.resolution.detail.push(`엄폐 AC 보정 Preview +${acBonus}; 최종 targeting legality는 domain transaction에서 재검증`);
    }
    setPendingManualMovementReaction(this,{
      kind:command.kind,
      provokerId:provoker.id,
      reactorId:reactor.id,
      attackActionId:action.id,
      triggerId:trigger.id,
      triggerLabel:trigger.label,
      optionId:trigger.optionId,
      source:`manual:movement-reaction:${trigger.id}`,
      baseTargetAc:provoker.ac,
      targetingFact:{
        distanceFeet:command.distanceFeet,
        visible:command.visibleAtTrigger,
        cover:command.coverAtTrigger,
        targetCanSeeAttacker:command.targetCanSeeReactorAtTrigger,
        provenance,
      },
    });
    return internal.getSnapshot();
  } catch(error) {
    clearPendingManualMovementReaction(this);
    reject(internal,command,error instanceof Error ? error.message : String(error));
    return internal.getSnapshot();
  }
};

MockAdapter.prototype.dismissResolution=async function dismissResolutionAndClearManualMovementReaction() {
  clearPendingManualMovementReaction(this);
  return previousDismiss.call(this);
};
