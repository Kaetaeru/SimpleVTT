import type { HpState } from "./damage";
import { DomainEvaluationError } from "./profileEngine";

export type TemporaryHpChoice = "keep-existing" | "take-new";

export interface TemporaryHpGainRequest {
  hp: HpState;
  amount: number;
  source: string;
  choice?: TemporaryHpChoice;
}

export function resolveTemporaryHpGain(_request: TemporaryHpGainRequest): never {
  throw new DomainEvaluationError(
    "temporary HP replacement choice is not implemented; caller must preserve the choice instead of auto-selecting",
  );
}
