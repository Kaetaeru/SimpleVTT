import "./connectedSessionRuntimeAdapter";
import { MockAdapter } from "./mockAdapter";
import { unmountAllReconstructedCharacterSessionProjections } from "./characterSessionProjectionMount";
import { isEphemeralSessionProjectionCharacter } from "./characterSessionProjectionRegistry";
import type { CharacterSheet } from "./contracts";

const previousHostSession=MockAdapter.prototype.hostSession;

MockAdapter.prototype.hostSession=async function hostSessionWithProjectionCleanup() {
  const app=this as unknown as {activeCharacter:CharacterSheet};
  if (isEphemeralSessionProjectionCharacter(this,app.activeCharacter.id)) {
    await this.dismissResolution();
  }
  unmountAllReconstructedCharacterSessionProjections(this);
  return previousHostSession.call(this);
};
