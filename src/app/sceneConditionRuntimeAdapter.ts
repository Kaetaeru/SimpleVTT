import "./phase09RealResolutionAdapter";
import "./sceneConditionContracts";
import type { ActivityEntry, AppSnapshot, SceneEntity, SceneVm } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { registerAttackRollStateContributor, registerAttackTargetAcContributor } from "./phase09RealResolutionAdapter";
import { CREATURE_BADGE_LABELS, SCENE_CONDITION_LABELS, type CreatureBadgeKind, type SceneConditionKind } from "./sceneConditionContracts";

/**
 * V1.2 T1-07 — sight and cover without positions. Per-creature badges (숨음, 투명, 엄폐 ½, 엄폐 ¾) live in the
 * public status list; no badge means clear. The rules read them at the moment an attack is judged:
 * a target the attacker cannot see gives disadvantage, an attacker the target cannot see gives advantage
 * (both present cancel, as in the SRD), cover adds +2/+5 to AC. Scene conditions (어둠, 안개) are narrative
 * chips: with both sides unseen the SRD effects cancel, so they change no roll on their own.
 * Narrative edits (−5, −10, 절반, condition chips) write straight to the scene with an activity line.
 */
interface ConditionAdapterState {
  scene:SceneVm;
  activity:ActivityEntry[];
  getSnapshot():Promise<AppSnapshot>;
}

let sequence=0;
const eventId=(prefix:string)=>`${prefix}.${Date.now()}.${sequence++}`;

export function hasBadge(entity:Pick<SceneEntity,"status">|undefined,badge:CreatureBadgeKind) {
  const label=CREATURE_BADGE_LABELS[badge];
  return Boolean(entity?.status.some((status)=>status===label || status===`✦ ${label}`));
}

export function isUnseen(entity:Pick<SceneEntity,"status">|undefined) {
  return hasBadge(entity,"hidden") || hasBadge(entity,"invisible");
}

export function coverBonusOf(entity:Pick<SceneEntity,"status">|undefined) {
  if (hasBadge(entity,"cover-three-quarters")) return 5;
  if (hasBadge(entity,"cover-half")) return 2;
  return 0;
}

registerAttackRollStateContributor(({ actor, target })=>{
  const contributions:Array<{ source:string; state:"advantage"|"disadvantage" }>=[];
  if (isUnseen(target)) contributions.push({ source:`badge:target-unseen:${hasBadge(target,"invisible") ? "투명" : "숨음"}`, state:"disadvantage" });
  // The attacker's own 숨음 is consumed by the resolution adapter (attack declaration reveals); 투명 stays.
  if (actor && hasBadge(actor,"invisible")) contributions.push({ source:"badge:attacker-unseen:투명", state:"advantage" });
  return contributions;
});

registerAttackTargetAcContributor(({ target })=>{
  const bonus=coverBonusOf(target);
  return bonus ? { bonus, source:`badge:cover:+${bonus}` } : null;
});

declare module "./mockAdapter" {
  interface MockAdapter {
    setSceneCondition(kind:SceneConditionKind,on:boolean):Promise<AppSnapshot>;
    setCreatureStatus(entityId:string,status:string,on:boolean):Promise<AppSnapshot>;
    setCreatureBadge(entityId:string,badge:CreatureBadgeKind,on:boolean):Promise<AppSnapshot>;
    /** Narrative HP edit: a fixed amount of damage (positive) or healing (negative), or "half" of the current HP. */
    applyNarrativeDamage(entityId:string,amount:number|"half"):Promise<AppSnapshot>;
  }
}

function log(internal:ConditionAdapterState,actor:string,title:string,summary:string,stateChanges:string[]) {
  internal.activity.unshift({ id:eventId("scene-condition"), time:"지금", actor, title, summary, detail:[], stateChanges });
}

MockAdapter.prototype.setSceneCondition=async function setSceneConditionRuntime(kind:SceneConditionKind,on:boolean) {
  const internal=this as unknown as ConditionAdapterState;
  const current=new Set(internal.scene.sceneConditions ?? []);
  if (current.has(kind)===on) return internal.getSnapshot();
  if (on) current.add(kind); else current.delete(kind);
  internal.scene.sceneConditions=[...current];
  if (!internal.scene.sceneConditions.length) delete internal.scene.sceneConditions;
  log(internal,"DM",on ? `장면 조건 · ${SCENE_CONDITION_LABELS[kind]}` : `장면 조건 해제 · ${SCENE_CONDITION_LABELS[kind]}`,on ? "양쪽 모두 보지 못하면 이점과 불리점이 상쇄됩니다. 암시야 등은 DM이 배지로 판단합니다." : "장면이 다시 맑아집니다.",[`scene.${kind} = ${on}`]);
  return internal.getSnapshot();
};

MockAdapter.prototype.setCreatureStatus=async function setCreatureStatusRuntime(entityId:string,status:string,on:boolean) {
  const internal=this as unknown as ConditionAdapterState;
  const entity=internal.scene.entities.find((entry)=>entry.id===entityId);
  if (!entity) return internal.getSnapshot();
  const has=entity.status.includes(status);
  if (has===on) return internal.getSnapshot();
  entity.status=on ? [...entity.status,status] : entity.status.filter((entry)=>entry!==status);
  log(internal,entity.name,on ? `상태 추가 · ${status}` : `상태 제거 · ${status}`,entity.status.join(" · ") || "상태 없음",[`${entity.name} 상태 ${on ? "추가" : "제거"}: ${status}`]);
  return internal.getSnapshot();
};

MockAdapter.prototype.setCreatureBadge=async function setCreatureBadgeRuntime(entityId:string,badge:CreatureBadgeKind,on:boolean) {
  // Cover badges are exclusive of each other.
  if (on && (badge==="cover-half" || badge==="cover-three-quarters")) {
    const other:CreatureBadgeKind=badge==="cover-half" ? "cover-three-quarters" : "cover-half";
    await this.setCreatureStatus(entityId,CREATURE_BADGE_LABELS[other],false);
  }
  return this.setCreatureStatus(entityId,CREATURE_BADGE_LABELS[badge],on);
};

MockAdapter.prototype.applyNarrativeDamage=async function applyNarrativeDamageRuntime(entityId:string,amount:number|"half") {
  const internal=this as unknown as ConditionAdapterState;
  const entity=internal.scene.entities.find((entry)=>entry.id===entityId);
  if (!entity) return internal.getSnapshot();
  const before=entity.hp;
  const delta=amount==="half" ? Math.floor(entity.hp/2) : amount;
  entity.hp=Math.max(0,Math.min(entity.maxHp,entity.hp-delta));
  if (entity.hp===before) return internal.getSnapshot();
  const label=amount==="half" ? "절반" : delta>0 ? `−${delta}` : `+${-delta}`;
  log(internal,"DM",`서술 ${delta>0 ? "피해" : "회복"} · ${entity.name} ${label}`,`HP ${before} → ${entity.hp}`,[`${entity.name} HP ${before} → ${entity.hp}`]);
  return internal.getSnapshot();
};

export function sceneConditionLabels(scene:Pick<SceneVm,"sceneConditions">):string[] {
  return (scene.sceneConditions ?? []).map((kind)=>SCENE_CONDITION_LABELS[kind]);
}
