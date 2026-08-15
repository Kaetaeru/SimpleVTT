import type { ActionVm, SceneEntity } from "./contracts";
import type { Phase09NoRollDamageFact } from "./phase09ReferenceEffectFacts";
import { resolveSceneDamage } from "./realHealthService";
import { resolveFixedDiceFormula } from "../domain/diceFormula";

export interface NoRollDamageResolutionRequest {
  action:ActionVm;
  target:SceneEntity;
  damageFact:Phase09NoRollDamageFact;
}

export function resolveNoRollDamageResolution(request:NoRollDamageResolutionRequest) {
  if (request.action.resolutionKind !== "no-roll-damage" || !request.action.damage?.[0]) {
    throw new Error(`no-roll damage service requires damage action: ${request.action.id}`);
  }
  const roll = resolveFixedDiceFormula({ dice:request.damageFact.dice, flat:request.damageFact.flat });
  const damage = resolveSceneDamage(request.target,request.action.damage[0].type,roll.total);
  return {
    authoritativeDice:[...roll.selectedFaces],
    raw:roll.total,
    nextHp:damage.nextHp,
    nextTempHp:damage.nextTempHp,
    component:{ ...damage.component, roll:roll.selectedFaces.join(" + ") },
    stateChanges:damage.stateChanges,
    provenance:[
      ...roll.provenance.map((entry) => `${entry.source} · ${entry.status} · ${entry.reason}`),
      ...damage.provenance,
    ],
  };
}
