import type { RulesRuntimeState } from "./combatState";
import type { ConcentrationCheckRequest } from "./concentration";
import type { FixedDiceInput } from "./d20";
import type { ProgressionClassTrack } from "./progression";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";
import { MONK_OPEN_HAND_SUBCLASS_ID } from "./srdSubclassCatalog";

export const MONK_OPEN_HAND_CLASS_ID = "dnd.srd521.class.monk";
export const MONK_FOCUS_RESOURCE_ID = "resource:monk.focus-points";
export const OPEN_HAND_WHOLENESS_OF_BODY_FEATURE_ID = "dnd.srd521.feature.monk.open-hand.wholeness-of-body";
export const OPEN_HAND_FLEET_STEP_FEATURE_ID = "dnd.srd521.feature.monk.open-hand.fleet-step";
export const OPEN_HAND_QUIVERING_PALM_FEATURE_ID = "dnd.srd521.feature.monk.open-hand.quivering-palm";
export const OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID = "resource:monk.open-hand.wholeness-of-body";
export const OPEN_HAND_FLEET_STEP_JUMP_TAG = "monk:open-hand:fleet-step:jump-distance-doubled";
export const OPEN_HAND_QUIVERING_PALM_TAG = "monk:open-hand:quivering-palm";
export const STEP_OF_THE_WIND_SOURCE_ID = "dnd.srd521.feature.monk.step-of-the-wind";

export interface MonkOpenHandRuntimeResourceDefinition {
  resourceId:string;
  label:string;
  maximum:number;
  source:string;
  recovery:{ shortRest?:"all"; longRest:"all" };
}

function abilityModifier(score:number,label:string) {
  if (!Number.isInteger(score) || score < 1 || score > 30) {
    throw new DomainEvaluationError(`${label} score must be an integer from 1 to 30`);
  }
  return Math.floor((score - 10) / 2);
}

function monkLevel(classTracks:ProgressionClassTrack[]) {
  return classTracks.find((track) => track.classId === MONK_OPEN_HAND_CLASS_ID)?.level ?? 0;
}

export function monkOpenHandRuntimeResourceDefinitions(
  classTracks:ProgressionClassTrack[],
  subclassIds:Record<string,string> = {},
  wisdomScore:number,
):MonkOpenHandRuntimeResourceDefinition[] {
  const level = monkLevel(classTracks);
  const definitions:MonkOpenHandRuntimeResourceDefinition[] = [];
  if (level >= 2) {
    definitions.push({
      resourceId:MONK_FOCUS_RESOURCE_ID,
      label:"기 점수",
      maximum:level,
      source:`수도승 ${level}레벨 · 기 · SRD 5.2.1`,
      recovery:{ shortRest:"all", longRest:"all" },
    });
  }
  if (level >= 6 && subclassIds[MONK_OPEN_HAND_CLASS_ID] === MONK_OPEN_HAND_SUBCLASS_ID) {
    definitions.push({
      resourceId:OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID,
      label:"신체 완성",
      maximum:Math.max(1,abilityModifier(wisdomScore,"Wisdom")),
      source:`수도승 ${level}레벨 · 열린 손의 전사 · 신체 완성 · SRD 5.2.1`,
      recovery:{ longRest:"all" },
    });
  }
  return definitions;
}

export function monkMartialArtsDieSides(level:number) {
  if (!Number.isInteger(level) || level < 1 || level > 20) {
    throw new DomainEvaluationError("Monk level must be an integer from 1 to 20");
  }
  if (level >= 17) return 12;
  if (level >= 11) return 10;
  if (level >= 5) return 8;
  return 6;
}

function validateOpenHand(level:number,subclassId:string|undefined,minimumLevel:number,feature:string) {
  if (!Number.isInteger(level) || level < minimumLevel || level > 20) {
    throw new DomainEvaluationError(`${feature} requires Monk level ${minimumLevel}-20`);
  }
  if (subclassId !== MONK_OPEN_HAND_SUBCLASS_ID) {
    throw new DomainEvaluationError(`${feature} requires the Warrior of the Open Hand subclass`);
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

export interface OpenHandWholenessOfBodyRequest {
  id:string;
  actorId:string;
  expectedRevision:number;
  monkLevel:number;
  subclassId?:string;
  wisdomModifier:number;
  martialArtsDieFace:number;
  useBonusActionEconomy?:boolean;
}

export function compileOpenHandWholenessOfBody(request:OpenHandWholenessOfBodyRequest):PendingResolution {
  validateOpenHand(request.monkLevel,request.subclassId,6,"Wholeness of Body");
  if (!Number.isInteger(request.wisdomModifier) || request.wisdomModifier < -5 || request.wisdomModifier > 10) {
    throw new DomainEvaluationError("Wholeness of Body Wisdom modifier must be an integer from -5 to 10");
  }
  const dieSides = monkMartialArtsDieSides(request.monkLevel);
  if (!Number.isInteger(request.martialArtsDieFace) || request.martialArtsDieFace < 1 || request.martialArtsDieFace > dieSides) {
    throw new DomainEvaluationError(`Wholeness of Body requires a fixed d${dieSides} face`);
  }
  const rollId = `${request.id}:healing-roll`;
  const operations:ResolutionOperation[] = [];
  if (request.useBonusActionEconomy !== false) {
    operations.push({
      id:`${request.id}:economy`,
      kind:"use-economy",
      actorId:request.actorId,
      slot:"bonus-action",
      bonusActionGranted:true,
      actionKind:"other",
    });
  }
  operations.push(
    {
      id:`${request.id}:resource`,
      kind:"spend-resource",
      actorId:request.actorId,
      resourceId:OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID,
      amount:1,
    },
    {
      id:rollId,
      kind:"damage-roll",
      request:{
        dice:[{
          source:`${OPEN_HAND_WHOLENESS_OF_BODY_FEATURE_ID}:martial-arts-die`,
          count:1,
          sides:dieSides,
          faces:[request.martialArtsDieFace],
        }],
        flat:[{ source:`${OPEN_HAND_WHOLENESS_OF_BODY_FEATURE_ID}:wisdom`, value:request.wisdomModifier }],
      },
    },
    {
      id:`${request.id}:healing`,
      kind:"healing",
      targetId:request.actorId,
      amount:{ operationId:rollId, field:"total" },
    },
  );
  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:OPEN_HAND_WHOLENESS_OF_BODY_FEATURE_ID,
    expectedRevision:request.expectedRevision,
    operations,
  };
}

export function resolveOpenHandWholenessOfBody(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:OpenHandWholenessOfBodyRequest,
):ResolutionCommit {
  try {
    return resolvePendingResolution(profile,inputState,compileOpenHandWholenessOfBody(request));
  } catch (error) {
    return rejected(inputState,error);
  }
}

export interface OpenHandFleetStepRequest {
  id:string;
  actorId:string;
  expectedRevision:number;
  monkLevel:number;
  subclassId?:string;
  triggeringResolutionId:string;
  triggeringBonusActionSourceId:string;
  spendFocus:boolean;
  distanceFeet:number;
}

function validateFleetStepTrigger(inputState:RulesRuntimeState,request:OpenHandFleetStepRequest) {
  validateOpenHand(request.monkLevel,request.subclassId,11,"Fleet Step");
  if (inputState.clock.activeActorId !== request.actorId) {
    throw new DomainEvaluationError("Fleet Step requires the Monk's active turn");
  }
  const actor = inputState.combatants[request.actorId];
  if (!actor) throw new DomainEvaluationError(`combatant not found: ${request.actorId}`);
  if (actor.economy.bonusAction) {
    throw new DomainEvaluationError("Fleet Step requires a Bonus Action to have just been spent");
  }
  if (!request.triggeringResolutionId || !request.triggeringBonusActionSourceId) {
    throw new DomainEvaluationError("Fleet Step requires the authoritative triggering Bonus Action resolution and source");
  }
  if (request.triggeringBonusActionSourceId === STEP_OF_THE_WIND_SOURCE_ID) {
    throw new DomainEvaluationError("Fleet Step cannot trigger after Step of the Wind");
  }
  const actorHistory = inputState.history.filter((entry) => entry.actorId === request.actorId);
  const latestActorEvent = actorHistory[actorHistory.length - 1];
  if (!latestActorEvent || latestActorEvent.resolutionId !== request.triggeringResolutionId) {
    throw new DomainEvaluationError("Fleet Step must be used immediately after the triggering Bonus Action resolution");
  }
  const triggeringEconomy = actorHistory.find((entry) =>
    entry.resolutionId === request.triggeringResolutionId
    && entry.kind === "use-economy"
    && entry.summary.includes("spends bonus-action"));
  if (!triggeringEconomy) {
    throw new DomainEvaluationError("Fleet Step trigger did not spend a Bonus Action");
  }
  if (!Number.isFinite(request.distanceFeet) || request.distanceFeet < 0 || request.distanceFeet > actor.baseSpeed) {
    throw new DomainEvaluationError(`Fleet Step Dash movement must be between 0 and ${actor.baseSpeed} feet`);
  }
}

export function compileOpenHandFleetStep(inputState:RulesRuntimeState,request:OpenHandFleetStepRequest):PendingResolution {
  validateFleetStepTrigger(inputState,request);
  const actor = inputState.combatants[request.actorId];
  const operations:ResolutionOperation[] = [];
  if (request.spendFocus) {
    operations.push({
      id:`${request.id}:focus`,
      kind:"spend-resource",
      actorId:request.actorId,
      resourceId:MONK_FOCUS_RESOURCE_ID,
      amount:1,
    });
  }
  operations.push({
    id:`${request.id}:dash-movement`,
    kind:"free-move",
    actorId:request.actorId,
    distanceFeet:request.distanceFeet,
    maximumDistanceFeet:actor.baseSpeed,
    doesNotProvokeOpportunityAttacks:request.spendFocus,
  });
  if (request.spendFocus) {
    operations.push({
      id:`${request.id}:jump`,
      kind:"apply-effect",
      effect:{
        id:`${request.id}:jump`,
        sourceId:OPEN_HAND_FLEET_STEP_FEATURE_ID,
        sourceActorId:request.actorId,
        targetId:request.actorId,
        kind:"marker",
        tags:[OPEN_HAND_FLEET_STEP_JUMP_TAG],
        duration:{ kind:"until-turn-boundary", actorId:request.actorId, round:inputState.clock.round, boundary:"end" },
        metadata:{ jumpDistanceMultiplier:2 },
      },
    });
  }
  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:OPEN_HAND_FLEET_STEP_FEATURE_ID,
    expectedRevision:request.expectedRevision,
    operations,
  };
}

export function resolveOpenHandFleetStep(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:OpenHandFleetStepRequest,
):ResolutionCommit {
  try {
    return resolvePendingResolution(profile,inputState,compileOpenHandFleetStep(inputState,request));
  } catch (error) {
    return rejected(inputState,error);
  }
}

export interface OpenHandQuiveringPalmSeedRequest {
  id:string;
  actorId:string;
  targetId:string;
  expectedRevision:number;
  monkLevel:number;
  subclassId?:string;
  unarmedStrikeHit:boolean;
}

function quiveringPalmEffects(state:RulesRuntimeState,actorId:string) {
  return state.effects.filter((effect) => effect.sourceActorId === actorId && effect.tags.includes(OPEN_HAND_QUIVERING_PALM_TAG));
}

export function compileOpenHandQuiveringPalmSeed(
  inputState:RulesRuntimeState,
  request:OpenHandQuiveringPalmSeedRequest,
):PendingResolution {
  validateOpenHand(request.monkLevel,request.subclassId,17,"Quivering Palm");
  if (!request.unarmedStrikeHit) throw new DomainEvaluationError("Quivering Palm requires a hit with an Unarmed Strike");
  if (!request.targetId || request.targetId === request.actorId) throw new DomainEvaluationError("Quivering Palm requires another creature as the hit target");
  if (!inputState.combatants[request.actorId]) throw new DomainEvaluationError(`combatant not found: ${request.actorId}`);
  if (!inputState.combatants[request.targetId]) throw new DomainEvaluationError(`combatant not found: ${request.targetId}`);
  const operations:ResolutionOperation[] = [
    {
      id:`${request.id}:focus`,
      kind:"spend-resource",
      actorId:request.actorId,
      resourceId:MONK_FOCUS_RESOURCE_ID,
      amount:4,
    },
  ];
  for (const effect of quiveringPalmEffects(inputState,request.actorId)) {
    operations.push({ id:`${request.id}:replace:${effect.id}`, kind:"remove-effect", effectId:effect.id });
  }
  operations.push({
    id:`${request.id}:seed`,
    kind:"apply-effect",
    effect:{
      id:`${request.id}:seed`,
      sourceId:OPEN_HAND_QUIVERING_PALM_FEATURE_ID,
      sourceActorId:request.actorId,
      targetId:request.targetId,
      kind:"marker",
      tags:[OPEN_HAND_QUIVERING_PALM_TAG],
      duration:{ kind:"hours", amount:request.monkLevel * 24 },
      metadata:{ monkLevel:request.monkLevel },
    },
  });
  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:OPEN_HAND_QUIVERING_PALM_FEATURE_ID,
    expectedRevision:request.expectedRevision,
    operations,
  };
}

export function resolveOpenHandQuiveringPalmSeed(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:OpenHandQuiveringPalmSeedRequest,
):ResolutionCommit {
  try {
    return resolvePendingResolution(profile,inputState,compileOpenHandQuiveringPalmSeed(inputState,request));
  } catch (error) {
    return rejected(inputState,error);
  }
}

export interface OpenHandQuiveringPalmDetonationRequest {
  id:string;
  actorId:string;
  targetId:string;
  expectedRevision:number;
  monkLevel:number;
  subclassId?:string;
  activation:"action"|"replace-attack";
  samePlane:boolean;
  proficiencyBonus:number;
  wisdomModifier:number;
  targetConSaveModifier:number;
  saveDice:FixedDiceInput;
  forceDamageFaces:number[];
  creatureKind:"character"|"monster";
  concentrationCheck?:Omit<ConcentrationCheckRequest,"damage">;
}

function requireQuiveringPalmEffect(state:RulesRuntimeState,actorId:string,targetId:string) {
  const effect = quiveringPalmEffects(state,actorId).find((entry) => entry.targetId === targetId);
  if (!effect) throw new DomainEvaluationError("Quivering Palm target does not have the Monk's vibrations");
  return effect;
}

export function compileOpenHandQuiveringPalmDetonation(
  inputState:RulesRuntimeState,
  request:OpenHandQuiveringPalmDetonationRequest,
):PendingResolution {
  validateOpenHand(request.monkLevel,request.subclassId,17,"Quivering Palm");
  const effect = requireQuiveringPalmEffect(inputState,request.actorId,request.targetId);
  if (request.activation === "replace-attack") {
    throw new DomainEvaluationError("Quivering Palm attack-replacement activation requires Attack-sequence replacement support");
  }
  if (!request.samePlane) throw new DomainEvaluationError("Quivering Palm can be detonated only while the target is on the same plane");
  if (!Number.isInteger(request.proficiencyBonus) || request.proficiencyBonus < 2 || request.proficiencyBonus > 6) {
    throw new DomainEvaluationError("Quivering Palm proficiency bonus must be an integer from 2 to 6");
  }
  if (!Number.isInteger(request.wisdomModifier) || request.wisdomModifier < -5 || request.wisdomModifier > 10) {
    throw new DomainEvaluationError("Quivering Palm Wisdom modifier must be an integer from -5 to 10");
  }
  if (!Number.isFinite(request.targetConSaveModifier)) {
    throw new DomainEvaluationError("Quivering Palm target Constitution save modifier must be finite");
  }
  if (request.forceDamageFaces.length !== 10 || request.forceDamageFaces.some((face) => !Number.isInteger(face) || face < 1 || face > 12)) {
    throw new DomainEvaluationError("Quivering Palm requires exactly ten fixed d12 damage faces");
  }
  const saveDc = 8 + request.proficiencyBonus + request.wisdomModifier;
  const saveId = `${request.id}:save`;
  const rollId = `${request.id}:damage-roll`;
  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:OPEN_HAND_QUIVERING_PALM_FEATURE_ID,
    expectedRevision:request.expectedRevision,
    operations:[
      {
        id:`${request.id}:economy`,
        kind:"use-economy",
        actorId:request.actorId,
        slot:"action",
        actionKind:"other",
      },
      {
        id:rollId,
        kind:"damage-roll",
        request:{
          dice:[{
            source:OPEN_HAND_QUIVERING_PALM_FEATURE_ID,
            count:10,
            sides:12,
            faces:request.forceDamageFaces,
          }],
        },
      },
      {
        id:saveId,
        kind:"d20",
        actorId:request.targetId,
        targetId:request.actorId,
        request:{
          family:"saving-throw",
          target:saveDc,
          modifierContributions:[{ source:`target:${request.targetId}:con-save`, value:request.targetConSaveModifier }],
          dice:request.saveDice,
          targetSource:`${OPEN_HAND_QUIVERING_PALM_FEATURE_ID}:save-dc`,
        },
        condition:{ ability:"con" },
      },
      {
        id:`${request.id}:damage:failed-save`,
        kind:"damage",
        when:{ operationId:saveId, field:"outcome", equals:"failure" },
        targetId:request.targetId,
        damageType:"force",
        amount:{ operationId:rollId, field:"total" },
        creatureKind:request.creatureKind,
        concentrationCheck:request.concentrationCheck,
      },
      {
        id:`${request.id}:damage:successful-save`,
        kind:"damage",
        when:{ operationId:saveId, field:"outcome", equals:"success" },
        targetId:request.targetId,
        damageType:"force",
        amount:{ operationId:rollId, field:"total", multiplier:0.5, rounding:"floor" },
        creatureKind:request.creatureKind,
        concentrationCheck:request.concentrationCheck,
      },
      {
        id:`${request.id}:end`,
        kind:"remove-effect",
        effectId:effect.id,
      },
    ],
  };
}

export function resolveOpenHandQuiveringPalmDetonation(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:OpenHandQuiveringPalmDetonationRequest,
):ResolutionCommit {
  try {
    return resolvePendingResolution(profile,inputState,compileOpenHandQuiveringPalmDetonation(inputState,request));
  } catch (error) {
    return rejected(inputState,error);
  }
}

export interface OpenHandQuiveringPalmEndRequest {
  id:string;
  actorId:string;
  targetId:string;
  expectedRevision:number;
  monkLevel:number;
  subclassId?:string;
}

export function resolveOpenHandQuiveringPalmHarmlessEnd(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:OpenHandQuiveringPalmEndRequest,
):ResolutionCommit {
  try {
    validateOpenHand(request.monkLevel,request.subclassId,17,"Quivering Palm");
    const effect = requireQuiveringPalmEffect(inputState,request.actorId,request.targetId);
    return resolvePendingResolution(profile,inputState,{
      id:request.id,
      actorId:request.actorId,
      sourceId:OPEN_HAND_QUIVERING_PALM_FEATURE_ID,
      expectedRevision:request.expectedRevision,
      operations:[
        { id:`${request.id}:economy`, kind:"use-economy", actorId:request.actorId, slot:"action", actionKind:"other" },
        { id:`${request.id}:end`, kind:"remove-effect", effectId:effect.id },
      ],
    });
  } catch (error) {
    return rejected(inputState,error);
  }
}
