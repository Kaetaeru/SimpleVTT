import type { AppSnapshot } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { recordCommittedResolutionEvents } from "./resolutionEventCommitRegistry";
import { runtimeResolutionEventHistory } from "./runtimeResolutionEventHistory";

function captureCommittedRuntimeEvents(adapter:MockAdapter,snapshot:AppSnapshot) {
  const resolution=snapshot.resolution;
  if (!resolution || resolution.stage!=="complete") return snapshot;
  const history=runtimeResolutionEventHistory(adapter);
  if (!history || history.resolutionId!==resolution.id || history.events.length===0) return snapshot;
  recordCommittedResolutionEvents(resolution.id,history.events);
  return snapshot;
}

const previousAdvanceResolution=MockAdapter.prototype.advanceResolution;
MockAdapter.prototype.advanceResolution=async function advanceResolutionWithCommitCapture() {
  return captureCommittedRuntimeEvents(this,await previousAdvanceResolution.call(this));
};

const previousRespondToInterrupt=MockAdapter.prototype.respondToInterrupt;
MockAdapter.prototype.respondToInterrupt=async function respondToInterruptWithCommitCapture(accept:boolean) {
  return captureCommittedRuntimeEvents(this,await previousRespondToInterrupt.call(this,accept));
};
