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
  choiceRequired: boolean;
  selected?: TemporaryHpChoice;
  existing: number;
  offered: number;
  provenance: ProvenanceRecord[];
}

function validate(request: TemporaryHpGainRequest) {
  if (!Number.isInteger(request.amount) || request.amount < 0) {
    throw new DomainEvaluationError("temporary HP amount must be a non-negative integer");
  }
  if (!Number.isInteger(request.hp.temporary) || request.hp.temporary < 0) {
    throw new DomainEvaluationError("existing temporary HP must be a non-negative integer");
  }
}

export function resolveTemporaryHpGain(
  request: TemporaryHpGainRequest,
): TemporaryHpGainResolution {
  validate(request);
  const existing = request.hp.temporary;
  const offered = request.amount;

  if (existing === 0 || offered === existing) {
    const nextHp = { ...request.hp, temporary: offered };
    return {
      nextHp,
      choiceRequired: false,
      selected: "take-new",
      existing,
      offered,
      provenance: [{
        source: request.source,
        status: "applied",
        reason: `Temporary HP ${existing} -> ${offered}`,
      }],
    };
  }

  if (offered === 0) {
    return {
      nextHp: { ...request.hp },
      choiceRequired: false,
      selected: "keep-existing",
      existing,
      offered,
      provenance: [{
        source: request.source,
        status: "suppressed",
        reason: `0 offered Temporary HP does not replace existing ${existing}`,
      }],
    };
  }

  if (request.choice === undefined) {
    return {
      nextHp: { ...request.hp },
      choiceRequired: true,
      existing,
      offered,
      provenance: [{
        source: request.source,
        status: "inactive",
        reason: `Temporary HP does not stack; choose existing ${existing} or offered ${offered}`,
      }],
    };
  }

  if (request.choice === "keep-existing") {
    return {
      nextHp: { ...request.hp },
      choiceRequired: false,
      selected: request.choice,
      existing,
      offered,
      provenance: [{
        source: request.source,
        status: "suppressed",
        reason: `kept existing Temporary HP ${existing} instead of offered ${offered}`,
      }],
    };
  }

  return {
    nextHp: { ...request.hp, temporary: offered },
    choiceRequired: false,
    selected: request.choice,
    existing,
    offered,
    provenance: [{
      source: request.source,
      status: "applied",
      reason: `replaced Temporary HP ${existing} with ${offered}`,
    }],
  };
}
