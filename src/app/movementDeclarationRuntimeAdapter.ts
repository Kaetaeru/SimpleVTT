import "./engagementRuntimeAdapter";
import "./phase09ManualMovementReactionAdapter";
import "./movementDeclarationContracts";
import type { ActivityEntry, AppSnapshot, ResolutionView, SceneVm } from "./contracts";
import type { MovementDeclarationKind, PendingWithdrawalVm, WithdrawalOpportunityCandidateVm } from "./movementDeclarationContracts";
import { MockAdapter } from "./mockAdapter";
import { isOpportunityAttackAction, opportunityAttackCommand } from "./manualMovementReactionContracts";
import { hostileEngagedIds } from "./engagementRuntimeAdapter";
import { clearEngagementsOf } from "../domain/engagement";

/**
 * V1.2 T1-05 — movement declarations and the opportunity-attack prompt.
 *
 * 접근(대상) · 물러남 · 그대로 replace feet. Speed is displayed, never gates. 물러남 by a creature engaged with a
 * hostile that still has its reaction and a melee attack opens one prompt for the DM: pick the reactor (the
 * existing manual movement-reaction path resolves the attack) or "없음". Either way the withdrawing creature's
 * engagements end. 이탈 (Disengage) suppresses the prompt. The per-card "기회공격 유발" button is gone.
 */
interface MovementAdapterState {
  scene:SceneVm;
  resolution:ResolutionView|null;
  activity:ActivityEntry[];
  sessionMode:string;
  getSnapshot():Promise<AppSnapshot>;
}

let sequence=0;
const eventId=(prefix:string)=>`${prefix}.${Date.now()}.${sequence++}`;
const KIND_LABEL:Record<MovementDeclarationKind,string>={ approach:"접근", withdraw:"물러남", stay:"그대로" };

function hasDisengaged(status:string[]) {
  return status.some((entry)=>entry==="이탈" || entry.endsWith("이탈"));
}

/** Engaged hostiles that can still react with a melee attack. */
export function withdrawalCandidates(scene:SceneVm,actorId:string):WithdrawalOpportunityCandidateVm[] {
  return hostileEngagedIds(scene,actorId).flatMap((reactorId)=>{
    const reactor=scene.entities.find((entity)=>entity.id===reactorId);
    if (!reactor || !scene.economyByActor[reactorId]?.reaction) return [];
    const action=(scene.actionsByActor[reactorId] ?? []).find(isOpportunityAttackAction);
    if (!action) return [];
    return [{ reactorId, reactorName:reactor.name, actionId:action.id, actionName:action.name }];
  });
}

/** Projects declarations onto entities; a declaration lasts until the actor's next turn start. */
export function projectMovementDeclarations(scene:SceneVm) {
  const declarations=scene.movementDeclarations ?? {};
  for (const entity of scene.entities) {
    const declaration=declarations[entity.id];
    if (declaration) entity.movementDeclaration=declaration;
    else delete entity.movementDeclaration;
  }
  if (scene.pendingWithdrawal && !scene.entities.some((entity)=>entity.id===scene.pendingWithdrawal!.actorId)) delete scene.pendingWithdrawal;
}

declare module "./mockAdapter" {
  interface MockAdapter {
    /** 접근(targetId) · 물러남 · 그대로 for the current-turn actor (DM may declare for any combatant it controls). */
    declareMovement(actorId:string,kind:MovementDeclarationKind,targetId?:string):Promise<AppSnapshot>;
    /** Answer the 물러남 prompt: `reactorId` takes its opportunity attack, or `null` for none. */
    answerWithdrawalPrompt(reactorId:string|null):Promise<AppSnapshot>;
  }
}

const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
const previousEndTurn=MockAdapter.prototype.endTurn;

MockAdapter.prototype.getSnapshot=async function getSnapshotWithMovementDeclarations() {
  const internal=this as unknown as MovementAdapterState;
  projectMovementDeclarations(internal.scene);
  return previousGetSnapshot.call(this);
};

MockAdapter.prototype.endTurn=async function endTurnWithMovementDeclarations() {
  const internal=this as unknown as MovementAdapterState;
  await previousEndTurn.call(this);
  // The new current actor starts fresh: last turn's declaration is cleared.
  if (internal.scene.movementDeclarations?.[internal.scene.currentActorId]) delete internal.scene.movementDeclarations[internal.scene.currentActorId];
  return internal.getSnapshot();
};

function log(internal:MovementAdapterState,actorName:string,title:string,summary:string,detail:string[],stateChanges:string[]) {
  internal.activity.unshift({ id:eventId("movement"), time:"지금", actor:actorName, title, summary, detail, stateChanges });
}

MockAdapter.prototype.declareMovement=async function declareMovementRuntime(actorId:string,kind:MovementDeclarationKind,targetId?:string) {
  const internal=this as unknown as MovementAdapterState;
  const actor=internal.scene.entities.find((entity)=>entity.id===actorId);
  if (!actor) return internal.getSnapshot();
  if (internal.resolution) {
    log(internal,actor.name,"이동 선언 보류","진행 중인 판정을 먼저 마쳐야 합니다.",[],[]);
    return internal.getSnapshot();
  }
  if (internal.scene.pendingWithdrawal) {
    log(internal,actor.name,"이동 선언 보류","물러남에 대한 기회공격 여부를 먼저 정해야 합니다.",[],[]);
    return internal.getSnapshot();
  }
  const round=Math.max(1,internal.scene.round);
  internal.scene.movementDeclarations ??= {};
  if (kind==="approach") {
    const target=targetId ? internal.scene.entities.find((entity)=>entity.id===targetId) : undefined;
    internal.scene.movementDeclarations[actorId]={ kind, ...(target ? { targetId:target.id } : {}), round };
    log(internal,actor.name,"이동 · 접근",target ? `${target.name}에게 접근` : "접근",["위치 없이 선언만 기록합니다. 근접 공격이 판정되면 교전이 시작됩니다."],[`이동 선언: 접근${target ? ` → ${target.id}` : ""}`]);
    return internal.getSnapshot();
  }
  if (kind==="stay") {
    internal.scene.movementDeclarations[actorId]={ kind, round };
    log(internal,actor.name,"이동 · 그대로","자리를 지킵니다.",[],["이동 선언: 그대로"]);
    return internal.getSnapshot();
  }
  // 물러남
  internal.scene.movementDeclarations[actorId]={ kind:"withdraw", round };
  const candidates=hasDisengaged(actor.status) ? [] : withdrawalCandidates(internal.scene,actorId);
  if (candidates.length && internal.sessionMode==="initiative") {
    const pending:PendingWithdrawalVm={ actorId, actorName:actor.name, round, candidates };
    internal.scene.pendingWithdrawal=pending;
    log(internal,actor.name,"이동 · 물러남",`${candidates.map((candidate)=>candidate.reactorName).join(", ")}의 기회공격 여부를 DM이 정합니다.`,candidates.map((candidate)=>`${candidate.reactorName} · ${candidate.actionName} (반응 사용 가능)`),["이동 선언: 물러남 · 기회공격 확인 대기"]);
    return internal.getSnapshot();
  }
  finishWithdrawal(internal,actorId,hasDisengaged(actor.status) ? "이탈 중이라 기회공격을 유발하지 않습니다." : "교전 중인 상대가 없거나 반응이 남아 있지 않아 기회공격이 없습니다.");
  return internal.getSnapshot();
};

function finishWithdrawal(internal:MovementAdapterState,actorId:string,reason:string) {
  const actor=internal.scene.entities.find((entity)=>entity.id===actorId);
  const engaged=(internal.scene.engagements ?? []).filter((record)=>record.a===actorId || record.b===actorId);
  internal.scene.engagements=clearEngagementsOf(internal.scene.engagements ?? [],actorId);
  delete internal.scene.pendingWithdrawal;
  log(internal,actor?.name ?? actorId,"이동 · 물러남",reason,engaged.length ? [`교전 종료: ${engaged.map((record)=>`${record.a} ↔ ${record.b}`).join(", ")}`] : [],[...(engaged.length ? ["교전 종료 (물러남)"] : []),"이동 선언: 물러남"]);
}

MockAdapter.prototype.answerWithdrawalPrompt=async function answerWithdrawalPromptRuntime(reactorId:string|null) {
  const internal=this as unknown as MovementAdapterState;
  const pending=internal.scene.pendingWithdrawal;
  if (!pending) return internal.getSnapshot();
  if (reactorId===null) {
    finishWithdrawal(internal,pending.actorId,"DM이 기회공격 없이 물러남을 허용했습니다.");
    return internal.getSnapshot();
  }
  const candidate=pending.candidates.find((entry)=>entry.reactorId===reactorId);
  if (!candidate) return internal.getSnapshot();
  const action=(internal.scene.actionsByActor[candidate.reactorId] ?? []).find((entry)=>entry.id===candidate.actionId);
  if (!action) { finishWithdrawal(internal,pending.actorId,"반응 공격 Action을 찾지 못해 기회공격 없이 물러납니다."); return internal.getSnapshot(); }
  // The withdrawing creature leaves reach as the reaction lands: engagements end, then the manual reaction path resolves the attack.
  finishWithdrawal(internal,pending.actorId,`${candidate.reactorName}이(가) 기회공격을 합니다 (${candidate.actionName}).`);
  return this.declareManualMovementReaction(opportunityAttackCommand(pending.actorId,candidate.reactorId,action));
};

export const MOVEMENT_KIND_LABEL=KIND_LABEL;
