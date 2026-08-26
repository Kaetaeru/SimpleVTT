import type { RulesRuntimeState } from "./combatState";
import type { ProgressionClassTrack } from "./progression";
import { PALADIN_ID } from "./classFeatureSpellResources";
import { paladinAuraRadiusFeet, type PaladinAuraFact } from "./paladinAura";
import { DomainEvaluationError, type RollStateContribution, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";
import { PALADIN_DEVOTION_SUBCLASS_ID } from "./srdSubclassCatalog";

export const DEVOTION_AURA_FEATURE_ID = "dnd.srd521.feature.paladin.devotion.aura-of-devotion";
export const DEVOTION_SMITE_OF_PROTECTION_FEATURE_ID = "dnd.srd521.feature.paladin.devotion.smite-of-protection";
export const DEVOTION_HOLY_NIMBUS_FEATURE_ID = "dnd.srd521.feature.paladin.devotion.holy-nimbus";
export const DEVOTION_SMITE_OF_PROTECTION_TAG = "paladin:devotion:smite-of-protection";
export const DEVOTION_HOLY_NIMBUS_TAG = "paladin:devotion:holy-nimbus";
export const DEVOTION_HOLY_NIMBUS_RESOURCE_ID = "resource:paladin.devotion.holy-nimbus";

export interface PaladinDevotionRuntimeResourceDefinition {
  resourceId:string;
  label:string;
  maximum:number;
  source:string;
  recovery:{ longRest:"all" };
}

export function paladinDevotionRuntimeResourceDefinitions(
  classTracks:ProgressionClassTrack[],
  subclassIds:Record<string,string> = {},
):PaladinDevotionRuntimeResourceDefinition[] {
  const level = classTracks.find((track) => track.classId === PALADIN_ID)?.level ?? 0;
  if (level < 20 || subclassIds[PALADIN_ID] !== PALADIN_DEVOTION_SUBCLASS_ID) return [];
  return [{
    resourceId:DEVOTION_HOLY_NIMBUS_RESOURCE_ID,
    label:"성스러운 후광",
    maximum:1,
    source:`팔라딘 ${level}레벨 · 헌신의 맹세 · 성스러운 후광 · SRD 5.2.1`,
    recovery:{ longRest:"all" },
  }];
}

function validateDevotion(level:number,subclassId:string|undefined,minimumLevel:number,feature:string) {
  if (!Number.isInteger(level) || level < minimumLevel || level > 20) {
    throw new DomainEvaluationError(`${feature} requires Paladin level ${minimumLevel}-20`);
  }
  if (subclassId !== PALADIN_DEVOTION_SUBCLASS_ID) {
    throw new DomainEvaluationError(`${feature} requires Oath of Devotion`);
  }
}

function rejected(inputState:RulesRuntimeState,error:unknown):ResolutionCommit {
  return {
    status:"rejected",
    state:inputState,
    events:[],
    results:{},
    error:error instanceof Error ? error.message : String(error),
  };
}

export function auraOfDevotionSuppressesCharmed(
  fact:PaladinAuraFact,
  subclassId:string|undefined,
) {
  validateDevotion(fact.paladinLevel,subclassId,7,"Aura of Devotion");
  const radius = paladinAuraRadiusFeet(fact.paladinLevel);
  return radius > 0
    && !fact.incapacitated
    && fact.distanceFeet <= radius
    && (fact.relation === "self" || fact.relation === "ally");
}

export interface DevotionSmiteOfProtectionRequest {
  id:string;
  actorId:string;
  expectedRevision:number;
  paladinLevel:number;
  subclassId?:string;
  divineSmiteCast:boolean;
}

export function compileDevotionSmiteOfProtection(request:DevotionSmiteOfProtectionRequest):PendingResolution {
  validateDevotion(request.paladinLevel,request.subclassId,15,"Smite of Protection");
  if (!request.divineSmiteCast) throw new DomainEvaluationError("Smite of Protection requires a Divine Smite cast");
  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:DEVOTION_SMITE_OF_PROTECTION_FEATURE_ID,
    expectedRevision:request.expectedRevision,
    operations:[{
      id:`${request.id}:aura-cover`,
      kind:"apply-effect",
      effect:{
        id:`${request.id}:${request.actorId}:aura-cover`,
        sourceId:DEVOTION_SMITE_OF_PROTECTION_FEATURE_ID,
        sourceActorId:request.actorId,
        targetId:request.actorId,
        kind:"marker",
        tags:[DEVOTION_SMITE_OF_PROTECTION_TAG],
        duration:{ kind:"rounds", amount:1, anchorActorId:request.actorId, boundary:"start" },
        termination:{ sourceBecomesIncapacitated:true, sourceDies:true },
      },
    }],
  };
}

export function resolveDevotionSmiteOfProtection(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:DevotionSmiteOfProtectionRequest,
):ResolutionCommit {
  try {
    return resolvePendingResolution(profile,inputState,compileDevotionSmiteOfProtection(request));
  } catch (error) {
    return rejected(inputState,error);
  }
}

export function smiteOfProtectionGrantsHalfCover(args:{
  state:RulesRuntimeState;
  paladinId:string;
  paladinLevel:number;
  subclassId?:string;
  paladinIncapacitated:boolean;
  relation:"self"|"ally"|"enemy"|"neutral";
  distanceFeet:number;
}) {
  validateDevotion(args.paladinLevel,args.subclassId,15,"Smite of Protection");
  const active = args.state.effects.some((effect) =>
    effect.sourceActorId === args.paladinId
    && effect.sourceId === DEVOTION_SMITE_OF_PROTECTION_FEATURE_ID
    && effect.tags.includes(DEVOTION_SMITE_OF_PROTECTION_TAG));
  if (!active || args.paladinIncapacitated) return false;
  const radius = paladinAuraRadiusFeet(args.paladinLevel);
  return args.distanceFeet <= radius && (args.relation === "self" || args.relation === "ally");
}

export interface DevotionHolyNimbusActivateRequest {
  id:string;
  actorId:string;
  expectedRevision:number;
  paladinLevel:number;
  subclassId?:string;
  charismaModifier:number;
  proficiencyBonus:number;
  useBonusActionEconomy?:boolean;
}

export function compileDevotionHolyNimbusActivation(request:DevotionHolyNimbusActivateRequest):PendingResolution {
  validateDevotion(request.paladinLevel,request.subclassId,20,"Holy Nimbus");
  if (!Number.isInteger(request.charismaModifier) || !Number.isInteger(request.proficiencyBonus) || request.proficiencyBonus < 0) {
    throw new DomainEvaluationError("Holy Nimbus requires integer Charisma modifier and proficiency bonus");
  }
  const operations:ResolutionOperation[] = [
    {
      id:`${request.id}:usage`,
      kind:"spend-resource",
      actorId:request.actorId,
      resourceId:DEVOTION_HOLY_NIMBUS_RESOURCE_ID,
      amount:1,
    },
  ];
  if (request.useBonusActionEconomy !== false) {
    operations.push({
      id:`${request.id}:bonus-action`,
      kind:"use-economy",
      actorId:request.actorId,
      slot:"bonus-action",
      bonusActionGranted:true,
      actionKind:"other",
    });
  }
  operations.push({
    id:`${request.id}:effect`,
    kind:"apply-effect",
    effect:{
      id:`${request.id}:${request.actorId}:holy-nimbus`,
      sourceId:DEVOTION_HOLY_NIMBUS_FEATURE_ID,
      sourceActorId:request.actorId,
      targetId:request.actorId,
      kind:"marker",
      tags:[DEVOTION_HOLY_NIMBUS_TAG],
      duration:{ kind:"minutes", amount:10 },
      termination:{ sourceBecomesIncapacitated:true, sourceDies:true },
      metadata:{
        charismaModifier:request.charismaModifier,
        proficiencyBonus:request.proficiencyBonus,
        sunlight:true,
      },
    },
  });
  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:DEVOTION_HOLY_NIMBUS_FEATURE_ID,
    expectedRevision:request.expectedRevision,
    operations,
  };
}

export function resolveDevotionHolyNimbusActivation(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:DevotionHolyNimbusActivateRequest,
):ResolutionCommit {
  try {
    return resolvePendingResolution(profile,inputState,compileDevotionHolyNimbusActivation(request));
  } catch (error) {
    return rejected(inputState,error);
  }
}

function holyNimbusEffect(state:RulesRuntimeState,paladinId:string) {
  return state.effects.find((effect) =>
    effect.sourceActorId === paladinId
    && effect.sourceId === DEVOTION_HOLY_NIMBUS_FEATURE_ID
    && effect.tags.includes(DEVOTION_HOLY_NIMBUS_TAG));
}

export function holyNimbusSavingThrowAdvantage(args:{
  state:RulesRuntimeState;
  paladinId:string;
  paladinLevel:number;
  subclassId?:string;
  paladinIncapacitated:boolean;
  relation:"self"|"ally"|"enemy"|"neutral";
  distanceFeet:number;
  sourceCreatureType:string;
}):RollStateContribution|undefined {
  validateDevotion(args.paladinLevel,args.subclassId,20,"Holy Nimbus");
  if (!holyNimbusEffect(args.state,args.paladinId) || args.paladinIncapacitated) return undefined;
  const radius = paladinAuraRadiusFeet(args.paladinLevel);
  if (args.distanceFeet > radius || (args.relation !== "self" && args.relation !== "ally")) return undefined;
  const type = args.sourceCreatureType.toLowerCase();
  if (type !== "fiend" && type !== "undead") return undefined;
  return { source:`${DEVOTION_HOLY_NIMBUS_FEATURE_ID}:holy-ward`, state:"advantage" };
}

export interface DevotionHolyNimbusTurnStartRequest {
  id:string;
  paladinId:string;
  targetId:string;
  expectedRevision:number;
  paladinLevel:number;
  subclassId?:string;
  paladinIncapacitated:boolean;
  relationToPaladin:"self"|"ally"|"enemy"|"neutral";
  distanceFeet:number;
  round:number;
  creatureKind:"character"|"monster";
  concentrationCheck?:Extract<ResolutionOperation,{kind:"damage"}>["concentrationCheck"];
}

export function resolveDevotionHolyNimbusTurnStart(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:DevotionHolyNimbusTurnStartRequest,
):ResolutionCommit {
  try {
    validateDevotion(request.paladinLevel,request.subclassId,20,"Holy Nimbus");
    const effect = holyNimbusEffect(inputState,request.paladinId);
    if (!effect) throw new DomainEvaluationError("Holy Nimbus is not active");
    if (!Number.isInteger(request.round) || request.round < 0) throw new DomainEvaluationError("round must be a non-negative integer");
    const radius = paladinAuraRadiusFeet(request.paladinLevel);
    const operations:ResolutionOperation[] = [{
      id:`${request.id}:begin-turn`,
      kind:"begin-turn",
      actorId:request.targetId,
      round:request.round,
    }];
    if (!request.paladinIncapacitated && request.relationToPaladin === "enemy" && request.distanceFeet <= radius) {
      const charismaModifier = effect.metadata?.charismaModifier;
      const proficiencyBonus = effect.metadata?.proficiencyBonus;
      if (typeof charismaModifier !== "number" || typeof proficiencyBonus !== "number") {
        throw new DomainEvaluationError("Holy Nimbus effect is missing damage metadata");
      }
      operations.push({
        id:`${request.id}:radiant-damage`,
        kind:"damage",
        targetId:request.targetId,
        damageType:"radiant",
        amount:Math.max(0,charismaModifier + proficiencyBonus),
        creatureKind:request.creatureKind,
        concentrationCheck:request.concentrationCheck,
      });
    }
    return resolvePendingResolution(profile,inputState,{
      id:request.id,
      actorId:request.targetId,
      sourceId:DEVOTION_HOLY_NIMBUS_FEATURE_ID,
      expectedRevision:request.expectedRevision,
      operations,
    });
  } catch (error) {
    return rejected(inputState,error);
  }
}

export interface DevotionHolyNimbusRecoverRequest {
  id:string;
  actorId:string;
  expectedRevision:number;
  paladinLevel:number;
  subclassId?:string;
  spellSlotLevel:number;
  spellSlotResourceId:string;
}

export function resolveDevotionHolyNimbusRecovery(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:DevotionHolyNimbusRecoverRequest,
):ResolutionCommit {
  try {
    validateDevotion(request.paladinLevel,request.subclassId,20,"Holy Nimbus recovery");
    if (request.spellSlotLevel !== 5) throw new DomainEvaluationError("Holy Nimbus recovery requires a level-5 spell slot");
    return resolvePendingResolution(profile,inputState,{
      id:request.id,
      actorId:request.actorId,
      sourceId:DEVOTION_HOLY_NIMBUS_FEATURE_ID,
      expectedRevision:request.expectedRevision,
      operations:[
        {
          id:`${request.id}:slot`,
          kind:"spend-resource",
          actorId:request.actorId,
          resourceId:request.spellSlotResourceId,
          amount:1,
        },
        {
          id:`${request.id}:recover`,
          kind:"gain-resource",
          actorId:request.actorId,
          resourceId:DEVOTION_HOLY_NIMBUS_RESOURCE_ID,
          amount:1,
        },
      ],
    });
  } catch (error) {
    return rejected(inputState,error);
  }
}

export function resolveDevotionHolyNimbusEnd(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:{ id:string; actorId:string; expectedRevision:number },
):ResolutionCommit {
  try {
    const effect = holyNimbusEffect(inputState,request.actorId);
    if (!effect) throw new DomainEvaluationError("Holy Nimbus is not active");
    return resolvePendingResolution(profile,inputState,{
      id:request.id,
      actorId:request.actorId,
      sourceId:DEVOTION_HOLY_NIMBUS_FEATURE_ID,
      expectedRevision:request.expectedRevision,
      operations:[{ id:`${request.id}:end`, kind:"remove-effect", effectId:effect.id }],
    });
  } catch (error) {
    return rejected(inputState,error);
  }
}
