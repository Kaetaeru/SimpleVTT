import "./spellcastingRuntimeAdapter";
import { MockAdapter } from "./mockAdapter";

export const legacySpellResolveAction = MockAdapter.prototype.resolveAction;
