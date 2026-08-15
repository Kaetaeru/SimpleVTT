import "./spellcastingRuntimeAdapter";
import { MockAdapter } from "./mockAdapter";

export const legacySpellResolveAction = MockAdapter.prototype.resolveAction;
export const legacySpellUndoLastResolution = MockAdapter.prototype.undoLastResolution;
