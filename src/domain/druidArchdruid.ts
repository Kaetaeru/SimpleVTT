import { requireCombatant, type RulesRuntimeState } from "./combatState";
import {
  DRUID_NATURE_MAGICIAN_RESOURCE_ID,
  DRUID_WILD_SHAPE_RESOURCE_ID,
} from "./coreClassResources";
import { orderInitiative, type InitiativeEntry, type InitiativeGroup } from "./initiative";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit } from "./resolutionTypes";
import { findResource } from "./resources";

export const DRUID_ARCHDRUID_SOURCE = "feature:druid.archdruid";
export const DRUID_EVERGREEN_WILD_SHAPE_SOURCE = "feature:druid.archdruid.evergreen-wild-shape";
export const DRUID_NATURE_MAGICIAN_SOURCE = "feature:druid.archdruid.nature-magician";

function validateArchdruidLevel(level:number) {
  if (!Number.isInteger(level) || level !== 20) {
    throw new DomainEvaluationError("Archdruid resource mechanics require Druid level 20");
  }
}

export interface NatureMagicianRequest {
  id:string;
  actorId:string;
  expectedRevision:number;
  druidLevel:number;
  wildShapeUses:number;
  slotResourceIds:Partial<Record<number,string>>;
  wildShapeResourceId?:string;
  usageResourceId?:string;
}

export function natureMagicianSlotLevel(wildShapeUses:number) {
  if (!Number.isInteger(wildShapeUses) || wildShapeUses < 1 || wildShapeUses > 4) {
    throw new DomainEvaluationError("Nature Magician converts 1-4 Wild Shape uses");
  }
  return wildShapeUses * 2;
}

export function compileNatureMagician(request:NatureMagicianRequest):PendingResolution {
  validateArchdruidLevel(request.druidLevel);
  const slotLevel = natureMagicianSlotLevel(request.wildShapeUses);
  const slotResourceId = request.slotResourceIds[slotLevel];
  if (!slotResourceId) throw new DomainEvaluationError(`Nature Magician requires a mapped level ${slotLevel} spell-slot resource`);
  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:DRUID_NATURE_MAGICIAN_SOURCE,
    expectedRevision:request.expectedRevision,
    operations:[
      {
        id:`${request.id}:usage`,
        kind:"spend-resource",
        actorId:request.actorId,
        resourceId:request.usageResourceId ?? DRUID_NATURE_MAGICIAN_RESOURCE_ID,
        amount:1,
      },
      {
        id:`${request.id}:wild-shape`,
        kind:"spend-resource",
        actorId:request.actorId,
        resourceId:request.wildShapeResourceId ?? DRUID_WILD_SHAPE_RESOURCE_ID,
        amount:request.wildShapeUses,
      },
      {
        id:`${request.id}:spell-slot-${slotLevel}`,
        kind:"gain-resource",
        actorId:request.actorId,
        resourceId:slotResourceId,
        amount:1,
        maximumDelta:1,
        temporaryCapacityUntilLongRest:true,
      },
    ],
  };
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

export function resolveNatureMagician(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:NatureMagicianRequest,
):ResolutionCommit {
  try {
    validateArchdruidLevel(request.druidLevel);
    if (request.expectedRevision !== inputState.revision) {
      return rejected(inputState,`revision mismatch: expected ${request.expectedRevision}, current ${inputState.revision}`);
    }
    const actor = requireCombatant(inputState,request.actorId);
    const wildShape = findResource(actor.resources,request.wildShapeResourceId ?? DRUID_WILD_SHAPE_RESOURCE_ID).pool;
    if (wildShape.current < request.wildShapeUses) {
      return rejected(inputState,`Nature Magician requires ${request.wildShapeUses} unexpended Wild Shape uses`);
    }
    return resolvePendingResolution(profile,inputState,compileNatureMagician(request));
  } catch (error) {
    return rejected(inputState,error);
  }
}

export interface ArchdruidInitiativeRequest {
  id:string;
  actorId:string;
  expectedRevision:number;
  druidLevel:number;
  entries:InitiativeEntry[];
  wildShapeResourceId?:string;
}

export type ArchdruidInitiativeResolution =
  | { status:"committed"; state:RulesRuntimeState; initiative:InitiativeGroup[]; restoredWildShape:boolean }
  | { status:"rejected"; state:RulesRuntimeState; initiative:[]; restoredWildShape:false; error:string };

export function resolveArchdruidInitiative(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:ArchdruidInitiativeRequest,
):ArchdruidInitiativeResolution {
  try {
    validateArchdruidLevel(request.druidLevel);
    if (request.expectedRevision !== inputState.revision) {
      throw new DomainEvaluationError(`revision mismatch: expected ${request.expectedRevision}, current ${inputState.revision}`);
    }
    if (!request.entries.some((entry) => entry.id === request.actorId)) {
      throw new DomainEvaluationError("Archdruid Evergreen Wild Shape requires the actor to roll Initiative");
    }
    const initiative = orderInitiative(request.entries);
    const actor = requireCombatant(inputState,request.actorId);
    const wildShapeId = request.wildShapeResourceId ?? DRUID_WILD_SHAPE_RESOURCE_ID;
    const wildShape = findResource(actor.resources,wildShapeId).pool;
    if (wildShape.current !== 0) {
      return { status:"committed", state:inputState, initiative, restoredWildShape:false };
    }
    const commit = resolvePendingResolution(profile,inputState,{
      id:request.id,
      actorId:request.actorId,
      sourceId:DRUID_EVERGREEN_WILD_SHAPE_SOURCE,
      expectedRevision:request.expectedRevision,
      operations:[{
        id:`${request.id}:wild-shape`,
        kind:"gain-resource",
        actorId:request.actorId,
        resourceId:wildShapeId,
        amount:1,
      }],
    });
    if (commit.status === "rejected") {
      return { status:"rejected", state:inputState, initiative:[], restoredWildShape:false, error:commit.error };
    }
    return { status:"committed", state:commit.state, initiative, restoredWildShape:true };
  } catch (error) {
    return {
      status:"rejected",
      state:inputState,
      initiative:[],
      restoredWildShape:false,
      error:error instanceof Error ? error.message : String(error),
    };
  }
}
