import { resolveD20Test, type FixedDiceInput, type ModifierContribution } from "./d20";
import { DomainEvaluationError, type ProvenanceRecord, type RollStateContribution, type RulesProfileLike } from "./profileEngine";
import type { EffectInstance } from "./effects";
import { removeEffectGroup } from "./effects";

export interface ConcentrationState {
  actorId: string;
  groupId: string;
  sourceId: string;
}

export interface StartConcentrationResolution {
  next: ConcentrationState;
  replaced?: ConcentrationState;
  effects: EffectInstance[];
  expiredEffects: EffectInstance[];
  provenance: ProvenanceRecord[];
}

export interface ConcentrationCheckRequest {
  damage: number;
  dice: FixedDiceInput;
  modifierContributions?: ModifierContribution[];
  rollStateContributions?: RollStateContribution[];
}

export interface ConcentrationCheckResolution {
  dc: number;
  maintained: boolean;
  provenance: ProvenanceRecord[];
}

export function concentrationCheckDc(damage: number) {
  if (!Number.isInteger(damage) || damage < 0) throw new DomainEvaluationError("concentration damage must be a non-negative integer");
  return Math.min(30, Math.max(10, Math.floor(damage / 2)));
}

export function startConcentration(
  current: ConcentrationState | undefined,
  next: ConcentrationState,
  effects: EffectInstance[],
): StartConcentrationResolution {
  if (!next.actorId || !next.groupId || !next.sourceId) throw new DomainEvaluationError("concentration actorId, groupId, and sourceId are required");
  if (current && current.actorId !== next.actorId) throw new DomainEvaluationError("concentration replacement must belong to the same actor");
  const removed = current ? removeEffectGroup(effects, current.groupId) : { active:[...effects], expired:[], provenance:[] };
  return {
    next,
    replaced:current,
    effects:removed.active,
    expiredEffects:removed.expired,
    provenance:[
      ...removed.provenance,
      { source:next.sourceId, status:"applied", reason:current ? `new concentration ${next.groupId} replaces ${current.groupId}` : `concentration ${next.groupId} started` },
    ],
  };
}

export function endConcentration(
  current: ConcentrationState | undefined,
  effects: EffectInstance[],
  reason: string,
) {
  if (!current) return { next:undefined, effects:[...effects], expiredEffects:[] as EffectInstance[], provenance:[] as ProvenanceRecord[] };
  const removed = removeEffectGroup(effects, current.groupId);
  return {
    next:undefined,
    effects:removed.active,
    expiredEffects:removed.expired,
    provenance:[...removed.provenance, { source:current.sourceId, status:"applied" as const, reason:`concentration ended: ${reason}` }],
  };
}

export function resolveConcentrationDamageCheck(
  profile: RulesProfileLike,
  request: ConcentrationCheckRequest,
): ConcentrationCheckResolution {
  if (request.damage <= 0) return { dc:0, maintained:true, provenance:[] };
  const dc = concentrationCheckDc(request.damage);
  const result = resolveD20Test(profile, {
    family:"saving-throw",
    target:dc,
    modifierContributions:request.modifierContributions ?? [],
    rollStateContributions:request.rollStateContributions ?? [],
    dice:request.dice,
    targetSource:"profile:dnd.srd-5.2.1/concentration-damage-dc",
  });
  return {
    dc,
    maintained:result.outcome === "success",
    provenance:[...result.provenance, {
      source:"profile:dnd.srd-5.2.1/concentration",
      status:"applied",
      reason:result.outcome === "success" ? "Concentration maintained" : "Concentration broken by damage",
    }],
  };
}

export function concentrationBreakReason(input: { incapacitated:boolean; dead:boolean }) {
  if (input.dead) return "concentrator died";
  if (input.incapacitated) return "concentrator became Incapacitated";
  return undefined;
}
