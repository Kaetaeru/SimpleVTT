import { requireCombatant, type RulesRuntimeState } from "./combatState";
import type { RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";
import { findResource } from "./resources";
import {
  DRUID_WILD_RESURGENCE_LONG_REST_RESOURCE_ID,
  DRUID_WILD_RESURGENCE_TURN_RESOURCE_ID,
  DRUID_WILD_SHAPE_RESOURCE_ID,
} from "./coreClassResources";

export const WILD_RESURGENCE_SOURCE_ID = "feature:druid.wild-resurgence";

export type WildResurgenceRequest = {
  id: string;
  actorId: string;
  expectedRevision: number;
  druidLevel: number;
  wildShapeResourceId?: string;
  turnUseResourceId?: string;
  longRestUseResourceId?: string;
  slotResourceIds: Partial<Record<number,string>>;
} & (
  | { mode:"slot-to-wild-shape"; slotLevel:number }
  | { mode:"wild-shape-to-slot" }
);

function rejected(inputState: RulesRuntimeState, error: string): ResolutionCommit {
  return { status:"rejected", state:inputState, events:[], results:{}, error };
}

export function compileWildResurgence(request: WildResurgenceRequest): PendingResolution {
  if (!Number.isInteger(request.druidLevel) || request.druidLevel < 5 || request.druidLevel > 20) {
    throw new Error("Wild Resurgence requires Druid level 5-20");
  }
  const wildShapeResourceId = request.wildShapeResourceId ?? DRUID_WILD_SHAPE_RESOURCE_ID;
  const operations: ResolutionOperation[] = [];

  if (request.mode === "slot-to-wild-shape") {
    if (!Number.isInteger(request.slotLevel) || request.slotLevel < 1 || request.slotLevel > 9) {
      throw new Error("spell slot level must be 1-9");
    }
    const slotResourceId = request.slotResourceIds[request.slotLevel];
    if (!slotResourceId) throw new Error(`no spell slot resource mapped for level ${request.slotLevel}`);
    operations.push(
      {
        id:`${request.id}:spend-turn-use`,
        kind:"spend-resource",
        actorId:request.actorId,
        resourceId:request.turnUseResourceId ?? DRUID_WILD_RESURGENCE_TURN_RESOURCE_ID,
        amount:1,
      },
      {
        id:`${request.id}:spend-slot`,
        kind:"spend-resource",
        actorId:request.actorId,
        resourceId:slotResourceId,
        amount:1,
      },
      {
        id:`${request.id}:gain-wild-shape`,
        kind:"gain-resource",
        actorId:request.actorId,
        resourceId:wildShapeResourceId,
        amount:1,
      },
    );
  } else {
    const firstLevelSlot = request.slotResourceIds[1];
    if (!firstLevelSlot) throw new Error("no level 1 spell slot resource mapped");
    operations.push(
      {
        id:`${request.id}:spend-long-rest-use`,
        kind:"spend-resource",
        actorId:request.actorId,
        resourceId:request.longRestUseResourceId ?? DRUID_WILD_RESURGENCE_LONG_REST_RESOURCE_ID,
        amount:1,
      },
      {
        id:`${request.id}:spend-wild-shape`,
        kind:"spend-resource",
        actorId:request.actorId,
        resourceId:wildShapeResourceId,
        amount:1,
      },
      {
        id:`${request.id}:restore-level-1-slot`,
        kind:"gain-resource",
        actorId:request.actorId,
        resourceId:firstLevelSlot,
        amount:1,
      },
    );
  }

  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:WILD_RESURGENCE_SOURCE_ID,
    expectedRevision:request.expectedRevision,
    operations,
  };
}

export function resolveWildResurgence(
  profile: RulesProfileLike,
  inputState: RulesRuntimeState,
  request: WildResurgenceRequest,
): ResolutionCommit {
  try {
    if (request.expectedRevision !== inputState.revision) {
      return rejected(inputState, `revision mismatch: expected ${request.expectedRevision}, current ${inputState.revision}`);
    }
    const actor = requireCombatant(inputState, request.actorId);
    const wildShapeResourceId = request.wildShapeResourceId ?? DRUID_WILD_SHAPE_RESOURCE_ID;
    const wildShape = findResource(actor.resources, wildShapeResourceId).pool;
    if (request.mode === "slot-to-wild-shape" && wildShape.current !== 0) {
      return rejected(inputState, "Wild Resurgence can restore Wild Shape from a spell slot only when no Wild Shape uses remain");
    }
    return resolvePendingResolution(profile, inputState, compileWildResurgence(request));
  } catch (error) {
    return rejected(inputState, error instanceof Error ? error.message : String(error));
  }
}
