import type { AppRole, AppSnapshot, DmAdjudicationCommand, ResolutionView, SessionVm } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { connectedStateFor } from "./connectedSessionState";
import { sessionDebugPreviewRoleFor } from "./sessionDebugPreviewRole";

interface AbilityCheckDcState {
  role:AppRole;
  resolution:ResolutionView|null;
  session:SessionVm;
  getSnapshot():Promise<AppSnapshot>;
}

const previousAdvanceResolution=MockAdapter.prototype.advanceResolution;
const previousApplyDmAdjudication=MockAdapter.prototype.applyDmAdjudication;

function isHost(adapter:MockAdapter,internal:AbilityCheckDcState) {
  return internal.role==="dm"||internal.session.role==="host"||connectedStateFor(adapter).mode==="host"||sessionDebugPreviewRoleFor(adapter)==="dm";
}

function awaitingDc(adapter:MockAdapter,internal:AbilityCheckDcState) {
  const resolution=internal.resolution;
  return isHost(adapter,internal)
    && resolution?.rollKind==="check"
    && resolution.stage==="effect-preview"
    && resolution.checkTarget===undefined;
}

MockAdapter.prototype.advanceResolution=async function advanceAbilityCheckToDmDc():Promise<AppSnapshot> {
  const internal=this as unknown as AbilityCheckDcState;
  const resolution=internal.resolution;
  if (isHost(this,internal)&&resolution?.rollKind==="check"&&resolution.stage==="roll-animation"&&resolution.checkTarget===undefined) {
    resolution.stage="effect-preview";
    resolution.canAdvance=false;
    resolution.nextLabel=undefined;
    resolution.compact=`${resolution.rollTotal??"—"} · DM 공개 DC 대기`;
    return internal.getSnapshot();
  }
  return previousAdvanceResolution.call(this);
};

MockAdapter.prototype.applyDmAdjudication=async function applyAbilityCheckDc(command:DmAdjudicationCommand):Promise<AppSnapshot> {
  if (command.type!=="ability-check-dc") return previousApplyDmAdjudication.call(this,command);
  const internal=this as unknown as AbilityCheckDcState;
  const dc=Number(command.value);
  if (command.scope!=="resolution"||!Number.isInteger(dc)||dc<1||dc>99||!awaitingDc(this,internal)) return internal.getSnapshot();

  const resolution=internal.resolution!;
  const total=resolution.rollTotal??0;
  resolution.checkTarget=dc;
  resolution.checkOutcome=total>=dc?"성공":"실패";
  resolution.compact=`${total} vs DC ${dc} · ${resolution.checkOutcome}`;
  resolution.calculatedOutcome=resolution.compact;
  resolution.finalOutcome=resolution.checkOutcome;
  resolution.detail.push(`DM 공개 DC: ${dc}`);
  resolution.provenance.push(`dm-adjudication:ability-check-dc · 공개 DC ${dc}`);
  resolution.stage="roll-animation";
  resolution.canAdvance=true;
  resolution.nextLabel="판정 적용";
  return this.advanceResolution();
};
