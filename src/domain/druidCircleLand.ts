import type { FixedDiceInput } from "./d20";
import type { RulesRuntimeState } from "./combatState";
import { DRUID_WILD_SHAPE_RESOURCE_ID } from "./coreClassResources";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";
import type { TargetFacts } from "./targeting";

export const DRUID_CIRCLE_LAND_SUBCLASS_ID = "dnd.srd521.subclass.druid.circle-of-the-land";
export const DRUID_LANDS_AID_SOURCE = "feature:druid.circle-of-the-land.lands-aid";

export interface LandsAidDamageTarget {
  target: TargetFacts;
  distanceFromPointFeet: number;
  constitutionSaveModifier: number;
  saveDice: FixedDiceInput;
  creatureKind: "character" | "monster";
}

export interface LandsAidHealingTarget {
  target: TargetFacts;
  distanceFromPointFeet: number;
}

export interface LandsAidRequest {
  id: string;
  actorId: string;
  expectedRevision: number;
  druidLevel: number;
  subclassId?: string;
  spellSaveDc: number;
  point: TargetFacts;
  damageTargets: LandsAidDamageTarget[];
  healingTarget?: LandsAidHealingTarget;
  damageFaces: number[];
  healingFaces: number[];
  wildShapeResourceId?: string;
  useActionEconomy: boolean;
}

export function landsAidDiceCount(druidLevel: number) {
  if (!Number.isInteger(druidLevel) || druidLevel < 3 || druidLevel > 20) {
    throw new DomainEvaluationError("Land's Aid requires Druid level 3-20");
  }
  if (druidLevel >= 14) return 4;
  if (druidLevel >= 10) return 3;
  return 2;
}

function validateRequest(request: LandsAidRequest) {
  if (request.subclassId !== DRUID_CIRCLE_LAND_SUBCLASS_ID) {
    throw new DomainEvaluationError("Land's Aid requires the Circle of the Land subclass");
  }
  const diceCount = landsAidDiceCount(request.druidLevel);
  if (!Number.isFinite(request.spellSaveDc)) throw new DomainEvaluationError("Druid spell save DC must be finite");
  if (request.point.kind !== "point") throw new DomainEvaluationError("Land's Aid requires an authoritative point target");
  if (request.point.distanceFeet > 60) throw new DomainEvaluationError("Land's Aid point must be within 60 feet");
  if (request.point.distanceFeet < 0 || !Number.isFinite(request.point.distanceFeet)) {
    throw new DomainEvaluationError("Land's Aid point distance must be authoritative");
  }
  if (!request.damageTargets.length && !request.healingTarget) {
    throw new DomainEvaluationError("Land's Aid requires at least one damage or healing target");
  }
  const damageIds = request.damageTargets.map((entry) => entry.target.id);
  if (new Set(damageIds).size !== damageIds.length) {
    throw new DomainEvaluationError("Land's Aid damage targets must be unique");
  }
  for (const entry of request.damageTargets) {
    if (entry.target.kind !== "creature") throw new DomainEvaluationError(`Land's Aid damage target must be a creature: ${entry.target.id}`);
    if (!Number.isFinite(entry.distanceFromPointFeet) || entry.distanceFromPointFeet < 0 || entry.distanceFromPointFeet > 10) {
      throw new DomainEvaluationError(`Land's Aid damage target must be inside the 10-foot sphere: ${entry.target.id}`);
    }
    if (!Number.isFinite(entry.constitutionSaveModifier)) {
      throw new DomainEvaluationError(`Land's Aid Constitution save modifier must be finite: ${entry.target.id}`);
    }
  }
  if (request.healingTarget) {
    if (request.healingTarget.target.kind !== "creature") throw new DomainEvaluationError("Land's Aid healing target must be a creature");
    if (!Number.isFinite(request.healingTarget.distanceFromPointFeet)
      || request.healingTarget.distanceFromPointFeet < 0
      || request.healingTarget.distanceFromPointFeet > 10) {
      throw new DomainEvaluationError("Land's Aid healing target must be inside the 10-foot sphere");
    }
  }
  if (request.damageFaces.length < diceCount) throw new DomainEvaluationError(`Land's Aid requires ${diceCount} fixed damage d6 faces`);
  if (request.healingTarget && request.healingFaces.length < diceCount) {
    throw new DomainEvaluationError(`Land's Aid requires ${diceCount} fixed healing d6 faces`);
  }
}

export function compileLandsAid(request: LandsAidRequest): PendingResolution {
  validateRequest(request);
  const diceCount = landsAidDiceCount(request.druidLevel);
  const damageRollId = `${request.id}:damage-roll`;
  const operations: ResolutionOperation[] = [
    {
      id:`${request.id}:point`,
      kind:"targeting",
      sourceId:request.actorId,
      rule:{
        kind:"point",
        rangeFeet:60,
        minTargets:1,
        maxTargets:1,
        allowedRelations:["neutral"],
        directTarget:false,
      },
      targets:[request.point],
    },
  ];

  if (request.damageTargets.length) {
    operations.push({
      id:`${request.id}:damage-targets`,
      kind:"targeting",
      sourceId:request.actorId,
      rule:{
        kind:"creature",
        minTargets:1,
        maxTargets:request.damageTargets.length,
        allowedRelations:["self","ally","enemy","neutral"],
        directTarget:false,
      },
      targets:request.damageTargets.map((entry) => entry.target),
      harmful:true,
    });
  }
  if (request.healingTarget) {
    operations.push({
      id:`${request.id}:healing-target`,
      kind:"targeting",
      sourceId:request.actorId,
      rule:{
        kind:"creature",
        minTargets:1,
        maxTargets:1,
        allowedRelations:["self","ally","enemy","neutral"],
        directTarget:false,
      },
      targets:[request.healingTarget.target],
    });
  }
  if (request.useActionEconomy) {
    operations.push({
      id:`${request.id}:action`,
      kind:"use-economy",
      actorId:request.actorId,
      slot:"action",
      actionKind:"magic",
    });
  }
  operations.push({
    id:`${request.id}:wild-shape`,
    kind:"spend-resource",
    actorId:request.actorId,
    resourceId:request.wildShapeResourceId ?? DRUID_WILD_SHAPE_RESOURCE_ID,
    amount:1,
  });

  if (request.damageTargets.length) {
    operations.push({
      id:damageRollId,
      kind:"damage-roll",
      request:{
        dice:[{
          source:DRUID_LANDS_AID_SOURCE,
          count:diceCount,
          sides:6,
          faces:request.damageFaces,
        }],
        flat:[],
      },
    });
    request.damageTargets.forEach((entry,index) => {
      const saveId = `${request.id}:save:${index}`;
      operations.push(
        {
          id:saveId,
          kind:"d20",
          actorId:entry.target.id,
          targetId:entry.target.id,
          request:{
            family:"saving-throw",
            target:request.spellSaveDc,
            modifierContributions:[{
              source:`target:${entry.target.id}:constitution-save`,
              value:entry.constitutionSaveModifier,
            }],
            dice:entry.saveDice,
            targetSource:`${DRUID_LANDS_AID_SOURCE}:spell-save-dc`,
          },
          condition:{ ability:"con" },
        },
        {
          id:`${request.id}:damage-failure:${index}`,
          kind:"damage",
          when:{ operationId:saveId, field:"outcome", equals:"failure" },
          targetId:entry.target.id,
          damageType:"necrotic",
          amount:{ operationId:damageRollId, field:"total" },
          creatureKind:entry.creatureKind,
        },
        {
          id:`${request.id}:damage-success:${index}`,
          kind:"damage",
          when:{ operationId:saveId, field:"outcome", equals:"success" },
          targetId:entry.target.id,
          damageType:"necrotic",
          amount:{ operationId:damageRollId, field:"total", multiplier:0.5, rounding:"floor" },
          creatureKind:entry.creatureKind,
        },
      );
    });
  }

  if (request.healingTarget) {
    const healingRollId = `${request.id}:healing-roll`;
    operations.push(
      {
        id:healingRollId,
        kind:"damage-roll",
        request:{
          dice:[{
            source:`${DRUID_LANDS_AID_SOURCE}:healing`,
            count:diceCount,
            sides:6,
            faces:request.healingFaces,
          }],
          flat:[],
        },
      },
      {
        id:`${request.id}:healing`,
        kind:"healing",
        targetId:request.healingTarget.target.id,
        amount:{ operationId:healingRollId, field:"total" },
      },
    );
  }

  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:DRUID_LANDS_AID_SOURCE,
    expectedRevision:request.expectedRevision,
    operations,
  };
}

export function resolveLandsAid(
  profile: RulesProfileLike,
  inputState: RulesRuntimeState,
  request: LandsAidRequest,
): ResolutionCommit {
  try {
    return resolvePendingResolution(profile,inputState,compileLandsAid(request));
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
