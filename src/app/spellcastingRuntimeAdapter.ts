import type { AppSnapshot, ResolutionView, SceneEntity } from "./contracts";
import { isExecutableSpellRuntimeSupport } from "./spellcastingRuntimeContracts";
import { MockAdapter } from "./mockAdapter";
import { selectedCombatSpellSlot } from "./spellcastingRuntimeSelection";
import type { RulesRuntimeState } from "../domain/combatState";
import type { DamageDefenseContribution } from "../domain/damage";
import type { SpellCasterContext, SpellCastTarget } from "../domain/spellcasting";
import { resolveSpellCast } from "../domain/spellcasting";
import { spellMechanicById } from "../domain/spellMechanics";
import type { RulesProfileLike } from "../domain/profileEngine";
import { resolveRuntimeTargetingFact } from "./realRuntimeAttackFactProvider";

const PROFILE: RulesProfileLike = {
  profileId: "dnd.srd-5.2.1",
  properties: {},
  d20Test: { advantageDisadvantage: { sameSideStacks: false, opposingCancel: true } },
};

const SPELL_META = {
  "action.healing-word": {
    spellId: "dnd.srd521.spell.healing-word",
    runtimeSupport: "combat-executable" as const,
    baseLevel: 1,
    castSource: "prepared" as const,
  },
  "action.vicious-mockery": {
    spellId: "dnd.srd521.spell.vicious-mockery",
    runtimeSupport: "combat-executable" as const,
    baseLevel: 0,
    castSource: "prepared" as const,
  },
  "action.thunderwave": {
    spellId: "dnd.srd521.spell.thunderwave",
    runtimeSupport: "combat-executable" as const,
    baseLevel: 1,
    castSource: "prepared" as const,
  },
  "action.wand": {
    spellId: "dnd.srd521.spell.magic-missile",
    runtimeSupport: "legacy-item" as const,
    baseLevel: 1,
    castSource: "item" as const,
    disabledMechanicReason: "아이템 충전과 주문 Resolution의 단일 atomic transaction 연결은 RealAdapter 단계에서 교체됩니다.",
  },
} satisfies Record<string, NonNullable<AppSnapshot["scene"]["actionsByActor"][string][number]["spellCast"]>>;

type AdapterInternalState = {
  scene: AppSnapshot["scene"];
  sessionMode: AppSnapshot["sessionMode"];
  activeCharacter: AppSnapshot["activeCharacter"];
  characters: AppSnapshot["characters"];
  resolution: ResolutionView | null;
  activity: AppSnapshot["activity"];
  queuedD20: number | null;
  lastBefore?: unknown;
  lastResolutionId?: string | null;
  _undoPreviewArmed?: boolean;
  getSnapshot(): Promise<AppSnapshot>;
};

type BridgeState = {
  runtime: RulesRuntimeState;
  casterByActor: Record<string, SpellCasterContext>;
};

type SpellUndoRecord = {
  resolutionId: string;
  runtime: RulesRuntimeState;
};

export interface FreeformSpellSlotChange {
  actorId: string;
  spellId: string;
  slotLevel: number;
  resourceId: string;
  before: number;
  after: number;
}

export type FreeformSpellSlotCommit =
  | { status: "not-applicable" }
  | { status: "rejected"; error: string }
  | { status: "committed"; change: FreeformSpellSlotChange; stateChange: string; provenance: string };

const bridgeByAdapter = new WeakMap<object, BridgeState>();
const spellUndoByAdapter = new WeakMap<object, SpellUndoRecord>();

const MIRA_CASTER: SpellCasterContext = {
  characterLevel: 4,
  spellAttackModifier: 6,
  spellSaveDc: 14,
  spellcastingAbilityModifier: 4,
  preparedSpellIds: ["dnd.srd521.spell.healing-word", "dnd.srd521.spell.thunderwave"],
  alwaysPreparedSpellIds: [],
  cantripSpellIds: ["dnd.srd521.spell.vicious-mockery"],
  slotResourceIds: { 1: "spell-slot-1", 2: "spell-slot-2" },
};

const DAMAGE_TYPE_MAP: Record<string, string> = {
  "산성": "acid",
  "타격": "bludgeoning",
  "냉기": "cold",
  "화염": "fire",
  "역장": "force",
  "번개": "lightning",
  "괴저": "necrotic",
  "관통": "piercing",
  "독": "poison",
  "정신": "psychic",
  "광휘": "radiant",
  "참격": "slashing",
  "천둥": "thunder",
};

function defenses(entity: SceneEntity): DamageDefenseContribution[] {
  return [
    ...entity.resistances.map((damageType) => ({ source: `scene:${entity.id}:resistance`, kind: "resistance" as const, damageType: DAMAGE_TYPE_MAP[damageType] ?? damageType })),
    ...entity.immunities.map((damageType) => ({ source: `scene:${entity.id}:immunity`, kind: "immunity" as const, damageType: DAMAGE_TYPE_MAP[damageType] ?? damageType })),
    ...entity.vulnerabilities.map((damageType) => ({ source: `scene:${entity.id}:vulnerability`, kind: "vulnerability" as const, damageType: DAMAGE_TYPE_MAP[damageType] ?? damageType })),
  ];
}

function initialRuntime(internal: AdapterInternalState): BridgeState {
  const combatants = Object.fromEntries(internal.scene.entities.map((entity) => [entity.id, {
    id: entity.id,
    baseSpeed: internal.scene.economyByActor[entity.id]?.movementMax ?? 30,
    life: {
      hp: { current: entity.hp, maximum: entity.maxHp, temporary: entity.tempHp },
      deathSaves: { successes: 0, failures: 0 },
      stable: false,
      unconscious: false,
      dead: false,
    },
    economy: {
      action: internal.scene.economyByActor[entity.id]?.action ?? true,
      bonusAction: internal.scene.economyByActor[entity.id]?.bonusAction ?? true,
      reaction: internal.scene.economyByActor[entity.id]?.reaction ?? true,
      movement: internal.scene.economyByActor[entity.id]?.movement ?? 30,
      movementMaximum: internal.scene.economyByActor[entity.id]?.movementMax ?? 30,
    },
    resources: entity.id === "char.mira" ? [
      { id: "spell-slot-1", label: "1레벨 주문 슬롯", current: 4, maximum: 4, recovery: { longRest: "all" as const } },
      { id: "spell-slot-2", label: "2레벨 주문 슬롯", current: 3, maximum: 3, recovery: { longRest: "all" as const } },
    ] : [],
    hitDice: [],
    damageDefenses: defenses(entity),
  }]));

  return {
    runtime: {
      revision: 0,
      clock: { round: internal.scene.round, elapsedSeconds: 0, activeActorId: internal.scene.currentActorId, phase: "action" },
      combatants,
      effects: [],
      concentration: {},
      history: [],
    },
    casterByActor: { "char.mira": structuredClone(MIRA_CASTER) },
  };
}

function bridgeFor(adapter: object, internal: AdapterInternalState) {
  let bridge = bridgeByAdapter.get(adapter);
  if (!bridge) {
    bridge = initialRuntime(internal);
    bridgeByAdapter.set(adapter, bridge);
  }
  return bridge;
}

function syncRuntimeFromScene(bridge: BridgeState, internal: AdapterInternalState) {
  for (const entity of internal.scene.entities) {
    const runtime = bridge.runtime.combatants[entity.id];
    if (!runtime) continue;
    runtime.life.hp = { current: entity.hp, maximum: entity.maxHp, temporary: entity.tempHp };
    runtime.damageDefenses = defenses(entity);
    const economy = internal.scene.economyByActor[entity.id];
    if (economy) {
      runtime.economy = {
        action: economy.action,
        bonusAction: economy.bonusAction,
        reaction: economy.reaction,
        movement: economy.movement,
        movementMaximum: economy.movementMax,
      };
    }
  }
  bridge.runtime.clock = {
    ...bridge.runtime.clock,
    round: internal.scene.round,
    activeActorId: internal.scene.currentActorId,
    phase: "action",
  };
}

function syncSceneFromRuntime(bridge: BridgeState, internal: AdapterInternalState) {
  for (const entity of internal.scene.entities) {
    const runtime = bridge.runtime.combatants[entity.id];
    if (!runtime) continue;
    entity.hp = runtime.life.hp.current;
    entity.maxHp = runtime.life.hp.maximum;
    entity.tempHp = runtime.life.hp.temporary;
    const economy = internal.scene.economyByActor[entity.id];
    if (economy) {
      economy.action = runtime.economy.action;
      economy.bonusAction = runtime.economy.bonusAction;
      economy.reaction = runtime.economy.reaction;
      economy.movement = runtime.economy.movement;
      economy.movementMax = runtime.economy.movementMaximum;
    }
  }
}

export function commitFreeformSpellSlot(adapter: MockAdapter, actionId: string, actorId: string): FreeformSpellSlotCommit {
  const metadata = SPELL_META[actionId as keyof typeof SPELL_META];
  if (!metadata || !isExecutableSpellRuntimeSupport(metadata.runtimeSupport) || metadata.baseLevel === 0) {
    return { status: "not-applicable" };
  }
  const internal = adapter as unknown as AdapterInternalState;
  const bridge = bridgeFor(adapter, internal);
  syncRuntimeFromScene(bridge, internal);
  const caster = bridge.casterByActor[actorId];
  if (!caster) return { status: "rejected", error: `spell caster runtime is missing for ${actorId}` };
  const selected = selectedCombatSpellSlot(actorId, metadata.baseLevel);
  const slotLevel = Math.max(metadata.baseLevel, selected);
  const resourceId = caster.slotResourceIds[slotLevel];
  if (!resourceId) return { status: "rejected", error: `no slot resource mapped for level ${slotLevel}` };
  const resource = bridge.runtime.combatants[actorId]?.resources.find((entry) => entry.id === resourceId);
  if (!resource) return { status: "rejected", error: `spell slot resource is missing: ${resourceId}` };
  if (resource.current < 1) return { status: "rejected", error: `spell slot resource is exhausted: ${resourceId}` };
  const before = resource.current;
  resource.current -= 1;
  bridge.runtime.revision += 1;
  const change: FreeformSpellSlotChange = {
    actorId,
    spellId: metadata.spellId,
    slotLevel,
    resourceId,
    before,
    after: resource.current,
  };
  return {
    status: "committed",
    change,
    stateChange: `${actorId} ${slotLevel}레벨 주문 슬롯 ${before} → ${resource.current}`,
    provenance: `Spellcasting Kernel · ${metadata.spellId} · Freeform slot resource`,
  };
}

export function restoreFreeformSpellSlot(adapter: MockAdapter, change: FreeformSpellSlotChange) {
  const internal = adapter as unknown as AdapterInternalState;
  const bridge = bridgeFor(adapter, internal);
  syncRuntimeFromScene(bridge, internal);
  const resource = bridge.runtime.combatants[change.actorId]?.resources.find((entry) => entry.id === change.resourceId);
  if (!resource) return { status: "rejected" as const, error: `spell slot resource is missing: ${change.resourceId}` };
  if (resource.current !== change.after) {
    return { status: "rejected" as const, error: `spell slot resource drift: expected ${change.after}, current ${resource.current}` };
  }
  resource.current = change.before;
  bridge.runtime.revision += 1;
  return {
    status: "committed" as const,
    stateChange: `${change.actorId} ${change.slotLevel}레벨 주문 슬롯 ${change.after} → ${change.before}`,
  };
}

function relation(actor: SceneEntity, target: SceneEntity): SpellCastTarget["relation"] {
  if (actor.id === target.id) return "self";
  return actor.side === target.side ? "ally" : "enemy";
}

function targetFacts(internal: AdapterInternalState, actorId: string, targetId: string): SpellCastTarget {
  const actor = internal.scene.entities.find((entity) => entity.id === actorId);
  const target = internal.scene.entities.find((entity) => entity.id === targetId);
  if (!actor || !target) throw new Error(`reference scene target not found: ${targetId}`);
  const spatial=resolveRuntimeTargetingFact(internal.scene,actorId,targetId);
  return {
    id: target.id,
    kind: "creature",
    relation: relation(actor, target),
    distanceFeet: spatial.distanceFeet,
    visible: spatial.visible,
    cover: spatial.cover,
    ac: target.ac,
    creatureKind: target.kind === "character" ? "character" : "monster",
    saveModifiers: { str: 2, dex: 2, con: 2, int: 1, wis: 1, cha: 0 },
    targetCanSeeCaster: spatial.targetCanSeeAttacker,
  };
}

function slotHud(bridge: BridgeState, actorId: string) {
  const actor = bridge.runtime.combatants[actorId];
  return (actor?.resources ?? [])
    .filter((resource) => resource.id.startsWith("spell-slot-"))
    .map((resource) => ({ level: Number(resource.id.slice("spell-slot-".length)), current: resource.current, max: resource.maximum }))
    .sort((a, b) => a.level - b.level);
}

function currentTurnId(internal: AdapterInternalState) {
  return internal.sessionMode === "initiative" ? `${internal.scene.round}:${internal.scene.currentActorId}` : undefined;
}

function slotSpentThisTurn(bridge: BridgeState, internal: AdapterInternalState, actorId: string) {
  const turnId = currentTurnId(internal);
  return Boolean(turnId && bridge.runtime.spellcastingTurn?.turnId === turnId && bridge.runtime.spellcastingTurn.slottedCasterIds.includes(actorId));
}

function spellcastingHud(bridge: BridgeState, internal: AdapterInternalState, actorId: string) {
  const caster = bridge.casterByActor[actorId];
  if (!caster) return undefined;
  return {
    spellAttackModifier: caster.spellAttackModifier,
    spellSaveDc: caster.spellSaveDc,
    spellcastingAbilityModifier: caster.spellcastingAbilityModifier,
    cantripSpellIds: [...caster.cantripSpellIds],
    preparedSpellIds: [...caster.preparedSpellIds],
    alwaysPreparedSpellIds: [...(caster.alwaysPreparedSpellIds ?? [])],
    slots: slotHud(bridge, actorId),
    slottedSpellCastThisTurn: slotSpentThisTurn(bridge, internal, actorId),
  };
}

function facesForHealingWord(slotLevel: number) {
  const count = 2 + Math.max(0, slotLevel - 1) * 2;
  const pattern = [3, 4, 2, 3, 4, 2, 3, 4, 2, 3, 4, 2, 3, 4, 2, 3];
  return pattern.slice(0, count);
}

type DiceAdapter={d20(actionId:string,index?:number):number};
function thunderwaveDice(adapter:MockAdapter,targetIds:string[],slotLevel:number) {
  const roll=(index:number,sides:number)=>(((adapter as unknown as DiceAdapter).d20("action.thunderwave",index)-1)%sides)+1;
  const count=2+Math.max(0,slotLevel-1);
  const effectFaces=Array.from({length:count},(_,index)=>roll(index,8));
  const saves=Object.fromEntries(targetIds.map((targetId,index)=>[targetId,{id:`thunderwave:save:${targetId}`,purpose:"Thunderwave Constitution save",sides:20 as const,faces:[(adapter as unknown as DiceAdapter).d20("action.thunderwave",count+index)]}]));
  return {faces:[...effectFaces,...Object.values(saves).flatMap((save)=>save.faces)],request:{effectFaces,saves}};
}

function viciousMockeryDice(adapter:MockAdapter,targetIds:string[]) {
  const effectFaces=[((adapter as unknown as DiceAdapter).d20("action.vicious-mockery",0)-1)%6+1];
  const saves=Object.fromEntries(targetIds.map((targetId,index)=>[targetId,{id:`vicious-mockery:save:${targetId}`,purpose:"Vicious Mockery Wisdom save",sides:20 as const,faces:[(adapter as unknown as DiceAdapter).d20("action.vicious-mockery",index+1)]}]));
  return {faces:[...effectFaces,...Object.values(saves).flatMap((save)=>save.faces)],request:{effectFaces,saves}};
}

function resolutionFromCast(
  actionName: string,
  actionId: string,
  actorId: string,
  targetIds: string[],
  slotLevel: number | undefined,
  result: ReturnType<typeof resolveSpellCast>,
  authoritativeDice: number[],
): ResolutionView {
  if (result.status === "rejected") {
    return {
      id: `spell-rejected.${Date.now()}`,
      actorId,
      targetIds,
      actionId,
      actionName,
      rollKind: "effect",
      stage: "complete",
      authoritativeDice,
      saveResults: [],
      damageComponents: [],
      compact: `시전 거부 · ${result.error}`,
      detail: [result.error],
      provenance: ["Phase 06 Spellcasting Kernel · atomic rejection"],
      calculatedOutcome: "시전 거부",
      finalOutcome: "시전 거부",
      stateChanges: [],
      adjudicated: false,
      canAdvance: false,
    };
  }

  const healing = Object.values(result.results).find((entry) =>
    Boolean(entry && typeof entry === "object" && "restored" in (entry as Record<string, unknown>)),
  ) as { restored?: number } | undefined;
  const roll = Object.values(result.results).find((entry) =>
    Boolean(entry && typeof entry === "object" && "diceTotal" in (entry as Record<string, unknown>)),
  ) as { total?: number } | undefined;
  const stateChanges = result.events.flatMap((event) => event.stateChanges.map((change) => `${event.summary} · ${change.kind}`));
  const provenance = [...new Set(result.events.flatMap((event) => event.provenance.map((entry) => entry.source)))];
  const outcome = healing?.restored !== undefined ? `${healing.restored} HP 회복` : result.events.at(-1)?.summary ?? "주문 적용";

  return {
    id: result.events[0]?.resolutionId ?? `spell.${Date.now()}`,
    actorId,
    targetIds,
    actionId,
    actionName,
    rollKind: healing ? "healing" : "effect",
    stage: "complete",
    authoritativeDice,
    rollTotal: roll?.total,
    saveResults: [],
    damageComponents: [],
    compact: `${actionName}${slotLevel ? ` · ${slotLevel}레벨 슬롯` : ""} · ${outcome}`,
    detail: result.events.map((event) => event.summary),
    provenance,
    calculatedOutcome: outcome,
    finalOutcome: outcome,
    stateChanges,
    adjudicated: false,
    canAdvance: false,
  };
}

const originalGetSnapshot = MockAdapter.prototype.getSnapshot;
const originalResolveAction = MockAdapter.prototype.resolveAction;
const originalUndoLastResolution = MockAdapter.prototype.undoLastResolution;

MockAdapter.prototype.getSnapshot = async function getSnapshotWithSpellcasting() {
  const snapshot = await originalGetSnapshot.call(this);
  const internal = this as unknown as AdapterInternalState;
  const bridge = bridgeFor(this, internal);
  syncRuntimeFromScene(bridge, internal);

  snapshot.scene.spellcastingByActor = {};
  for (const actorId of Object.keys(bridge.casterByActor)) {
    const hud = spellcastingHud(bridge, internal, actorId);
    if (hud) snapshot.scene.spellcastingByActor[actorId] = hud;
  }

  for (const actions of Object.values(snapshot.scene.actionsByActor)) {
    for (const action of actions) {
      const metadata = SPELL_META[action.id as keyof typeof SPELL_META];
      if (!metadata) continue;
      action.spellCast = { ...metadata };
      if (isExecutableSpellRuntimeSupport(metadata.runtimeSupport) && metadata.baseLevel > 0) {
        const hud = snapshot.scene.spellcastingByActor[action.actorId];
        const hasSlot = hud?.slots.some((slot) => slot.level >= metadata.baseLevel && slot.current > 0) ?? false;
        if (!hasSlot) {
          action.available = false;
          action.disabledReason = "사용 가능한 주문 슬롯이 없습니다.";
        } else if (internal.sessionMode === "initiative" && hud?.slottedSpellCastThisTurn) {
          action.available = false;
          action.disabledReason = "이번 턴에는 이미 주문 슬롯을 소비해 주문을 시전했습니다.";
        }
      }
    }
  }

  return snapshot;
};

MockAdapter.prototype.resolveAction = async function resolveActionThroughSpellKernel(actionId, targetIds) {
  const metadata = SPELL_META[actionId as keyof typeof SPELL_META];
  if (!metadata || !isExecutableSpellRuntimeSupport(metadata.runtimeSupport)) {
    return originalResolveAction.call(this, actionId, targetIds);
  }

  const internal = this as unknown as AdapterInternalState;
  const sourceAction = Object.values(internal.scene.actionsByActor).flat().find((entry) => entry.id === actionId);
  if (!sourceAction) return originalResolveAction.call(this, actionId, targetIds);
  const actorId = sourceAction.actorId;
  const bridge = bridgeFor(this, internal);
  syncRuntimeFromScene(bridge, internal);
  const definition = spellMechanicById(metadata.spellId);
  const caster = bridge.casterByActor[actorId];
  if (!definition || !caster) return originalResolveAction.call(this, actionId, targetIds);

  const selected = selectedCombatSpellSlot(actorId, metadata.baseLevel || 1);
  const slotLevel = metadata.baseLevel === 0 ? undefined : Math.max(metadata.baseLevel, selected);
  const castId = `spell-cast.${metadata.spellId}.${Date.now()}`;
  const before = {
    scene: structuredClone(internal.scene),
    activeCharacter: structuredClone(internal.activeCharacter),
    characters: structuredClone(internal.characters),
  };
  const runtimeBefore = structuredClone(bridge.runtime);
  const thunderwave=metadata.spellId==="dnd.srd521.spell.thunderwave"?thunderwaveDice(this,targetIds,slotLevel??1):null;
  const vicious=metadata.spellId==="dnd.srd521.spell.vicious-mockery"?viciousMockeryDice(this,targetIds):null;
  const faces = thunderwave?.faces??vicious?.faces??(metadata.spellId === "dnd.srd521.spell.healing-word" ? facesForHealingWord(slotLevel ?? 1) : []);

  let targets: SpellCastTarget[];
  try {
    targets = targetIds.map((targetId) => targetFacts(internal, actorId, targetId));
  } catch (error) {
    internal.resolution = resolutionFromCast(sourceAction.name, actionId, actorId, targetIds, slotLevel, {
      status: "rejected",
      state: bridge.runtime,
      spellId: metadata.spellId,
      slotLevel,
      error: error instanceof Error ? error.message : String(error),
      events: [],
      results: {},
    }, faces);
    return this.getSnapshot();
  }

  const result = resolveSpellCast(PROFILE, definition, bridge.runtime, {
    id: castId,
    actorId,
    spellId: metadata.spellId,
    source: metadata.castSource,
    expectedRevision: bridge.runtime.revision,
    caster,
    targets,
    slotLevel,
    componentsSatisfied: true,
    useActionEconomy: internal.sessionMode === "initiative",
    turnId: currentTurnId(internal),
    dice: thunderwave?.request??vicious?.request??{ effectFaces: faces },
  });

  internal.resolution = resolutionFromCast(sourceAction.name, actionId, actorId, targetIds, slotLevel, result, faces);

  if (result.status === "committed") {
    bridge.runtime = result.state;
    syncSceneFromRuntime(bridge, internal);
    internal.lastBefore = before;
    internal.lastResolutionId = internal.resolution.id;
    spellUndoByAdapter.set(this, { resolutionId: internal.resolution.id, runtime: runtimeBefore });
    internal.activity.unshift({
      id: internal.resolution.id,
      time: "지금",
      actor: internal.scene.entities.find((entity) => entity.id === actorId)?.name ?? actorId,
      title: `${sourceAction.name} 시전`,
      summary: internal.resolution.compact,
      detail: [...internal.resolution.detail, ...internal.resolution.provenance.map((source) => `출처: ${source}`)],
      stateChanges: [...internal.resolution.stateChanges],
    });
  }

  return this.getSnapshot();
};

MockAdapter.prototype.undoLastResolution = async function undoSpellcastingResolution() {
  const internal = this as unknown as AdapterInternalState;
  const undoRecord = spellUndoByAdapter.get(this);
  const matchesSpellResolution = Boolean(undoRecord && undoRecord.resolutionId === internal.lastResolutionId);
  const wasPreviewArmed = internal._undoPreviewArmed === true;
  const snapshot = await originalUndoLastResolution.call(this);

  if (wasPreviewArmed) {
    if (matchesSpellResolution && undoRecord) {
      const bridge = bridgeFor(this, internal);
      bridge.runtime = structuredClone(undoRecord.runtime);
      syncSceneFromRuntime(bridge, internal);
    }
    spellUndoByAdapter.delete(this);
    return this.getSnapshot();
  }

  return snapshot;
};
