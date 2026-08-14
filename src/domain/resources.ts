import { DomainEvaluationError, type ProvenanceRecord } from "./profileEngine";

export type RecoveryAmount = number | "all";

export interface ResourceRecovery {
  shortRest?: RecoveryAmount;
  longRest?: RecoveryAmount;
  turnStart?: RecoveryAmount;
}

export interface ResourcePool {
  id: string;
  label: string;
  current: number;
  maximum: number;
  recovery?: ResourceRecovery;
}

export interface ResourceResolution {
  next: ResourcePool;
  delta: number;
  provenance: ProvenanceRecord[];
}

function validate(pool: ResourcePool) {
  if (!pool.id) throw new DomainEvaluationError("resource id is required");
  if (!Number.isInteger(pool.current) || !Number.isInteger(pool.maximum) || pool.current < 0 || pool.maximum < 0 || pool.current > pool.maximum) {
    throw new DomainEvaluationError(`invalid resource pool ${pool.id}`);
  }
}

export function spendResource(pool: ResourcePool, amount: number, source: string): ResourceResolution {
  validate(pool);
  if (!Number.isInteger(amount) || amount < 0) throw new DomainEvaluationError("resource spend must be a non-negative integer");
  if (amount > pool.current) throw new DomainEvaluationError(`${pool.id} has ${pool.current}, cannot spend ${amount}`);
  const next = { ...pool, current:pool.current - amount };
  return {
    next,
    delta:-amount,
    provenance:[{ source, status:"applied", reason:`${pool.label} ${pool.current} -> ${next.current}` }],
  };
}

export function recoverResource(pool: ResourcePool, amount: RecoveryAmount, source: string): ResourceResolution {
  validate(pool);
  if (amount !== "all" && (!Number.isInteger(amount) || amount < 0)) throw new DomainEvaluationError("resource recovery must be a non-negative integer or all");
  const target = amount === "all" ? pool.maximum : Math.min(pool.maximum, pool.current + amount);
  const next = { ...pool, current:target };
  return {
    next,
    delta:target - pool.current,
    provenance:[{ source, status:"applied", reason:`${pool.label} ${pool.current} -> ${target}` }],
  };
}

export function recoverResources(
  pools: ResourcePool[],
  trigger: "shortRest" | "longRest" | "turnStart",
): { next:ResourcePool[]; provenance:ProvenanceRecord[] } {
  const provenance: ProvenanceRecord[] = [];
  const next = pools.map((pool) => {
    validate(pool);
    const amount = pool.recovery?.[trigger];
    if (amount === undefined) return { ...pool };
    const resolved = recoverResource(pool, amount, `resource-recovery:${trigger}`);
    provenance.push(...resolved.provenance);
    return resolved.next;
  });
  return { next, provenance };
}

export function findResource(pools: ResourcePool[], id: string) {
  const index = pools.findIndex((pool) => pool.id === id);
  if (index < 0) throw new DomainEvaluationError(`resource not found: ${id}`);
  return { index, pool:pools[index] };
}
