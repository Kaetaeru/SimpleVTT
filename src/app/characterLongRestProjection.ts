import type { CharacterResourceVm, CharacterSheet } from "./contracts";
import { resolveLongRest } from "../domain/rest";
import type { EffectInstance } from "../domain/effects";
import type { ProvenanceRecord } from "../domain/profileEngine";
import type { ResourcePool } from "../domain/resources";

type RestAwareResource=CharacterResourceVm&{
  recovery?:ResourcePool["recovery"];
  recoveryLockouts?:ResourcePool["recoveryLockouts"];
};

export interface CharacterLongRestProjection {
  sheet:CharacterSheet;
  effects:EffectInstance[];
  expiredEffects:EffectInstance[];
  provenance:ProvenanceRecord[];
}

/**
 * Pure application projection over the canonical domain Long Rest resolver.
 * Campaign time/rations are intentionally absent: those are separate optional
 * compound participants and must never be implied by resolving the Rest itself.
 */
export function projectCharacterLongRest(
  sheet:CharacterSheet,
  options:{effects?:EffectInstance[];deathSaves?:{successes:number;failures:number}}={},
):CharacterLongRestProjection {
  const flags=sheet.durableLifeFlags??{stable:false,unconscious:sheet.hp===0,dead:false};
  const resources=(sheet.resources as RestAwareResource[]).map((resource):ResourcePool=>({
    id:resource.id,
    label:resource.label,
    current:resource.current,
    maximum:resource.max,
    recovery:resource.recovery?structuredClone(resource.recovery):undefined,
    recoveryLockouts:resource.recoveryLockouts?structuredClone(resource.recoveryLockouts):undefined,
  }));
  const resolved=resolveLongRest(sheet.id,{
    life:{
      hp:{current:sheet.hp,maximum:sheet.maxHp,temporary:sheet.tempHp},
      deathSaves:options.deathSaves?structuredClone(options.deathSaves):{successes:0,failures:0},
      stable:flags.stable,
      unconscious:flags.unconscious,
      dead:flags.dead,
    },
    resources,
    hitDice:[],
    effects:structuredClone(options.effects??[]),
  });
  const next=structuredClone(sheet);
  next.hp=resolved.next.life.hp.current;
  next.tempHp=resolved.next.life.hp.temporary;
  next.durableLifeFlags={
    stable:resolved.next.life.stable,
    unconscious:resolved.next.life.unconscious,
    dead:resolved.next.life.dead,
  };
  const byId=new Map(resolved.next.resources.map((resource)=>[resource.id,resource]));
  next.resources=(sheet.resources as RestAwareResource[]).map((resource)=>{
    const recovered=byId.get(resource.id);
    if(!recovered) return structuredClone(resource);
    return {
      ...structuredClone(resource),
      current:recovered.current,
      max:recovered.maximum,
      recoveryLockouts:recovered.recoveryLockouts?structuredClone(recovered.recoveryLockouts):undefined,
    };
  });
  return {
    sheet:next,
    effects:structuredClone(resolved.next.effects),
    expiredEffects:structuredClone(resolved.expiredEffects),
    provenance:structuredClone(resolved.provenance),
  };
}
