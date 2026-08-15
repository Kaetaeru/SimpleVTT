import type { RulesRuntimeState } from "./combatState";
import type { DamageDefenseContribution } from "./damage";
import type { FixedDiceInput } from "./d20";
import type { ProgressionClassTrack } from "./progression";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";
import { WARLOCK_FIEND_SUBCLASS_ID } from "./srdSubclassCatalog";
import { WARLOCK_ID } from "./warlockProgressionChoices";

export const FIEND_DARK_ONES_OWN_LUCK_FEATURE_ID = "dnd.srd521.feature.warlock.fiend.dark-ones-own-luck";
export const FIEND_FIENDISH_RESILIENCE_FEATURE_ID = "dnd.srd521.feature.warlock.fiend.fiendish-resilience";
export const FIEND_HURL_THROUGH_HELL_FEATURE_ID = "dnd.srd521.feature.warlock.fiend.hurl-through-hell";
export const FIEND_DARK_ONES_OWN_LUCK_RESOURCE_ID = "resource:warlock.fiend.dark-ones-own-luck";
export const FIEND_HURL_THROUGH_HELL_RESOURCE_ID = "resource:warlock.fiend.hurl-through-hell";
export const FIEND_FIENDISH_RESILIENCE_TAG = "warlock:fiend:fiendish-resilience";
export const FIEND_HURL_THROUGH_HELL_TAG = "warlock:fiend:hurl-through-hell";
export const FIEND_HURL_USED_THIS_TURN_TAG = "warlock:fiend:hurl-through-hell:used-this-turn";
export const TEMPORARILY_UNAVAILABLE_TARGET_TAG = "runtime:temporarily-unavailable-target";

const FIENDISH_RESILIENCE_DAMAGE_TYPES = new Set([
  "acid","bludgeoning","cold","fire","lightning","necrotic","piercing","poison","psychic","radiant","slashing","thunder",
]);

export interface WarlockFiendRuntimeResourceDefinition {
  resourceId:string;
  label:string;
  maximum:number;
  source:string;
  recovery:{ longRest:"all" };
}

function charismaModifier(score:number) {
  if (!Number.isInteger(score) || score < 1 || score > 30) throw new DomainEvaluationError("Charisma score must be an integer from 1 to 30");
  return Math.floor((score - 10) / 2);
}

export function warlockFiendRuntimeResourceDefinitions(
  classTracks:ProgressionClassTrack[],
  subclassIds:Record<string,string> = {},
  charismaScore:number,
):WarlockFiendRuntimeResourceDefinition[] {
  const level = classTracks.find((track) => track.classId === WARLOCK_ID)?.level ?? 0;
  if (subclassIds[WARLOCK_ID] !== WARLOCK_FIEND_SUBCLASS_ID) return [];
  const definitions:WarlockFiendRuntimeResourceDefinition[] = [];
  if (level >= 6) {
    definitions.push({
      resourceId:FIEND_DARK_ONES_OWN_LUCK_RESOURCE_ID,
      label:"어둠의 존재의 행운",
      maximum:Math.max(1,charismaModifier(charismaScore)),
      source:`워락 ${level}레벨 · 악마 후원자 · 어둠의 존재의 행운 · SRD 5.2.1`,
      recovery:{ longRest:"all" },
    });
  }
  if (level >= 14) {
    definitions.push({
      resourceId:FIEND_HURL_THROUGH_HELL_RESOURCE_ID,
      label:"지옥으로 내던지기",
      maximum:1,
      source:`워락 ${level}레벨 · 악마 후원자 · 지옥으로 내던지기 · SRD 5.2.1`,
      recovery:{ longRest:"all" },
    });
  }
  return definitions;
}

function validateFiend(level:number,subclassId:string|undefined,minimumLevel:number,feature:string) {
  if (!Number.isInteger(level) || level < minimumLevel || level > 20) {
    throw new DomainEvaluationError(`${feature} requires Warlock level ${minimumLevel}-20`);
  }
  if (subclassId !== WARLOCK_FIEND_SUBCLASS_ID) throw new DomainEvaluationError(`${feature} requires the Fiend Patron subclass`);
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

export interface FiendDarkOnesOwnLuckRequest {
  id:string;
  actorId:string;
  expectedRevision:number;
  warlockLevel:number;
  subclassId?:string;
  family:"ability-check"|"saving-throw";
  initialTotal:number;
  target:number;
  d10Face:number;
}

export interface FiendDarkOnesOwnLuckResult {
  family:"ability-check"|"saving-throw";
  initialTotal:number;
  target:number;
  bonus:number;
  finalTotal:number;
  outcome:"success"|"failure";
}

function darkOnesOwnLuckResult(request:FiendDarkOnesOwnLuckRequest):FiendDarkOnesOwnLuckResult {
  if (!Number.isFinite(request.initialTotal) || !Number.isFinite(request.target)) {
    throw new DomainEvaluationError("Dark One's Own Luck totals must be finite");
  }
  if (!Number.isInteger(request.d10Face) || request.d10Face < 1 || request.d10Face > 10) {
    throw new DomainEvaluationError("Dark One's Own Luck requires one fixed d10 face from 1 to 10");
  }
  const finalTotal = request.initialTotal + request.d10Face;
  return {
    family:request.family,
    initialTotal:request.initialTotal,
    target:request.target,
    bonus:request.d10Face,
    finalTotal,
    outcome:finalTotal >= request.target ? "success" : "failure",
  };
}

export function compileFiendDarkOnesOwnLuck(request:FiendDarkOnesOwnLuckRequest):PendingResolution {
  validateFiend(request.warlockLevel,request.subclassId,6,"Dark One's Own Luck");
  darkOnesOwnLuckResult(request);
  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:FIEND_DARK_ONES_OWN_LUCK_FEATURE_ID,
    expectedRevision:request.expectedRevision,
    operations:[
      {
        id:`${request.id}:d10`,
        kind:"damage-roll",
        request:{ dice:[{ source:FIEND_DARK_ONES_OWN_LUCK_FEATURE_ID, count:1, sides:10, faces:[request.d10Face] }] },
      },
      {
        id:`${request.id}:usage`,
        kind:"spend-resource",
        actorId:request.actorId,
        resourceId:FIEND_DARK_ONES_OWN_LUCK_RESOURCE_ID,
        amount:1,
      },
    ],
  };
}

export function resolveFiendDarkOnesOwnLuck(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:FiendDarkOnesOwnLuckRequest,
):ResolutionCommit & { check?:FiendDarkOnesOwnLuckResult } {
  try {
    const check = darkOnesOwnLuckResult(request);
    const commit = resolvePendingResolution(profile,inputState,compileFiendDarkOnesOwnLuck(request));
    return { ...commit, check };
  } catch (error) {
    return rejected(inputState,error);
  }
}

export interface FiendishResilienceRequest {
  id:string;
  actorId:string;
  expectedRevision:number;
  warlockLevel:number;
  subclassId?:string;
  rest:"short"|"long";
  damageType:string;
}

export function resolveFiendishResilienceSelection(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:FiendishResilienceRequest,
):ResolutionCommit {
  try {
    validateFiend(request.warlockLevel,request.subclassId,10,"Fiendish Resilience");
    if (!FIENDISH_RESILIENCE_DAMAGE_TYPES.has(request.damageType)) {
      throw new DomainEvaluationError("Fiendish Resilience requires a standard non-force damage type");
    }
    const current = inputState.effects.filter((effect) =>
      effect.targetId === request.actorId
      && effect.sourceId === FIEND_FIENDISH_RESILIENCE_FEATURE_ID
      && effect.tags.includes(FIEND_FIENDISH_RESILIENCE_TAG));
    const operations:ResolutionOperation[] = current.map((effect,index) => ({
      id:`${request.id}:remove-old:${index}`,
      kind:"remove-effect",
      effectId:effect.id,
    }));
    operations.push({
      id:`${request.id}:resistance`,
      kind:"apply-effect",
      effect:{
        id:`${request.id}:${request.actorId}:${request.damageType}`,
        sourceId:FIEND_FIENDISH_RESILIENCE_FEATURE_ID,
        sourceActorId:request.actorId,
        targetId:request.actorId,
        kind:"marker",
        tags:[FIEND_FIENDISH_RESILIENCE_TAG,`damage-resistance:${request.damageType}`],
        duration:{ kind:"permanent" },
        metadata:{ damageType:request.damageType, selectedAfterRest:request.rest },
      },
    });
    return resolvePendingResolution(profile,inputState,{
      id:request.id,
      actorId:request.actorId,
      sourceId:FIEND_FIENDISH_RESILIENCE_FEATURE_ID,
      expectedRevision:request.expectedRevision,
      operations,
    });
  } catch (error) {
    return rejected(inputState,error);
  }
}

export function fiendishResilienceDefense(
  state:RulesRuntimeState,
  actorId:string,
  damageType:string,
):DamageDefenseContribution|undefined {
  const active = state.effects.some((effect) =>
    effect.targetId === actorId
    && effect.sourceId === FIEND_FIENDISH_RESILIENCE_FEATURE_ID
    && effect.tags.includes(`damage-resistance:${damageType}`));
  return active ? { source:FIEND_FIENDISH_RESILIENCE_FEATURE_ID, kind:"resistance", damageType } : undefined;
}

export interface FiendHurlThroughHellRequest {
  id:string;
  actorId:string;
  expectedRevision:number;
  warlockLevel:number;
  subclassId?:string;
  attackHit:boolean;
  targetId:string;
  targetCreatureKind:"character"|"monster";
  targetCreatureType:string;
  targetCharismaSaveModifier:number;
  spellSaveDc:number;
  saveDice:FixedDiceInput;
  psychicDamageFaces:number[];
  concentrationCheck?:Extract<ResolutionOperation,{kind:"damage"}>["concentrationCheck"];
}

export function compileFiendHurlThroughHell(
  inputState:RulesRuntimeState,
  request:FiendHurlThroughHellRequest,
):PendingResolution {
  validateFiend(request.warlockLevel,request.subclassId,14,"Hurl Through Hell");
  if (!request.attackHit) throw new DomainEvaluationError("Hurl Through Hell requires an attack roll that hit a creature");
  if (!Number.isFinite(request.targetCharismaSaveModifier) || !Number.isFinite(request.spellSaveDc)) {
    throw new DomainEvaluationError("Hurl Through Hell requires finite Charisma save modifier and spell save DC");
  }
  if (request.psychicDamageFaces.length !== 8 || request.psychicDamageFaces.some((face) => !Number.isInteger(face) || face < 1 || face > 10)) {
    throw new DomainEvaluationError("Hurl Through Hell requires exactly eight fixed d10 psychic damage faces");
  }
  const activeTurnActorId = inputState.clock.activeActorId;
  if (!activeTurnActorId) throw new DomainEvaluationError("Hurl Through Hell requires an active combat turn");
  if (inputState.effects.some((effect) =>
    effect.targetId === request.actorId && effect.tags.includes(FIEND_HURL_USED_THIS_TURN_TAG))) {
    throw new DomainEvaluationError("Hurl Through Hell has already been used this turn");
  }
  const saveId = `${request.id}:save`;
  const operations:ResolutionOperation[] = [
    {
      id:`${request.id}:usage`,
      kind:"spend-resource",
      actorId:request.actorId,
      resourceId:FIEND_HURL_THROUGH_HELL_RESOURCE_ID,
      amount:1,
    },
    {
      id:`${request.id}:turn-gate`,
      kind:"apply-effect",
      effect:{
        id:`${request.id}:${request.actorId}:turn-gate`,
        sourceId:FIEND_HURL_THROUGH_HELL_FEATURE_ID,
        sourceActorId:request.actorId,
        targetId:request.actorId,
        kind:"marker",
        tags:[FIEND_HURL_USED_THIS_TURN_TAG],
        duration:{ kind:"until-turn-boundary", actorId:activeTurnActorId, round:inputState.clock.round, boundary:"end" },
      },
    },
    {
      id:saveId,
      kind:"d20",
      actorId:request.targetId,
      targetId:request.targetId,
      request:{
        family:"saving-throw",
        target:request.spellSaveDc,
        modifierContributions:[{ source:`target:${request.targetId}:charisma-save`, value:request.targetCharismaSaveModifier }],
        dice:request.saveDice,
        targetSource:`${FIEND_HURL_THROUGH_HELL_FEATURE_ID}:spell-save-dc`,
      },
      condition:{ ability:"cha" },
    },
    {
      id:`${request.id}:banishment`,
      kind:"apply-effect",
      when:{ operationId:saveId, field:"outcome", equals:"failure" },
      effect:{
        id:`${request.id}:${request.targetId}:banishment`,
        sourceId:FIEND_HURL_THROUGH_HELL_FEATURE_ID,
        sourceActorId:request.actorId,
        targetId:request.targetId,
        kind:"condition",
        conditionId:"incapacitated",
        tags:[FIEND_HURL_THROUGH_HELL_TAG,TEMPORARILY_UNAVAILABLE_TARGET_TAG],
        duration:{ kind:"rounds", amount:1, anchorActorId:request.actorId, boundary:"end" },
        metadata:{ returnSpace:"original-or-nearest-empty" },
      },
    },
  ];
  if (request.targetCreatureType.toLowerCase() !== "fiend") {
    const rollId = `${request.id}:psychic-roll`;
    operations.push(
      {
        id:rollId,
        kind:"damage-roll",
        when:{ operationId:saveId, field:"outcome", equals:"failure" },
        request:{ dice:[{ source:FIEND_HURL_THROUGH_HELL_FEATURE_ID, count:8, sides:10, faces:request.psychicDamageFaces }] },
      },
      {
        id:`${request.id}:psychic-damage`,
        kind:"damage",
        when:{ operationId:saveId, field:"outcome", equals:"failure" },
        targetId:request.targetId,
        damageType:"psychic",
        amount:{ operationId:rollId, field:"total" },
        creatureKind:request.targetCreatureKind,
        concentrationCheck:request.concentrationCheck,
      },
    );
  }
  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:FIEND_HURL_THROUGH_HELL_FEATURE_ID,
    expectedRevision:request.expectedRevision,
    operations,
  };
}

export function resolveFiendHurlThroughHell(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:FiendHurlThroughHellRequest,
):ResolutionCommit {
  try {
    return resolvePendingResolution(profile,inputState,compileFiendHurlThroughHell(inputState,request));
  } catch (error) {
    return rejected(inputState,error);
  }
}

export function resolveFiendHurlThroughHellRecovery(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:{
    id:string;
    actorId:string;
    expectedRevision:number;
    warlockLevel:number;
    subclassId?:string;
    pactMagicSlotResourceId:string;
  },
):ResolutionCommit {
  try {
    validateFiend(request.warlockLevel,request.subclassId,14,"Hurl Through Hell recovery");
    return resolvePendingResolution(profile,inputState,{
      id:request.id,
      actorId:request.actorId,
      sourceId:FIEND_HURL_THROUGH_HELL_FEATURE_ID,
      expectedRevision:request.expectedRevision,
      operations:[
        {
          id:`${request.id}:pact-slot`,
          kind:"spend-resource",
          actorId:request.actorId,
          resourceId:request.pactMagicSlotResourceId,
          amount:1,
        },
        {
          id:`${request.id}:recover`,
          kind:"gain-resource",
          actorId:request.actorId,
          resourceId:FIEND_HURL_THROUGH_HELL_RESOURCE_ID,
          amount:1,
        },
      ],
    });
  } catch (error) {
    return rejected(inputState,error);
  }
}
