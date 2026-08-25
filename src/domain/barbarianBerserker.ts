import type { AttackRequest } from "./attack";
import { compileAttack } from "./attack";
import type { RulesRuntimeState } from "./combatState";
import type { FixedDiceInput } from "./d20";
import type { ProgressionClassTrack } from "./progression";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";
import type { TargetFacts } from "./targeting";

export const BARBARIAN_CLASS_ID = "dnd.srd521.class.barbarian";
export const BARBARIAN_BERSERKER_SUBCLASS_ID = "dnd.srd521.subclass.barbarian.path-of-the-berserker";
export const BARBARIAN_RAGE_RESOURCE_ID = "resource:barbarian.rage";
export const BARBARIAN_RAGE_FEATURE_ID = "dnd.srd521.feature.barbarian.rage";
export const BARBARIAN_RAGE_TAG = "barbarian:rage";
export const BERSERKER_MINDLESS_RAGE_FEATURE_ID = "dnd.srd521.feature.barbarian.berserker.mindless-rage";
export const BERSERKER_RETALIATION_FEATURE_ID = "dnd.srd521.feature.barbarian.berserker.retaliation";
export const BERSERKER_INTIMIDATING_PRESENCE_FEATURE_ID = "dnd.srd521.feature.barbarian.berserker.intimidating-presence";
export const BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID = "resource:barbarian.berserker.intimidating-presence";
export const BERSERKER_MINDLESS_RAGE_TAG = "barbarian:berserker:mindless-rage";
export const BERSERKER_INTIMIDATING_PRESENCE_TAG = "barbarian:berserker:intimidating-presence";

export interface BarbarianRuntimeResourceDefinition {
  resourceId:string;
  label:string;
  maximum:number;
  source:string;
  recovery:{ shortRest?:number|"all"; longRest?:number|"all" };
}

export function barbarianRageMaximum(level:number) {
  if (!Number.isInteger(level) || level < 0 || level > 20) {
    throw new DomainEvaluationError("Barbarian level must be an integer from 0 to 20");
  }
  if (level < 1) return 0;
  if (level >= 17) return 6;
  if (level >= 12) return 5;
  if (level >= 6) return 4;
  if (level >= 3) return 3;
  return 2;
}

export function barbarianRageDamageBonus(level:number) {
  if (!Number.isInteger(level) || level < 1 || level > 20) {
    throw new DomainEvaluationError("Rage Damage requires Barbarian level 1-20");
  }
  if (level >= 16) return 4;
  if (level >= 9) return 3;
  return 2;
}

export function barbarianRuntimeResourceDefinitions(
  classTracks:ProgressionClassTrack[],
  subclassIds:Record<string,string> = {},
):BarbarianRuntimeResourceDefinition[] {
  const level = classTracks.find((track) => track.classId === BARBARIAN_CLASS_ID)?.level ?? 0;
  const definitions:BarbarianRuntimeResourceDefinition[] = [];
  const rageMaximum = barbarianRageMaximum(level);
  if (rageMaximum > 0) {
    definitions.push({
      resourceId:BARBARIAN_RAGE_RESOURCE_ID,
      label:"격노",
      maximum:rageMaximum,
      source:`바바리안 ${level}레벨 · Rage · SRD 5.2.1`,
      recovery:{ shortRest:1, longRest:"all" },
    });
  }
  if (level >= 14 && subclassIds[BARBARIAN_CLASS_ID] === BARBARIAN_BERSERKER_SUBCLASS_ID) {
    definitions.push({
      resourceId:BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID,
      label:"위압적인 존재감",
      maximum:1,
      source:`바바리안 ${level}레벨 · Path of the Berserker · Intimidating Presence · SRD 5.2.1`,
      recovery:{ longRest:"all" },
    });
  }
  return definitions;
}

export interface BarbarianRageRequest {
  id:string;
  actorId:string;
  expectedRevision:number;
  barbarianLevel:number;
  wearingHeavyArmor:boolean;
}

function validateBarbarianRage(level:number) {
  if (!Number.isInteger(level) || level < 1 || level > 20) {
    throw new DomainEvaluationError("Rage requires Barbarian level 1-20");
  }
}

function barbarianRageDuration(level:number,actorId:string) {
  return level >= 15
    ? ({ kind:"minutes", amount:10 } as const)
    : ({ kind:"rounds", amount:1, anchorActorId:actorId, boundary:"end" } as const);
}

function barbarianRageTermination(level:number) {
  return level >= 15
    ? ({ targetBecomesUnconscious:true, targetDies:true } as const)
    : ({ targetBecomesIncapacitated:true, targetDies:true } as const);
}

function rageEffectsFor(inputState:RulesRuntimeState,actorId:string) {
  return inputState.effects.filter((effect) => effect.targetId === actorId && effect.tags.includes(BARBARIAN_RAGE_TAG));
}

export function compileBarbarianRageStart(
  inputState:RulesRuntimeState,
  request:BarbarianRageRequest,
):PendingResolution {
  validateBarbarianRage(request.barbarianLevel);
  if (request.wearingHeavyArmor) throw new DomainEvaluationError("Rage cannot start while wearing Heavy Armor");
  if (rageEffectsFor(inputState,request.actorId).length) throw new DomainEvaluationError("Rage is already active");
  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:BARBARIAN_RAGE_FEATURE_ID,
    expectedRevision:request.expectedRevision,
    operations:[
      {
        id:`${request.id}:bonus-action`,
        kind:"use-economy",
        actorId:request.actorId,
        slot:"bonus-action",
        bonusActionGranted:true,
        actionKind:"other",
      },
      {
        id:`${request.id}:rage-use`,
        kind:"spend-resource",
        actorId:request.actorId,
        resourceId:BARBARIAN_RAGE_RESOURCE_ID,
        amount:1,
      },
      {
        id:`${request.id}:end-concentration`,
        kind:"end-concentration",
        actorId:request.actorId,
        reason:"Rage prevents Concentration",
      },
      {
        id:`${request.id}:rage-effect`,
        kind:"apply-effect",
        effect:{
          id:`${request.id}:${request.actorId}:rage`,
          sourceId:BARBARIAN_RAGE_FEATURE_ID,
          sourceActorId:request.actorId,
          targetId:request.actorId,
          kind:"marker",
          tags:[
            BARBARIAN_RAGE_TAG,
            "damage-resistance:bludgeoning",
            "damage-resistance:piercing",
            "damage-resistance:slashing",
          ],
          duration:barbarianRageDuration(request.barbarianLevel,request.actorId),
          termination:barbarianRageTermination(request.barbarianLevel),
        },
      },
    ],
  };
}

export function resolveBarbarianRageStart(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:BarbarianRageRequest,
):ResolutionCommit {
  try {
    return resolvePendingResolution(profile,inputState,compileBarbarianRageStart(inputState,request));
  } catch (error) {
    return { status:"rejected", state:inputState, events:[], results:{}, error:error instanceof Error ? error.message : String(error) };
  }
}

export interface BarbarianRageHeavyArmorRequest {
  id:string;
  actorId:string;
  expectedRevision:number;
}

export function compileBarbarianRageHeavyArmorEquipped(
  inputState:RulesRuntimeState,
  request:BarbarianRageHeavyArmorRequest,
):PendingResolution {
  const active = rageEffectsFor(inputState,request.actorId);
  if (!active.length) throw new DomainEvaluationError("Rage is not active");
  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:BARBARIAN_RAGE_FEATURE_ID,
    expectedRevision:request.expectedRevision,
    operations:active.map((effect,index) => ({
      id:`${request.id}:heavy-armor-end:${index}`,
      kind:"remove-effect",
      effectId:effect.id,
    })),
  };
}

export function resolveBarbarianRageHeavyArmorEquipped(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:BarbarianRageHeavyArmorRequest,
):ResolutionCommit {
  try {
    return resolvePendingResolution(profile,inputState,compileBarbarianRageHeavyArmorEquipped(inputState,request));
  } catch (error) {
    return { status:"rejected", state:inputState, events:[], results:{}, error:error instanceof Error ? error.message : String(error) };
  }
}

function validateBerserker(level:number,subclassId:string|undefined,minimumLevel:number,feature:string) {
  if (!Number.isInteger(level) || level < minimumLevel || level > 20) {
    throw new DomainEvaluationError(`${feature} requires Barbarian level ${minimumLevel}-20`);
  }
  if (subclassId !== BARBARIAN_BERSERKER_SUBCLASS_ID) {
    throw new DomainEvaluationError(`${feature} requires Path of the Berserker`);
  }
}

export interface BerserkerMindlessRageRequest {
  id:string;
  actorId:string;
  expectedRevision:number;
  barbarianLevel:number;
  subclassId?:string;
}

export function compileBerserkerMindlessRageStart(
  inputState:RulesRuntimeState,
  request:BerserkerMindlessRageRequest,
):PendingResolution {
  validateBerserker(request.barbarianLevel,request.subclassId,6,"Mindless Rage");
  const operations:ResolutionOperation[] = inputState.effects
    .filter((effect) => effect.targetId === request.actorId && (effect.conditionId === "charmed" || effect.conditionId === "frightened"))
    .map((effect,index) => ({ id:`${request.id}:end-existing-condition:${index}`, kind:"remove-effect" as const, effectId:effect.id }));
  operations.push({
    id:`${request.id}:mindless-rage`,
    kind:"apply-effect",
    effect:{
      id:`${request.id}:${request.actorId}:mindless-rage`,
      sourceId:BERSERKER_MINDLESS_RAGE_FEATURE_ID,
      sourceActorId:request.actorId,
      targetId:request.actorId,
      kind:"marker",
      tags:[
        BERSERKER_MINDLESS_RAGE_TAG,
        "condition-immunity:charmed",
        "condition-immunity:frightened",
      ],
      duration:{ kind:"special", key:"barbarian-rage" },
      termination:{ targetBecomesIncapacitated:true, targetDies:true },
    },
  });
  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:BERSERKER_MINDLESS_RAGE_FEATURE_ID,
    expectedRevision:request.expectedRevision,
    operations,
  };
}

export function resolveBerserkerMindlessRageStart(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:BerserkerMindlessRageRequest,
):ResolutionCommit {
  try {
    return resolvePendingResolution(profile,inputState,compileBerserkerMindlessRageStart(inputState,request));
  } catch (error) {
    return { status:"rejected", state:inputState, events:[], results:{}, error:error instanceof Error ? error.message : String(error) };
  }
}

export interface BerserkerMindlessRageEndRequest {
  id:string;
  actorId:string;
  expectedRevision:number;
}

export function compileBerserkerMindlessRageEnd(
  inputState:RulesRuntimeState,
  request:BerserkerMindlessRageEndRequest,
):PendingResolution {
  const markers = inputState.effects.filter((effect) =>
    effect.targetId === request.actorId && effect.tags.includes(BERSERKER_MINDLESS_RAGE_TAG));
  if (!markers.length) throw new DomainEvaluationError("Mindless Rage is not active");
  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:BERSERKER_MINDLESS_RAGE_FEATURE_ID,
    expectedRevision:request.expectedRevision,
    operations:markers.map((effect,index) => ({ id:`${request.id}:end:${index}`, kind:"remove-effect", effectId:effect.id })),
  };
}

export function resolveBerserkerMindlessRageEnd(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:BerserkerMindlessRageEndRequest,
):ResolutionCommit {
  try {
    return resolvePendingResolution(profile,inputState,compileBerserkerMindlessRageEnd(inputState,request));
  } catch (error) {
    return { status:"rejected", state:inputState, events:[], results:{}, error:error instanceof Error ? error.message : String(error) };
  }
}

type RetaliationAttack = Omit<
  AttackRequest,
  "id"|"actorId"|"expectedRevision"|"sourceId"|"rangeFeet"|"economy"|"requiresSight"|"rollStateContributions"
>;

export interface BerserkerRetaliationRequest {
  id:string;
  actorId:string;
  expectedRevision:number;
  barbarianLevel:number;
  subclassId?:string;
  triggeringDamageSourceActorId:string;
  attack:RetaliationAttack;
}

export function compileBerserkerRetaliation(request:BerserkerRetaliationRequest):PendingResolution {
  validateBerserker(request.barbarianLevel,request.subclassId,10,"Retaliation");
  if (request.attack.sourceKind !== "weapon" && request.attack.sourceKind !== "unarmed") {
    throw new DomainEvaluationError("Retaliation requires a melee weapon or Unarmed Strike attack");
  }
  if (request.attack.target.id !== request.triggeringDamageSourceActorId) {
    throw new DomainEvaluationError("Retaliation must target the creature that dealt the triggering damage");
  }
  if (request.attack.target.distanceFeet > 5) {
    throw new DomainEvaluationError("Retaliation requires the triggering creature to be within 5 feet");
  }
  return compileAttack({
    ...request.attack,
    id:request.id,
    actorId:request.actorId,
    expectedRevision:request.expectedRevision,
    sourceId:BERSERKER_RETALIATION_FEATURE_ID,
    rangeFeet:5,
    requiresSight:false,
    rollStateContributions:request.attack.target.visible
      ? []
      : [{ source:`${BERSERKER_RETALIATION_FEATURE_ID}:unseen-target`, state:"disadvantage" }],
    economy:{ slot:"reaction" },
  });
}

export function resolveBerserkerRetaliation(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:BerserkerRetaliationRequest,
):ResolutionCommit {
  try {
    return resolvePendingResolution(profile,inputState,compileBerserkerRetaliation(request));
  } catch (error) {
    return { status:"rejected", state:inputState, events:[], results:{}, error:error instanceof Error ? error.message : String(error) };
  }
}

export interface BerserkerIntimidatingPresenceTarget extends TargetFacts {
  wisdomSaveModifier:number;
  saveDice:FixedDiceInput;
}

export interface BerserkerIntimidatingPresenceRequest {
  id:string;
  actorId:string;
  expectedRevision:number;
  barbarianLevel:number;
  subclassId?:string;
  strengthModifier:number;
  proficiencyBonus:number;
  targets:BerserkerIntimidatingPresenceTarget[];
}

export function berserkerIntimidatingPresenceDc(strengthModifier:number,proficiencyBonus:number) {
  if (!Number.isInteger(strengthModifier) || !Number.isInteger(proficiencyBonus) || proficiencyBonus < 0) {
    throw new DomainEvaluationError("Intimidating Presence requires integer Strength modifier and proficiency bonus");
  }
  return 8 + strengthModifier + proficiencyBonus;
}

export function compileBerserkerIntimidatingPresence(request:BerserkerIntimidatingPresenceRequest):PendingResolution {
  validateBerserker(request.barbarianLevel,request.subclassId,14,"Intimidating Presence");
  if (!request.targets.length) throw new DomainEvaluationError("Intimidating Presence requires at least one selected creature");
  const saveDc = berserkerIntimidatingPresenceDc(request.strengthModifier,request.proficiencyBonus);
  const operations:ResolutionOperation[] = [
    {
      id:`${request.id}:targets`,
      kind:"targeting",
      sourceId:request.actorId,
      rule:{
        kind:"creature",
        rangeFeet:30,
        minTargets:1,
        maxTargets:request.targets.length,
        allowedRelations:["ally","enemy","neutral"],
        requiresSight:false,
        directTarget:true,
      },
      targets:request.targets,
      harmful:true,
    },
    {
      id:`${request.id}:usage`,
      kind:"spend-resource",
      actorId:request.actorId,
      resourceId:BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID,
      amount:1,
    },
    {
      id:`${request.id}:bonus-action`,
      kind:"use-economy",
      actorId:request.actorId,
      slot:"bonus-action",
      bonusActionGranted:true,
      actionKind:"other",
    },
  ];
  request.targets.forEach((target,index) => {
    if (!Number.isFinite(target.wisdomSaveModifier)) throw new DomainEvaluationError(`target Wisdom save modifier must be finite: ${target.id}`);
    const saveId = `${request.id}:save:${index}`;
    operations.push(
      {
        id:saveId,
        kind:"d20",
        actorId:target.id,
        targetId:target.id,
        request:{
          family:"saving-throw",
          target:saveDc,
          modifierContributions:[{ source:`target:${target.id}:wisdom-save`, value:target.wisdomSaveModifier }],
          dice:target.saveDice,
          targetSource:`${BERSERKER_INTIMIDATING_PRESENCE_FEATURE_ID}:save-dc`,
        },
        condition:{ ability:"wis" },
      },
      {
        id:`${request.id}:frightened:${index}`,
        kind:"apply-effect",
        when:{ operationId:saveId, field:"outcome", equals:"failure" },
        effect:{
          id:`${request.id}:${target.id}:frightened`,
          sourceId:BERSERKER_INTIMIDATING_PRESENCE_FEATURE_ID,
          sourceActorId:request.actorId,
          targetId:target.id,
          kind:"condition",
          conditionId:"frightened",
          tags:[BERSERKER_INTIMIDATING_PRESENCE_TAG],
          duration:{ kind:"minutes", amount:1 },
          metadata:{ saveDc },
        },
      },
    );
  });
  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:BERSERKER_INTIMIDATING_PRESENCE_FEATURE_ID,
    expectedRevision:request.expectedRevision,
    operations,
  };
}

export function resolveBerserkerIntimidatingPresence(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:BerserkerIntimidatingPresenceRequest,
):ResolutionCommit {
  try {
    return resolvePendingResolution(profile,inputState,compileBerserkerIntimidatingPresence(request));
  } catch (error) {
    return { status:"rejected", state:inputState, events:[], results:{}, error:error instanceof Error ? error.message : String(error) };
  }
}

export interface BerserkerRecoverIntimidatingPresenceRequest {
  id:string;
  actorId:string;
  expectedRevision:number;
  barbarianLevel:number;
  subclassId?:string;
}

export function compileBerserkerRecoverIntimidatingPresence(
  request:BerserkerRecoverIntimidatingPresenceRequest,
):PendingResolution {
  validateBerserker(request.barbarianLevel,request.subclassId,14,"Intimidating Presence recovery");
  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:BERSERKER_INTIMIDATING_PRESENCE_FEATURE_ID,
    expectedRevision:request.expectedRevision,
    operations:[
      {
        id:`${request.id}:spend-rage`,
        kind:"spend-resource",
        actorId:request.actorId,
        resourceId:BARBARIAN_RAGE_RESOURCE_ID,
        amount:1,
      },
      {
        id:`${request.id}:recover-presence`,
        kind:"gain-resource",
        actorId:request.actorId,
        resourceId:BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID,
        amount:1,
      },
    ],
  };
}

export function resolveBerserkerRecoverIntimidatingPresence(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:BerserkerRecoverIntimidatingPresenceRequest,
):ResolutionCommit {
  try {
    return resolvePendingResolution(profile,inputState,compileBerserkerRecoverIntimidatingPresence(request));
  } catch (error) {
    return { status:"rejected", state:inputState, events:[], results:{}, error:error instanceof Error ? error.message : String(error) };
  }
}

export interface BerserkerIntimidatingPresenceRepeatSaveRequest {
  id:string;
  targetId:string;
  expectedRevision:number;
  wisdomSaveModifier:number;
  saveDice:FixedDiceInput;
}

export function compileBerserkerIntimidatingPresenceRepeatSave(
  inputState:RulesRuntimeState,
  request:BerserkerIntimidatingPresenceRepeatSaveRequest,
):PendingResolution {
  const effect = inputState.effects.find((entry) =>
    entry.targetId === request.targetId
    && entry.sourceId === BERSERKER_INTIMIDATING_PRESENCE_FEATURE_ID
    && entry.tags.includes(BERSERKER_INTIMIDATING_PRESENCE_TAG));
  if (!effect) throw new DomainEvaluationError("target has no active Intimidating Presence effect");
  const saveDc = effect.metadata?.saveDc;
  if (typeof saveDc !== "number" || !Number.isFinite(saveDc)) throw new DomainEvaluationError("Intimidating Presence effect is missing its save DC");
  if (!Number.isFinite(request.wisdomSaveModifier)) throw new DomainEvaluationError("Wisdom save modifier must be finite");
  const saveId = `${request.id}:save`;
  return {
    id:request.id,
    actorId:request.targetId,
    sourceId:BERSERKER_INTIMIDATING_PRESENCE_FEATURE_ID,
    expectedRevision:request.expectedRevision,
    operations:[
      {
        id:saveId,
        kind:"d20",
        actorId:request.targetId,
        targetId:request.targetId,
        request:{
          family:"saving-throw",
          target:saveDc,
          modifierContributions:[{ source:`target:${request.targetId}:wisdom-save`, value:request.wisdomSaveModifier }],
          dice:request.saveDice,
          targetSource:`${BERSERKER_INTIMIDATING_PRESENCE_FEATURE_ID}:repeat-save-dc`,
        },
        condition:{ ability:"wis" },
      },
      {
        id:`${request.id}:end-effect`,
        kind:"remove-effect",
        effectId:effect.id,
        when:{ operationId:saveId, field:"outcome", equals:"success" },
      },
    ],
  };
}

export function resolveBerserkerIntimidatingPresenceRepeatSave(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:BerserkerIntimidatingPresenceRepeatSaveRequest,
):ResolutionCommit {
  try {
    return resolvePendingResolution(profile,inputState,compileBerserkerIntimidatingPresenceRepeatSave(inputState,request));
  } catch (error) {
    return { status:"rejected", state:inputState, events:[], results:{}, error:error instanceof Error ? error.message : String(error) };
  }
}
