import "./progressionPhase08RogueThiefAdapter";
import type { ActionVm, AppSnapshot, ResolutionView } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { resolveAttackRollResolution, resolveOpenAbilityCheckResolution } from "./realResolutionService";

interface Phase09ResolutionTarget {
  id:string;
  name:string;
  ac:number;
}

interface Phase09ResolutionAdapterState {
  action(id:string):ActionVm|undefined;
  entity(id:string):Phase09ResolutionTarget|undefined;
  availability(action:ActionVm):{ available:boolean; reason?:string };
  eligible(action:ActionVm):string[];
  capture():void;
  d20(actionId:string,index?:number):number;
  resolution:ResolutionView|null;
  getSnapshot():Promise<AppSnapshot>;
}

function resolutionId() {
  return `resolution.phase09.${Date.now()}.${Math.floor(Math.random() * 1000)}`;
}

const oldResolveAction = MockAdapter.prototype.resolveAction;

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
