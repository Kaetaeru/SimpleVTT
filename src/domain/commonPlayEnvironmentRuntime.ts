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

export function validateCommonPlayEnvironmentProfile(profile:CommonPlayEnvironmentProfile) {
  if(!profile||typeof profile!=="object"||typeof profile.id!=="string"||!profile.id||!Number.isFinite(profile.movementCostMultiplier)||profile.movementCostMultiplier<0)throw new DomainEvaluationError("environment profile requires identity and a non-negative movement multiplier");
  if(!Array.isArray(profile.bypassMovementMultiplierWithModes)||profile.bypassMovementMultiplierWithModes.some((mode)=>typeof mode!=="string"||!mode)||new Set(profile.bypassMovementMultiplierWithModes).size!==profile.bypassMovementMultiplierWithModes.length)throw new DomainEvaluationError("environment movement bypass modes must be non-empty and unique");
  if(!Array.isArray(profile.attackRules)||profile.attackRules.some((rule)=>!rule||typeof rule!=="object"||rule.attackKind!=="melee-weapon"&&rule.attackKind!=="ranged-weapon"||rule.adaptedProperty!==undefined&&(typeof rule.adaptedProperty!=="string"||!rule.adaptedProperty)||rule.normalRangeOnly!==undefined&&typeof rule.normalRangeOnly!=="boolean"||rule.otherwise!=="disadvantage"&&rule.otherwise!=="automatic-miss"))throw new DomainEvaluationError("environment attack rule is invalid");
  if(!Array.isArray(profile.damageDefenses)||profile.damageDefenses.some((defense)=>!defense||typeof defense!=="object"||typeof defense.damageType!=="string"||!defense.damageType||defense.kind!=="resistance"&&defense.kind!=="immunity"))throw new DomainEvaluationError("environment damage defense is invalid");
  return structuredClone(profile);
}

export function resolveEnvironmentMovement(profile:CommonPlayEnvironmentProfile,movementMode:string,hasModeSpeed:boolean) {
  validateCommonPlayEnvironmentProfile(profile);
  return hasModeSpeed&&profile.bypassMovementMultiplierWithModes.includes(movementMode)?1:profile.movementCostMultiplier;
}

export function resolveEnvironmentAttack(profile:CommonPlayEnvironmentProfile,input:{attackKind:"melee-weapon"|"ranged-weapon";properties:string[];rangeBand:"normal"|"long"}) {
  validateCommonPlayEnvironmentProfile(profile);
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
  validateCommonPlayEnvironmentProfile(profile);
  return profile.damageDefenses.find((entry)=>entry.damageType===damageType)?.kind;
}

export function fallDamageDice(distanceFeet:number,feetPerDie=10,maximumDice=20) {
  if(!Number.isFinite(distanceFeet)||distanceFeet<0||!Number.isFinite(feetPerDie)||feetPerDie<=0||!Number.isInteger(maximumDice)||maximumDice<0)throw new DomainEvaluationError("fall damage parameters are invalid");
  return Math.min(maximumDice,Math.floor(distanceFeet/feetPerDie));
}
