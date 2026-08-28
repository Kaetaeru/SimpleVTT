import type { RulesRuntimeState } from "./combatState";
import type { RulesProfileLike } from "./profileEngine";
import {
  compileCommonPlayEntryPointOperations,
  resolveCommonPlayEntryPointOperations,
  type CommonPlayOperationDefinition,
  type CommonPlayOperationExecutionInput,
} from "./commonPlayOperationRuntime";
import type { PendingResolution, ResolutionCommit } from "./resolutionTypes";

export type CommonPlayActionEconomyDefinition=CommonPlayOperationDefinition;
export type CommonPlayActionEconomyRequest=CommonPlayOperationExecutionInput;

export function compileCommonPlayActionEconomyEntryPoint(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  definition:CommonPlayActionEconomyDefinition,
  request:CommonPlayActionEconomyRequest,
):PendingResolution {
  return compileCommonPlayEntryPointOperations(profile,inputState,definition,request);
}

export function resolveCommonPlayActionEconomyEntryPoint(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  definition:CommonPlayActionEconomyDefinition,
  request:CommonPlayActionEconomyRequest,
):ResolutionCommit {
  return resolveCommonPlayEntryPointOperations(profile,inputState,definition,request);
}
