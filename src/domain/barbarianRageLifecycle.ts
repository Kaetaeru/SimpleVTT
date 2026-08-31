import type { EffectInstance, RuntimeClock } from "./effects";
import {
  applyExtendableEffectUpdate,
  extendableEffectStartMetadata,
  extendEffectFromHostileD20,
  extendEffectThroughNextTurn,
  expireExtendableEffectsAtClock,
  type ExtendableEffectUpdate,
} from "./extendableEffectLifecycle";
import type { PendingResolution, ResolutionOperation } from "./resolutionTypes";

export const BARBARIAN_RAGE_FEATURE_ID="dnd.srd521.feature.barbarian.rage";
export const BARBARIAN_RAGE_TAG="barbarian:rage";
export const BARBARIAN_RAGE_DURATION_KEY="barbarian-rage";
const RAGE_MAXIMUM_SECONDS=600;
const RAGE_MAXIMUM_ROUNDS=100;

type D20Op=Extract<ResolutionOperation,{kind:"d20"}>;
export type RageEffectUpdate=ExtendableEffectUpdate;

function rageMarker(effects:EffectInstance[],actorId:string) {
  return effects.find((effect)=>effect.targetId===actorId&&effect.tags.includes(BARBARIAN_RAGE_TAG));
}

export function barbarianRageStartMetadata(clock:RuntimeClock) {
  return extendableEffectStartMetadata(clock,RAGE_MAXIMUM_SECONDS,RAGE_MAXIMUM_ROUNDS);
}

export function barbarianRageExtensionUpdate(effects:EffectInstance[],actorId:string,clock:RuntimeClock):RageEffectUpdate|undefined {
  const marker=rageMarker(effects,actorId);
  return marker?extendEffectThroughNextTurn(effects,actorId,clock,marker.id):undefined;
}

export function barbarianRageD20ExtensionUpdate(effects:EffectInstance[],clock:RuntimeClock,pending:PendingResolution,operation:D20Op):RageEffectUpdate|undefined {
  return extendEffectFromHostileD20(effects,clock,pending,operation);
}

export function applyRageEffectUpdate(effects:EffectInstance[],update:RageEffectUpdate) {
  return applyExtendableEffectUpdate(effects,update);
}

export function expireBarbarianRageAtClock(effects:EffectInstance[],clock:RuntimeClock) {
  return expireExtendableEffectsAtClock(effects,clock);
}
