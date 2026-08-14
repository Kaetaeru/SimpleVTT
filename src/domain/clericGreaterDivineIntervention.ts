import type { RulesRuntimeState } from "./combatState";
import { CLERIC_DIVINE_INTERVENTION_RESOURCE_ID } from "./coreClassResources";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { ResolutionCommit, ResolutionOperation } from "./resolutionTypes";

export const CLERIC_GREATER_DIVINE_INTERVENTION_SOURCE = "feature:cleric.greater-divine-intervention";
export const CLERIC_GREATER_DIVINE_INTERVENTION_WISH_LOCKOUT_SOURCE = "feature:cleric.greater-divine-intervention.wish-lockout";

export interface GreaterDivineInterventionWishLockoutRequest {
  id:string;
  actorId:string;
  expectedRevision:number;
  clericLevel:number;
  d4Faces:[number,number];
  divineInterventionResourceId?:string;
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
