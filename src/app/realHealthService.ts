import type { DamageComponentView, SceneEntity } from "./contracts";
import { resolveDamage, type DamageDefenseContribution } from "../domain/damage";

export interface SceneDamageResolution {
  nextHp:number;
  nextTempHp:number;
  component:DamageComponentView;
  stateChanges:string[];
  provenance:string[];
}

function defensesFor(target:Pick<SceneEntity,"id"|"resistances"|"immunities"|"vulnerabilities">):DamageDefenseContribution[] {
  return [
    ...target.resistances.map((damageType) => ({ source:`scene:${target.id}:resistance:${damageType}`, kind:"resistance" as const, damageType })),
    ...target.vulnerabilities.map((damageType) => ({ source:`scene:${target.id}:vulnerability:${damageType}`, kind:"vulnerability" as const, damageType })),
    ...target.immunities.map((damageType) => ({ source:`scene:${target.id}:immunity:${damageType}`, kind:"immunity" as const, damageType })),
  ];
}

function adjustmentLabel(target:Pick<SceneEntity,"resistances"|"immunities"|"vulnerabilities">,damageType:string,raw:number,adjusted:number) {
  if (target.immunities.includes(damageType)) return `${damageType} 면역 ${raw} → ${adjusted}`;
  const resistance = target.resistances.includes(damageType);
  const vulnerability = target.vulnerabilities.includes(damageType);
  if (resistance && vulnerability) return `${damageType} 저항/취약 ${raw} → ${adjusted}`;
  if (resistance) return `${damageType} 저항 ${raw} → ${adjusted}`;
  if (vulnerability) return `${damageType} 취약 ${raw} → ${adjusted}`;
  return "조정 없음";
}

export function resolveSceneDamage(
  target:Pick<SceneEntity,"id"|"name"|"hp"|"maxHp"|"tempHp"|"resistances"|"immunities"|"vulnerabilities">,
  damageType:string,
  raw:number,
):SceneDamageResolution {
  const resolved = resolveDamage({
    damageType,
    amount:raw,
    hp:{ current:target.hp, maximum:target.maxHp, temporary:target.tempHp },
    defenses:defensesFor(target),
  });
  const stateChanges:string[] = [];
  if (target.tempHp !== resolved.nextHp.temporary) {
    stateChanges.push(`${target.name} 임시 HP ${target.tempHp} → ${resolved.nextHp.temporary}`);
  }
  if (target.hp !== resolved.nextHp.current) {
    stateChanges.push(`${target.name} HP ${target.hp} → ${resolved.nextHp.current}`);
  }

  return {
    nextHp:resolved.nextHp.current,
    nextTempHp:resolved.nextHp.temporary,
    component:{
      type:damageType,
      roll:String(raw),
      raw,
      adjusted:resolved.finalDamage,
      adjustment:adjustmentLabel(target,damageType,raw,resolved.adjusted),
      source:"Rules Domain · Typed Defense → Temp HP → HP",
    },
    stateChanges,
    provenance:resolved.provenance.map((entry) => `${entry.source} · ${entry.status} · ${entry.reason}`),
  };
}
