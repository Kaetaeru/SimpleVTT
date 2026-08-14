import { DomainEvaluationError } from "./profileEngine";

export type TurnSlot = "action" | "bonus-action" | "reaction";

export interface TurnEconomyState {
  action: boolean;
  bonusAction: boolean;
  reaction: boolean;
  movement: number;
  movementMaximum: number;
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
  };
}

export function useTurnSlot(
  state: TurnEconomyState,
  slot: TurnSlot,
  bonusActionGranted = false,
): TurnEconomyState {
  if (slot === "bonus-action" && !bonusActionGranted) {
    throw new DomainEvaluationError("bonus action requires an explicit granting rule");
  }
  const key = slot === "bonus-action" ? "bonusAction" : slot;
  if (!state[key]) throw new DomainEvaluationError(`${slot} is not available`);
  return { ...state, [key]: false };
}

export function useMovement(state: TurnEconomyState, distance: number): TurnEconomyState {
  if (!Number.isInteger(distance) || distance < 0) {
    throw new DomainEvaluationError("movement must be a non-negative integer");
  }
  if (distance > state.movement) throw new DomainEvaluationError("movement exceeds remaining speed");
  return { ...state, movement: state.movement - distance };
}
