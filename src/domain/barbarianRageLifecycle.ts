import type { EffectExpiryResolution, EffectInstance, RuntimeClock } from "./effects";
import type { PendingResolution, ResolutionOperation } from "./resolutionTypes";

export const BARBARIAN_RAGE_FEATURE_ID = "dnd.srd521.feature.barbarian.rage";
export const BARBARIAN_RAGE_TAG = "barbarian:rage";
export const BARBARIAN_RAGE_DURATION_KEY = "barbarian-rage";

const RAGE_STARTED_ROUND = "rageStartedRound";
const RAGE_STARTED_AT_SECONDS = "rageStartedAtSeconds";
const RAGE_EXPIRES_AFTER_ROUND = "rageExpiresAfterRound";
const RAGE_MAXIMUM_ROUND = "rageMaximumRound";
const RAGE_MAXIMUM_SECONDS = 600;
const RAGE_MAXIMUM_ROUNDS = 100;

type D20Op = Extract<ResolutionOperation, { kind:"d20" }>;

export interface RageEffectUpdate {
  before:EffectInstance;
  after:EffectInstance;
  reason:string;
}

function numberMetadata(effect:EffectInstance,key:string) {
  const value=effect.metadata?.[key];
  return typeof value==="number"&&Number.isFinite(value)?value:undefined;
}

function rageMarker(effects:EffectInstance[],actorId:string) {
  return effects.find((effect)=>effect.targetId===actorId&&effect.tags.includes(BARBARIAN_RAGE_TAG));
}

function rageLinked(effect:EffectInstance,actorId:string) {
  return effect.targetId===actorId&&(
    effect.tags.includes(BARBARIAN_RAGE_TAG)
    || (effect.expiry.kind==="special"&&effect.expiry.key===BARBARIAN_RAGE_DURATION_KEY)
  );
}

export function barbarianRageStartMetadata(clock:RuntimeClock) {
  return {
    [RAGE_STARTED_ROUND]:clock.round,
    [RAGE_STARTED_AT_SECONDS]:clock.elapsedSeconds,
    [RAGE_EXPIRES_AFTER_ROUND]:clock.round+1,
    [RAGE_MAXIMUM_ROUND]:clock.round+RAGE_MAXIMUM_ROUNDS,
  };
}

export function barbarianRageExtensionUpdate(
  effects:EffectInstance[],
  actorId:string,
  clock:RuntimeClock,
):RageEffectUpdate|undefined {
  if(clock.activeActorId!==actorId)return undefined;
  const marker=rageMarker(effects,actorId);
  if(!marker)return undefined;
  const maximumRound=numberMetadata(marker,RAGE_MAXIMUM_ROUND);
  const currentExpiry=numberMetadata(marker,RAGE_EXPIRES_AFTER_ROUND);
  if(maximumRound===undefined||currentExpiry===undefined)return undefined;
  const nextExpiry=Math.min(clock.round+1,maximumRound);
  if(currentExpiry>=nextExpiry)return undefined;
  const after={
    ...marker,
    metadata:{...marker.metadata,[RAGE_EXPIRES_AFTER_ROUND]:nextExpiry},
  };
  return {before:marker,after,reason:`Rage extended through end of round ${nextExpiry}`};
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

export function barbarianRageD20ExtensionUpdate(
  effects:EffectInstance[],
  clock:RuntimeClock,
  pending:PendingResolution,
  operation:D20Op,
):RageEffectUpdate|undefined {
  let actorId:string|undefined;
  let enemyId:string|undefined;
  if(operation.request.family==="attack-roll") {
    actorId=operation.actorId??pending.actorId;
    enemyId=operation.targetId;
  } else if(operation.request.family==="saving-throw") {
    actorId=pending.actorId;
    enemyId=operation.actorId??pending.actorId;
  } else {
    return undefined;
  }
  if(targetRelation(pending,enemyId)!=="enemy")return undefined;
  return barbarianRageExtensionUpdate(effects,actorId,clock);
}

export function applyRageEffectUpdate(effects:EffectInstance[],update:RageEffectUpdate) {
  return effects.map((effect)=>effect.id===update.before.id?update.after:effect);
}

export function expireBarbarianRageAtClock(
  effects:EffectInstance[],
  clock:RuntimeClock,
):EffectExpiryResolution {
  const actors=new Set<string>();
  for(const marker of effects.filter((effect)=>effect.tags.includes(BARBARIAN_RAGE_TAG))) {
    const startSeconds=numberMetadata(marker,RAGE_STARTED_AT_SECONDS);
    const expiresAfterRound=numberMetadata(marker,RAGE_EXPIRES_AFTER_ROUND);
    const maximumRound=numberMetadata(marker,RAGE_MAXIMUM_ROUND);
    if(startSeconds===undefined||expiresAfterRound===undefined||maximumRound===undefined)continue;
    const timeExpired=clock.elapsedSeconds>=startSeconds+RAGE_MAXIMUM_SECONDS;
    const roundExpired=clock.round>expiresAfterRound
      || (clock.round===expiresAfterRound&&clock.activeActorId===marker.targetId&&clock.phase==="end")
      || clock.round>maximumRound
      || (clock.round===maximumRound&&clock.activeActorId===marker.targetId&&clock.phase==="end");
    if(timeExpired||roundExpired)actors.add(marker.targetId);
  }
  if(!actors.size)return {active:effects,expired:[],provenance:[]};
  const expired=effects.filter((effect)=>actors.has(effect.targetId)&&rageLinked(effect,effect.targetId));
  const expiredIds=new Set(expired.map((effect)=>effect.id));
  return {
    active:effects.filter((effect)=>!expiredIds.has(effect.id)),
    expired,
    provenance:expired.map((effect)=>({
      source:effect.sourceId,
      status:"applied",
      reason:`effect ${effect.id} ended with Barbarian Rage duration`,
    })),
  };
}
