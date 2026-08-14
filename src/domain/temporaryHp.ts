import type { HpState } from "./damage";
import { DomainEvaluationError, type ProvenanceRecord } from "./profileEngine";

export type TemporaryHpChoice = "keep-existing" | "take-new";

export interface TemporaryHpGainRequest {
  hp: HpState;
  amount: number;
  source: string;
  choice?: TemporaryHpChoice;
}

export interface TemporaryHpGainResolution {
  nextHp: HpState;
  choice: TemporaryHpChoice;
  provenance: ProvenanceRecord[];
}

export function resolveTemporaryHpGain(request: TemporaryHpGainRequest): TemporaryHpGainResolution {
  if (!Number.isInteger(request.amount) || request.amount < 0) {
    throw new DomainEvaluationError("temporary HP amount must be a non-negative integer");
  }
  if (!request.source) throw new DomainEvaluationError("temporary HP source is required");

  const existing = request.hp.temporary;
  if (!Number.isInteger(existing) || existing < 0) {
    throw new DomainEvaluationError("existing temporary HP must be a non-negative integer");
  }

  let choice = request.choice;
  if (existing === 0) choice = "take-new";
  else if (request.amount === 0) choice = "keep-existing";
  else if (!choice) {
    throw new DomainEvaluationError(
      "temporary HP does not stack; caller must preserve the keep-existing/take-new choice",
    );
  }

  const temporary = choice === "take-new" ? request.amount : existing;
  return {
    nextHp: { ...request.hp, temporary },
    choice,
    provenance: [{
      source: request.source,
      status: "applied",
      reason: choice === "take-new"
        ? `Temporary HP ${existing} -> ${temporary}; new value chosen`
        : `Temporary HP remains ${existing}; existing value chosen`,
    }],
  };
}

export function clearTemporaryHpOnLongRest(hp: HpState): HpState {
  return hp.temporary === 0 ? { ...hp } : { ...hp, temporary: 0 };
}
