import type { AbilityKey, ConditionId } from "./conditions";
import type { DurationSpec } from "./effects";
import type { FixedDiceInput } from "./d20";
import type { FixedDamageDice } from "./damageRoll";
import { cloneRuntimeState, type RulesRuntimeState } from "./combatState";
import { BARBARIAN_RAGE_TAG } from "./barbarianRage";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionEvent, ResolutionOperation } from "./resolutionTypes";
import type { TargetFacts, TargetingRule } from "./targeting";

export type SpellRuntimeSupport = "combat-executable" | "tracked-executable" | "partial" | "presentation-only";
export type SpellCastingEconomy = "action" | "bonus-action" | "reaction";
export type SpellCastSource = "prepared" | "always-prepared" | "item" | "feature";
export type SpellSuccessDamage = "none" | "half";

export interface SpellDiceFormula {
  count: number;
  sides: number;
  flat?: number;
  addSpellcastingModifier?: boolean;
  dicePerSlotAboveBase?: number;
  flatPerSlotAboveBase?: number;
  cantripScaling?: boolean;
}

export interface SpellConditionEffectDefinition {
  conditionId: ConditionId;
  trigger: "hit" | "failed-save" | "always";
  duration: DurationSpec;
  termination?: {
    targetTakesDamage?: boolean;
  };
}

export interface SpellTrackedEffectDefinition {
  summary: string;
  trigger: "hit" | "failed-save" | "always";
  duration: DurationSpec;
  termination?: {
    targetTakesDamage?: boolean;
  };
  modifier?: {
    family: "attack-roll" | "saving-throw" | "ability-check";
    rollState: "advantage" | "disadvantage";
    scope: "actor" | "target";
    consumeOnUse?: boolean;
  };
}

export type SpellPrimaryMechanic =
  | {
      kind: "attack-damage";
      damageType: string;
      dice: SpellDiceFormula;
    }
  | {
      kind: "multi-attack-damage";
      damageType: string;
      dicePerAttack: SpellDiceFormula;
      baseAttacks: number;
      attacksPerSlotAboveBase?: number;
      cantripAttackScaling?: boolean;
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
      kind: "save-compound-damage";
      saveAbility: AbilityKey;
      components:Array<{damageType:string;dice:SpellDiceFormula}>;
      successDamage: SpellSuccessDamage;
      ignoresCoverForSave?: boolean;
    }
  | {
      kind: "healing";
      dice: SpellDiceFormula;
    }
  | {
      kind: "temporary-hp";
      dice: SpellDiceFormula;
    }
  | {
      kind: "full-healing";
    }
  | {
      kind: "power-word-kill";
      fallbackDamage:SpellDiceFormula;
    }
  | {
      kind: "save-effect";
      saveAbility: AbilityKey;
      summary: string;
      duration: DurationSpec;
    }
  | {
      kind: "automatic-projectiles";
      damageType: string;
      projectileDice: { sides: number; flat: number };
      baseProjectiles: number;
      projectilesPerSlotAboveBase?: number;
    }
  | {
      kind: "tracked-effect";
      summary: string;
      duration: DurationSpec;
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
  trackedEffects?: SpellTrackedEffectDefinition[];
  removesConditions?: ConditionId[];
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
  attackInstances?: Array<{
    targetId:string;
    attack:FixedDiceInput;
    effectFaces:number[];
  }>;
  componentFaces?:number[][];
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
  if (!Number.isInteger(formula.count) || formula.count < 0) throw new DomainEvaluationError("spell dice count must be a non-negative integer");
  if (formula.count === 0 && (formula.flat ?? 0) <= 0) throw new DomainEvaluationError("spell formula must contain dice or positive flat value");
  requirePositiveInteger(formula.sides, "spell die sides");
  let count = formula.count;
  if (formula.cantripScaling) count += cantripScaleSteps(request.caster.characterLevel);
  if (request.slotLevel !== undefined && formula.dicePerSlotAboveBase) {
    count += Math.max(0, request.slotLevel - definition.baseLevel) * formula.dicePerSlotAboveBase;
  }
  const flat = (formula.flat ?? 0)
    +Math.max(0,(request.slotLevel??definition.baseLevel)-definition.baseLevel)*(formula.flatPerSlotAboveBase??0)
    +(formula.addSpellcastingModifier ? request.caster.spellcastingAbilityModifier : 0);
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
  if (definition.runtimeSupport !== "combat-executable" && definition.runtimeSupport !== "tracked-executable") {
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
      throw new DomainEvaluationError("spell is not granted for slotless feature casting");
    }
    if (request.slotLevel !== undefined) throw new DomainEvaluationError("slotless feature casting cannot specify a slot level");
    return {
      slotted:false as const,
      slotResourceId:undefined,
      featureResourceId:request.caster.featureResourceIds?.[definition.spellId],
    };
  }

  if (request.slotLevel === undefined) throw new DomainEvaluationError("level 1+ prepared spells require a spell slot");
  if (!Number.isInteger(request.slotLevel) || request.slotLevel < definition.baseLevel || request.slotLevel > 9) {
    throw new DomainEvaluationError(`slot level must be ${definition.baseLevel}-9`);
  }
  const slotResourceId = request.caster.slotResourceIds[request.slotLevel];
  if (!slotResourceId) throw new DomainEvaluationError(`no slot resource mapped for level ${request.slotLevel}`);
  if (request.useActionEconomy && !request.turnId) {
    throw new DomainEvaluationError("turn-bound slotted casting requires turnId for the one-slot-per-turn rule");
  }
  return { slotted: true as const, slotResourceId, featureResourceId: undefined };
}

function economyOperation(definition: SpellMechanicDefinition, request: SpellCastRequest): ResolutionOperation | undefined {
  if (!request.useActionEconomy) return undefined;
  return {
    id: `${request.id}:economy`,
    kind: "use-economy",
    actorId: request.actorId,
    slot: definition.castingEconomy,
    bonusActionGranted: definition.castingEconomy === "bonus-action",
  };
}

function applyEffectOperations(
  definition: SpellMechanicDefinition,
  request: SpellCastRequest,
  triggerOperationIds: Record<string, string | undefined>,
  concentrationGroupId: string | undefined,
): ResolutionOperation[] {
  const operations: ResolutionOperation[] = [];
  for (const [effectIndex, effect] of (definition.effects ?? []).entries()) {
    for (const target of request.targets) {
      const triggerId = triggerOperationIds[target.id];
      if (effect.trigger !== "always" && !triggerId) continue;
      const when = effect.trigger === "hit" && triggerId
        ? { operationId: triggerId, field: "outcome", equals: "success" as const }
        : effect.trigger === "failed-save" && triggerId
          ? { operationId: triggerId, field: "outcome", equals: "failure" as const }
          : undefined;
      operations.push({
        id: `${request.id}:effect:${effectIndex}:${target.id}`,
        kind: "apply-effect",
        when,
        effect: {
          id: `${request.id}:effect:${effectIndex}:${target.id}`,
          sourceId: definition.spellId,
          sourceActorId: request.actorId,
          targetId: target.id,
          kind: "condition",
          conditionId: effect.conditionId,
          duration: resolveEffectDuration(effect.duration, request, target.id),
          termination: effect.termination,
          concentrationGroupId,
          tags: ["spell", definition.spellId],
        },
      });
    }
  }
  return operations;
}

export function spellMultiAttackCount(definition:SpellMechanicDefinition,characterLevel:number,slotLevel?:number) {
  if (definition.primary.kind!=="multi-attack-damage") return 0;
  return definition.primary.baseAttacks
    +(definition.primary.cantripAttackScaling?cantripScaleSteps(characterLevel):0)
    +Math.max(0,(slotLevel??definition.baseLevel)-definition.baseLevel)*(definition.primary.attacksPerSlotAboveBase??0);
}

function resolveEffectDuration(duration:DurationSpec,request:SpellCastRequest,targetId:string):DurationSpec {
  if (duration.kind!=="rounds") return duration;
  const anchorActorId=duration.anchorActorId==="$source"?request.actorId:duration.anchorActorId==="$target"?targetId:duration.anchorActorId;
  return {...duration,anchorActorId};
}

function applyTrackedEffectOperations(
  definition:SpellMechanicDefinition,
  request:SpellCastRequest,
  triggerOperationIds:Record<string,string|undefined>,
  concentrationGroupId:string|undefined,
):ResolutionOperation[] {
  const operations:ResolutionOperation[]=[];
  for (const [effectIndex,effect] of (definition.trackedEffects??[]).entries()) {
    const targets=request.targets.length?request.targets:[{id:request.actorId} as SpellCastTarget];
    for (const target of targets) {
      const triggerId=triggerOperationIds[target.id];
      if (effect.trigger!=="always"&&!triggerId) continue;
      const when=effect.trigger==="hit"&&triggerId
        ? {operationId:triggerId,field:"outcome",equals:"success" as const}
        : effect.trigger==="failed-save"&&triggerId
          ? {operationId:triggerId,field:"outcome",equals:"failure" as const}
          : undefined;
      operations.push({
        id:`${request.id}:tracked-rider:${effectIndex}:${target.id}`,
        kind:"apply-effect",
        when,
        effect:{
          id:`${request.id}:tracked-rider:${effectIndex}:${target.id}`,
          sourceId:definition.spellId,
          sourceActorId:request.actorId,
          targetId:target.id,
          kind:effect.modifier?"modifier":"marker",
          tags:["spell",definition.spellId,"tracked-effect"],
          duration:resolveEffectDuration(effect.duration,request,target.id),
          termination:effect.termination,
          concentrationGroupId,
          metadata:{
            summary:effect.summary,
            ...(effect.modifier?{
              d20Family:effect.modifier.family,
              d20RollState:effect.modifier.rollState,
              d20Scope:effect.modifier.scope,
              consumeOnUse:effect.modifier.consumeOnUse===true,
            }:{}),
          },
        },
      });
    }
  }
  return operations;
}

function saveOperations(
  definition:SpellMechanicDefinition,
  request:SpellCastRequest,
  targetOpId:string,
  saveAbility:AbilityKey,
  ignoresCoverForSave=false,
) {
  const operations:ResolutionOperation[]=[];
  const triggerOperationIds:Record<string,string|undefined>={};
  for (const target of request.targets) {
    const saveDice=request.dice.saves?.[target.id];
    if (!saveDice) throw new DomainEvaluationError(`missing fixed save dice for ${target.id}`);
    const saveId=`${request.id}:save:${target.id}`;
    triggerOperationIds[target.id]=saveId;
    operations.push({
      id:saveId,
      kind:"d20",
      actorId:target.id,
      request:{
        family:"saving-throw",
        target:request.caster.spellSaveDc,
        modifierContributions:[{source:`target:${target.id}:${saveAbility}-save`,value:target.saveModifiers?.[saveAbility]??0}],
        dice:saveDice,
        targetSource:`${definition.spellId}:spell-save-dc`,
      },
      cover:saveAbility==="dex"&&!ignoresCoverForSave?{targetingOperationId:targetOpId,targetId:target.id,appliesTo:"dexterity-save"}:undefined,
      condition:{ability:saveAbility,actorCanSeeTarget:target.targetCanSeeCaster,targetCanSeeActor:target.visible},
    });
  }
  return {operations,triggerOperationIds};
}

export function compileSpellCast(
  definition: SpellMechanicDefinition,
  inputState: RulesRuntimeState,
  request: SpellCastRequest,
): SpellCastCompilation {
  if (request.expectedRevision !== inputState.revision) throw new DomainEvaluationError("spell cast revision mismatch");
  if (inputState.effects.some((effect) => effect.targetId === request.actorId && effect.tags.includes(BARBARIAN_RAGE_TAG))) {
    throw new DomainEvaluationError("Rage prevents casting spells");
  }
  const access = validateAccess(definition, request);
  const operations: ResolutionOperation[] = [];
  const targetOpId = `${request.id}:targets`;
  let targetRule = definition.targeting;

  if (definition.primary.kind === "automatic-projectiles") {
    const projectileCount = definition.primary.baseProjectiles
      + Math.max(0, (request.slotLevel ?? definition.baseLevel) - definition.baseLevel)
        * (definition.primary.projectilesPerSlotAboveBase ?? 0);
    targetRule = { ...targetRule, maxTargets: projectileCount };
  } else if (definition.primary.kind==="multi-attack-damage") {
    targetRule={...targetRule,maxTargets:spellMultiAttackCount(definition,request.caster.characterLevel,request.slotLevel)};
  }

  operations.push({
    id: targetOpId,
    kind: "targeting",
    sourceId: request.actorId,
    rule: targetRule,
    targets: request.targets,
    harmful: definition.primary.kind === "attack-damage"
      || definition.primary.kind === "multi-attack-damage"
      || definition.primary.kind === "save-damage"
      || definition.primary.kind === "save-compound-damage"
      || definition.primary.kind === "save-effect"
      || definition.primary.kind === "power-word-kill"
      || definition.primary.kind === "automatic-projectiles",
  });

  const economy = economyOperation(definition, request);
  if (economy) operations.push(economy);
  if (access.slotted) {
    operations.push({
      id: `${request.id}:slot`,
      kind: "spend-resource",
      actorId: request.actorId,
      resourceId: access.slotResourceId,
      amount: 1,
    });
  }
  if (access.featureResourceId) {
    operations.push({
      id:`${request.id}:feature-resource`,
      kind:"spend-resource",
      actorId:request.actorId,
      resourceId:access.featureResourceId,
      amount:1,
    });
  }

  const concentrationGroupId = definition.concentration ? `${request.id}:concentration` : undefined;
  if (definition.concentration) {
    operations.push({
      id: `${request.id}:concentration:start`,
      kind: "start-concentration",
      actorId: request.actorId,
      groupId: concentrationGroupId!,
      sourceId: definition.spellId,
    });
  }

  let triggerOperationIds: Record<string, string | undefined> = {};

  if (definition.primary.kind === "attack-damage") {
    if (request.targets.length !== 1) throw new DomainEvaluationError("attack spell requires exactly one target in this execution envelope");
    const target = request.targets[0];
    if (target.ac === undefined) throw new DomainEvaluationError("spell attack requires authoritative target AC");
    if (!request.dice.attack) throw new DomainEvaluationError("spell attack requires fixed d20 input");
    const attackId = `${request.id}:attack:${target.id}`;
    triggerOperationIds[target.id] = attackId;
    operations.push({
      id: attackId,
      kind: "d20",
      actorId: request.actorId,
      targetId: target.id,
      request: {
        family: "attack-roll",
        target: target.ac,
        modifierContributions: [{ source: `${definition.spellId}:spell-attack`, value: request.caster.spellAttackModifier }],
        dice: request.dice.attack,
        targetSource: `target:${target.id}:ac`,
      },
      cover: { targetingOperationId: targetOpId, targetId: target.id, appliesTo: "ac" },
      condition: {
        distanceToTargetFeet: target.distanceFeet,
        actorCanSeeTarget: target.visible,
        targetCanSeeActor: target.targetCanSeeCaster,
      },
    });
    const formula = scaledFormula(definition.primary.dice, definition, request);
    const rollId = `${request.id}:damage-roll`;
    operations.push({
      id: rollId,
      kind: "damage-roll",
      when: { operationId: attackId, field: "outcome", equals: "success" },
      criticalFrom: attackId,
      request: diceRequest(definition.spellId, formula.count, formula.sides, request.dice.effectFaces ?? [], formula.flat),
    });
    operations.push({
      id: `${request.id}:damage:${target.id}`,
      kind: "damage",
      when: { operationId: attackId, field: "outcome", equals: "success" },
      targetId: target.id,
      damageType: definition.primary.damageType,
      amount: { operationId: rollId, field: "total" },
      creatureKind: target.creatureKind,
      criticalFrom: attackId,
    });
  } else if (definition.primary.kind === "multi-attack-damage") {
    const attackCount=spellMultiAttackCount(definition,request.caster.characterLevel,request.slotLevel);
    const instances=request.dice.attackInstances??[];
    if (instances.length!==attackCount) throw new DomainEvaluationError(`multi-attack spell requires exactly ${attackCount} attack instances`);
    const targetsById=new Map(request.targets.map((target)=>[target.id,target]));
    for (const [index,instance] of instances.entries()) {
      const target=targetsById.get(instance.targetId);
      if (!target) throw new DomainEvaluationError(`multi-attack target not selected: ${instance.targetId}`);
      if (target.ac===undefined) throw new DomainEvaluationError("spell attack requires authoritative target AC");
      const attackId=`${request.id}:attack:${index}:${target.id}`;
      triggerOperationIds[target.id]=attackId;
      operations.push({
        id:attackId,kind:"d20",actorId:request.actorId,targetId:target.id,
        request:{family:"attack-roll",target:target.ac,modifierContributions:[{source:`${definition.spellId}:spell-attack`,value:request.caster.spellAttackModifier}],dice:instance.attack,targetSource:`target:${target.id}:ac`},
        cover:{targetingOperationId:targetOpId,targetId:target.id,appliesTo:"ac"},
        condition:{distanceToTargetFeet:target.distanceFeet,actorCanSeeTarget:target.visible,targetCanSeeActor:target.targetCanSeeCaster},
      });
      const formula=scaledFormula(definition.primary.dicePerAttack,definition,request);
      const rollId=`${request.id}:damage-roll:${index}:${target.id}`;
      operations.push({id:rollId,kind:"damage-roll",when:{operationId:attackId,field:"outcome",equals:"success"},criticalFrom:attackId,request:diceRequest(`${definition.spellId}:attack:${index}`,formula.count,formula.sides,instance.effectFaces,formula.flat)});
      operations.push({id:`${request.id}:damage:${index}:${target.id}`,kind:"damage",when:{operationId:attackId,field:"outcome",equals:"success"},targetId:target.id,damageType:definition.primary.damageType,amount:{operationId:rollId,field:"total"},creatureKind:target.creatureKind,criticalFrom:attackId});
    }
  } else if (definition.primary.kind === "save-damage") {
    const formula = scaledFormula(definition.primary.dice, definition, request);
    const rollId = `${request.id}:damage-roll`;
    operations.push({
      id: rollId,
      kind: "damage-roll",
      request: diceRequest(definition.spellId, formula.count, formula.sides, request.dice.effectFaces ?? [], formula.flat),
    });
    const saves=saveOperations(definition,request,targetOpId,definition.primary.saveAbility,definition.primary.ignoresCoverForSave);
    operations.push(...saves.operations);
    triggerOperationIds=saves.triggerOperationIds;
    for (const target of request.targets) {
      const saveId=triggerOperationIds[target.id]!;
      operations.push({
        id: `${request.id}:damage:${target.id}:failed-save`,
        kind: "damage",
        when: { operationId: saveId, field: "outcome", equals: "failure" },
        targetId: target.id,
        damageType: definition.primary.damageType,
        amount: { operationId: rollId, field: "total" },
        creatureKind: target.creatureKind,
      });
      if (definition.primary.successDamage === "half") {
        operations.push({
          id: `${request.id}:damage:${target.id}:successful-save`,
          kind: "damage",
          when: { operationId: saveId, field: "outcome", equals: "success" },
          targetId: target.id,
          damageType: definition.primary.damageType,
          amount: { operationId: rollId, field: "total", multiplier: 0.5, rounding: "floor" },
          creatureKind: target.creatureKind,
        });
      }
    }
  } else if (definition.primary.kind==="save-compound-damage") {
    const rollIds=definition.primary.components.map((component,index)=>{
      const formula=scaledFormula(component.dice,definition,request);
      const rollId=`${request.id}:damage-roll:${index}`;
      operations.push({id:rollId,kind:"damage-roll",request:diceRequest(`${definition.spellId}:${component.damageType}`,formula.count,formula.sides,request.dice.componentFaces?.[index]??[],formula.flat)});
      return rollId;
    });
    const saves=saveOperations(definition,request,targetOpId,definition.primary.saveAbility,definition.primary.ignoresCoverForSave);
    operations.push(...saves.operations);
    triggerOperationIds=saves.triggerOperationIds;
    for (const target of request.targets) {
      const saveId=triggerOperationIds[target.id]!;
      const components=definition.primary.components.map((component,index)=>({damageType:component.damageType,amount:{operationId:rollIds[index],field:"total" as const}}));
      operations.push({id:`${request.id}:compound-damage:${target.id}:failed-save`,kind:"compound-damage",when:{operationId:saveId,field:"outcome",equals:"failure"},targetId:target.id,components,creatureKind:target.creatureKind});
      if (definition.primary.successDamage==="half") operations.push({
        id:`${request.id}:compound-damage:${target.id}:successful-save`,kind:"compound-damage",when:{operationId:saveId,field:"outcome",equals:"success"},targetId:target.id,
        components:components.map((component)=>({...component,amount:{...component.amount,multiplier:0.5,rounding:"floor" as const}})),creatureKind:target.creatureKind,
      });
    }
  } else if (definition.primary.kind === "healing") {
    if (!request.targets.length) throw new DomainEvaluationError("healing spell requires at least one target");
    const formula = scaledFormula(definition.primary.dice, definition, request);
    const rollId = `${request.id}:healing-roll`;
    operations.push({
      id: rollId,
      kind: "damage-roll",
      request: diceRequest(`${definition.spellId}:healing`, formula.count, formula.sides, request.dice.effectFaces ?? [], formula.flat),
    });
    for (const target of request.targets) operations.push({id:`${request.id}:healing:${target.id}`,kind:"healing",targetId:target.id,amount:{operationId:rollId,field:"total"}});
  } else if (definition.primary.kind==="temporary-hp") {
    if (!request.targets.length) throw new DomainEvaluationError("temporary HP spell requires at least one target");
    const formula=scaledFormula(definition.primary.dice,definition,request);
    const rollId=`${request.id}:temporary-hp-roll`;
    operations.push({id:rollId,kind:"damage-roll",request:diceRequest(`${definition.spellId}:temporary-hp`,formula.count,formula.sides,request.dice.effectFaces??[],formula.flat)});
    for (const target of request.targets) operations.push({id:`${request.id}:temporary-hp:${target.id}`,kind:"temporary-hp",targetId:target.id,amount:{operationId:rollId,field:"total"},source:definition.spellId});
  } else if (definition.primary.kind === "full-healing") {
    if (!request.targets.length) throw new DomainEvaluationError("full healing spell requires at least one target");
    for (const target of request.targets) {
      const life=inputState.combatants[target.id]?.life;
      if (!life) throw new DomainEvaluationError(`full healing target not found: ${target.id}`);
      operations.push({id:`${request.id}:full-healing:${target.id}`,kind:"healing",targetId:target.id,amount:Math.max(0,life.hp.maximum-life.hp.current)});
    }
  } else if (definition.primary.kind==="power-word-kill") {
    if (request.targets.length!==1) throw new DomainEvaluationError("Power Word Kill requires exactly one target");
    const target=request.targets[0];
    const life=inputState.combatants[target.id]?.life;
    if (!life) throw new DomainEvaluationError(`Power Word Kill target not found: ${target.id}`);
    if (life.hp.current<=100) {
      operations.push({id:`${request.id}:kill:${target.id}`,kind:"damage",targetId:target.id,damageType:"power-word-kill",amount:life.hp.current+life.hp.temporary+life.hp.maximum,creatureKind:target.creatureKind});
    } else {
      const formula=scaledFormula(definition.primary.fallbackDamage,definition,request);
      const rollId=`${request.id}:fallback-damage-roll`;
      operations.push({id:rollId,kind:"damage-roll",request:diceRequest(`${definition.spellId}:fallback`,formula.count,formula.sides,request.dice.effectFaces??[],formula.flat)});
      operations.push({id:`${request.id}:fallback-damage:${target.id}`,kind:"damage",targetId:target.id,damageType:"psychic",amount:{operationId:rollId,field:"total"},creatureKind:target.creatureKind});
    }
  } else if (definition.primary.kind === "save-effect") {
    const saves=saveOperations(definition,request,targetOpId,definition.primary.saveAbility);
    operations.push(...saves.operations);
    triggerOperationIds=saves.triggerOperationIds;
  } else if (definition.primary.kind === "automatic-projectiles") {
    const projectileCount = definition.primary.baseProjectiles
      + Math.max(0, (request.slotLevel ?? definition.baseLevel) - definition.baseLevel)
        * (definition.primary.projectilesPerSlotAboveBase ?? 0);
    const allocations = request.projectileAllocations ?? (request.targets[0] ? [{ targetId: request.targets[0].id, count: projectileCount }] : []);
    const totalAllocated = allocations.reduce((sum, entry) => sum + entry.count, 0);
    if (totalAllocated !== projectileCount) throw new DomainEvaluationError(`projectile allocation must total ${projectileCount}`);
    const knownTargets = new Set(request.targets.map((target) => target.id));
    let faceOffset = 0;
    for (const allocation of allocations) {
      if (!knownTargets.has(allocation.targetId)) throw new DomainEvaluationError(`projectile target not selected: ${allocation.targetId}`);
      requirePositiveInteger(allocation.count, "projectile allocation");
      const target = request.targets.find((entry) => entry.id === allocation.targetId)!;
      const faces = (request.dice.projectileFaces ?? []).slice(faceOffset, faceOffset + allocation.count);
      faceOffset += allocation.count;
      const rollId = `${request.id}:projectiles:${allocation.targetId}`;
      operations.push({
        id: rollId,
        kind: "damage-roll",
        request: diceRequest(
          `${definition.spellId}:projectile`,
          allocation.count,
          definition.primary.projectileDice.sides,
          faces,
          allocation.count * definition.primary.projectileDice.flat,
        ),
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
  } else if (definition.primary.duration.kind !== "instant") {
    const affectedIds=request.targets.length?request.targets.map((target)=>target.id):[request.actorId];
    for (const targetId of affectedIds) {
      operations.push({
        id:`${request.id}:tracked-effect:${targetId}`,
        kind:"apply-effect",
        effect:{
          id:`${request.id}:tracked-effect:${targetId}`,
          sourceId:definition.spellId,
          sourceActorId:request.actorId,
          targetId,
          kind:"marker",
          tags:["spell",definition.spellId,"tracked-effect"],
          duration:resolveEffectDuration(definition.primary.duration,request,targetId),
          concentrationGroupId,
          metadata:{summary:definition.primary.summary},
        },
      });
    }
  }

  operations.push(...applyEffectOperations(definition, request, triggerOperationIds, concentrationGroupId));
  operations.push(...applyTrackedEffectOperations(definition,request,triggerOperationIds,concentrationGroupId));
  for (const target of request.targets) {
    for (const effect of inputState.effects.filter((entry)=>entry.targetId===target.id&&entry.conditionId&&definition.removesConditions?.includes(entry.conditionId))) {
      operations.push({id:`${request.id}:remove-condition:${target.id}:${effect.id}`,kind:"remove-effect",effectId:effect.id});
    }
  }

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
    return {
      status: "committed",
      state: commit.state,
      spellId: request.spellId,
      slotLevel: request.slotLevel,
      events: commit.events,
      results: commit.results,
    };
  } catch (error) {
    return reject(inputState, request, error);
  }
}
