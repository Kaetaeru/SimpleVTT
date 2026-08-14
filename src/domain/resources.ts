import { DomainEvaluationError, type ProvenanceRecord } from "./profileEngine";

export type RecoveryAmount = number | "all";
export type ResourceRecoveryTrigger = "shortRest" | "longRest" | "turnStart";

export interface ResourceRecovery {
  shortRest?: RecoveryAmount;
  longRest?: RecoveryAmount;
  turnStart?: RecoveryAmount;
}

export interface ResourceRecoveryLockouts {
  shortRest?: number;
  longRest?: number;
}

export interface ResourcePool {
  id: string;
  label: string;
  current: number;
  maximum: number;
  recovery?: ResourceRecovery;
  maximumAfterLongRest?: number;
  recoveryLockouts?: ResourceRecoveryLockouts;
}

export interface ResourceResolution {
  next: ResourcePool;
  delta: number;
  provenance: ProvenanceRecord[];
}

function validateLockout(value:number|undefined,label:string) {
  if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
    throw new DomainEvaluationError(`${label} recovery lockout must be a non-negative integer`);
  }
}

function validate(pool: ResourcePool) {
  if (!pool.id) throw new DomainEvaluationError("resource id is required");
  if (!Number.isInteger(pool.current) || !Number.isInteger(pool.maximum) || pool.current < 0 || pool.maximum < 0 || pool.current > pool.maximum) {
    throw new DomainEvaluationError(`invalid resource pool ${pool.id}`);
  }
  if (pool.maximumAfterLongRest !== undefined && (!Number.isInteger(pool.maximumAfterLongRest) || pool.maximumAfterLongRest < 0 || pool.maximumAfterLongRest > pool.maximum)) {
    throw new DomainEvaluationError(`invalid long-rest maximum for ${pool.id}`);
  }
  validateLockout(pool.recoveryLockouts?.shortRest,"shortRest");
  validateLockout(pool.recoveryLockouts?.longRest,"longRest");
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

export function setResourceRecoveryLockout(
  pool:ResourcePool,
  trigger:"shortRest"|"longRest",
  rests:number,
  source:string,
):ResourceResolution {
  validate(pool);
  if (!Number.isInteger(rests) || rests <= 0) throw new DomainEvaluationError("resource recovery lockout must require at least one rest");
  const next:ResourcePool = {
    ...pool,
    recoveryLockouts:{
      ...(pool.recoveryLockouts ?? {}),
      [trigger]:rests,
    },
  };
  validate(next);
  return {
    next,
    delta:0,
    provenance:[{ source, status:"applied", reason:`${pool.label} ${trigger} recovery locked for ${rests} rests` }],
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

function applyRecoveryLockout(
  pool:ResourcePool,
  trigger:ResourceRecoveryTrigger,
): { pool:ResourcePool; blocked:boolean; provenance:ProvenanceRecord[] } {
  if (trigger === "turnStart") return { pool, blocked:false, provenance:[] };
  const remaining = pool.recoveryLockouts?.[trigger];
  if (!remaining) return { pool, blocked:false, provenance:[] };
  const after = remaining - 1;
  const recoveryLockouts = { ...(pool.recoveryLockouts ?? {}) };
  if (after > 0) recoveryLockouts[trigger] = after;
  else delete recoveryLockouts[trigger];
  const next:ResourcePool = {
    ...pool,
    recoveryLockouts:Object.keys(recoveryLockouts).length ? recoveryLockouts : undefined,
  };
  return {
    pool:next,
    blocked:after > 0,
    provenance:[{
      source:`resource-recovery-lockout:${trigger}`,
      status:"applied",
      reason:after > 0
        ? `${pool.label} ${trigger} recovery remains locked for ${after} rests`
        : `${pool.label} ${trigger} recovery lockout completed`,
    }],
  };
}

export function recoverResources(
  pools: ResourcePool[],
  trigger: ResourceRecoveryTrigger,
): { next:ResourcePool[]; provenance:ProvenanceRecord[] } {
  const provenance: ProvenanceRecord[] = [];
  const next = pools.map((pool) => {
    validate(pool);
    const normalized = trigger === "longRest" ? normalizeLongRestMaximum(pool) : { ...pool };
    const lockout = applyRecoveryLockout(normalized,trigger);
    provenance.push(...lockout.provenance);
    if (lockout.blocked) {
      if (trigger === "longRest" && normalized.maximum !== pool.maximum) {
        provenance.push({ source:"resource-recovery:longRest", status:"applied", reason:`${pool.label} temporary maximum ${pool.maximum} -> ${normalized.maximum}` });
      }
      return lockout.pool;
    }
    const amount = lockout.pool.recovery?.[trigger];
    if (amount === undefined) {
      if (trigger === "longRest" && normalized.maximum !== pool.maximum) {
        provenance.push({ source:"resource-recovery:longRest", status:"applied", reason:`${pool.label} temporary maximum ${pool.maximum} -> ${normalized.maximum}` });
      }
      return lockout.pool;
    }
    const resolved = recoverResource(lockout.pool, amount, `resource-recovery:${trigger}`);
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
