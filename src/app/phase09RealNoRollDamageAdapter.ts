import "./phase09RealItemCostAdapter";
import type { ActionVm, AppSnapshot, ResolutionView, SceneEntity } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { phase09ReferenceNoRollDamageFact } from "./phase09ReferenceEffectFacts";
import { resolveNoRollDamageResolution } from "./realNoRollDamageService";

interface Phase09NoRollDamageState {
  action(id:string):ActionVm|undefined;
  entity(id:string):SceneEntity|undefined;
  commit(action:ActionVm):void;
  resolution:ResolutionView|null;
  getSnapshot():Promise<AppSnapshot>;
}

const previousAdvance = MockAdapter.prototype.advanceResolution;

MockAdapter.prototype.advanceResolution = async function advanceResolutionWithRealNoRollDamage() {
  const internal = this as unknown as Phase09NoRollDamageState;
  const resolution = internal.resolution;
  if (!resolution || !["effect-preview","damage-animation"].includes(resolution.stage)) {
    return previousAdvance.call(this);
  }
  const action = internal.action(resolution.actionId);
  if (!action || action.resolutionKind !== "no-roll-damage") {
    return previousAdvance.call(this);
  }
  const target = internal.entity(resolution.targetIds[0]);
  if (!target) return previousAdvance.call(this);

  let resolved;
  try {
    resolved = resolveNoRollDamageResolution({
      action,
      target,
      damageFact:phase09ReferenceNoRollDamageFact(action.id),
    });
  } catch {
    return previousAdvance.call(this);
  }

  if (resolution.stage === "effect-preview") {
    resolution.authoritativeDice = [...resolved.authoritativeDice];
    resolution.rollKind = "damage";
    resolution.stage = "damage-animation";
    resolution.compact = `${action.damage?.[0]?.dice ?? "피해"} · 권위 주사위 결과 준비`;
    resolution.calculatedOutcome = `${resolved.raw} ${resolved.component.type} 피해 예정`;
    if (!resolution.adjudicated) resolution.finalOutcome = resolution.calculatedOutcome;
    resolution.provenance.push(...resolved.provenance.filter((entry) => !resolution.provenance.includes(entry)));
    resolution.canAdvance = true;
    resolution.nextLabel = "피해 적용";
    return internal.getSnapshot();
  }

  target.hp = resolved.nextHp;
  target.tempHp = resolved.nextTempHp;
  resolution.authoritativeDice = [...resolved.authoritativeDice];
  resolution.damageComponents = [resolved.component];
  resolution.stateChanges.push(...resolved.stateChanges);
  resolution.provenance.push(...resolved.provenance.filter((entry) => !resolution.provenance.includes(entry)));
  resolution.compact = `자동 명중 · ${resolved.component.adjusted} ${resolved.component.type} 피해`;
  resolution.calculatedOutcome = resolution.compact;
  if (!resolution.adjudicated) resolution.finalOutcome = resolution.compact;
  internal.commit(action);
  return internal.getSnapshot();
};
