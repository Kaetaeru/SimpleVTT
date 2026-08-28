import { DomainEvaluationError } from "./profileEngine";

export interface CommonPlayEnvironmentProfile {
  id:string;
  movementCostMultiplier:number;
  bypassMovementMultiplierWithModes:string[];
  attackRules:Array<{
    attackKind:"melee-weapon"|"ranged-weapon";
    adaptedProperty?:string;
    normalRangeOnly?:boolean;
    otherwise:"disadvantage"|"automatic-miss";
  }>;
  damageDefenses:Array<{damageType:string;kind:"resistance"|"immunity"}>;
}

export function resolveEnvironmentMovement(profile:CommonPlayEnvironmentProfile,movementMode:string,hasModeSpeed:boolean) {
  if(!Number.isFinite(profile.movementCostMultiplier)||profile.movementCostMultiplier<0)throw new DomainEvaluationError("environment movement multiplier must be non-negative and finite");
  return hasModeSpeed&&profile.bypassMovementMultiplierWithModes.includes(movementMode)?1:profile.movementCostMultiplier;
}

export function resolveEnvironmentAttack(profile:CommonPlayEnvironmentProfile,input:{attackKind:"melee-weapon"|"ranged-weapon";properties:string[];rangeBand:"normal"|"long"}) {
  let disadvantage=false;
  for(const rule of profile.attackRules.filter((entry)=>entry.attackKind===input.attackKind)){
    if(rule.normalRangeOnly&&input.rangeBand==="long")return {allowed:false,disadvantage:false};
    if(rule.adaptedProperty&&!input.properties.includes(rule.adaptedProperty)){
      if(rule.otherwise==="automatic-miss")return {allowed:false,disadvantage:false};
      disadvantage=true;
    }
  }
  return {allowed:true,disadvantage};
}

export function environmentDamageDefense(profile:CommonPlayEnvironmentProfile,damageType:string) {
  return profile.damageDefenses.find((entry)=>entry.damageType===damageType)?.kind;
}

export function fallDamageDice(distanceFeet:number,feetPerDie=10,maximumDice=20) {
  if(!Number.isFinite(distanceFeet)||distanceFeet<0||!Number.isFinite(feetPerDie)||feetPerDie<=0||!Number.isInteger(maximumDice)||maximumDice<0)throw new DomainEvaluationError("fall damage parameters are invalid");
  return Math.min(maximumDice,Math.floor(distanceFeet/feetPerDie));
}
