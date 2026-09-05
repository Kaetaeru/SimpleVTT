import "./phase09RealTurnRuntimeAdapter";
import "./engagementContracts";
import type { ActionVm, ActivityEntry, AppSnapshot, ResolutionView, SceneEntity, SceneVm } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { registerAttackRollStateContributor } from "./phase09RealResolutionAdapter";
import { ENGAGEMENT_RANGED_IN_MELEE_SOURCE } from "./engagementContracts";
import {
  type EngagementRecord,
  clearEngagement,
  clearEngagementsOf,
  engagedWith,
  isEngaged,
  pruneEngagementsToPresent,
  pruneIdleEngagements,
  recordMeleeAttack,
} from "../domain/engagement";

/**
 * V1.2 T1-03 — engagement inference. No positions: a resolved melee attack engages attacker and target; a
 * ranged attack by an engaged creature takes disadvantage automatically (ranged attack in melee); Disengage,
 * death, leaving the scene, or a round without melee between the pair end it. The DM can clear or set a pair
 * by hand (the toggle for the rare exception). Records live in the scene so scene-restore undo covers them,
 * and the adapter re-applies its own memory after an event-native undo.
 */
interface EngagementAdapterState {
  scene:SceneVm;
  resolution:ResolutionView|null;
  activity:ActivityEntry[];
  sessionMode:string;
  lastResolutionId:string|null;
  getSnapshot():Promise<AppSnapshot>;
}

const cp=<T,>(value:T):T=>structuredClone(value);
let sequence=0;
const eventId=(prefix:string)=>`${prefix}.${Date.now()}.${sequence++}`;
const undoMemory=new WeakMap<MockAdapter,{ resolutionId:string; before:EngagementRecord[] }>();

export const DISENGAGE_ACTION_IDS=new Set(["action.standard.disengage","action.disengage","action.rogue.cunning-action.disengage"]);

export function isMeleeAttackAction(action:ActionVm|undefined):action is ActionVm {
  return Boolean(action && action.resolutionKind==="attack" && action.runtimeAttack && action.runtimeAttack.rangeFeet<=10);
}

export function isRangedAttackAction(action:ActionVm|undefined):action is ActionVm {
  return Boolean(action && action.resolutionKind==="attack" && action.runtimeAttack && action.runtimeAttack.rangeFeet>10);
}

export function isDisengageAction(action:ActionVm|undefined) {
  return Boolean(action && (DISENGAGE_ACTION_IDS.has(action.id) || action.id.endsWith(".disengage") || action.name==="이탈"));
}

function records(scene:SceneVm):EngagementRecord[] {
  return scene.engagements ?? [];
}

function entityName(scene:SceneVm,id:string) {
  return scene.entities.find((entity)=>entity.id===id)?.name ?? id;
}

/** Hostile, living creatures the actor is engaged with — the ones that make a ranged attack "in melee". */
export function hostileEngagedIds(scene:SceneVm,actorId:string):string[] {
  const actor=scene.entities.find((entity)=>entity.id===actorId);
  if (!actor) return [];
  return engagedWith(records(scene),actorId).filter((id)=>{
    const other=scene.entities.find((entity)=>entity.id===id);
    return Boolean(other && other.side!==actor.side && other.hp>0);
  });
}

/** Drops pairs whose members left the scene or died, and projects `engagedWithIds` for the boards. */
export function projectEngagements(scene:SceneVm) {
  const alive=new Set(scene.entities.filter((entity)=>entity.hp>0).map((entity)=>entity.id));
  const pruned=pruneEngagementsToPresent(records(scene),alive);
  if (pruned.length!==records(scene).length) scene.engagements=pruned;
  for (const entity of scene.entities) {
    const ids=engagedWith(pruned,entity.id);
    if (ids.length) entity.engagedWithIds=ids;
    else delete entity.engagedWithIds;
  }
}

registerAttackRollStateContributor(({ scene, action })=>{
  if (!isRangedAttackAction(action)) return [];
  const engaged=hostileEngagedIds(scene,action.actorId);
  if (!engaged.length) return [];
  return [{ source:`${ENGAGEMENT_RANGED_IN_MELEE_SOURCE}:${engaged.join(",")}`, state:"disadvantage" as const }];
});

declare module "./mockAdapter" {
  interface MockAdapter {
    /** DM toggle: set or clear an engagement between two creatures by hand. */
    setEngagement(leftId:string,rightId:string,engaged:boolean):Promise<AppSnapshot>;
  }
}

const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
const previousResolveAction=MockAdapter.prototype.resolveAction;
const previousEndTurn=MockAdapter.prototype.endTurn;
const previousUndo=MockAdapter.prototype.undoLastResolution;

MockAdapter.prototype.getSnapshot=async function getSnapshotWithEngagements() {
  const internal=this as unknown as EngagementAdapterState;
  projectEngagements(internal.scene);
  return previousGetSnapshot.call(this);
};

MockAdapter.prototype.resolveAction=async function resolveActionWithEngagements(actionId:string,targetIds:string[]) {
  const internal=this as unknown as EngagementAdapterState;
  const beforeId=internal.resolution?.id;
  const before=cp(records(internal.scene));
  await previousResolveAction.call(this,actionId,targetIds);
  const resolution=internal.resolution;
  if (resolution && resolution.id!==beforeId && resolution.actionId===actionId && resolution.calculatedOutcome!=="적용 거부") {
    const action=(internal.scene.actionsByActor[resolution.actorId] ?? []).find((entry)=>entry.id===actionId);
    const round=Math.max(1,internal.scene.round);
    let next:EngagementRecord[]|null=null;
    if (isMeleeAttackAction(action) && resolution.targetIds[0] && resolution.targetIds[0]!==resolution.actorId) {
      const targetId=resolution.targetIds[0];
      const already=isEngaged(before,resolution.actorId,targetId);
      next=recordMeleeAttack(before,resolution.actorId,targetId,round);
      resolution.stateChanges.push(already
        ? `교전 유지: ${entityName(internal.scene,resolution.actorId)} ↔ ${entityName(internal.scene,targetId)}`
        : `교전 시작: ${entityName(internal.scene,resolution.actorId)} ↔ ${entityName(internal.scene,targetId)}`);
      resolution.provenance.push(`engagement:melee-attack:${resolution.actorId}<->${targetId}:round:${round}`);
    } else if (isDisengageAction(action)) {
      const engaged=engagedWith(before,resolution.actorId);
      if (engaged.length) {
        next=clearEngagementsOf(before,resolution.actorId);
        resolution.stateChanges.push(`교전 종료 (이탈): ${entityName(internal.scene,resolution.actorId)} ↔ ${engaged.map((id)=>entityName(internal.scene,id)).join(", ")}`);
      }
    }
    if (next) {
      internal.scene.engagements=next;
      undoMemory.set(this,{ resolutionId:resolution.id, before });
    }
  }
  return internal.getSnapshot();
};

MockAdapter.prototype.endTurn=async function endTurnWithEngagements() {
  const internal=this as unknown as EngagementAdapterState;
  const roundBefore=internal.scene.round;
  await previousEndTurn.call(this);
  const round=internal.scene.round;
  if (internal.sessionMode==="initiative" && round>roundBefore) {
    const current=records(internal.scene);
    const kept=pruneIdleEngagements(current,round);
    if (kept.length!==current.length) {
      const dropped=current.filter((record)=>!kept.includes(record));
      internal.scene.engagements=kept;
      internal.activity.unshift({
        id:eventId("engagement-idle"),
        time:"지금",
        actor:"시스템",
        title:"교전 종료 · 한 라운드 동안 근접 공격 없음",
        summary:dropped.map((record)=>`${entityName(internal.scene,record.a)} ↔ ${entityName(internal.scene,record.b)}`).join(", "),
        detail:[`${round}라운드 시작 · 직전 라운드에 근접 공격이 없던 교전이 끝납니다.`],
        stateChanges:dropped.map((record)=>`교전 종료: ${record.a} ↔ ${record.b}`),
      });
    }
  }
  return internal.getSnapshot();
};

MockAdapter.prototype.undoLastResolution=async function undoLastResolutionWithEngagements() {
  const internal=this as unknown as EngagementAdapterState;
  const target=internal.lastResolutionId;
  const memory=undoMemory.get(this);
  await previousUndo.call(this);
  if (memory && target && memory.resolutionId===target && internal.lastResolutionId!==target) {
    internal.scene.engagements=cp(memory.before);
    undoMemory.delete(this);
  }
  return internal.getSnapshot();
};

MockAdapter.prototype.setEngagement=async function setEngagementRuntime(leftId:string,rightId:string,engaged:boolean) {
  const internal=this as unknown as EngagementAdapterState;
  const left=internal.scene.entities.find((entity)=>entity.id===leftId);
  const right=internal.scene.entities.find((entity)=>entity.id===rightId);
  if (!left || !right || leftId===rightId) return internal.getSnapshot();
  const current=records(internal.scene);
  const currently=isEngaged(current,leftId,rightId);
  if (currently===engaged) return internal.getSnapshot();
  internal.scene.engagements=engaged ? recordMeleeAttack(current,leftId,rightId,Math.max(1,internal.scene.round)) : clearEngagement(current,leftId,rightId);
  internal.activity.unshift({
    id:eventId("engagement-dm"),
    time:"지금",
    actor:"DM",
    title:engaged ? "교전 지정" : "교전 해제",
    summary:`${left.name} ↔ ${right.name}`,
    detail:[engaged ? "DM이 두 크리처를 교전 중으로 지정했습니다." : "DM이 교전을 해제했습니다. 다음 원거리 공격은 근접 불리점을 받지 않습니다."],
    stateChanges:[`${engaged ? "교전 시작" : "교전 종료"}: ${leftId} ↔ ${rightId}`],
  });
  return internal.getSnapshot();
};

export function engagementPartners(scene:SceneVm,entity:Pick<SceneEntity,"id">):string[] {
  return engagedWith(records(scene),entity.id);
}
