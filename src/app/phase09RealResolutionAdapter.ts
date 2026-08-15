import "./progressionPhase08RogueThiefAdapter";
import type { ActionVm, AppSnapshot, ResolutionView, SceneEntity } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { resolveSceneDamage } from "./realHealthService";
import { resolveAttackRollResolution, resolveOpenAbilityCheckResolution } from "./realResolutionService";

interface Phase09ResolutionAdapterState {
  action(id:string):ActionVm|undefined;
  entity(id:string):SceneEntity|undefined;
  availability(action:ActionVm):{ available:boolean; reason?:string };
  eligible(action:ActionVm):string[];
  capture():void;
  d20(actionId:string,index?:number):number;
  commit(action:ActionVm):void;
  resolution:ResolutionView|null;
  getSnapshot():Promise<AppSnapshot>;
}

function resolutionId() {
  return `resolution.phase09.${Date.now()}.${Math.floor(Math.random() * 1000)}`;
}

const oldResolveAction = MockAdapter.prototype.resolveAction;
const oldAdvanceResolution = MockAdapter.prototype.advanceResolution;

MockAdapter.prototype.resolveAction = async function resolveActionWithRealD20(actionId:string,targetIds:string[]) {
  const internal = this as unknown as Phase09ResolutionAdapterState;
  const action = internal.action(actionId);
  if (!action || (action.resolutionKind !== "ability-check" && action.resolutionKind !== "attack")) {
    return oldResolveAction.call(this,actionId,targetIds);
  }

  const availability = internal.availability(action);
  if (!availability.available) return internal.getSnapshot();
  const allowed = new Set(internal.eligible(action));
  if (targetIds.some((id) => !allowed.has(id))) return internal.getSnapshot();

  if (action.resolutionKind === "attack") {
    if (targetIds.length !== 1) return internal.getSnapshot();
    const target = internal.entity(targetIds[0]);
    if (!target) return internal.getSnapshot();
    internal.capture();
    internal.resolution = resolveAttackRollResolution({
      resolutionId:resolutionId(),
      action,
      target,
      diceFaces:[internal.d20(action.id)],
      modifierContributions:[{
        source:`action:${action.id}:attack-bonus`,
        value:action.attackBonus ?? 0,
      }],
    });
    return internal.getSnapshot();
  }

  internal.capture();
  const checkLabel = action.details.find((entry) => entry.label === "판정")?.value ?? action.name;
  internal.resolution = resolveOpenAbilityCheckResolution({
    resolutionId:resolutionId(),
    action,
    diceFaces:[internal.d20(action.id)],
    modifierContributions:[{
      source:`action:${action.id}:check-bonus`,
      value:action.checkBonus ?? 0,
    }],
    checkLabel,
  });
  return internal.getSnapshot();
};

MockAdapter.prototype.advanceResolution = async function advanceResolutionWithRealDamage() {
  const internal = this as unknown as Phase09ResolutionAdapterState;
  const resolution = internal.resolution;
  if (!resolution) return oldAdvanceResolution.call(this);
  const action = internal.action(resolution.actionId);
  if (!action || resolution.stage !== "damage-animation" || action.resolutionKind !== "attack") {
    return oldAdvanceResolution.call(this);
  }

  const target = internal.entity(resolution.targetIds[0]);
  const damage = action.damage?.[0];
  if (!target || !damage) return oldAdvanceResolution.call(this);
  const raw = damage.average * (resolution.critical ? 2 : 1);
  const resolved = resolveSceneDamage(target,damage.type,raw);
  target.hp = resolved.nextHp;
  target.tempHp = resolved.nextTempHp;
  resolution.stateChanges.push(...resolved.stateChanges);
  resolution.provenance.push(...resolved.provenance);
  resolution.damageComponents = [resolved.component];
  resolution.compact = `${resolution.attackTotal} vs AC ${resolution.targetAc} — ${resolution.attackOutcome}${resolution.critical ? " · 치명타" : ""} · ${resolved.component.adjusted} ${resolved.component.type} 피해`;
  resolution.calculatedOutcome = resolution.compact;
  if (!resolution.adjudicated) resolution.finalOutcome = resolution.compact;
  internal.commit(action);
  return internal.getSnapshot();
};
