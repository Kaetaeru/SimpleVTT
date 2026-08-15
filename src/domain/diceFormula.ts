import { DomainEvaluationError, type ProvenanceRecord } from "./profileEngine";

export interface FixedFormulaDice {
  source:string;
  sides:number;
  count:number;
  faces:number[];
}

export interface FlatFormulaContribution {
  source:string;
  value:number;
}

export interface FixedDiceFormulaRequest {
  dice:FixedFormulaDice[];
  flat?:FlatFormulaContribution[];
}

export interface FixedDiceFormulaResolution {
  diceTotal:number;
  flatTotal:number;
  total:number;
  selectedFaces:number[];
  provenance:ProvenanceRecord[];
}

export function resolveFixedDiceFormula(request:FixedDiceFormulaRequest):FixedDiceFormulaResolution {
  const provenance:ProvenanceRecord[] = [];
  const selectedFaces:number[] = [];
  let diceTotal = 0;
  for (const die of request.dice) {
    if (!Number.isInteger(die.sides) || die.sides < 2) {
      throw new DomainEvaluationError(`formula dice from ${die.source} must have at least 2 sides`);
    }
    if (!Number.isInteger(die.count) || die.count < 0) {
      throw new DomainEvaluationError(`formula dice count from ${die.source} must be a non-negative integer`);
    }
    if (die.faces.length < die.count) {
      throw new DomainEvaluationError(`formula dice from ${die.source} require ${die.count} fixed faces`);
    }
    const faces = die.faces.slice(0,die.count);
    for (const face of faces) {
      if (!Number.isInteger(face) || face < 1 || face > die.sides) {
        throw new DomainEvaluationError(`invalid d${die.sides} formula face ${face} from ${die.source}`);
      }
    }
    const subtotal = faces.reduce((sum,face) => sum + face,0);
    selectedFaces.push(...faces);
    diceTotal += subtotal;
    provenance.push({
      source:die.source,
      status:"applied",
      reason:`${die.count}d${die.sides} [${faces.join(", ")}] => ${subtotal}`,
    });
  }

  const flat = request.flat ?? [];
  let flatTotal = 0;
  for (const contribution of flat) {
    if (!Number.isFinite(contribution.value)) {
      throw new DomainEvaluationError(`formula flat contribution from ${contribution.source} must be finite`);
    }
    flatTotal += contribution.value;
    provenance.push({
      source:contribution.source,
      status:"applied",
      reason:`${contribution.value >= 0 ? "+" : ""}${contribution.value} flat contribution`,
    });
  }

  return {
    diceTotal,
    flatTotal,
    total:diceTotal + flatTotal,
    selectedFaces,
    provenance,
  };
}
