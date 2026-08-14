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
  maximumAfterLongRest?: number;
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
  if (pool.maximumAfterLongRest !== undefined && (!Number.isInteger(pool.maximumAfterLongRest) || pool.maximumAfterLongRest < 0 || pool.maximumAfterLongRest > pool.maximum)) {
    throw new DomainEvaluationError(`invalid long-rest maximum for ${pool.id}`);
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

export function gainResource(
  pool: ResourcePool,
  amount: number,
  source: string,
  options: { maximumDelta?: number; temporaryCapacityUntilLongRest?: boolean } = {},
): ResourceResolution {
  validate(pool);
  const maximumDelta = options.maximumDelta ?? 0;
  if (!Number.isInteger(amount) || amount < 0) throw new DomainEvaluationError("resource gain must be a non-negative integer");
  if (!Number.isInteger(maximumDelta) || maximumDelta < 0) throw new DomainEvaluationError("resource maximum gain must be a non-negative integer");
  const nextMaximum = pool.maximum + maximumDelta;
  const nextCurrent = pool.current + amount;
  if (nextCurrent > nextMaximum) throw new DomainEvaluationError(`${pool.id} cannot exceed maximum ${nextMaximum}`);
  const next: ResourcePool = {
    ...pool,
    current:nextCurrent,
    maximum:nextMaximum,
    maximumAfterLongRest:options.temporaryCapacityUntilLongRest && maximumDelta > 0
      ? (pool.maximumAfterLongRest ?? pool.maximum)
      : pool.maximumAfterLongRest,
  };
  validate(next);
  return {
    next,
    delta:amount,
    provenance:[{ source, status:"applied", reason:`${pool.label} ${pool.current}/${pool.maximum} -> ${next.current}/${next.maximum}` }],
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

function normalizeLongRestMaximum(pool: ResourcePool) {
  if (pool.maximumAfterLongRest === undefined) return pool;
  const maximum = pool.maximumAfterLongRest;
  return {
    ...pool,
    current:Math.min(pool.current, maximum),
    maximum,
    maximumAfterLongRest:undefined,
  } satisfies ResourcePool;
}

export function recoverResources(
  pools: ResourcePool[],
  trigger: "shortRest" | "longRest" | "turnStart",
): { next:ResourcePool[]; provenance:ProvenanceRecord[] } {
  const provenance: ProvenanceRecord[] = [];
  const next = pools.map((pool) => {
    validate(pool);
    const normalized = trigger === "longRest" ? normalizeLongRestMaximum(pool) : { ...pool };
    const amount = normalized.recovery?.[trigger];
    if (amount === undefined) {
      if (trigger === "longRest" && normalized.maximum !== pool.maximum) {
        provenance.push({ source:"resource-recovery:longRest", status:"applied", reason:`${pool.label} temporary maximum ${pool.maximum} -> ${normalized.maximum}` });
      }
      return normalized;
    }
    const resolved = recoverResource(normalized, amount, `resource-recovery:${trigger}`);
    provenance.push(...resolved.provenance);
    if (trigger === "longRest" && normalized.maximum !== pool.maximum) {
      provenance.push({ source:"resource-recovery:longRest", status:"applied", reason:`${pool.label} temporary maximum ${pool.maximum} -> ${normalized.maximum}` });
    }
    return resolved.next;
  });
  return { next, provenance };
}

export function findResource(pools: ResourcePool[], id: string) {
  const index = pools.findIndex((pool) => pool.id === id);
  if (index < 0) throw new DomainEvaluationError(`resource not found: ${id}`);
  return { index, pool:pools[index] };
}
