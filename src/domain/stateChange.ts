import type { HpState } from "./damage";
import type { ProvenanceRecord } from "./profileEngine";
import type { TurnEconomyState } from "./turnEconomy";

export type StateLifetime = "character-durable" | "session-runtime";
export type WriteBackClass = "character" | "session";

interface StateChangeBase {
  targetId: string;
  provenance: ProvenanceRecord[];
  lifetime: StateLifetime;
  writeBack: WriteBackClass;
}

export interface HpStateChange extends StateChangeBase {
  kind: "hp";
  field: "current" | "maximum" | "temporary";
  before: number;
  after: number;
}

export interface EconomyStateChange extends StateChangeBase {
  kind: "economy";
  field: "action" | "bonusAction" | "reaction" | "movement" | "movementMaximum" | "extraActions";
  before: boolean | number;
  after: boolean | number;
}

export type StateChange = HpStateChange | EconomyStateChange;

export function hpStateChanges(
  targetId: string,
  before: HpState,
  after: HpState,
  provenance: ProvenanceRecord[],
): HpStateChange[] {
  const fields: Array<HpStateChange["field"]> = ["current", "maximum", "temporary"];
  return fields
    .filter((field) => before[field] !== after[field])
    .map((field) => ({
      kind: "hp",
      targetId,
      field,
      before: before[field],
      after: after[field],
      provenance,
      lifetime: "character-durable",
      writeBack: "character",
    }));
}

export function economyStateChanges(
  targetId: string,
  before: TurnEconomyState,
  after: TurnEconomyState,
  provenance: ProvenanceRecord[],
): EconomyStateChange[] {
  const fields: Array<Exclude<EconomyStateChange["field"], "extraActions">> = [
    "action",
    "bonusAction",
    "reaction",
    "movement",
    "movementMaximum",
  ];
  const changes: EconomyStateChange[] = fields
    .filter((field) => before[field] !== after[field])
    .map((field) => ({
      kind: "economy",
      targetId,
      field,
      before: before[field],
      after: after[field],
      provenance,
      lifetime: "session-runtime",
      writeBack: "session",
    }));
  const beforeExtra = before.extraActions?.length ?? 0;
  const afterExtra = after.extraActions?.length ?? 0;
  if (beforeExtra !== afterExtra) {
    changes.push({
      kind:"economy",
      targetId,
      field:"extraActions",
      before:beforeExtra,
      after:afterExtra,
      provenance,
      lifetime:"session-runtime",
      writeBack:"session",
    });
  }
  return changes;
}
