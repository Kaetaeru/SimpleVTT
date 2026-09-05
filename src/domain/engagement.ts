/**
 * V1.2 T1-03 — engagement without positions.
 *
 * SimpleVTT stores no coordinates. The only "spatial" relation is *engagement*: two creatures are engaged
 * once one of them made a melee attack against the other. Engagement is what the rules that would otherwise
 * need adjacency read (ranged attacks in melee, opportunity attacks on 물러남). It ends when a creature
 * withdraws (물러남/이탈), dies or leaves the scene, or after a full round without melee between the pair.
 *
 * Pure functions over an immutable record list; the app adapter owns storage and undo.
 */
export interface EngagementRecord {
  /** lexicographically smaller id */
  a:string;
  /** lexicographically larger id */
  b:string;
  sinceRound:number;
  lastMeleeRound:number;
}

export function engagementPair(left:string,right:string):[string,string] {
  return left<right ? [left,right] : [right,left];
}

export function isEngaged(records:readonly EngagementRecord[],left:string,right:string) {
  const [a,b]=engagementPair(left,right);
  return records.some((record)=>record.a===a && record.b===b);
}

export function engagedWith(records:readonly EngagementRecord[],actorId:string):string[] {
  return records.flatMap((record)=>record.a===actorId ? [record.b] : record.b===actorId ? [record.a] : []);
}

/** A melee attack (hit or miss) between two creatures creates or refreshes their engagement. */
export function recordMeleeAttack(records:readonly EngagementRecord[],attackerId:string,targetId:string,round:number):EngagementRecord[] {
  if (attackerId===targetId) return [...records];
  const [a,b]=engagementPair(attackerId,targetId);
  const existing=records.find((record)=>record.a===a && record.b===b);
  if (existing) return records.map((record)=>record===existing ? { ...record, lastMeleeRound:Math.max(record.lastMeleeRound,round) } : record);
  return [...records,{ a, b, sinceRound:round, lastMeleeRound:round }];
}

export function clearEngagement(records:readonly EngagementRecord[],left:string,right:string):EngagementRecord[] {
  const [a,b]=engagementPair(left,right);
  return records.filter((record)=>!(record.a===a && record.b===b));
}

/** 물러남 / 이탈 / death / leaving the scene: every engagement of the creature ends. */
export function clearEngagementsOf(records:readonly EngagementRecord[],actorId:string):EngagementRecord[] {
  return records.filter((record)=>record.a!==actorId && record.b!==actorId);
}

/** A round without melee between the pair ends it: at the start of `round`, pairs last refreshed before `round-1` drop. */
export function pruneIdleEngagements(records:readonly EngagementRecord[],round:number):EngagementRecord[] {
  return records.filter((record)=>record.lastMeleeRound>=round-1);
}

/** Keep only engagements whose both members are still present (and alive when `alive` is given). */
export function pruneEngagementsToPresent(records:readonly EngagementRecord[],present:ReadonlySet<string>):EngagementRecord[] {
  return records.filter((record)=>present.has(record.a) && present.has(record.b));
}
