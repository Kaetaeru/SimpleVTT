import type { HpState } from "./damage";
import type { ProvenanceRecord } from "./profileEngine";
import type { ExtraActionGrant, ExtraAttackGrant, TurnEconomyState } from "./turnEconomy";

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

interface EconomyScalarStateChange extends StateChangeBase {
  kind: "economy";
  field: "action" | "bonusAction" | "reaction" | "movement" | "movementMaximum";
  before: boolean | number;
  after: boolean | number;
}

interface EconomyExtraActionsStateChange extends StateChangeBase {
  kind: "economy";
  field: "extraActions";
  before: ExtraActionGrant[];
  after: ExtraActionGrant[];
}

interface EconomyExtraAttacksStateChange extends StateChangeBase {
  kind:"economy";
  field:"extraAttacks";
  before:ExtraAttackGrant[];
  after:ExtraAttackGrant[];
}

export type EconomyStateChange = EconomyScalarStateChange | EconomyExtraActionsStateChange | EconomyExtraAttacksStateChange;

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
  const fields: Array<EconomyScalarStateChange["field"]> = [
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
  const pushGrantChange=<K extends "extraActions"|"extraAttacks">(field:K,beforeExtra:NonNullable<TurnEconomyState[K]>,afterExtra:NonNullable<TurnEconomyState[K]>)=>{
    if (JSON.stringify(beforeExtra)===JSON.stringify(afterExtra)) return;
    changes.push({
      kind:"economy",
      targetId,
      field,
      before:structuredClone(beforeExtra),after:structuredClone(afterExtra),
      provenance,
      lifetime:"session-runtime",
      writeBack:"session",
    } as EconomyStateChange);
  };
  pushGrantChange("extraActions",before.extraActions??[],after.extraActions??[]);
  pushGrantChange("extraAttacks",before.extraAttacks??[],after.extraAttacks??[]);
  return changes;
}
