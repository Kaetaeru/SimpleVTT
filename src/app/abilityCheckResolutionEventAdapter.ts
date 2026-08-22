import type { ActionVm, AppSnapshot, ResolutionView } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { resolveOpenAbilityCheckResolutionEvent } from "./realResolutionService";
import { recordRuntimeResolutionEvents } from "./runtimeResolutionEventHistory";

type AbilityCheckEventAdapterState={
  action(id:string):ActionVm|undefined;
  resolution:ResolutionView|null;
};

const previousAdvanceResolution=MockAdapter.prototype.advanceResolution;

MockAdapter.prototype.advanceResolution=async function advanceAbilityCheckWithCanonicalEvent():Promise<AppSnapshot> {
  const internal=this as unknown as AbilityCheckEventAdapterState;
  const resolution=internal.resolution;
  const action=resolution ? internal.action(resolution.actionId) : undefined;
  if (!resolution || !action || action.resolutionKind!=="ability-check" || resolution.stage!=="roll-animation") {
    return previousAdvanceResolution.call(this);
  }

  const checkLabel=action.details.find((entry)=>entry.label==="판정")?.value ?? action.name;
  const helped=resolution.provenance.some((entry)=>entry.startsWith("action:standard.help ·"));
  const event=resolveOpenAbilityCheckResolutionEvent({
    resolutionId:resolution.id,
    action,
    diceFaces:[...resolution.authoritativeDice],
    modifierContributions:[{
      source:`action:${action.id}:check-bonus`,
      value:action.checkBonus ?? 0,
    }],
    rollStateContributions:helped
      ? [{ source:"action:standard.help",state:"advantage" }]
      : undefined,
    checkLabel,
  });
  const completed=await previousAdvanceResolution.call(this);
  if (completed.resolution?.id===resolution.id && completed.resolution.stage==="complete") {
    recordRuntimeResolutionEvents(this,resolution.id,[event]);
  }
  return completed;
};
