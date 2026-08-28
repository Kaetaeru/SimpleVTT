import type { D20TestRequest } from "./d20";
import type { DamageDefenseContribution } from "./damage";
import type { DamageRollRequest } from "./damageRoll";
import type { AbilityKey } from "./conditions";
import type { ConcentrationCheckRequest } from "./concentration";
import type { EffectApplyRequest } from "./effects";
import type { HitDieSpend } from "./rest";
import type { ReactorOption } from "./reaction";
import type { TargetingFactInput, TargetingRule } from "./targeting";
import type { ActionUseKind, TurnSlot } from "./turnEconomy";
import type { ProvenanceRecord } from "./profileEngine";
import type { RulesRuntimeState } from "./combatState";
import type { RuntimeArtifactSpawnRequest, ZoneMembershipAuthority } from "./runtimeArtifact";
import type { RuntimeStateChange } from "./runtimeStateChange";
import type { TemporaryHpChoice } from "./temporaryHp";
import type { ResourceRecovery } from "./resources";

export type NumericOperand = number | {
  operationId: string;
  field: "total" | "diceTotal" | "finalDamage" | "restored";
  multiplier?: number;
  add?: number;
  rounding?: "floor" | "ceil" | "round";
};

export type OperationPredicate = {
  operationId: string;
  field: string;
} & (
  | { equals: string | number | boolean; greaterThan?: never }
  | { greaterThan: number; equals?: never }
);

interface OperationBase {
  id: string;
  when?: OperationPredicate;
}

export type ResolutionOperation =
  | (OperationBase & {
      kind: "targeting";
      sourceId?: string;
      rule: TargetingRule;
      targets: TargetingFactInput[];
      harmful?: boolean;
    })
  | (OperationBase & {
      kind: "use-economy";
      actorId?: string;
      slot: TurnSlot;
      bonusActionGranted?: boolean;
      actionKind?: ActionUseKind;
      attacksPerAction?:number;
    })
  | (OperationBase & {
      kind: "grant-extra-action";
      actorId?: string;
      grantId: string;
      allowsMagicAction: boolean;
    })
  | (OperationBase & {
      kind: "use-turn-feature";
      actorId?: string;
      featureId: string;
    })
  | (OperationBase & {
      kind: "move";
      actorId?: string;
      movementMode?:"walk"|"climb"|"swim"|"fly"|"crawl"|"jump";
      distanceFeet: number;
      distanceTraveledFeet?:number;
      destinationRef?:string;
      doesNotProvokeOpportunityAttacks?:boolean;
      destinationMovesCloserToVisibleFrighteningSource?: boolean;
      visibleSourceIds?: string[];
    })
  | (OperationBase & {
      kind:"free-move";
      actorId?:string;
      distanceFeet:number;
      maximumDistanceFeet:number;
      movementMode?:"teleport"|"push"|"pull"|"forced";
      destinationRef?:string;
      doesNotProvokeOpportunityAttacks?:boolean;
      destinationMovesCloserToVisibleFrighteningSource?:boolean;
      visibleSourceIds?:string[];
    })
  | (OperationBase & {
      kind: "spend-resource";
      actorId?: string;
      resourceId: string;
      amount: number;
    })
  | (OperationBase & {
      kind: "gain-resource";
      actorId?: string;
      resourceId: string;
      amount: number;
      maximumDelta?: number;
      temporaryCapacityUntilLongRest?: boolean;
      createIfMissing?: {
        label: string;
        recovery?: ResourceRecovery;
      };
    })
  | (OperationBase & {
      kind: "set-resource-recovery-lockout";
      actorId?: string;
      resourceId:string;
      trigger:"shortRest"|"longRest";
      rests:number;
    })
  | (OperationBase & {
      kind:"recharge-resource";
      actorId?:string;
      resourceId:string;
      timing:"turn-start";
      die:{sides:number;faces:number[]};
      succeedsOn:{minimum:number;maximum?:number};
    })
  | (OperationBase & {
      kind: "d20";
      actorId?: string;
      targetId?: string;
      request: D20TestRequest;
      cover?: {
        targetingOperationId: string;
        targetId: string;
        appliesTo: "ac" | "dexterity-save";
      };
      condition?: {
        ability?: AbilityKey;
        requiresSight?: boolean;
        requiresHearing?: boolean;
        socialInteraction?: boolean;
        distanceToTargetFeet?: number;
        actorCanSeeTarget?: boolean;
        targetCanSeeActor?: boolean;
        visibleSourceIds?: string[];
      };
    })
  | (OperationBase & {
      kind: "damage-roll";
      request: DamageRollRequest;
      criticalFrom?: string;
    })
  | (OperationBase & {
      kind: "damage";
      targetId: string;
      damageType: string;
      amount: NumericOperand;
      defenses?: DamageDefenseContribution[];
      creatureKind: "character" | "monster";
      criticalFrom?: string;
      concentrationCheck?: Omit<ConcentrationCheckRequest, "damage">;
    })
  | (OperationBase & {
      kind: "compound-damage";
      targetId: string;
      components: Array<{
        damageType: string;
        amount: NumericOperand;
        defenses?: DamageDefenseContribution[];
      }>;
      creatureKind: "character" | "monster";
      criticalFrom?: string;
      concentrationCheck?: Omit<ConcentrationCheckRequest, "damage">;
    })
  | (OperationBase & {
      kind: "healing";
      targetId: string;
      amount: NumericOperand;
    })
  | (OperationBase & {
      kind: "temporary-hp";
      targetId: string;
      amount: NumericOperand;
      source: string;
      choice?: TemporaryHpChoice;
    })
  | (OperationBase & {
      kind:"death-save";
      actorId?:string;
      dice:D20TestRequest["dice"];
      modifierContributions?:D20TestRequest["modifierContributions"];
      rollStateContributions?:D20TestRequest["rollStateContributions"];
    })
  | (OperationBase & {
      kind:"stabilize";
      targetId:string;
    })
  | (OperationBase & {
      kind: "apply-effect";
      effect: EffectApplyRequest;
    })
  | (OperationBase & {
      kind: "update-effect";
      effectId: string;
      metadataPatch: Record<string,string|number|boolean>;
    })
  | (OperationBase & {
      kind:"set-effect-suppression";
      effectId:string;
      suppressed:boolean;
      reason?:string;
      pauseDuration?:boolean;
    })
  | (OperationBase & {
      kind: "remove-effect";
      effectId: string;
    })
  | (OperationBase & {
      kind:"spawn-artifact";
      artifact:RuntimeArtifactSpawnRequest;
      zoneMembershipAuthority?:ZoneMembershipAuthority;
    })
  | (OperationBase & {
      kind:"update-artifact";
      artifactId:string;
      metadataPatch:Record<string,string|number|boolean>;
    })
  | (OperationBase & {
      kind:"damage-artifact";
      artifactId:string;
      damageType:string;
      amount:number;
    })
  | (OperationBase & {
      kind:"repair-artifact";
      artifactId:string;
      amount:number;
    })
  | (OperationBase & {
      kind:"relocate-artifact";
      artifactId:string;
      placementRef:string;
    })
  | (OperationBase & {
      kind:"set-artifact-controller";
      artifactId:string;
      controllerId:string;
    })
  | (OperationBase & {
      kind:"remove-artifact";
      artifactId:string;
    })
  | (OperationBase & {
      kind:"set-zone-membership";
      artifactId:string;
      authority:ZoneMembershipAuthority;
      memberId:string;
      present:boolean;
    })
  | (OperationBase & {
      kind: "start-concentration";
      actorId?: string;
      groupId: string;
      sourceId: string;
    })
  | (OperationBase & {
      kind: "end-concentration";
      actorId?: string;
      reason: string;
    })
  | (OperationBase & {
      kind: "reaction";
      reactorId: string;
      trigger: string;
      options: ReactorOption[];
      optionId: string;
    })
  | (OperationBase & {
      kind: "begin-turn";
      actorId: string;
      round: number;
    })
  | (OperationBase & {
      kind: "end-turn";
      actorId: string;
      round: number;
    })
  | (OperationBase & {
      kind: "advance-time";
      elapsedSeconds: number;
    })
  | (OperationBase & {
      kind: "short-rest";
      targetId: string;
      spends: HitDieSpend[];
      resourceRestoration?: {
        resourceId: string;
        amount: number;
        usageResourceId: string;
      };
      resourceRestorationBatch?: {
        restorations: Array<{
          resourceId: string;
          amount: number;
        }>;
        usageResourceId: string;
      };
    })
  | (OperationBase & {
      kind: "long-rest";
      targetId: string;
    });

export interface PendingResolution {
  id: string;
  actorId: string;
  sourceId: string;
  expectedRevision: number;
  operations: ResolutionOperation[];
}

export interface ResolutionEvent {
  id: string;
  resolutionId: string;
  operationId: string;
  kind: string;
  actorId: string;
  targetId?: string;
  summary: string;
  provenance: ProvenanceRecord[];
  stateChanges: RuntimeStateChange[];
  result: unknown;
}

export type ResolutionCommit =
  | {
      status: "committed";
      state: RulesRuntimeState;
      events: ResolutionEvent[];
      results: Record<string, unknown>;
    }
  | {
      status: "rejected";
      state: RulesRuntimeState;
      events: [];
      results: Record<string, never>;
      error: string;
      failedOperationId?: string;
    };
