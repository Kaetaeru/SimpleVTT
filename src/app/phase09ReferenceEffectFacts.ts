import type { ActionVm } from "./contracts";
import type { FixedFormulaDice, FlatFormulaContribution } from "../domain/diceFormula";

export interface Phase09NoRollDamageFact {
  dice:FixedFormulaDice[];
  flat:FlatFormulaContribution[];
}

function formula(action:ActionVm) {
  const damage=action.damage?.[0];
  const match=damage?.dice.trim().match(/^(\d+)d(\d+)(?:\s*\+\s*(\d+))?$/i);
  if(!damage||!match)throw new Error(`no-roll damage action requires a simple dice formula: ${action.id}`);
  const count=Number(match[1]);
  const sides=Number(match[2]);
  const flat=Number(match[3]??0)+damage.flat;
  if(!Number.isInteger(count)||count<1||!Number.isInteger(sides)||sides<2||!Number.isFinite(flat))throw new Error(`invalid no-roll damage formula: ${action.id}`);
  return {count,sides,flat};
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
  if(parsed.sides>20)throw new Error(`d20-backed no-roll damage preview cannot roll d${parsed.sides}: ${action.id}`);
  let drawIndex=0;
  const faces=Array.from({length:parsed.count},()=>{
    const limit=20-(20%parsed.sides);
    let face:number;
    do face=drawD20(drawIndex++);while(face>limit);
    return ((face+Math.floor(parsed.sides/2)-1)%parsed.sides)+1;
  });
  return noRollDamageFactFromFaces(action,faces);
}
