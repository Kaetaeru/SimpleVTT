import { forceSaveSuccess } from "./forcedSaveSuccess";
import "./phase09RealTurnRuntimeAdapter";
import "./phase09CombatantDefinitionRuntimeAdapter";
import type { ActionVm, ActivityEntry, AppSnapshot, CombatantDefinitionVm, ResolutionView, SceneEntity, SceneVm } from "./contracts";
import type { CombatantRuntimeTimingVm, MonsterTimingStateVm } from "./combatantRuntimeContracts";
import { MockAdapter } from "./mockAdapter";
import { materializeEncounterRuntimeActions } from "./phase09CombatantDefinitionRuntimeAdapter";

/**
 * V1.2 T1-02 — monster timing counters. Stat-block actions carry `timing` (recharge, uses per day / per round,
 * legendary cost). This adapter keeps one counter block per monster instance inside the scene
 * (`scene.monsterTimingByActor`, so resolution undo restores it), blocks the projected ActionVms when a counter is
 * spent, consumes counters when an action is declared, and refreshes them at the start of the monster's turn:
 * legendary pool back to full, per-round uses back, and a d6 for every spent recharge action.
 */
interface TimingAdapterState {
  scene:SceneVm;
  resolution:ResolutionView|null;
  combatantDefinitions:CombatantDefinitionVm[];
  activity:ActivityEntry[];
  sessionMode:string;
  lastResolutionId:string|null;
  /** Test hook: the next recharge d6 faces (consumed in order). */
  queuedRechargeD6?:number[]|null;
  getSnapshot():Promise<AppSnapshot>;
}

interface TimedSpec { id:string; name:string; timing:CombatantRuntimeTimingVm }

const cp=<T,>(value:T):T=>structuredClone(value);
/** Counters consumed by the last resolution, so an event-native Undo (which rebuilds the scene from events) can put them back. */
const undoMemory=new WeakMap<MockAdapter,{ resolutionId:string; actorId:string; before:MonsterTimingStateVm }>();
let sequence=0;
const eventId=(prefix:string)=>`${prefix}.${Date.now()}.${sequence++}`;

function matchesDefinition(entityId:string,definitionId:string) {
  return entityId===definitionId || entityId.startsWith(`${definitionId}.`) || entityId.startsWith(`${definitionId}-`);
}

function definitionForEntity(definitions:CombatantDefinitionVm[],entityId:string) {
  return [...definitions].sort((left,right)=>right.id.length-left.id.length).find((definition)=>matchesDefinition(entityId,definition.id));
}

export function timedSpecsOf(definition:CombatantDefinitionVm):TimedSpec[] {
  const specs:TimedSpec[]=[];
  for (const spec of [...(definition.runtimeActions ?? []),...(definition.runtimeSaveActions ?? []),...(definition.runtimeTextActions ?? [])]) {
    if (spec.timing) specs.push({ id:spec.id, name:spec.name, timing:spec.timing });
  }
  return specs;
}

export function initialMonsterTiming(definition:CombatantDefinitionVm):MonsterTimingStateVm|undefined {
  const monster=definition.runtimeMonster;
  const specs=timedSpecsOf(definition);
  if (!monster && !specs.length) return undefined;
  const state:MonsterTimingStateVm={ recharge:{}, uses:{} };
  if (monster && monster.legendaryActionsPerRound>0) state.legendary={ remaining:monster.legendaryActionsPerRound, max:monster.legendaryActionsPerRound };
  if (monster && monster.legendaryResistance>0) state.legendaryResistance={ remaining:monster.legendaryResistance, max:monster.legendaryResistance };
  for (const spec of specs) {
    if (spec.timing.recharge) state.recharge[spec.id]={ ready:true, min:spec.timing.recharge.min, sides:spec.timing.recharge.sides ?? 6, label:spec.name };
    if (spec.timing.usesPerDay) state.uses[spec.id]={ remaining:spec.timing.usesPerDay, max:spec.timing.usesPerDay, per:"day", label:spec.name };
    else if (spec.timing.usesPerRound) state.uses[spec.id]={ remaining:spec.timing.usesPerRound, max:spec.timing.usesPerRound, per:"round", label:spec.name };
  }
  if (!state.legendary && !state.legendaryResistance && !Object.keys(state.recharge).length && !Object.keys(state.uses).length) return undefined;
  return state;
}

function timingByActor(scene:SceneVm) {
  scene.monsterTimingByActor ??= {};
  return scene.monsterTimingByActor;
}

function specIdOf(actorId:string,action:ActionVm) {
  const prefix=`action.${actorId}.`;
  return action.id.startsWith(prefix) ? action.id.slice(prefix.length) : action.id;
}

export function rechargeLabel(min:number,sides:number) {
  return min>=sides ? `재충전 ${sides}` : `재충전 ${min}–${sides}`;
}

/** Projects the counters onto the actor's ActionVms (availability + label) and onto the scene entity for the UI. */
export function applyMonsterTiming(internal:TimingAdapterState) {
  const byActor=internal.scene.monsterTimingByActor;
  if (!byActor) return;
  for (const [actorId,state] of Object.entries(byActor)) {
    const entity=internal.scene.entities.find((entry)=>entry.id===actorId);
    if (!entity) { delete byActor[actorId]; continue; }
    entity.runtimeMonsterTiming=cp(state);
    const definition=definitionForEntity(internal.combatantDefinitions,actorId);
    const timings=new Map(definition ? timedSpecsOf(definition).map((spec)=>[spec.id,spec.timing] as const) : []);
    for (const action of internal.scene.actionsByActor[actorId] ?? []) {
      const timing=timings.get(specIdOf(actorId,action));
      if (!timing) continue;
      const specId=specIdOf(actorId,action);
      type Kind="recharge"|"uses-per-day"|"uses-per-round"|"legendary";
      let label="";
      let kind:Kind="recharge";
      // The most specific spent counter names the reason: per-turn/day uses, then recharge, then the legendary pool.
      let blockedBy:Kind|null=null;
      if (timing.legendaryCost && state.legendary) {
        kind="legendary";
        const cost=timing.legendaryCost;
        label=`전설 행동 ${cost}회분 · 남은 ${state.legendary.remaining}/${state.legendary.max}`;
        if (state.legendary.remaining<cost) blockedBy="legendary";
      }
      const recharge=state.recharge[specId];
      if (recharge) {
        kind=timing.legendaryCost ? kind : "recharge";
        const text=rechargeLabel(recharge.min,recharge.sides);
        label=label ? `${label} · ${text}` : `${text}${recharge.ready ? " · 준비됨" : " · 대기 중"}`;
        if (!recharge.ready) blockedBy="recharge";
      }
      const uses=state.uses[specId];
      if (uses) {
        const usesKind:Kind=uses.per==="day" ? "uses-per-day" : "uses-per-round";
        if (!timing.legendaryCost && !recharge) kind=usesKind;
        const text=uses.per==="day" ? `${uses.remaining}/${uses.max} 일` : `이번 턴 ${uses.remaining}/${uses.max}`;
        label=label ? `${label} · ${text}` : text;
        if (uses.remaining<=0) blockedBy=usesKind;
      }
      const blocked=blockedBy!==null;
      const previous=action.runtimeMonsterTiming;
      action.runtimeMonsterTiming={ kind, blocked, label, ...(timing.legendaryCost ? { legendaryCost:timing.legendaryCost } : {}) };
      if (blockedBy) {
        action.available=false;
        action.disabledReason=blockedReason(blockedBy,label);
      } else if (previous?.blocked) {
        action.available=true;
        delete action.disabledReason;
      }
    }
  }
}

function blockedReason(kind:"recharge"|"uses-per-day"|"uses-per-round"|"legendary",label:string) {
  if (kind==="recharge") return `재충전 대기 중 (${label.replace(/ · 대기 중$/,"")})`;
  if (kind==="legendary") return `전설 행동이 부족합니다 (${label})`;
  if (kind==="uses-per-round") return "다음 턴이 시작될 때까지 다시 사용할 수 없습니다.";
  return "오늘의 사용 횟수를 모두 썼습니다.";
}

function consumeMonsterTiming(internal:TimingAdapterState,actorId:string,action:ActionVm,changes:string[]) {
  const state=internal.scene.monsterTimingByActor?.[actorId];
  if (!state) return;
  const specId=specIdOf(actorId,action);
  const definition=definitionForEntity(internal.combatantDefinitions,actorId);
  const timing=definition ? timedSpecsOf(definition).find((spec)=>spec.id===specId)?.timing : undefined;
  if (!timing) return;
  if (timing.legendaryCost && state.legendary) {
    const before=state.legendary.remaining;
    state.legendary.remaining=Math.max(0,before-timing.legendaryCost);
    changes.push(`전설 행동 ${before} → ${state.legendary.remaining}`);
  }
  const recharge=state.recharge[specId];
  if (recharge && recharge.ready) {
    recharge.ready=false;
    changes.push(`${recharge.label} 재충전 필요 (${rechargeLabel(recharge.min,recharge.sides)})`);
  }
  const uses=state.uses[specId];
  if (uses && uses.remaining>0) {
    const before=uses.remaining;
    uses.remaining=before-1;
    changes.push(`${uses.label} 사용 횟수 ${before} → ${uses.remaining}`);
  }
}

function nextRechargeFace(internal:TimingAdapterState,sides:number) {
  const queued=internal.queuedRechargeD6;
  if (queued && queued.length) return queued.shift()!;
  return Math.floor(Math.random()*sides)+1;
}

/** Start of the monster's turn: legendary pool and per-round uses refill; each spent recharge action rolls its die. */
export function refreshMonsterTimingAtTurnStart(internal:TimingAdapterState,actorId:string) {
  const state=internal.scene.monsterTimingByActor?.[actorId];
  if (!state) return;
  const entity=internal.scene.entities.find((entry)=>entry.id===actorId);
  const detail:string[]=[];
  if (state.legendary && state.legendary.remaining!==state.legendary.max) {
    detail.push(`전설 행동 ${state.legendary.remaining} → ${state.legendary.max}`);
    state.legendary.remaining=state.legendary.max;
  }
  for (const uses of Object.values(state.uses)) {
    if (uses.per==="round" && uses.remaining!==uses.max) {
      detail.push(`${uses.label} 사용 가능 (${uses.max}/${uses.max})`);
      uses.remaining=uses.max;
    }
  }
  for (const recharge of Object.values(state.recharge)) {
    if (recharge.ready) continue;
    const face=nextRechargeFace(internal,recharge.sides);
    recharge.ready=face>=recharge.min;
    detail.push(`${recharge.label} 재충전 굴림 d${recharge.sides} ${face} → ${recharge.ready ? "준비됨" : "대기 중"}`);
  }
  if (!detail.length) return;
  internal.activity.unshift({
    id:eventId("monster-timing"),
    time:"지금",
    actor:entity?.name ?? actorId,
    title:"턴 시작 · 몬스터 재정비",
    summary:detail[0],
    detail,
    stateChanges:detail,
  });
}

function timingEntity(internal:TimingAdapterState,actorId:string):SceneEntity|undefined {
  return internal.scene.entities.find((entry)=>entry.id===actorId);
}

declare module "./mockAdapter" {
  interface MockAdapter {
    /** DM: spend one legendary resistance (the save outcome itself is adjudicated with 강제 성공 on the resolution). */
    useLegendaryResistance(actorId:string):Promise<AppSnapshot>;
    /** DM: refill every counter of the monster (recharge, uses, legendary pool, legendary resistance). */
    resetMonsterTiming(actorId:string):Promise<AppSnapshot>;
  }
}

const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
const previousInstantiate=MockAdapter.prototype.instantiateCombatant;
const previousResolveAction=MockAdapter.prototype.resolveAction;
const previousEndTurn=MockAdapter.prototype.endTurn;
const previousStartInitiative=MockAdapter.prototype.startInitiative;
const previousUndo=MockAdapter.prototype.undoLastResolution;

MockAdapter.prototype.getSnapshot=async function getSnapshotWithMonsterTiming() {
  const internal=this as unknown as TimingAdapterState;
  materializeEncounterRuntimeActions(internal as unknown as Parameters<typeof materializeEncounterRuntimeActions>[0]);
  applyMonsterTiming(internal);
  return previousGetSnapshot.call(this);
};

MockAdapter.prototype.instantiateCombatant=async function instantiateCombatantWithMonsterTiming(definitionId:string) {
  const internal=this as unknown as TimingAdapterState;
  const beforeIds=new Set(internal.scene.entities.map((entity)=>entity.id));
  await previousInstantiate.call(this,definitionId);
  const added=internal.scene.entities.find((entity)=>!beforeIds.has(entity.id));
  const definition=internal.combatantDefinitions.find((entry)=>entry.id===definitionId);
  if (added && definition) {
    const state=initialMonsterTiming(definition);
    if (state) timingByActor(internal.scene)[added.id]=state;
  }
  return internal.getSnapshot();
};

MockAdapter.prototype.resolveAction=async function resolveActionWithMonsterTiming(actionId:string,targetIds:string[]) {
  const internal=this as unknown as TimingAdapterState;
  const beforeResolutionId=internal.resolution?.id;
  await previousResolveAction.call(this,actionId,targetIds);
  const resolution=internal.resolution;
  if (resolution && resolution.id!==beforeResolutionId && resolution.actionId===actionId && resolution.calculatedOutcome!=="적용 거부") {
    const action=(internal.scene.actionsByActor[resolution.actorId] ?? []).find((entry)=>entry.id===actionId);
    const state=internal.scene.monsterTimingByActor?.[resolution.actorId];
    if (action && state) {
      const before=cp(state);
      const changes:string[]=[];
      consumeMonsterTiming(internal,resolution.actorId,action,changes);
      if (changes.length) {
        resolution.stateChanges.push(...changes);
        undoMemory.set(this,{ resolutionId:resolution.id, actorId:resolution.actorId, before });
      }
      applyMonsterTiming(internal);
    }
  }
  return internal.getSnapshot();
};

MockAdapter.prototype.endTurn=async function endTurnWithMonsterTiming() {
  const internal=this as unknown as TimingAdapterState;
  const before=internal.scene.currentActorId;
  await previousEndTurn.call(this);
  if (internal.sessionMode==="initiative" && internal.scene.currentActorId!==before) refreshMonsterTimingAtTurnStart(internal,internal.scene.currentActorId);
  return internal.getSnapshot();
};

MockAdapter.prototype.startInitiative=async function startInitiativeWithMonsterTiming() {
  const internal=this as unknown as TimingAdapterState;
  await previousStartInitiative.call(this);
  refreshMonsterTimingAtTurnStart(internal,internal.scene.currentActorId);
  return internal.getSnapshot();
};

MockAdapter.prototype.undoLastResolution=async function undoLastResolutionWithMonsterTiming() {
  const internal=this as unknown as TimingAdapterState;
  const target=internal.lastResolutionId;
  const memory=undoMemory.get(this);
  await previousUndo.call(this);
  if (memory && target && memory.resolutionId===target && internal.lastResolutionId!==target) {
    // The resolution was undone (scene restore or event-native); put the counters back as they were before it.
    if (internal.scene.entities.some((entity)=>entity.id===memory.actorId)) timingByActor(internal.scene)[memory.actorId]=cp(memory.before);
    undoMemory.delete(this);
  }
  return internal.getSnapshot();
};

MockAdapter.prototype.useLegendaryResistance=async function useLegendaryResistanceRuntime(actorId:string) {
  const internal=this as unknown as TimingAdapterState;
  const initial=internal.scene.monsterTimingByActor?.[actorId];
  const entity=timingEntity(internal,actorId);
  if (!initial?.legendaryResistance || !entity || initial.legendaryResistance.remaining<=0) return internal.getSnapshot();
  // C1-04: when the last card holds this creature's failed save, undo it and judge the same cast with that save
  // as an automatic success; the counter is spent on the re-judged card.
  const card=internal.resolution;
  const failed=card?.saveResults.find((entry)=>entry.targetId===actorId&&entry.outcome==="실패");
  let rejudged=false;
  if (card && failed && card.stage==="complete") {
    const { actionId, targetIds }=card;
    await this.undoLastResolution();
    forceSaveSuccess(this,actorId);
    await this.resolveAction(actionId,targetIds);
    // A stat-block saving-throw action completes through its stages; a spell cast is already complete.
    for (let step=0; step<8&&internal.resolution&&internal.resolution.stage!=="complete"; step+=1) await this.advanceResolution();
    const after=internal.resolution;
    rejudged=Boolean(after && after.saveResults.some((entry)=>entry.targetId===actorId&&entry.outcome==="성공"));
    if (after && rejudged) {
      after.detail.unshift(`전설 저항 · ${entity.name}의 실패한 내성 굴림을 성공으로 재판정`);
      after.provenance.push(`legendary-resistance:${actorId} · auto-success`);
      after.stateChanges.push(`${entity.name} 전설 저항 사용`);
    }
  }
  const state=internal.scene.monsterTimingByActor?.[actorId];
  if (!state?.legendaryResistance || state.legendaryResistance.remaining<=0) return internal.getSnapshot();
  const before=state.legendaryResistance.remaining;
  state.legendaryResistance.remaining=before-1;
  internal.activity.unshift({
    id:eventId("legendary-resistance"),
    time:"지금",
    actor:entity.name,
    title:"전설 저항 사용",
    summary:`실패한 내성 굴림을 성공으로 바꿉니다 · 남은 ${state.legendaryResistance.remaining}/${state.legendaryResistance.max}`,
    detail:[rejudged ? `${card?.actionName ?? "직전 판정"}의 내성 굴림을 성공으로 재판정했습니다.` : "DM이 해당 판정에 강제 성공을 적용합니다."],
    stateChanges:[`전설 저항 ${before} → ${state.legendaryResistance.remaining}`],
  });
  return internal.getSnapshot();
};

MockAdapter.prototype.resetMonsterTiming=async function resetMonsterTimingRuntime(actorId:string) {
  const internal=this as unknown as TimingAdapterState;
  const definition=definitionForEntity(internal.combatantDefinitions,actorId);
  const entity=timingEntity(internal,actorId);
  if (!definition || !entity) return internal.getSnapshot();
  const state=initialMonsterTiming(definition);
  if (!state) return internal.getSnapshot();
  timingByActor(internal.scene)[actorId]=state;
  internal.activity.unshift({
    id:eventId("monster-timing-reset"),
    time:"지금",
    actor:entity.name,
    title:"몬스터 재정비 초기화",
    summary:"재충전, 사용 횟수, 전설 행동과 전설 저항을 모두 되돌립니다.",
    detail:[],
    stateChanges:["몬스터 타이밍 카운터 초기화"],
  });
  return internal.getSnapshot();
};
