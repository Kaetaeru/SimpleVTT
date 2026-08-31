import type { EffectExpiryResolution, EffectInstance, RuntimeClock } from "./effects";
import type { PendingResolution, ResolutionOperation } from "./resolutionTypes";

const EXTENDABLE="extendOnHostileAttackOrSave";
const STARTED_AT="extendableStartedAtSeconds";
const EXPIRES_AFTER_ROUND="extendableExpiresAfterRound";
const MAXIMUM_ROUND="extendableMaximumRound";
const MAXIMUM_SECONDS="extendableMaximumSeconds";

type D20Op=Extract<ResolutionOperation,{kind:"d20"}>;
export interface ExtendableEffectUpdate {before:EffectInstance;after:EffectInstance;reason:string}

function numberMetadata(effect:EffectInstance,key:string) {
  const value=effect.metadata?.[key];
  return typeof value==="number"&&Number.isFinite(value)?value:undefined;
}

function marker(effects:EffectInstance[],actorId:string,effectId?:string) {
  return effects.find((effect)=>effect.targetId===actorId&&effect.metadata?.[EXTENDABLE]===true&&(!effectId||effect.id===effectId));
}

function specialDurationKey(effect:EffectInstance) {
  return effect.expiry.kind==="special"?effect.expiry.key:undefined;
}

export function extendableEffectStartMetadata(clock:RuntimeClock,maximumSeconds:number,maximumRounds:number) {
  return {
    [EXTENDABLE]:true,
    [STARTED_AT]:clock.elapsedSeconds,
    [EXPIRES_AFTER_ROUND]:clock.round+1,
    [MAXIMUM_ROUND]:clock.round+maximumRounds,
    [MAXIMUM_SECONDS]:maximumSeconds,
  };
}

export function extendEffectThroughNextTurn(effects:EffectInstance[],actorId:string,clock:RuntimeClock,effectId?:string):ExtendableEffectUpdate|undefined {
  if(clock.activeActorId!==actorId)return undefined;
  const current=marker(effects,actorId,effectId);
  if(!current)return undefined;
  const maximumRound=numberMetadata(current,MAXIMUM_ROUND);
  const currentExpiry=numberMetadata(current,EXPIRES_AFTER_ROUND);
  if(maximumRound===undefined||currentExpiry===undefined)return undefined;
  const nextExpiry=Math.min(clock.round+1,maximumRound);
  if(currentExpiry>=nextExpiry)return undefined;
  const after={...current,metadata:{...current.metadata,[EXPIRES_AFTER_ROUND]:nextExpiry}};
  return {before:current,after,reason:`effect ${current.id} extended through end of round ${nextExpiry}`};
}

function targetRelation(pending:PendingResolution,targetId:string|undefined) {
  if(!targetId)return undefined;
  for(const operation of pending.operations) {
    if(operation.kind!=="targeting")continue;
    const target=operation.targets.find((entry)=>entry.id===targetId);
    if(target)return target.relation;
  }
  return undefined;
}

export function extendEffectFromHostileD20(effects:EffectInstance[],clock:RuntimeClock,pending:PendingResolution,operation:D20Op) {
  let actorId:string|undefined;
  let enemyId:string|undefined;
  if(operation.request.family==="attack-roll") {
    actorId=operation.actorId??pending.actorId;
    enemyId=operation.targetId;
  } else if(operation.request.family==="saving-throw") {
    actorId=pending.actorId;
    enemyId=operation.actorId??pending.actorId;
  } else return undefined;
  if(targetRelation(pending,enemyId)!=="enemy")return undefined;
  return extendEffectThroughNextTurn(effects,actorId,clock);
}

export function applyExtendableEffectUpdate(effects:EffectInstance[],update:ExtendableEffectUpdate) {
  return effects.map((effect)=>effect.id===update.before.id?update.after:effect);
}

export function expireExtendableEffectsAtClock(effects:EffectInstance[],clock:RuntimeClock):EffectExpiryResolution {
  const groups:Array<{actorId:string;durationKey:string}>=[];
  for(const current of effects.filter((effect)=>effect.metadata?.[EXTENDABLE]===true)) {
    const durationKey=specialDurationKey(current);
    if(!durationKey)continue;
    const startedAt=numberMetadata(current,STARTED_AT);
    const expiresAfterRound=numberMetadata(current,EXPIRES_AFTER_ROUND);
    const maximumRound=numberMetadata(current,MAXIMUM_ROUND);
    const maximumSeconds=numberMetadata(current,MAXIMUM_SECONDS);
    if(startedAt===undefined||expiresAfterRound===undefined||maximumRound===undefined||maximumSeconds===undefined)continue;
    const timeExpired=clock.elapsedSeconds>=startedAt+maximumSeconds;
    const roundExpired=clock.round>expiresAfterRound
      || (clock.round===expiresAfterRound&&clock.activeActorId===current.targetId&&clock.phase==="end")
      || clock.round>maximumRound
      || (clock.round===maximumRound&&clock.activeActorId===current.targetId&&clock.phase==="end");
    if(timeExpired||roundExpired)groups.push({actorId:current.targetId,durationKey});
  }
  if(!groups.length)return {active:effects,expired:[],provenance:[]};
  const expired=effects.filter((effect)=>groups.some((group)=>group.actorId===effect.targetId&&group.durationKey===specialDurationKey(effect)));
  const ids=new Set(expired.map((effect)=>effect.id));
  return {
    active:effects.filter((effect)=>!ids.has(effect.id)),
    expired,
    provenance:expired.map((effect)=>({source:effect.sourceId,status:"applied",reason:`effect ${effect.id} reached its extendable duration boundary`})),
  };
}
