import rawCatalog from "../generated/featRuleCatalog.generated.json";
import type { AbilityKey } from "./progressionCatalog";

export interface FeatAbilityRequirement {
  any:AbilityKey[];
  minimum:number;
}

export interface FeatAbilityIncrease {
  any?:AbilityKey[];
  amount:number;
  maximum:number;
}

export interface FeatRuleConfig {
  tier?:"origin"|"general";
  minimumLevel?:number;
  repeatable?:boolean;
  requires?:string;
  abilityPrerequisite?:FeatAbilityRequirement;
  abilityIncrease?:FeatAbilityIncrease;
  grants?:string[];
  [key:string]:unknown;
}

export interface FeatRuleDefinition {
  id:string;
  name:string;
  originalName:string;
  tags:string[];
  config:FeatRuleConfig;
}

interface FeatRuleCatalog {
  schemaVersion:string;
  rulesProfileId:string;
  count:number;
  feats:FeatRuleDefinition[];
}

export const FEAT_RULE_CATALOG = rawCatalog as unknown as FeatRuleCatalog;
const BY_ID = new Map(FEAT_RULE_CATALOG.feats.map((entry) => [entry.id,entry]));

export function featRuleById(featId:string) {
  return BY_ID.get(featId);
}

export function epicBoonFeatRules() {
  return FEAT_RULE_CATALOG.feats.filter((entry) => entry.tags.includes("epic-boon"));
}

export interface FeatEligibilityContext {
  totalLevel:number;
  abilities:Record<AbilityKey,number>;
  featureIds?:readonly string[];
  hasSpellcastingFeature?:boolean;
  knownFeatIds?:readonly string[];
}

export interface FeatEligibility {
  eligible:boolean;
  reasons:string[];
}

export function featEligibility(definition:FeatRuleDefinition,context:FeatEligibilityContext):FeatEligibility {
  const reasons:string[] = [];
  const minimumLevel = definition.config.minimumLevel ?? 0;
  if (context.totalLevel < minimumLevel) reasons.push(`requires level ${minimumLevel}`);

  const prerequisite = definition.config.abilityPrerequisite;
  if (prerequisite) {
    const met = prerequisite.any.some((ability) => context.abilities[ability] >= prerequisite.minimum);
    if (!met) reasons.push(`requires ${prerequisite.any.join("/")} ${prerequisite.minimum}+`);
  }

  if (definition.config.requires === "spellcasting-feature" && !context.hasSpellcastingFeature) {
    reasons.push("requires Spellcasting feature");
  } else if (definition.config.requires && definition.config.requires !== "spellcasting-feature") {
    if (!(context.featureIds ?? []).includes(definition.config.requires)) reasons.push(`requires ${definition.config.requires}`);
  }

  const known = new Set(context.knownFeatIds ?? []);
  if (known.has(definition.id) && definition.config.repeatable !== true && !definition.tags.includes("repeatable")) {
    reasons.push("feat is not repeatable and is already known");
  }
  return { eligible:reasons.length === 0, reasons };
}

export function featAbilityIncreaseOptions(definition:FeatRuleDefinition):AbilityKey[] {
  const increase = definition.config.abilityIncrease;
  if (!increase) return [];
  return increase.any ? [...increase.any] : ["str","dex","con","int","wis","cha"];
}
