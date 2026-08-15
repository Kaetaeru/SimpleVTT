import type { RulesRuntimeState } from "./combatState";
import { CLERIC_DIVINE_INTERVENTION_RESOURCE_ID } from "./coreClassResources";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";
import {
  compileSpellCast,
  type SpellCasterContext,
  type SpellCastDiceInput,
  type SpellCastResolution,
  type SpellCastTarget,
  type SpellMechanicDefinition,
} from "./spellcasting";

export const CLERIC_GREATER_DIVINE_INTERVENTION_SOURCE = "feature:cleric.greater-divine-intervention";
export const CLERIC_GREATER_DIVINE_INTERVENTION_WISH_SOURCE = "feature:cleric.greater-divine-intervention.wish";
export const CLERIC_GREATER_DIVINE_INTERVENTION_WISH_LOCKOUT_SOURCE = "feature:cleric.greater-divine-intervention.wish-lockout";
export const WISH_SPELL_ID = "dnd.srd521.spell.wish";

export interface GreaterDivineInterventionWishLockoutRequest {
  id:string;
  actorId:string;
  expectedRevision:number;
  clericLevel:number;
  d4Faces:[number,number];
  divineInterventionResourceId?:string;
}

export interface GreaterDivineInterventionWishCopyRequest extends GreaterDivineInterventionWishLockoutRequest {
  copiedSpellId:string;
  caster:SpellCasterContext;
  targets:SpellCastTarget[];
  wishNonMaterialComponentsSatisfied:boolean;
  useActionEconomy:boolean;
  dice:SpellCastDiceInput;
  projectileAllocations?:Array<{ targetId:string; count:number }>;
}

function validateFaces(faces:readonly number[]) {
  if (faces.length !== 2 || faces.some((face) => !Number.isInteger(face) || face < 1 || face > 4)) {
    throw new DomainEvaluationError("Greater Divine Intervention Wish lockout requires exactly two authoritative d4 faces");
  }
}

export function greaterDivineInterventionLockoutLongRests(d4Faces:readonly number[]) {
  validateFaces(d4Faces);
  return d4Faces[0] + d4Faces[1];
}

export function greaterDivineInterventionWishLockoutOperations(args:{
  id:string;
  actorId:string;
  clericLevel:number;
  d4Faces:[number,number];
  divineInterventionResourceId?:string;
}):ResolutionOperation[] {
  if (!Number.isInteger(args.clericLevel) || args.clericLevel !== 20) {
    throw new DomainEvaluationError("Greater Divine Intervention requires Cleric level 20");
  }
  const rests = greaterDivineInterventionLockoutLongRests(args.d4Faces);
  return [
    {
      id:`${args.id}:lockout-roll`,
      kind:"damage-roll",
      request:{
        dice:[{
          source:CLERIC_GREATER_DIVINE_INTERVENTION_WISH_LOCKOUT_SOURCE,
          count:2,
          sides:4,
          faces:[...args.d4Faces],
        }],
        flat:[],
      },
    },
    {
      id:`${args.id}:lockout`,
      kind:"set-resource-recovery-lockout",
      actorId:args.actorId,
      resourceId:args.divineInterventionResourceId ?? CLERIC_DIVINE_INTERVENTION_RESOURCE_ID,
      trigger:"longRest",
      rests,
    },
  ];
}

function validateWishCopy(definition:SpellMechanicDefinition,request:GreaterDivineInterventionWishCopyRequest) {
  if (!Number.isInteger(request.clericLevel) || request.clericLevel !== 20) {
    throw new DomainEvaluationError("Greater Divine Intervention Wish requires Cleric level 20");
  }
  validateFaces(request.d4Faces);
  if (definition.spellId !== request.copiedSpellId) {
    throw new DomainEvaluationError("Wish copied-spell definition mismatch");
  }
  if (!Number.isInteger(definition.baseLevel) || definition.baseLevel < 0 || definition.baseLevel > 8) {
    throw new DomainEvaluationError("Wish basic spell replication requires a spell of level 8 or lower");
  }
  if (definition.runtimeSupport !== "combat-executable") {
    throw new DomainEvaluationError("Wish can only execute a copied spell whose mechanics are fully executable");
  }
  if (!request.wishNonMaterialComponentsSatisfied) {
    throw new DomainEvaluationError("Greater Divine Intervention still requires Wish's non-material component to be satisfied");
  }
}

function wishCopiedSpellRequest(request:GreaterDivineInterventionWishCopyRequest) {
  const featureSpellIds = [...new Set([...(request.caster.featureSpellIds ?? []),request.copiedSpellId])];
  const featureResourceIds = { ...(request.caster.featureResourceIds ?? {}) };
  delete featureResourceIds[request.copiedSpellId];
  return {
    id:request.id,
    actorId:request.actorId,
    spellId:request.copiedSpellId,
    source:"feature" as const,
    expectedRevision:request.expectedRevision,
    caster:{
      ...request.caster,
      featureSpellIds,
      featureResourceIds,
    },
    targets:request.targets,
    componentsSatisfied:true,
    useActionEconomy:false,
    dice:request.dice,
    projectileAllocations:request.projectileAllocations,
  };
}

export function compileGreaterDivineInterventionWishCopy(
  definition:SpellMechanicDefinition,
  inputState:RulesRuntimeState,
  request:GreaterDivineInterventionWishCopyRequest,
):PendingResolution {
  validateWishCopy(definition,request);
  const compilation = compileSpellCast(definition,inputState,wishCopiedSpellRequest(request));
  if (compilation.slotted || compilation.slotLevel !== undefined) {
    throw new DomainEvaluationError("Wish copied spell must execute without a spell slot");
  }
  const operations = structuredClone(compilation.pending.operations);
  const targetingIndex = operations.findIndex((operation) => operation.kind === "targeting");
  const insertionIndex = targetingIndex >= 0 ? targetingIndex + 1 : 0;
  const costs:ResolutionOperation[] = [];
  if (request.useActionEconomy) {
    costs.push({
      id:`${request.id}:greater-divine-intervention:action`,
      kind:"use-economy",
      actorId:request.actorId,
      slot:"action",
      actionKind:"magic",
    });
  }
  costs.push({
    id:`${request.id}:greater-divine-intervention:resource`,
    kind:"spend-resource",
    actorId:request.actorId,
    resourceId:request.divineInterventionResourceId ?? CLERIC_DIVINE_INTERVENTION_RESOURCE_ID,
    amount:1,
  });
  operations.splice(insertionIndex,0,...costs);
  operations.push(...greaterDivineInterventionWishLockoutOperations(request));
  return {
    ...compilation.pending,
    sourceId:CLERIC_GREATER_DIVINE_INTERVENTION_WISH_SOURCE,
    operations,
  };
}

function rejectedWishCopy(
  inputState:RulesRuntimeState,
  request:GreaterDivineInterventionWishCopyRequest,
  error:unknown,
  failedOperationId?:string,
):SpellCastResolution {
  return {
    status:"rejected",
    state:inputState,
    spellId:request.copiedSpellId,
    events:[],
    results:{},
    error:error instanceof Error ? error.message : String(error),
    failedOperationId,
  };
}

export function resolveGreaterDivineInterventionWishCopy(
  profile:RulesProfileLike,
  definition:SpellMechanicDefinition,
  inputState:RulesRuntimeState,
  request:GreaterDivineInterventionWishCopyRequest,
):SpellCastResolution {
  try {
    const pending = compileGreaterDivineInterventionWishCopy(definition,inputState,request);
    const commit = resolvePendingResolution(profile,inputState,pending);
    if (commit.status === "rejected") {
      return rejectedWishCopy(inputState,request,commit.error,commit.failedOperationId);
    }
    return {
      status:"committed",
      state:commit.state,
      spellId:request.copiedSpellId,
      events:commit.events,
      results:commit.results,
    };
  } catch (error) {
    return rejectedWishCopy(inputState,request,error);
  }
}

export function resolveGreaterDivineInterventionWishLockout(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  request:GreaterDivineInterventionWishLockoutRequest,
):ResolutionCommit {
  try {
    const operations = greaterDivineInterventionWishLockoutOperations(request);
    return resolvePendingResolution(profile,inputState,{
      id:request.id,
      actorId:request.actorId,
      sourceId:CLERIC_GREATER_DIVINE_INTERVENTION_WISH_LOCKOUT_SOURCE,
      expectedRevision:request.expectedRevision,
      operations,
    });
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
