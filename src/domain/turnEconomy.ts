import { DomainEvaluationError } from "./profileEngine";

export type TurnSlot = "action" | "bonus-action" | "reaction";
export type ActionUseKind = "magic" | "other";

export interface ExtraActionGrant {
  id: string;
  source: string;
  allowsMagicAction: boolean;
}

export interface TurnEconomyState {
  action: boolean;
  bonusAction: boolean;
  reaction: boolean;
  movement: number;
  movementMaximum: number;
  extraActions: ExtraActionGrant[];
}

export interface TurnSlotSpendResolution {
  next: TurnEconomyState;
  spentFrom: "standard" | string;
}

export function beginTurn(speed: number): TurnEconomyState {
  if (!Number.isInteger(speed) || speed < 0) {
    throw new DomainEvaluationError("speed must be a non-negative integer");
  }
  return {
    action: true,
    bonusAction: true,
    reaction: true,
    movement: speed,
    movementMaximum: speed,
    extraActions: [],
  };
}

function compatibleExtraActionIndex(state: TurnEconomyState, actionKind: ActionUseKind) {
  const grants = state.extraActions ?? [];
  if (actionKind === "magic") return grants.findIndex((grant) => grant.allowsMagicAction);
  const restricted = grants.findIndex((grant) => !grant.allowsMagicAction);
  return restricted >= 0 ? restricted : grants.findIndex(() => true);
}

export function spendTurnSlot(
  state: TurnEconomyState,
  slot: TurnSlot,
  bonusActionGranted = false,
  actionKind: ActionUseKind = "other",
): TurnSlotSpendResolution {
  if (slot === "bonus-action" && !bonusActionGranted) {
    throw new DomainEvaluationError("bonus action requires an explicit granting rule");
  }

  if (slot === "action") {
    const extraIndex = compatibleExtraActionIndex(state, actionKind);
    if (actionKind === "other" && extraIndex >= 0) {
      const grant = state.extraActions[extraIndex];
      return {
        next:{ ...state, extraActions:state.extraActions.filter((_, index) => index !== extraIndex) },
        spentFrom:grant.id,
      };
    }
    if (state.action) return { next:{ ...state, action:false }, spentFrom:"standard" };
    if (extraIndex >= 0) {
      const grant = state.extraActions[extraIndex];
      return {
        next:{ ...state, extraActions:state.extraActions.filter((_, index) => index !== extraIndex) },
        spentFrom:grant.id,
      };
    }
    if (actionKind === "magic" && state.extraActions.length > 0) {
      throw new DomainEvaluationError("no remaining action can be used for a Magic Action");
    }
    throw new DomainEvaluationError("action is not available");
  }

  const key = slot === "bonus-action" ? "bonusAction" : "reaction";
  if (!state[key]) throw new DomainEvaluationError(`${slot} is not available`);
  return { next:{ ...state, [key]:false }, spentFrom:"standard" };
}

export function useTurnSlot(
  state: TurnEconomyState,
  slot: TurnSlot,
  bonusActionGranted = false,
  actionKind: ActionUseKind = "other",
): TurnEconomyState {
  return spendTurnSlot(state, slot, bonusActionGranted, actionKind).next;
}

export function grantExtraAction(state: TurnEconomyState, grant: ExtraActionGrant): TurnEconomyState {
  if (!grant.id || !grant.source) throw new DomainEvaluationError("extra action grant id and source are required");
  if (state.extraActions.some((entry) => entry.id === grant.id)) {
    throw new DomainEvaluationError(`duplicate extra action grant: ${grant.id}`);
  }
  return { ...state, extraActions:[...state.extraActions, { ...grant }] };
}

export function useMovement(state: TurnEconomyState, distance: number): TurnEconomyState {
  if (!Number.isInteger(distance) || distance < 0) {
    throw new DomainEvaluationError("movement must be a non-negative integer");
  }
  if (distance > state.movement) throw new DomainEvaluationError("movement exceeds remaining speed");
  return { ...state, movement: state.movement - distance };
}
