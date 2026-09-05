import "./phase09RealResolutionAdapter";
import "./phase09RealRuntimeAttackAdapter";
import type { ActivityEntry, AppSnapshot, ResolutionView, SceneVm } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { registerAttackRollStateContributor, registerAttackRollStateFilter, registerAttackTargetAcContributor } from "./phase09RealResolutionAdapter";

/**
 * V1.2 T1-06 — post-hoc DM toggles on a committed result card. The table never stops for a question: the
 * result lands, and the DM corrects the rare exception afterwards. A toggle re-judges *that* resolution:
 * the original is undone through the existing undo path, then the same action is resolved again with the
 * same first d20 face and the toggle applied (advantage/disadvantage/plain roll, cover +2/+5). 피해 절반 is a
 * healing correction of half the damage dealt; 닿지 않음 undoes the attack and records an approach instead.
 */
export type PostHocToggle="advantage"|"disadvantage"|"plain-roll"|"cover-half"|"cover-three-quarters"|"out-of-reach"|"half-damage";

export interface PostHocRecordVm {
  toggle:PostHocToggle;
  label:string;
  previousOutcome:string;
}

interface PendingPostHoc {
  actionId:string;
  targetIds:string[];
  toggle:PostHocToggle;
  rollState:"advantage"|"disadvantage"|null;
  plainRoll:boolean;
  acBonus:number;
}

interface PostHocAdapterState {
  scene:SceneVm;
  resolution:ResolutionView|null;
  activity:ActivityEntry[];
  lastResolutionId:string|null;
  /** Test/replay hook: d20 faces consumed in order before the mock's own d20 mapping. */
  queuedD20Sequence?:number[]|null;
  /** Test hook: the extra face rolled when a toggle adds a second d20. */
  queuedPostHocD20?:number|null;
  getSnapshot():Promise<AppSnapshot>;
  declareMovement?(actorId:string,kind:"approach"|"withdraw"|"stay",targetId?:string):Promise<AppSnapshot>;
}

declare module "./contracts" {
  interface ResolutionView {
    /** T1-06: the DM toggle that re-judged this resolution. */
    postHoc?:PostHocRecordVm;
  }
}

declare module "./mockAdapter" {
  interface MockAdapter {
    applyPostHocToggle(toggle:PostHocToggle):Promise<AppSnapshot>;
  }
}

export const POST_HOC_LABEL:Record<PostHocToggle,string>={
  advantage:"이점", disadvantage:"불리점", "plain-roll":"판정 그대로", "cover-half":"엄폐 ½", "cover-three-quarters":"엄폐 ¾", "out-of-reach":"닿지 않음", "half-damage":"피해 절반",
};

const pendingByAdapter=new WeakMap<MockAdapter,PendingPostHoc>();
/** First-roll attack faces per resolution id (the complete stage replaces authoritativeDice with damage faces). */
const attackFacesByAdapter=new WeakMap<MockAdapter,{ resolutionId:string; faces:number[] }>();
let sequence=0;
const eventId=(prefix:string)=>`${prefix}.${Date.now()}.${sequence++}`;

registerAttackRollStateContributor(({ action })=>{
  for (const [adapter,pending] of pendingEntries()) {
    if (pending.actionId===action.id && pending.rollState) return [{ source:`dm:post-hoc:${pending.rollState}`, state:pending.rollState }];
    void adapter;
  }
  return [];
});
registerAttackRollStateFilter((contributions,{ action })=>{
  for (const [,pending] of pendingEntries()) {
    if (pending.actionId===action.id && pending.plainRoll) return contributions.filter((entry)=>entry.source.startsWith("dm:post-hoc:"));
  }
  return contributions;
});
registerAttackTargetAcContributor(({ action })=>{
  for (const [,pending] of pendingEntries()) {
    if (pending.actionId===action.id && pending.acBonus) return { bonus:pending.acBonus, source:`dm:post-hoc:cover:+${pending.acBonus}` };
  }
  return null;
});

// WeakMap has no iteration; keep a parallel registry of adapters with a pending toggle (cleared as soon as the toggle lands).
const activeAdapters=new Set<MockAdapter>();
function pendingEntries():Array<[MockAdapter,PendingPostHoc]> {
  return [...activeAdapters].flatMap((adapter)=>{ const pending=pendingByAdapter.get(adapter); return pending ? [[adapter,pending] as [MockAdapter,PendingPostHoc]] : []; });
}

function isAttackResolution(resolution:ResolutionView|null):resolution is ResolutionView {
  return Boolean(resolution && resolution.stage==="complete" && resolution.attackOutcome && (resolution.rollKind==="attack" || resolution.rollKind==="damage"));
}

function damageDealt(resolution:ResolutionView) {
  return resolution.damageComponents.reduce((sum,component)=>sum+Math.max(0,component.adjusted),0);
}

const previousResolveAction=MockAdapter.prototype.resolveAction;
const mockPrototype=MockAdapter.prototype as unknown as { d20(actionId:string,index?:number):number };
const previousD20=mockPrototype.d20;

mockPrototype.d20=function d20WithQueuedSequence(actionId:string,index=0) {
  const internal=this as unknown as PostHocAdapterState;
  const queue=internal.queuedD20Sequence;
  if (queue && queue.length) return queue.shift()!;
  return previousD20.call(this,actionId,index);
};

MockAdapter.prototype.resolveAction=async function resolveActionRememberingAttackFaces(actionId:string,targetIds:string[]) {
  const internal=this as unknown as PostHocAdapterState;
  const beforeId=internal.resolution?.id;
  await previousResolveAction.call(this,actionId,targetIds);
  const resolution=internal.resolution;
  if (resolution && resolution.id!==beforeId && resolution.rollKind==="attack") attackFacesByAdapter.set(this,{ resolutionId:resolution.id, faces:[...resolution.authoritativeDice] });
  return internal.getSnapshot();
};

function log(internal:PostHocAdapterState,actorName:string,title:string,summary:string,detail:string[],stateChanges:string[]) {
  internal.activity.unshift({ id:eventId("post-hoc"), time:"지금", actor:actorName, title, summary, detail, stateChanges, correction:true });
}

MockAdapter.prototype.applyPostHocToggle=async function applyPostHocToggleRuntime(toggle:PostHocToggle) {
  const internal=this as unknown as PostHocAdapterState;
  const resolution=internal.resolution;
  if (!resolution || resolution.stage!=="complete") return internal.getSnapshot();
  const actorName=internal.scene.entities.find((entity)=>entity.id===resolution.actorId)?.name ?? resolution.actorId;
  const targetId=resolution.targetIds[0];
  const previousOutcome=resolution.finalOutcome || resolution.compact;

  if (toggle==="half-damage") {
    const dealt=damageDealt(resolution);
    if (!targetId || dealt<=0) return internal.getSnapshot();
    const refund=Math.floor(dealt/2);
    await this.applyDmAdjudication({ type:"healing-correction", value:refund, targetId, scope:"resolution", reason:"피해 절반" });
    const after=internal.resolution;
    if (after && after.id===resolution.id) {
      after.postHoc={ toggle, label:POST_HOC_LABEL[toggle], previousOutcome };
      after.finalOutcome=`피해 절반 · ${dealt} → ${dealt-refund}`;
    }
    return internal.getSnapshot();
  }

  if (!isAttackResolution(resolution) || !targetId) return internal.getSnapshot();
  const faces=attackFacesByAdapter.get(this)?.resolutionId===resolution.id ? attackFacesByAdapter.get(this)!.faces : [];
  const firstFace=faces[0];
  const actionId=resolution.actionId;
  const targetIds=[...resolution.targetIds];
  const targetName=internal.scene.entities.find((entity)=>entity.id===targetId)?.name ?? targetId;

  const undoTarget=internal.lastResolutionId;
  await this.undoLastResolution();
  if (undoTarget && internal.lastResolutionId===undoTarget) {
    log(internal,actorName,"사후 수정 거부",`${POST_HOC_LABEL[toggle]}: 판정을 되돌리지 못했습니다.`,[internal.resolution?.finalOutcome ?? ""],[]);
    return internal.getSnapshot();
  }

  if (toggle==="out-of-reach") {
    if (internal.declareMovement) await internal.declareMovement.call(this,resolution.actorId,"approach",targetId);
    log(internal,actorName,"사후 수정 · 닿지 않음",`${resolution.actionName} 취소 · ${targetName}에게 접근으로 기록`,["공격이 되돌려졌습니다. 접근 후 다시 공격하세요."],[`${resolution.actionName} 되돌림`,"이동 선언: 접근"]);
    internal.resolution=null;
    return internal.getSnapshot();
  }

  const pending:PendingPostHoc={
    actionId, targetIds, toggle,
    rollState:toggle==="advantage" ? "advantage" : toggle==="disadvantage" ? "disadvantage" : null,
    plainRoll:toggle==="plain-roll",
    acBonus:toggle==="cover-half" ? 2 : toggle==="cover-three-quarters" ? 5 : 0,
  };
  pendingByAdapter.set(this,pending);
  activeAdapters.add(this);
  const secondFace=typeof internal.queuedPostHocD20==="number" ? internal.queuedPostHocD20 : Math.floor(Math.random()*20)+1;
  internal.queuedPostHocD20=null;
  internal.queuedD20Sequence=firstFace!==undefined ? [firstFace,secondFace] : [];
  try {
    await this.resolveAction(actionId,targetIds);
    let snapshot=await internal.getSnapshot();
    for (let step=0; step<8 && snapshot.resolution && snapshot.resolution.canAdvance && !snapshot.resolution.interrupt && snapshot.resolution.stage!=="complete"; step+=1) snapshot=await this.advanceResolution();
  } finally {
    pendingByAdapter.delete(this);
    activeAdapters.delete(this);
    internal.queuedD20Sequence=null;
  }
  const after=internal.resolution;
  if (after) {
    after.postHoc={ toggle, label:POST_HOC_LABEL[toggle], previousOutcome };
    after.detail.unshift(`DM 사후 수정: ${POST_HOC_LABEL[toggle]} · 이전 결과 "${previousOutcome}"`);
    after.provenance.push(`dm:post-hoc:${toggle}:re-judged-with-first-face:${firstFace ?? "n/a"}`);
  }
  log(internal,actorName,`사후 수정 · ${POST_HOC_LABEL[toggle]}`,`${resolution.actionName} → ${targetName} · ${previousOutcome} → ${after?.finalOutcome ?? after?.compact ?? "다시 판정"}`,[`같은 첫 d20 (${firstFace ?? "?"})로 다시 판정`],[]);
  return internal.getSnapshot();
};
