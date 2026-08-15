import type { AbilityKey, ConditionId } from "./conditions";
import type { DurationSpec } from "./effects";
import type { FixedDiceInput } from "./d20";
import type { FixedDamageDice } from "./damageRoll";
import { cloneRuntimeState, type RulesRuntimeState } from "./combatState";
import { DomainEvaluationError, type ProvenanceRecord, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import { spellcastingTurnStateChange } from "./runtimeStateChange";
import type { PendingResolution, ResolutionEvent, ResolutionOperation } from "./resolutionTypes";
import type { TargetFacts, TargetingRule } from "./targeting";

export type SpellRuntimeSupport = "combat-executable" | "partial" | "presentation-only";
export type SpellCastingEconomy = "action" | "bonus-action" | "reaction";
export type SpellCastSource = "prepared" | "always-prepared" | "item" | "feature";
export type SpellSuccessDamage = "none" | "half";

export interface SpellDiceFormula {
  count: number;
  sides: number;
  flat?: number;
  addSpellcastingModifier?: boolean;
  dicePerSlotAboveBase?: number;
  cantripScaling?: boolean;
}

export interface SpellConditionEffectDefinition {
  conditionId: ConditionId;
  trigger: "hit" | "failed-save" | "always";
  duration: DurationSpec;
}

export type SpellPrimaryMechanic =
  | {
      kind: "attack-damage";
      damageType: string;
      dice: SpellDiceFormula;
    }
  | {
      kind: "save-damage";
      saveAbility: AbilityKey;
      damageType: string;
      dice: SpellDiceFormula;
      successDamage: SpellSuccessDamage;
      ignoresCoverForSave?: boolean;
    }
  | {
      kind: "healing";
      dice: SpellDiceFormula;
    }
  | {
      kind: "automatic-projectiles";
      damageType: string;
      projectileDice: { sides: number; flat: number };
      baseProjectiles: number;
      projectilesPerSlotAboveBase?: number;
    };

export interface SpellMechanicDefinition {
  spellId: string;
  baseLevel: number;
  runtimeSupport: SpellRuntimeSupport;
  castingEconomy: SpellCastingEconomy;
  targeting: TargetingRule;
  primary: SpellPrimaryMechanic;
  concentration?: boolean;
  effects?: SpellConditionEffectDefinition[];
  unsupportedInteractions?: string[];
  executionScope?: string;
}

export interface SpellCasterContext {
  characterLevel: number;
  spellAttackModifier: number;
  spellSaveDc: number;
  spellcastingAbilityModifier: number;
  preparedSpellIds: string[];
  alwaysPreparedSpellIds?: string[];
  cantripSpellIds: string[];
  slotResourceIds: Partial<Record<number, string>>;
  featureSpellIds?: string[];
  featureResourceIds?: Partial<Record<string, string>>;
}

export interface SpellCastTarget extends TargetFacts {
  ac?: number;
  creatureKind: "character" | "monster";
  saveModifiers?: Partial<Record<AbilityKey, number>>;
  targetCanSeeCaster: boolean;
}

export interface SpellProjectileAllocation {
  targetId: string;
  count: number;
}

export interface SpellCastDiceInput {
  attack?: FixedDiceInput;
  saves?: Record<string, FixedDiceInput>;
  effectFaces?: number[];
  projectileFaces?: number[];
}

export interface SpellCastRequest {
  id: string;
  actorId: string;
  spellId: string;
  source: SpellCastSource;
  expectedRevision: number;
  caster: SpellCasterContext;
  targets: SpellCastTarget[];
  slotLevel?: number;
  componentsSatisfied: boolean;
  useActionEconomy: boolean;
  turnId?: string;
  dice: SpellCastDiceInput;
  projectileAllocations?: SpellProjectileAllocation[];
}

export interface SpellCastCompilation {
  pending: PendingResolution;
  slotLevel?: number;
  slotted: boolean;
  concentrationGroupId?: string;
}

export type SpellCastResolution =
  | {
      status: "committed";
      state: RulesRuntimeState;
      spellId: string;
      slotLevel?: number;
      events: ResolutionEvent[];
      results: Record<string, unknown>;
    }
  | {
      status: "rejected";
      state: RulesRuntimeState;
      spellId: string;
      slotLevel?: number;
      error: string;
      failedOperationId?: string;
      events: [];
      results: Record<string, never>;
    };

declare module "./combatState" {
  interface RulesRuntimeState {
    spellcastingTurn?: {
      turnId: string;
      slottedCasterIds: string[];
    };
  }
}

function requirePositiveInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value < 1) throw new DomainEvaluationError(`${label} must be a positive integer`);
}

function cantripScaleSteps(level: number) {
  requirePositiveInteger(level, "character level");
  return [5, 11, 17].filter((threshold) => level >= threshold).length;
}

function scaledFormula(
  formula: SpellDiceFormula,
  definition: SpellMechanicDefinition,
  request: SpellCastRequest,
) {
  requirePositiveInteger(formula.count, "spell dice count");
  requirePositiveInteger(formula.sides, "spell die sides");
  let count = formula.count;
  if (formula.cantripScaling) count += cantripScaleSteps(request.caster.characterLevel);
  if (request.slotLevel !== undefined && formula.dicePerSlotAboveBase) {
    count += Math.max(0, request.slotLevel - definition.baseLevel) * formula.dicePerSlotAboveBase;
  }
  const flat = (formula.flat ?? 0) + (formula.addSpellcastingModifier ? request.caster.spellcastingAbilityModifier : 0);
  return { count, sides: formula.sides, flat };
}

function diceRequest(source: string, count: number, sides: number, faces: number[], flat: number) {
  const die: FixedDamageDice = { source, count, sides, faces };
  return {
    dice: [die],
    flat: flat === 0 ? [] : [{ source: `${source}:flat`, value: flat }],
  };
}

function validateAccess(definition: SpellMechanicDefinition, request: SpellCastRequest) {
  if (!request.id || !request.actorId || !request.spellId) throw new DomainEvaluationError("spell cast id, actorId, and spellId are required");
  if (request.spellId !== definition.spellId) throw new DomainEvaluationError("spell cast definition mismatch");
  if (definition.runtimeSupport !== "combat-executable") {
    throw new DomainEvaluationError(
      definition.unsupportedInteractions?.length
        ? `spell mechanics are not executable: ${definition.unsupportedInteractions.join("; ")}`
        : "spell mechanics are not executable",
    );
  }
  if (!request.componentsSatisfied) throw new DomainEvaluationError("spell components are not satisfied");
  if (!Number.isInteger(definition.baseLevel) || definition.baseLevel < 0 || definition.baseLevel > 9) {
    throw new DomainEvaluationError("invalid spell base level");
  }

  if (definition.baseLevel === 0) {
    if (!request.caster.cantripSpellIds.includes(definition.spellId) && request.source !== "item" && request.source !== "feature") {
      throw new DomainEvaluationError("cantrip is not available to the caster");
    }
    if (request.slotLevel !== undefined) throw new DomainEvaluationError("cantrips do not expend spell slots");
    return { slotted: false as const, slotResourceId: undefined, featureResourceId: undefined };
  }

  if (request.source === "prepared" && !request.caster.preparedSpellIds.includes(definition.spellId)) {
    throw new DomainEvaluationError("spell is not prepared");
  }
  if (request.source === "always-prepared" && !(request.caster.alwaysPreparedSpellIds ?? []).includes(definition.spellId)) {
    throw new DomainEvaluationError("spell is not always prepared for this caster");
  }
  if (request.source === "item") {
    if (request.slotLevel !== undefined) throw new DomainEvaluationError("slotless item casting cannot specify a slot level");
    return { slotted: false as const, slotResourceId: undefined, featureResourceId: undefined };
  }
  if (request.source === "feature") {
    if (!(request.caster.featureSpellIds ?? []).includes(definition.spellId)) {
      throw new DomainEvaluationError("spell is not available from the requested feature source");
    }
    const featureResourceId = request.caster.featureResourceIds?.[definition.spellId];
    if (request.slotLevel !== undefined) throw new DomainEvaluationError("feature spell casting cannot specify a slot level");
    return { slotted: false as const, slotResourceId: undefined, featureResourceId };
  }
  if (request.slotLevel === undefined) throw new DomainEvaluationError("slotted spell casting requires a slot level");
  if (request.slotLevel < definition.baseLevel || request.slotLevel > 9) throw new DomainEvaluationError("invalid spell slot level");
  const slotResourceId = request.caster.slotResourceIds[request.slotLevel];
  if (!slotResourceId) throw new DomainEvaluationError(`caster has no spell slot resource for level ${request.slotLevel}`);
  return { slotted: true as const, slotResourceId, featureResourceId: undefined };
}

function economyOperation(definition: SpellMechanicDefinition, request: SpellCastRequest): ResolutionOperation | undefined {
  if (!request.useActionEconomy) return undefined;
  return {
    id: `${request.id}:economy`,
    kind: "use-economy",
    actorId: request.actorId,
    slot: definition.castingEconomy,
    source: definition.spellId,
    bonusActionGranted: definition.castingEconomy === "bonus-action" ? true : undefined,
  };
}

function resourceOperations(
  definition: SpellMechanicDefinition,
  request: SpellCastRequest,
  access: ReturnType<typeof validateAccess>,
): ResolutionOperation[] {
  if (access.slotResourceId) {
    return [{
      id: `${request.id}:slot`,
      kind: "spend-resource",
      targetId: request.actorId,
      resourceId: access.slotResourceId,
      amount: 1,
    }];
  }
  if (access.featureResourceId) {
    return [{
      id: `${request.id}:feature-resource`,
      kind: "spend-resource",
      targetId: request.actorId,
      resourceId: access.featureResourceId,
      amount: 1,
    }];
  }
  return [];
}

function concentrationOperation(definition: SpellMechanicDefinition, request: SpellCastRequest) {
  if (!definition.concentration) return undefined;
  return {
    id: `${request.id}:concentration`,
    kind: "start-concentration" as const,
    actorId: request.actorId,
    groupId: `${request.actorId}:${request.id}`,
    sourceId: definition.spellId,
  };
}

function targetOperations(definition: SpellMechanicDefinition, request: SpellCastRequest) {
  return request.targets.map((target) => ({
    id: `${request.id}:target:${target.id}`,
    kind: "targeting" as const,
    actorId: request.actorId,
    target,
    rule: definition.targeting,
  }));
}

function effectOperationId(request: SpellCastRequest, targetId: string, conditionId: ConditionId, index: number) {
  return `${request.id}:effect:${targetId}:${conditionId}:${index}`;
}

function applyEffectOperations(
  definition: SpellMechanicDefinition,
  request: SpellCastRequest,
  triggerOperationIds: Record<string, string>,
  concentrationGroupId?: string,
): ResolutionOperation[] {
  if (!definition.effects?.length) return [];
  const operations: ResolutionOperation[] = [];
  for (const target of request.targets) {
    for (const [index, effect] of definition.effects.entries()) {
      const triggerOperationId = triggerOperationIds[target.id];
      const when = effect.trigger === "always"
        ? undefined
        : effect.trigger === "hit"
          ? { operationId: triggerOperationId, field: "outcome", equals: "success" }
          : { operationId: triggerOperationId, field: "outcome", equals: "failure" };
      operations.push({
        id: effectOperationId(request, target.id, effect.conditionId, index),
        kind: "apply-effect",
        when,
        effect: {
          id: `${request.id}:effect:${target.id}:${effect.conditionId}:${index}`,
          sourceId: definition.spellId,
          sourceActorId: request.actorId,
          targetId: target.id,
          kind: "condition",
          conditionId: effect.conditionId,
          tags: [`spell:${definition.spellId}`],
          duration: effect.duration,
          concentrationGroupId,
        },
      });
    }
  }
  return operations;
}

export function compileSpellCast(
  definition: SpellMechanicDefinition,
  state: RulesRuntimeState,
  request: SpellCastRequest,
): SpellCastCompilation {
  const access = validateAccess(definition, request);
  if (!state.combatants[request.actorId]) throw new DomainEvaluationError(`caster combatant not found: ${request.actorId}`);
  if (definition.targeting.minTargets > 0 && request.targets.length < definition.targeting.minTargets) {
    throw new DomainEvaluationError(`spell requires at least ${definition.targeting.minTargets} target(s)`);
  }
  if (request.targets.length > definition.targeting.maxTargets) {
    throw new DomainEvaluationError(`spell allows at most ${definition.targeting.maxTargets} target(s)`);
  }
  if (definition.primary.kind === "automatic-projectiles") {
    const allocations = request.projectileAllocations ?? [];
    const expected = definition.primary.baseProjectiles
      + Math.max(0, (request.slotLevel ?? definition.baseLevel) - definition.baseLevel)
      * (definition.primary.projectilesPerSlotAboveBase ?? 0);
    const allocated = allocations.reduce((sum, entry) => sum + entry.count, 0);
    if (allocations.some((entry) => !Number.isInteger(entry.count) || entry.count < 1)) {
      throw new DomainEvaluationError("projectile allocation counts must be positive integers");
    }
    if (allocated !== expected) throw new DomainEvaluationError(`projectile allocation must total ${expected}`);
    for (const allocation of allocations) {
      if (!request.targets.some((target) => target.id === allocation.targetId)) {
        throw new DomainEvaluationError(`projectile allocation target is missing: ${allocation.targetId}`);
      }
    }
  }

  const operations: ResolutionOperation[] = [];
  const economy = economyOperation(definition, request);
  if (economy) operations.push(economy);
  operations.push(...resourceOperations(definition, request, access));

  const concentration = concentrationOperation(definition, request);
  if (concentration) operations.push(concentration);

  operations.push(...targetOperations(definition, request));
  const triggerOperationIds: Record<string, string> = {};
  const concentrationGroupId = concentration?.groupId;

  if (definition.primary.kind === "healing") {
    const scaled = scaledFormula(definition.primary.dice, definition, request);
    const faces = request.dice.effectFaces ?? [];
    const rollId = `${request.id}:healing-roll`;
    operations.push({
      id: rollId,
      kind: "damage-roll",
      request: diceRequest(definition.spellId, scaled.count, scaled.sides, faces, scaled.flat),
    });
    for (const target of request.targets) {
      operations.push({
        id: `${request.id}:healing:${target.id}`,
        kind: "healing",
        targetId: target.id,
        amount: { operationId: rollId, field: "total" },
      });
      triggerOperationIds[target.id] = `${request.id}:healing:${target.id}`;
    }
  } else if (definition.primary.kind === "attack-damage") {
    const attack = request.dice.attack;
    if (!attack) throw new DomainEvaluationError("spell attack requires fixed d20 input");
    if (request.targets.length !== 1) throw new DomainEvaluationError("spell attack runtime currently requires exactly one target");
    const target = request.targets[0];
    const attackId = `${request.id}:attack:${target.id}`;
    operations.push({
      id: attackId,
      kind: "d20",
      family: "attack",
      actorId: request.actorId,
      targetId: target.id,
      ability: "int",
      dice: attack,
      modifierContributions: [{ source: `${definition.spellId}:spell-attack`, value: request.caster.spellAttackModifier }],
      target: target.ac,
      sourceKind: "spell",
      criticalOnNatural20: true,
      naturalOneAlwaysFails: true,
      naturalTwentyAlwaysSucceeds: true,
    });
    const scaled = scaledFormula(definition.primary.dice, definition, request);
    const faces = request.dice.effectFaces ?? [];
    const rollId = `${request.id}:damage-roll:${target.id}`;
    operations.push({
      id: rollId,
      kind: "damage-roll",
      when: { operationId: attackId, field: "outcome", equals: "success" },
      request: diceRequest(definition.spellId, scaled.count, scaled.sides, faces, scaled.flat),
      criticalFrom: attackId,
    });
    operations.push({
      id: `${request.id}:damage:${target.id}`,
      kind: "damage",
      when: { operationId: attackId, field: "outcome", equals: "success" },
      targetId: target.id,
      damageType: definition.primary.damageType,
      amount: { operationId: rollId, field: "total" },
      criticalFrom: attackId,
      creatureKind: target.creatureKind,
    });
    triggerOperationIds[target.id] = attackId;
  } else if (definition.primary.kind === "save-damage") {
    const scaled = scaledFormula(definition.primary.dice, definition, request);
    for (const target of request.targets) {
      const save = request.dice.saves?.[target.id];
      if (!save) throw new DomainEvaluationError(`saving throw input is required for ${target.id}`);
      const targetRule = definition.targeting;
      const effectiveCover = definition.primary.ignoresCoverForSave ? "none" : target.cover;
      const targetOperationId = `${request.id}:target:${target.id}`;
      const saveId = `${request.id}:save:${target.id}`;
      operations.push({
        id: saveId,
        kind: "d20",
        family: "saving-throw",
        actorId: target.id,
        ability: definition.primary.saveAbility,
        dice: save,
        modifierContributions: [{
          source: `${definition.spellId}:${target.id}:save-modifier`,
          value: target.saveModifiers?.[definition.primary.saveAbility] ?? 0,
        }],
        target: request.caster.spellSaveDc,
        naturalOneAlwaysFails: false,
        naturalTwentyAlwaysSucceeds: false,
        rollStateContributions: effectiveCover === "total" && targetRule.requiresSight
          ? [{ source: `${definition.spellId}:total-cover`, state: "disadvantage" }]
          : [],
      });
      triggerOperationIds[target.id] = saveId;
      const rollId = `${request.id}:damage-roll:${target.id}`;
      operations.push({
        id: rollId,
        kind: "damage-roll",
        request: diceRequest(definition.spellId, scaled.count, scaled.sides, request.dice.effectFaces ?? [], scaled.flat),
      });
      operations.push({
        id: `${request.id}:damage:${target.id}`,
        kind: "damage",
        targetId: target.id,
        damageType: definition.primary.damageType,
        amount: { operationId: rollId, field: "total" },
        creatureKind: target.creatureKind,
      });
    }
  } else {
    const allocations = request.projectileAllocations ?? [];
    const faces = request.dice.projectileFaces ?? [];
    let faceIndex = 0;
    for (const allocation of allocations) {
      const target = request.targets.find((entry) => entry.id === allocation.targetId)!;
      const count = allocation.count;
      const selectedFaces = faces.slice(faceIndex, faceIndex + count);
      faceIndex += count;
      const rollId = `${request.id}:projectiles:${allocation.targetId}`;
      operations.push({
        id: rollId,
        kind: "damage-roll",
        request: diceRequest(definition.spellId, count, definition.primary.projectileDice.sides, selectedFaces, definition.primary.projectileDice.flat * count),
      });
      operations.push({
        id: `${request.id}:damage:${allocation.targetId}`,
        kind: "damage",
        targetId: allocation.targetId,
        damageType: definition.primary.damageType,
        amount: { operationId: rollId, field: "total" },
        creatureKind: target.creatureKind,
      });
    }
  }

  operations.push(...applyEffectOperations(definition, request, triggerOperationIds, concentrationGroupId));

  return {
    pending: {
      id: request.id,
      actorId: request.actorId,
      sourceId: definition.spellId,
      expectedRevision: request.expectedRevision,
      operations,
    },
    slotLevel: request.slotLevel,
    slotted: access.slotted,
    concentrationGroupId,
  };
}

function reject(inputState: RulesRuntimeState, request: SpellCastRequest, error: unknown, failedOperationId?: string): SpellCastResolution {
  return {
    status: "rejected",
    state: inputState,
    spellId: request.spellId,
    slotLevel: request.slotLevel,
    error: error instanceof Error ? error.message : String(error),
    failedOperationId,
    events: [],
    results: {},
  };
}

export function resolveSpellCast(
  profile: RulesProfileLike,
  definition: SpellMechanicDefinition,
  inputState: RulesRuntimeState,
  request: SpellCastRequest,
): SpellCastResolution {
  try {
    const compilation = compileSpellCast(definition, inputState, request);
    const workingState = cloneRuntimeState(inputState);
    const beforeTurn = workingState.spellcastingTurn ? structuredClone(workingState.spellcastingTurn) : undefined;
    if (compilation.slotted && request.turnId) {
      const marker = workingState.spellcastingTurn?.turnId === request.turnId
        ? { ...workingState.spellcastingTurn, slottedCasterIds: [...workingState.spellcastingTurn.slottedCasterIds] }
        : { turnId: request.turnId, slottedCasterIds: [] };
      if (marker.slottedCasterIds.includes(request.actorId)) {
        throw new DomainEvaluationError("caster has already expended a spell slot to cast a spell on this turn");
      }
      marker.slottedCasterIds.push(request.actorId);
      workingState.spellcastingTurn = marker;
    }

    const commit = resolvePendingResolution(profile, workingState, compilation.pending);
    if (commit.status === "rejected") {
      return reject(inputState, request, commit.error, commit.failedOperationId);
    }
    const events=commit.events.map((event)=>structuredClone(event));
    const afterTurn=commit.state.spellcastingTurn ? structuredClone(commit.state.spellcastingTurn) : undefined;
    if (compilation.slotted && request.turnId && events.length) {
      const provenance:ProvenanceRecord[]=[{
        source:`spellcasting-turn:${request.turnId}`,
        status:"applied",
        reason:`${request.actorId} expended a spell slot on ${request.turnId}`,
      }];
      const event=events[events.length-1];
      event.stateChanges.push(spellcastingTurnStateChange(request.actorId,beforeTurn,afterTurn,provenance));
      event.provenance.push(...provenance);
    }
    return {
      status: "committed",
      state: commit.state,
      spellId: request.spellId,
      slotLevel: request.slotLevel,
      events,
      results: commit.results,
    };
  } catch (error) {
    return reject(inputState, request, error);
  }
}
