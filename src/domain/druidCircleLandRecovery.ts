import type { RulesRuntimeState } from "./combatState";
import { findResource, type ResourcePool } from "./resources";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit } from "./resolutionTypes";
import { stableSpellId } from "./spellListCatalog";
import {
  compileSpellCast,
  type SpellCastRequest,
  type SpellCastResolution,
  type SpellMechanicDefinition,
} from "./spellcasting";
import { DRUID_CIRCLE_LAND_SUBCLASS_ID } from "./druidCircleLand";

export type CircleLandType = "arid" | "polar" | "temperate" | "tropical";

export const DRUID_NATURAL_RECOVERY_CAST_RESOURCE_ID = "resource:druid.circle-land.natural-recovery.cast";
export const DRUID_NATURAL_RECOVERY_SLOTS_RESOURCE_ID = "resource:druid.circle-land.natural-recovery.slots";
export const DRUID_NATURAL_RECOVERY_CAST_SOURCE = "feature:druid.circle-of-the-land.natural-recovery.cast";
export const DRUID_NATURAL_RECOVERY_SLOTS_SOURCE = "feature:druid.circle-of-the-land.natural-recovery.slots";

interface CircleLandSpellRow {
  nameEn: string;
  spellLevel: number;
  unlockDruidLevel: 3 | 5 | 7 | 9;
}

const CIRCLE_LAND_SPELL_ROWS: Record<CircleLandType, CircleLandSpellRow[]> = {
  arid:[
    { nameEn:"Blur", spellLevel:2, unlockDruidLevel:3 },
    { nameEn:"Burning Hands", spellLevel:1, unlockDruidLevel:3 },
    { nameEn:"Fire Bolt", spellLevel:0, unlockDruidLevel:3 },
    { nameEn:"Fireball", spellLevel:3, unlockDruidLevel:5 },
    { nameEn:"Blight", spellLevel:4, unlockDruidLevel:7 },
    { nameEn:"Wall of Stone", spellLevel:5, unlockDruidLevel:9 },
  ],
  polar:[
    { nameEn:"Fog Cloud", spellLevel:1, unlockDruidLevel:3 },
    { nameEn:"Hold Person", spellLevel:2, unlockDruidLevel:3 },
    { nameEn:"Ray of Frost", spellLevel:0, unlockDruidLevel:3 },
    { nameEn:"Sleet Storm", spellLevel:3, unlockDruidLevel:5 },
    { nameEn:"Ice Storm", spellLevel:4, unlockDruidLevel:7 },
    { nameEn:"Cone of Cold", spellLevel:5, unlockDruidLevel:9 },
  ],
  temperate:[
    { nameEn:"Misty Step", spellLevel:2, unlockDruidLevel:3 },
    { nameEn:"Shocking Grasp", spellLevel:0, unlockDruidLevel:3 },
    { nameEn:"Sleep", spellLevel:1, unlockDruidLevel:3 },
    { nameEn:"Lightning Bolt", spellLevel:3, unlockDruidLevel:5 },
    { nameEn:"Freedom of Movement", spellLevel:4, unlockDruidLevel:7 },
    { nameEn:"Tree Stride", spellLevel:5, unlockDruidLevel:9 },
  ],
  tropical:[
    { nameEn:"Acid Splash", spellLevel:0, unlockDruidLevel:3 },
    { nameEn:"Ray of Sickness", spellLevel:1, unlockDruidLevel:3 },
    { nameEn:"Web", spellLevel:2, unlockDruidLevel:3 },
    { nameEn:"Stinking Cloud", spellLevel:3, unlockDruidLevel:5 },
    { nameEn:"Polymorph", spellLevel:4, unlockDruidLevel:7 },
    { nameEn:"Insect Plague", spellLevel:5, unlockDruidLevel:9 },
  ],
};

export interface CircleLandSpellEntry extends CircleLandSpellRow {
  id: string;
}

export function circleLandSpellEntries(landType: CircleLandType, druidLevel: number): CircleLandSpellEntry[] {
  if (!Number.isInteger(druidLevel) || druidLevel < 3 || druidLevel > 20) {
    throw new DomainEvaluationError("Circle of the Land spells require Druid level 3-20");
  }
  return CIRCLE_LAND_SPELL_ROWS[landType]
    .filter((entry) => entry.unlockDruidLevel <= druidLevel)
    .map((entry) => ({ ...entry, id:stableSpellId(entry.nameEn) }));
}

export function naturalRecoverySpellEntries(landType: CircleLandType, druidLevel: number) {
  if (druidLevel < 6) throw new DomainEvaluationError("Natural Recovery requires Druid level 6");
  return circleLandSpellEntries(landType,druidLevel).filter((entry) => entry.spellLevel >= 1);
}

function validateSubclass(druidLevel:number, subclassId:string|undefined) {
  if (!Number.isInteger(druidLevel) || druidLevel < 6 || druidLevel > 20) {
    throw new DomainEvaluationError("Natural Recovery requires Druid level 6-20");
  }
  if (subclassId !== DRUID_CIRCLE_LAND_SUBCLASS_ID) {
    throw new DomainEvaluationError("Natural Recovery requires the Circle of the Land subclass");
  }
}

export function naturalRecoveryResourcePools(druidLevel:number, subclassId?:string):ResourcePool[] {
  validateSubclass(druidLevel,subclassId);
  return [
    {
      id:DRUID_NATURAL_RECOVERY_CAST_RESOURCE_ID,
      label:"Natural Recovery · Circle Spell",
      current:1,
      maximum:1,
      recovery:{ longRest:"all" },
    },
    {
      id:DRUID_NATURAL_RECOVERY_SLOTS_RESOURCE_ID,
      label:"Natural Recovery · Spell Slots",
      current:1,
      maximum:1,
      recovery:{ longRest:"all" },
    },
  ];
}

function rejectedSpell(inputState:RulesRuntimeState, request:SpellCastRequest, error:unknown, failedOperationId?:string):SpellCastResolution {
  return {
    status:"rejected",
    state:inputState,
    spellId:request.spellId,
    slotLevel:request.slotLevel,
    events:[],
    results:{},
    error:error instanceof Error ? error.message : String(error),
    failedOperationId,
  };
}

export function resolveNaturalRecoveryCircleSpell(
  profile:RulesProfileLike,
  definition:SpellMechanicDefinition,
  inputState:RulesRuntimeState,
  request:SpellCastRequest,
  context:{ druidLevel:number; subclassId?:string; landType:CircleLandType },
):SpellCastResolution {
  try {
    validateSubclass(context.druidLevel,context.subclassId);
    const eligible = naturalRecoverySpellEntries(context.landType,context.druidLevel);
    if (!eligible.some((entry) => entry.id === request.spellId)) {
      throw new DomainEvaluationError("Natural Recovery free casting requires a prepared level 1+ Circle Spell from the current land");
    }
    const caster = {
      ...request.caster,
      featureSpellIds:[...new Set([...(request.caster.featureSpellIds ?? []),request.spellId])],
      featureResourceIds:{
        ...(request.caster.featureResourceIds ?? {}),
        [request.spellId]:DRUID_NATURAL_RECOVERY_CAST_RESOURCE_ID,
      },
    };
    const featureRequest:SpellCastRequest = {
      ...request,
      source:"feature",
      slotLevel:undefined,
      caster,
    };
    const compilation = compileSpellCast(definition,inputState,featureRequest);
    if (compilation.slotted) throw new DomainEvaluationError("Natural Recovery Circle Spell must cast without a spell slot");
    const commit = resolvePendingResolution(profile,inputState,{
      ...compilation.pending,
      sourceId:DRUID_NATURAL_RECOVERY_CAST_SOURCE,
    });
    if (commit.status === "rejected") return rejectedSpell(inputState,request,commit.error,commit.failedOperationId);
    return {
      status:"committed",
      state:commit.state,
      spellId:request.spellId,
      events:commit.events,
      results:commit.results,
    };
  } catch (error) {
    return rejectedSpell(inputState,request,error);
  }
}

export interface NaturalRecoverySlotSelection {
  slotLevel: number;
  resourceId: string;
  amount: number;
}

export interface NaturalRecoverySlotRequest {
  id:string;
  actorId:string;
  expectedRevision:number;
  druidLevel:number;
  subclassId?:string;
  selections:NaturalRecoverySlotSelection[];
  usageResourceId?:string;
}

export function naturalRecoverySlotLevelBudget(druidLevel:number) {
  if (!Number.isInteger(druidLevel) || druidLevel < 6 || druidLevel > 20) {
    throw new DomainEvaluationError("Natural Recovery requires Druid level 6-20");
  }
  return Math.ceil(druidLevel / 2);
}

export function compileNaturalRecoverySlotRest(inputState:RulesRuntimeState, request:NaturalRecoverySlotRequest):PendingResolution {
  validateSubclass(request.druidLevel,request.subclassId);
  if (!request.selections.length) throw new DomainEvaluationError("Natural Recovery requires at least one expended spell slot selection");
  const resourceIds = request.selections.map((entry) => entry.resourceId);
  if (new Set(resourceIds).size !== resourceIds.length) {
    throw new DomainEvaluationError("Natural Recovery spell-slot resource selections must be unique");
  }
  let totalLevels = 0;
  for (const selection of request.selections) {
    if (!Number.isInteger(selection.slotLevel) || selection.slotLevel < 1 || selection.slotLevel > 5) {
      throw new DomainEvaluationError("Natural Recovery can recover only level 1-5 spell slots");
    }
    if (!Number.isInteger(selection.amount) || selection.amount < 1) {
      throw new DomainEvaluationError("Natural Recovery slot recovery amounts must be positive integers");
    }
    const pool = findResource(inputState.combatants[request.actorId]?.resources ?? [],selection.resourceId).pool;
    if (pool.maximum - pool.current < selection.amount) {
      throw new DomainEvaluationError(`Natural Recovery selection exceeds expended capacity: ${selection.resourceId}`);
    }
    totalLevels += selection.slotLevel * selection.amount;
  }
  const budget = naturalRecoverySlotLevelBudget(request.druidLevel);
  if (totalLevels > budget) {
    throw new DomainEvaluationError(`Natural Recovery spell-slot levels ${totalLevels} exceed budget ${budget}`);
  }

  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:DRUID_NATURAL_RECOVERY_SLOTS_SOURCE,
    expectedRevision:request.expectedRevision,
    operations:[{
      id:`${request.id}:short-rest`,
      kind:"short-rest",
      targetId:request.actorId,
      spends:[],
      resourceRestorationBatch:{
        usageResourceId:request.usageResourceId ?? DRUID_NATURAL_RECOVERY_SLOTS_RESOURCE_ID,
        restorations:request.selections.map((selection) => ({
          resourceId:selection.resourceId,
          amount:selection.amount,
        })),
      },
    }],
  };
}

export function resolveNaturalRecoverySlotRest(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:NaturalRecoverySlotRequest,
):ResolutionCommit {
  try {
    return resolvePendingResolution(profile,inputState,compileNaturalRecoverySlotRest(inputState,request));
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
