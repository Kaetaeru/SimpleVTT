import type { DamageDefenseContribution } from "./damage";
import type { D20TestFamily, ModifierContribution } from "./d20";
import type { RollStateContribution } from "./profileEngine";

export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";
export type ConditionId =
  | "blinded"
  | "charmed"
  | "deafened"
  | "exhaustion"
  | "frightened"
  | "grappled"
  | "incapacitated"
  | "invisible"
  | "paralyzed"
  | "petrified"
  | "poisoned"
  | "prone"
  | "restrained"
  | "stunned"
  | "unconscious";

export interface ConditionEffectRef {
  id: string;
  conditionId: ConditionId;
  sourceActorId?: string;
}

export interface ConditionProfile {
  id: ConditionId;
  name: string;
  implied?: ConditionId[];
  speedZero?: boolean;
  senses?: { sight?:"none"; hearing?:"none"; speech?:"none" };
}

export const SRD_521_CONDITIONS: Record<ConditionId, ConditionProfile> = {
  blinded:{ id:"blinded", name:"Blinded", senses:{ sight:"none" } },
  charmed:{ id:"charmed", name:"Charmed" },
  deafened:{ id:"deafened", name:"Deafened", senses:{ hearing:"none" } },
  exhaustion:{ id:"exhaustion", name:"Exhaustion" },
  frightened:{ id:"frightened", name:"Frightened" },
  grappled:{ id:"grappled", name:"Grappled", speedZero:true },
  incapacitated:{ id:"incapacitated", name:"Incapacitated", senses:{ speech:"none" } },
  invisible:{ id:"invisible", name:"Invisible" },
  paralyzed:{ id:"paralyzed", name:"Paralyzed", implied:["incapacitated"], speedZero:true },
  petrified:{ id:"petrified", name:"Petrified", implied:["incapacitated"], speedZero:true },
  poisoned:{ id:"poisoned", name:"Poisoned" },
  prone:{ id:"prone", name:"Prone" },
  restrained:{ id:"restrained", name:"Restrained", speedZero:true },
  stunned:{ id:"stunned", name:"Stunned", implied:["incapacitated"] },
  unconscious:{ id:"unconscious", name:"Unconscious", implied:["incapacitated","prone"], speedZero:true },
};

export interface ConditionD20Context {
  actorId: string;
  targetId?: string;
  family: D20TestFamily;
  ability?: AbilityKey;
  requiresSight?: boolean;
  requiresHearing?: boolean;
  socialInteraction?: boolean;
  distanceToTargetFeet?: number;
  actorCanSeeTarget?: boolean;
  targetCanSeeActor?: boolean;
  visibleSourceIds?: string[];
  actorConditions: ConditionEffectRef[];
  targetConditions?: ConditionEffectRef[];
}

export interface ConditionD20Adjustments {
  rollStateContributions: RollStateContribution[];
  modifierContributions: ModifierContribution[];
  autoFailure: boolean;
  criticalOnHit: boolean;
}

function expandIds(effects: ConditionEffectRef[]): Set<ConditionId> {
  const out = new Set<ConditionId>();
  const visit = (id: ConditionId) => {
    if (out.has(id)) return;
    out.add(id);
    for (const implied of SRD_521_CONDITIONS[id].implied ?? []) visit(implied);
  };
  effects.forEach((effect) => visit(effect.conditionId));
  return out;
}

export function activeConditionIds(effects: ConditionEffectRef[]) {
  return [...expandIds(effects)];
}

export function exhaustionLevel(effects: ConditionEffectRef[]) {
  return Math.min(6, effects.filter((effect) => effect.conditionId === "exhaustion").length);
}

export function exhaustionIsFatal(effects: ConditionEffectRef[]) {
  return exhaustionLevel(effects) >= 6;
}

export function conditionActionAvailability(effects: ConditionEffectRef[]) {
  const ids = expandIds(effects);
  const inactive = ids.has("incapacitated");
  return { action:!inactive, bonusAction:!inactive, reaction:!inactive, canSpeak:!inactive };
}

export function conditionSenses(effects: ConditionEffectRef[]) {
  const ids = expandIds(effects);
  return { canSee:!ids.has("blinded"), canHear:!ids.has("deafened"), canSpeak:!ids.has("incapacitated") };
}

export function effectiveSpeed(baseSpeed: number, effects: ConditionEffectRef[]) {
  const ids = expandIds(effects);
  if ([...ids].some((id) => SRD_521_CONDITIONS[id].speedZero)) return 0;
  return Math.max(0, baseSpeed - exhaustionLevel(effects) * 5);
}

export function proneStandingCost(speed: number, effects: ConditionEffectRef[]) {
  return expandIds(effects).has("prone") ? Math.floor(speed / 2) : 0;
}

export function conditionTargetingRestriction(
  actorConditions: ConditionEffectRef[],
  targetId: string,
  harmful: boolean,
): string | undefined {
  if (!harmful) return undefined;
  const charmedByTarget = actorConditions.some(
    (effect) => effect.conditionId === "charmed" && effect.sourceActorId === targetId,
  );
  return charmedByTarget
    ? "Charmed prevents attacking or targeting the charmer with damaging abilities or magical effects"
    : undefined;
}

export function frightenedMovementRestriction(
  actorConditions: ConditionEffectRef[],
  destinationMovesCloserToSource: boolean,
  visibleSourceIds: string[],
) {
  if (!destinationMovesCloserToSource) return undefined;
  const visible = new Set(visibleSourceIds);
  const source = actorConditions.find(
    (effect) => effect.conditionId === "frightened" && effect.sourceActorId && visible.has(effect.sourceActorId),
  );
  return source ? `Frightened prevents willingly moving closer to ${source.sourceActorId}` : undefined;
}

export function conditionDamageDefenses(effects: ConditionEffectRef[]): DamageDefenseContribution[] {
  return expandIds(effects).has("petrified")
    ? [{ source:"condition:petrified", kind:"resistance", damageType:"*" }]
    : [];
}

export function conditionImmunities(effects: ConditionEffectRef[]): ConditionId[] {
  return expandIds(effects).has("petrified") ? ["poisoned"] : [];
}

export function conditionD20Adjustments(context: ConditionD20Context): ConditionD20Adjustments {
  const actorIds = expandIds(context.actorConditions);
  const targetConditions = context.targetConditions ?? [];
  const targetIds = expandIds(targetConditions);
  const rollStateContributions: RollStateContribution[] = [];
  const modifierContributions: ModifierContribution[] = [];
  let autoFailure = false;
  let criticalOnHit = false;
  const actorSource = (condition:ConditionId, state:"advantage"|"disadvantage") =>
    rollStateContributions.push({ source:`condition:${condition}:actor`, state });
  const targetSource = (condition:ConditionId, state:"advantage"|"disadvantage") =>
    rollStateContributions.push({ source:`condition:${condition}:target`, state });

  const level = exhaustionLevel(context.actorConditions);
  if (level > 0) modifierContributions.push({ source:"condition:exhaustion", value:-2 * level });

  if (context.family === "ability-check") {
    if (actorIds.has("poisoned")) actorSource("poisoned", "disadvantage");
    if (context.requiresSight && actorIds.has("blinded")) autoFailure = true;
    if (context.requiresHearing && actorIds.has("deafened")) autoFailure = true;
    const visible = new Set(context.visibleSourceIds ?? []);
    if (context.actorConditions.some(
      (effect) => effect.conditionId === "frightened" && effect.sourceActorId && visible.has(effect.sourceActorId),
    )) actorSource("frightened", "disadvantage");
    if (context.socialInteraction && targetConditions.some(
      (effect) => effect.conditionId === "charmed" && effect.sourceActorId === context.actorId,
    )) targetSource("charmed", "advantage");
  }

  if (context.family === "attack-roll") {
    if (actorIds.has("blinded")) actorSource("blinded", "disadvantage");
    if (actorIds.has("poisoned")) actorSource("poisoned", "disadvantage");
    if (actorIds.has("prone")) actorSource("prone", "disadvantage");
    if (actorIds.has("restrained")) actorSource("restrained", "disadvantage");
    const visible = new Set(context.visibleSourceIds ?? []);
    if (context.actorConditions.some(
      (effect) => effect.conditionId === "frightened" && effect.sourceActorId && visible.has(effect.sourceActorId),
    )) actorSource("frightened", "disadvantage");
    const grapplers = context.actorConditions
      .filter((effect) => effect.conditionId === "grappled" && effect.sourceActorId)
      .map((effect) => effect.sourceActorId!);
    if (grapplers.length && context.targetId && grapplers.some((grappler) => grappler !== context.targetId)) {
      actorSource("grappled", "disadvantage");
    }
    if (actorIds.has("invisible") && context.targetCanSeeActor === false) actorSource("invisible", "advantage");

    if (targetIds.has("blinded")) targetSource("blinded", "advantage");
    if (targetIds.has("restrained")) targetSource("restrained", "advantage");
    if (targetIds.has("paralyzed")) targetSource("paralyzed", "advantage");
    if (targetIds.has("petrified")) targetSource("petrified", "advantage");
    if (targetIds.has("stunned")) targetSource("stunned", "advantage");
    if (targetIds.has("unconscious")) targetSource("unconscious", "advantage");
    if (targetIds.has("invisible") && context.actorCanSeeTarget === false) targetSource("invisible", "disadvantage");
    if (targetIds.has("prone")) {
      targetSource("prone", (context.distanceToTargetFeet ?? Infinity) <= 5 ? "advantage" : "disadvantage");
    }
    if ((targetIds.has("paralyzed") || targetIds.has("unconscious"))
      && (context.distanceToTargetFeet ?? Infinity) <= 5) criticalOnHit = true;
  }

  if (context.family === "saving-throw" && context.ability === "dex" && actorIds.has("restrained")) {
    actorSource("restrained", "disadvantage");
  }
  if (context.family === "saving-throw"
    && (context.ability === "str" || context.ability === "dex")
    && (actorIds.has("paralyzed") || actorIds.has("petrified") || actorIds.has("stunned") || actorIds.has("unconscious"))) {
    autoFailure = true;
  }

  return { rollStateContributions, modifierContributions, autoFailure, criticalOnHit };
}

export function initiativeConditionContributions(effects: ConditionEffectRef[]): RollStateContribution[] {
  const ids = expandIds(effects);
  const out: RollStateContribution[] = [];
  if (ids.has("incapacitated")) out.push({ source:"condition:incapacitated:initiative", state:"disadvantage" });
  if (ids.has("invisible")) out.push({ source:"condition:invisible:initiative", state:"advantage" });
  return out;
}
