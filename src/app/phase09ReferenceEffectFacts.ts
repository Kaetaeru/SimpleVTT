import type { ActionVm } from "./contracts";
import type { FixedFormulaDice, FlatFormulaContribution } from "../domain/diceFormula";
import { parseCommonPlayDamageDiceFormula } from "../domain/commonPlayOperationRuntime";

export interface Phase09NoRollDamageFact {
  dice:FixedFormulaDice[];
  flat:FlatFormulaContribution[];
}

function formula(action:ActionVm) {
  const damage=action.damage?.[0];
  if(!damage)throw new Error(`no-roll damage action requires a damage formula: ${action.id}`);
  const parsed=parseCommonPlayDamageDiceFormula(damage.dice,`no-roll damage action ${action.id}`);
  return {...parsed,flat:parsed.flat+damage.flat};
}

export function d20BackedFormulaFaces(count:number,sides:number,drawD20:(index:number)=>number) {
  let drawIndex=0;
  return Array.from({length:count},()=>{
    const limit=20-(20%sides);
    let face:number;
    do {
      face=drawD20(drawIndex++);
      if(!Number.isInteger(face)||face<1||face>20)throw new Error(`invalid authoritative d20 face: ${face}`);
    } while(face>limit);
    return ((face+Math.floor(sides/2)-1)%sides)+1;
  });
}

export function noRollDamageFactFromFaces(action:ActionVm,faces:number[]):Phase09NoRollDamageFact {
  const parsed=formula(action);
  if(faces.length!==parsed.count||faces.some((face)=>!Number.isInteger(face)||face<1||face>parsed.sides))throw new Error(`no-roll damage faces do not match ${parsed.count}d${parsed.sides}: ${action.id}`);
  return {
    dice:[{source:`action:${action.id}:damage-d${parsed.sides}`,sides:parsed.sides,count:parsed.count,faces:[...faces]}],
    flat:parsed.flat?[{source:`action:${action.id}:damage-flat`,value:parsed.flat}]:[],
  };
}

export function rollNoRollDamageFact(action:ActionVm,drawD20:(index:number)=>number):Phase09NoRollDamageFact {
  const parsed=formula(action);
  const faces=d20BackedFormulaFaces(parsed.count,parsed.sides,drawD20);
  return noRollDamageFactFromFaces(action,faces);
}
