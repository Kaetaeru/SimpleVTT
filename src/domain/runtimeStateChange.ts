import type { ConcentrationState } from "./concentration";
import type { EffectInstance } from "./effects";
import type { LifeState } from "./life";
import type { ProvenanceRecord } from "./profileEngine";
import type { StateChange } from "./stateChange";

export interface ResourceStateChange {
  kind:"resource";
  targetId:string;
  resourceId:string;
  before:number;
  after:number;
  provenance:ProvenanceRecord[];
  lifetime:"character-durable";
  writeBack:"character";
}

export interface EffectStateChange {
  kind:"effect";
  targetId:string;
  effectId:string;
  operation:"added" | "updated" | "removed";
  before?:EffectInstance;
  after?:EffectInstance;
  provenance:ProvenanceRecord[];
  lifetime:"session-runtime";
  writeBack:"session";
}

export interface ConcentrationStateChange {
  kind:"concentration";
  targetId:string;
  before?:ConcentrationState;
  after?:ConcentrationState;
  provenance:ProvenanceRecord[];
  lifetime:"session-runtime";
  writeBack:"session";
}

export interface SpellcastingTurnSnapshot {
  turnId:string;
  slottedCasterIds:string[];
}

export interface SpellcastingTurnStateChange {
  kind:"spellcasting-turn";
  targetId:string;
  before?:SpellcastingTurnSnapshot;
  after?:SpellcastingTurnSnapshot;
  provenance:ProvenanceRecord[];
  lifetime:"session-runtime";
  writeBack:"session";
}

export interface LifeFlagStateChange {
  kind:"life";
  targetId:string;
  field:"stable" | "unconscious" | "dead";
  before:boolean;
  after:boolean;
  provenance:ProvenanceRecord[];
  lifetime:"character-durable";
  writeBack:"character";
}

export type RuntimeStateChange =
  | StateChange
  | ResourceStateChange
  | EffectStateChange
  | ConcentrationStateChange
  | SpellcastingTurnStateChange
  | LifeFlagStateChange;

export function resourceStateChange(targetId:string, resourceId:string, before:number, after:number, provenance:ProvenanceRecord[]): ResourceStateChange {
  return { kind:"resource", targetId, resourceId, before, after, provenance, lifetime:"character-durable", writeBack:"character" };
}

export function effectStateChange(
  targetId:string,
  effectId:string,
  operation:"added"|"updated"|"removed",
  provenance:ProvenanceRecord[],
  before?:EffectInstance,
  after?:EffectInstance,
): EffectStateChange {
  return {
    kind:"effect",
    targetId,
    effectId,
    operation,
    before:before ? structuredClone(before) : undefined,
    after:after ? structuredClone(after) : undefined,
    provenance,
    lifetime:"session-runtime",
    writeBack:"session",
  };
}

export function concentrationStateChange(
  targetId:string,
  before:ConcentrationState|undefined,
  after:ConcentrationState|undefined,
  provenance:ProvenanceRecord[],
): ConcentrationStateChange {
  return {
    kind:"concentration",
    targetId,
    before:before ? structuredClone(before) : undefined,
    after:after ? structuredClone(after) : undefined,
    provenance,
    lifetime:"session-runtime",
    writeBack:"session",
  };
}

export function spellcastingTurnStateChange(
  targetId:string,
  before:SpellcastingTurnSnapshot|undefined,
  after:SpellcastingTurnSnapshot|undefined,
  provenance:ProvenanceRecord[],
):SpellcastingTurnStateChange {
  return {
    kind:"spellcasting-turn",
    targetId,
    before:before ? structuredClone(before) : undefined,
    after:after ? structuredClone(after) : undefined,
    provenance,
    lifetime:"session-runtime",
    writeBack:"session",
  };
}

export function lifeFlagStateChanges(
  targetId:string,
  before:LifeState,
  after:LifeState,
  provenance:ProvenanceRecord[],
): LifeFlagStateChange[] {
  const fields:Array<LifeFlagStateChange["field"]> = ["stable","unconscious","dead"];
  return fields
    .filter((field) => before[field] !== after[field])
    .map((field) => ({
      kind:"life",
      targetId,
      field,
      before:before[field],
      after:after[field],
      provenance,
      lifetime:"character-durable",
      writeBack:"character",
    }));
}
