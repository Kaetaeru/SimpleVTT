import { DomainEvaluationError } from "./profileEngine";

export type CommonPlayOrderingAuthority="actor-owner"|"target-owner"|"dm"|"host";

export interface CommonPlayOrderingDecision {
  id:string;
  timingWindow:string;
  eligibleIds:string[];
  authority:CommonPlayOrderingAuthority;
  expectedRevision:number;
  idempotencyKey:string;
  stalePolicy:"cancel"|"restart"|"reject";
}

export type CommonPlayOrderingResult=
  | {status:"awaiting-input";decision:CommonPlayOrderingDecision}
  | {status:"resolved";decisionId:string;idempotencyKey:string;orderedIds:string[]}
  | {status:"invalidated";reason:string}
  | {status:"rejected";reason:string};

export function openCommonPlayOrderingDecision(request:CommonPlayOrderingDecision):CommonPlayOrderingResult {
  if(!request.id||!request.timingWindow||!request.idempotencyKey) throw new DomainEvaluationError("ordering identity, timing window, and idempotency key are required");
  if(!Number.isInteger(request.expectedRevision)||request.expectedRevision<0) throw new DomainEvaluationError("ordering expectedRevision must be a non-negative integer");
  if(request.eligibleIds.length<2) throw new DomainEvaluationError("simultaneous ordering requires at least two eligible effects");
  if(request.eligibleIds.some((id)=>!id)||new Set(request.eligibleIds).size!==request.eligibleIds.length) throw new DomainEvaluationError("ordering eligible effect identities must be non-empty and unique");
  return {status:"awaiting-input",decision:structuredClone(request)};
}

export function resolveCommonPlayOrderingDecision(
  currentRevision:number,
  decision:CommonPlayOrderingDecision,
  response:{decisionId:string;idempotencyKey:string;orderedIds:string[]},
):CommonPlayOrderingResult {
  if(response.decisionId!==decision.id||response.idempotencyKey!==decision.idempotencyKey) return {status:"rejected",reason:"ordering response identity mismatch"};
  if(currentRevision!==decision.expectedRevision) {
    if(decision.stalePolicy==="restart") return {status:"awaiting-input",decision:{...structuredClone(decision),expectedRevision:currentRevision}};
    return {status:"invalidated",reason:`ordering decision is stale: expected revision ${decision.expectedRevision}, current ${currentRevision}`};
  }
  if(response.orderedIds.length!==decision.eligibleIds.length
    ||new Set(response.orderedIds).size!==response.orderedIds.length
    ||response.orderedIds.some((id)=>!decision.eligibleIds.includes(id))) {
    return {status:"rejected",reason:"ordering response must be an exact permutation of eligible effects"};
  }
  return {status:"resolved",decisionId:decision.id,idempotencyKey:decision.idempotencyKey,orderedIds:[...response.orderedIds]};
}
