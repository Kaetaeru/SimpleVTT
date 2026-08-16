import "./connectedSessionRuntimeAdapter";
import { MockAdapter } from "./mockAdapter";
import { unmountAllReconstructedCharacterSessionProjections } from "./characterSessionProjectionMount";

const previousHostSession=MockAdapter.prototype.hostSession;

MockAdapter.prototype.hostSession=async function hostSessionWithProjectionCleanup() {
  unmountAllReconstructedCharacterSessionProjections(this);
  return previousHostSession.call(this);
};
