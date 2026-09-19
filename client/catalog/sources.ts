/**
 * Read-only data the new client ships with: the SRD 5.2.1 modules, built from the SRD's source
 * (content/modules/srd-5.2.1, scripts/srd-build-modules.mjs). D314: nothing else — no index, no generated tables.
 */
import { BUILTIN_MODULE_JSON } from "./builtinModules";
import type { RuleModuleJson } from "./types";

export const BUILTIN_MODULES = BUILTIN_MODULE_JSON as readonly RuleModuleJson[];
