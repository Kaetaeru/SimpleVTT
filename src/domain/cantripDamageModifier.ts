import { DomainEvaluationError } from "./profileEngine";
import type { ResolutionOperation } from "./resolutionTypes";
import { classCantripListEntries } from "./spellListCatalog";
import type { SpellMechanicDefinition } from "./spellcasting";

function classCantripIds(classId:string) {
  return new Set(classCantripListEntries(classId).map((entry) => entry.id));
}

export function requireClassCantrip(definition:SpellMechanicDefinition, classId:string) {
  if (definition.baseLevel !== 0 || !classCantripIds(classId).has(definition.spellId)) {
    throw new DomainEvaluationError(`spell ${definition.spellId} is not a cantrip for ${classId}`);
  }
}

export function addSingleCantripDamageFlatModifier(args:{
  definition:SpellMechanicDefinition;
  operations:ResolutionOperation[];
  classId:string;
  sourceId:string;
  value:number;
}) {
  requireClassCantrip(args.definition,args.classId);
  if (!Number.isFinite(args.value)) throw new DomainEvaluationError("cantrip damage modifier must be finite");
  if (args.definition.primary.kind !== "attack-damage" && args.definition.primary.kind !== "save-damage") {
    throw new DomainEvaluationError("cantrip mechanic does not have a supported damage roll");
  }
  const rolls = args.operations.filter(
    (operation):operation is Extract<ResolutionOperation,{kind:"damage-roll"}> => operation.kind === "damage-roll",
  );
  if (rolls.length !== 1) throw new DomainEvaluationError("cantrip damage modifier requires one authoritative damage roll");
  rolls[0].request = {
    ...rolls[0].request,
    flat:[
      ...(rolls[0].request.flat ?? []),
      { source:args.sourceId, value:args.value },
    ],
  };
}

export function withClassCantripRangeIncrease(args:{
  definition:SpellMechanicDefinition;
  classId:string;
  minimumRangeFeet:number;
  increaseFeet:number;
}) {
  requireClassCantrip(args.definition,args.classId);
  if (!Number.isFinite(args.minimumRangeFeet) || args.minimumRangeFeet < 0) {
    throw new DomainEvaluationError("minimum cantrip range must be non-negative and finite");
  }
  if (!Number.isFinite(args.increaseFeet) || args.increaseFeet < 0) {
    throw new DomainEvaluationError("cantrip range increase must be non-negative and finite");
  }
  const current = args.definition.targeting.rangeFeet;
  if (current === undefined || current < args.minimumRangeFeet) return structuredClone(args.definition);
  return {
    ...structuredClone(args.definition),
    targeting:{
      ...args.definition.targeting,
      rangeFeet:current + args.increaseFeet,
    },
  } satisfies SpellMechanicDefinition;
}
