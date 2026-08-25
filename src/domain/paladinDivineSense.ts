import type { RulesRuntimeState } from "./combatState";
import { activeConditionIds } from "./conditions";
import { conditionEffectsFor, requireCombatant } from "./combatState";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";
import { PALADIN_CHANNEL_DIVINITY_RESOURCE_ID } from "./coreClassResources";

export const DIVINE_SENSE_SOURCE_ID = "feature:paladin.channel-divinity.divine-sense";
export const DIVINE_SENSE_TAG = "paladin:divine-sense";

export interface DivineSenseActivationRequest {
  id: string;
  actorId: string;
  expectedRevision: number;
  paladinLevel: number;
  channelDivinityResourceId?: string;
  useBonusAction?: boolean;
}

export interface DivineSenseCreatureFact {
  id: string;
  distanceFeet: number;
  creatureType: string;
  location: string;
}

export interface DivineSenseSanctityFact {
  id: string;
  distanceFeet: number;
  sanctity: "consecrated" | "desecrated" | "ordinary";
}

export interface DivineSenseAwareness {
  active: boolean;
  creatures: Array<{
    id: string;
    creatureType: "celestial" | "fiend" | "undead";
    location: string;
  }>;
  consecratedPresence: boolean;
  desecratedPresence: boolean;
}

function validatePaladinLevel(level: number) {
  if (!Number.isInteger(level) || level < 3 || level > 20) {
    throw new DomainEvaluationError("Divine Sense requires Paladin level 3-20");
  }
}

function validateDistance(distanceFeet: number) {
  if (!Number.isFinite(distanceFeet) || distanceFeet < 0) {
    throw new DomainEvaluationError("Divine Sense fact distance must be non-negative and finite");
  }
}

export function compileDivineSense(request: DivineSenseActivationRequest): PendingResolution {
  validatePaladinLevel(request.paladinLevel);
  const operations: ResolutionOperation[] = [
    ...(request.useBonusAction===false?[]:[{
      id:`${request.id}:bonus-action`,
      kind:"use-economy" as const,
      actorId:request.actorId,
      slot:"bonus-action" as const,
      bonusActionGranted:true,
    }]),
    {
      id:`${request.id}:channel-divinity`,
      kind:"spend-resource",
      actorId:request.actorId,
      resourceId:request.channelDivinityResourceId ?? PALADIN_CHANNEL_DIVINITY_RESOURCE_ID,
      amount:1,
    },
    {
      id:`${request.id}:awareness`,
      kind:"apply-effect",
      effect:{
        id:`${request.id}:awareness`,
        sourceId:DIVINE_SENSE_SOURCE_ID,
        sourceActorId:request.actorId,
        targetId:request.actorId,
        kind:"marker",
        tags:[DIVINE_SENSE_TAG],
        duration:{ kind:"minutes", amount:10 },
        termination:{
          targetBecomesIncapacitated:true,
          targetDies:true,
        },
        metadata:{ radiusFeet:60 },
      },
    },
  ];
  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:DIVINE_SENSE_SOURCE_ID,
    expectedRevision:request.expectedRevision,
    operations,
  };
}

export function resolveDivineSenseActivation(
  profile: RulesProfileLike,
  inputState: RulesRuntimeState,
  request: DivineSenseActivationRequest,
): ResolutionCommit {
  try {
    return resolvePendingResolution(profile, inputState, compileDivineSense(request));
  } catch (error) {
    return {
      status:"rejected",
      state:inputState,
      events:[],
      results:{},
      error:error instanceof Error ? error.message : String(error),
    };
  }
}

export function divineSenseAwareness(
  state: RulesRuntimeState,
  actorId: string,
  creatures: DivineSenseCreatureFact[],
  sanctityFacts: DivineSenseSanctityFact[],
): DivineSenseAwareness {
  const actor = requireCombatant(state, actorId);
  const incapacitated = actor.life.unconscious
    || actor.life.dead
    || activeConditionIds(conditionEffectsFor(state, actorId)).includes("incapacitated");
  const active = !incapacitated && state.effects.some((effect) =>
    effect.targetId === actorId
    && effect.sourceId === DIVINE_SENSE_SOURCE_ID
    && effect.tags.includes(DIVINE_SENSE_TAG),
  );
  if (!active) {
    return { active:false, creatures:[], consecratedPresence:false, desecratedPresence:false };
  }

  const detected = creatures.flatMap((fact) => {
    validateDistance(fact.distanceFeet);
    if (fact.distanceFeet > 60) return [];
    const creatureType = fact.creatureType.toLowerCase();
    if (creatureType !== "celestial" && creatureType !== "fiend" && creatureType !== "undead") return [];
    return [{
      id:fact.id,
      creatureType:creatureType as "celestial" | "fiend" | "undead",
      location:fact.location,
    }];
  });

  let consecratedPresence = false;
  let desecratedPresence = false;
  for (const fact of sanctityFacts) {
    validateDistance(fact.distanceFeet);
    if (fact.distanceFeet > 60) continue;
    if (fact.sanctity === "consecrated") consecratedPresence = true;
    if (fact.sanctity === "desecrated") desecratedPresence = true;
  }
  return { active:true, creatures:detected, consecratedPresence, desecratedPresence };
}
