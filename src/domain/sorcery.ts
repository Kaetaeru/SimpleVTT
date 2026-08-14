import { requireCombatant, type RulesRuntimeState } from "./combatState";
import type { RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { HitDieSpend } from "./rest";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";

export const SORCERY_POINT_RESOURCE_ID = "resource:sorcery-points";
export const SORCEROUS_RESTORATION_USAGE_RESOURCE_ID = "resource:sorcerous-restoration";
export const FONT_OF_MAGIC_SOURCE_ID = "feature:sorcerer.font-of-magic";
export const SORCEROUS_RESTORATION_SOURCE_ID = "feature:sorcerer.sorcerous-restoration";

export const CREATED_SPELL_SLOT_COSTS = {
  1:{ sorceryPoints:2, minimumSorcererLevel:2 },
  2:{ sorceryPoints:3, minimumSorcererLevel:3 },
  3:{ sorceryPoints:5, minimumSorcererLevel:5 },
  4:{ sorceryPoints:6, minimumSorcererLevel:7 },
  5:{ sorceryPoints:7, minimumSorcererLevel:9 },
} as const;

export function sorceryPointMaximum(sorcererLevel: number) {
  if (!Number.isInteger(sorcererLevel) || sorcererLevel < 0 || sorcererLevel > 20) throw new Error("Sorcerer level must be an integer from 0 to 20");
  return sorcererLevel >= 2 ? sorcererLevel : 0;
}

export function sorcerousRestorationMaximum(sorcererLevel: number) {
  if (!Number.isInteger(sorcererLevel) || sorcererLevel < 0 || sorcererLevel > 20) throw new Error("Sorcerer level must be an integer from 0 to 20");
  return sorcererLevel >= 5 ? Math.floor(sorcererLevel / 2) : 0;
}

export type FontOfMagicRequest = {
  id: string;
  actorId: string;
  expectedRevision: number;
  sorcererLevel: number;
  sorceryPointResourceId?: string;
  slotResourceIds: Partial<Record<number,string>>;
} & (
  | { mode:"slot-to-points"; slotLevel:number }
  | { mode:"points-to-slot"; slotLevel:1|2|3|4|5 }
);

export function compileFontOfMagic(request: FontOfMagicRequest): PendingResolution {
  const maximum = sorceryPointMaximum(request.sorcererLevel);
  if (maximum <= 0) throw new Error("Font of Magic requires Sorcerer level 2 or higher");
  if (!Number.isInteger(request.slotLevel) || request.slotLevel < 1 || request.slotLevel > 9) throw new Error("spell slot level must be 1-9");
  const sorceryPointResourceId = request.sorceryPointResourceId ?? SORCERY_POINT_RESOURCE_ID;
  const operations: ResolutionOperation[] = [];

  if (request.mode === "slot-to-points") {
    const slotResourceId = request.slotResourceIds[request.slotLevel];
    if (!slotResourceId) throw new Error(`no spell slot resource mapped for level ${request.slotLevel}`);
    operations.push(
      {
        id:`${request.id}:spend-slot`,
        kind:"spend-resource",
        actorId:request.actorId,
        resourceId:slotResourceId,
        amount:1,
      },
      {
        id:`${request.id}:gain-sorcery-points`,
        kind:"gain-resource",
        actorId:request.actorId,
        resourceId:sorceryPointResourceId,
        amount:request.slotLevel,
      },
    );
  } else {
    const relationship = CREATED_SPELL_SLOT_COSTS[request.slotLevel];
    if (request.sorcererLevel < relationship.minimumSorcererLevel) {
      throw new Error(`creating a level ${request.slotLevel} spell slot requires Sorcerer level ${relationship.minimumSorcererLevel}`);
    }
    const slotResourceId = request.slotResourceIds[request.slotLevel] ?? `spell-slot-${request.slotLevel}`;
    operations.push(
      {
        id:`${request.id}:bonus-action`,
        kind:"use-economy",
        actorId:request.actorId,
        slot:"bonus-action",
        bonusActionGranted:true,
      },
      {
        id:`${request.id}:spend-sorcery-points`,
        kind:"spend-resource",
        actorId:request.actorId,
        resourceId:sorceryPointResourceId,
        amount:relationship.sorceryPoints,
      },
      {
        id:`${request.id}:create-slot`,
        kind:"gain-resource",
        actorId:request.actorId,
        resourceId:slotResourceId,
        amount:1,
        maximumDelta:1,
        temporaryCapacityUntilLongRest:true,
        createIfMissing:{
          label:`${request.slotLevel}레벨 주문 슬롯`,
          recovery:{ longRest:"all" },
        },
      },
    );
  }

  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:FONT_OF_MAGIC_SOURCE_ID,
    expectedRevision:request.expectedRevision,
    operations,
  };
}

export function resolveFontOfMagic(
  profile: RulesProfileLike,
  inputState: RulesRuntimeState,
  request: FontOfMagicRequest,
): ResolutionCommit {
  try {
    return resolvePendingResolution(profile, inputState, compileFontOfMagic(request));
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

export interface SorcerousRestorationRequest {
  id: string;
  actorId: string;
  expectedRevision: number;
  sorcererLevel: number;
  hitDieSpends?: HitDieSpend[];
  sorceryPointResourceId?: string;
  usageResourceId?: string;
}

export function compileSorcerousRestoration(
  inputState: RulesRuntimeState,
  request: SorcerousRestorationRequest,
): PendingResolution {
  const restoreLimit = sorcerousRestorationMaximum(request.sorcererLevel);
  if (restoreLimit <= 0) throw new Error("Sorcerous Restoration requires Sorcerer level 5 or higher");
  const actor = requireCombatant(inputState, request.actorId);
  const sorceryPointResourceId = request.sorceryPointResourceId ?? SORCERY_POINT_RESOURCE_ID;
  const usageResourceId = request.usageResourceId ?? SORCEROUS_RESTORATION_USAGE_RESOURCE_ID;
  const points = actor.resources.find((pool) => pool.id === sorceryPointResourceId);
  const usage = actor.resources.find((pool) => pool.id === usageResourceId);
  if (!points) throw new Error(`resource not found: ${sorceryPointResourceId}`);
  if (!usage) throw new Error(`resource not found: ${usageResourceId}`);
  if (usage.current < 1) throw new Error("Sorcerous Restoration has already been used since the last Long Rest");
  const amount = Math.min(restoreLimit, points.maximum - points.current);
  if (amount <= 0) throw new Error("no expended Sorcery Points to restore");
  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:SORCEROUS_RESTORATION_SOURCE_ID,
    expectedRevision:request.expectedRevision,
    operations:[{
      id:`${request.id}:short-rest`,
      kind:"short-rest",
      targetId:request.actorId,
      spends:request.hitDieSpends ?? [],
      resourceRestoration:{
        resourceId:sorceryPointResourceId,
        amount,
        usageResourceId,
      },
    }],
  };
}

export function resolveSorcerousRestoration(
  profile: RulesProfileLike,
  inputState: RulesRuntimeState,
  request: SorcerousRestorationRequest,
): ResolutionCommit {
  try {
    return resolvePendingResolution(profile, inputState, compileSorcerousRestoration(inputState, request));
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
