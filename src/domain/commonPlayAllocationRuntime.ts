import { evaluateExpression, type ExpressionNode } from "./profileEngine";

export interface CommonPlayAllocationPlan {
  units:ExpressionNode;
  minimumPerTarget?:number;
  maximumPerTarget?:number;
  totalMustMatch:boolean;
}

export interface CommonPlayAllocationEntry {
  targetId:string;
  units:number;
}

export interface CommonPlayAllocationRequest {
  id:string;
  idempotencyKey:string;
  expectedRevision:number;
  authority:"actor-owner"|"dm"|"host";
  responderId:string;
  plan:CommonPlayAllocationPlan;
  candidateTargetIds:string[];
  allocations:CommonPlayAllocationEntry[];
  properties?:Record<string,number>;
}

export type CommonPlayAllocationResolution=
  | {status:"resolved";id:string;idempotencyKey:string;authority:CommonPlayAllocationRequest["authority"];responderId:string;total:number;allocations:CommonPlayAllocationEntry[]}
  | {status:"rejected"|"stale";reason:string};

/** Repeated target selections are an authored integer allocation, not an adapter distribution policy. */
export function allocationEntriesFromTargetSequence(targetIds:string[]):CommonPlayAllocationEntry[] {
  const byTarget=new Map<string,CommonPlayAllocationEntry>();
  for(const targetId of targetIds) {
    const current=byTarget.get(targetId);
    if(current) current.units+=1;
    else byTarget.set(targetId,{targetId,units:1});
  }
  return [...byTarget.values()];
}

export function resolveCommonPlayAllocation(
  request:CommonPlayAllocationRequest,
  currentRevision:number,
):CommonPlayAllocationResolution {
  if(!request.id||!request.idempotencyKey||!request.responderId) return {status:"rejected",reason:"allocation identity, idempotency key, and responder are required"};
  if(currentRevision!==request.expectedRevision) return {status:"stale",reason:`allocation is stale: expected revision ${request.expectedRevision}, current ${currentRevision}`};
  const total=evaluateExpression(request.plan.units,(property)=>{
    const value=request.properties?.[property];
    if(value===undefined) throw new Error(`unresolved allocation property: ${property}`);
    return value;
  });
  if(!Number.isInteger(total)||total<0) return {status:"rejected",reason:"allocation units must resolve to a non-negative integer"};
  const minimum=request.plan.minimumPerTarget??0;
  const maximum=request.plan.maximumPerTarget??total;
  if(!Number.isInteger(minimum)||minimum<0||!Number.isInteger(maximum)||maximum<Math.max(1,minimum)) {
    return {status:"rejected",reason:"allocation per-target bounds are invalid"};
  }
  const candidates=new Set(request.candidateTargetIds);
  const seen=new Set<string>();
  let allocated=0;
  for(const entry of request.allocations) {
    if(!entry.targetId||seen.has(entry.targetId)) return {status:"rejected",reason:`duplicate allocation target: ${entry.targetId}`};
    seen.add(entry.targetId);
    if(!candidates.has(entry.targetId)) return {status:"rejected",reason:`allocation target was not selected: ${entry.targetId}`};
    if(!Number.isInteger(entry.units)||entry.units<minimum||entry.units>maximum) {
      return {status:"rejected",reason:`allocation for ${entry.targetId} must be ${minimum}-${maximum}`};
    }
    allocated+=entry.units;
  }
  if(request.plan.totalMustMatch ? allocated!==total : allocated>total) {
    return {status:"rejected",reason:`allocation total ${allocated} does not satisfy ${request.plan.totalMustMatch?"exact":"maximum"} pool ${total}`};
  }
  return {
    status:"resolved",id:request.id,idempotencyKey:request.idempotencyKey,
    authority:request.authority,responderId:request.responderId,total,
    allocations:request.allocations.map((entry)=>({...entry})),
  };
}
