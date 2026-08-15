import { resolveD20Test, type D20TestResult, type FixedDiceInput, type ModifierContribution } from "./d20";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { ROGUE_THIEF_SUBCLASS_ID } from "./srdSubclassCatalog";
import type { CoverDegree } from "./targeting";
import type { InitiativeEntry } from "./initiative";

export const ROGUE_THIEF_CLASS_ID = "dnd.srd521.class.rogue";
export const THIEF_SUPREME_SNEAK_FEATURE_ID = "dnd.srd521.feature.rogue.thief.supreme-sneak";
export const THIEF_SUPREME_SNEAK_OPTION_ID = "dnd.srd521.cunning-strike.rogue.thief.supreme-sneak.stealth-attack";
export const THIEF_USE_MAGIC_DEVICE_FEATURE_ID = "dnd.srd521.feature.rogue.thief.use-magic-device";
export const THIEF_THIEFS_REFLEXES_FEATURE_ID = "dnd.srd521.feature.rogue.thief.thiefs-reflexes";

function validateThief(level:number,subclassId:string|undefined,minimumLevel:number,feature:string) {
  if (!Number.isInteger(level) || level < minimumLevel || level > 20) {
    throw new DomainEvaluationError(`${feature} requires Rogue level ${minimumLevel}-20`);
  }
  if (subclassId !== ROGUE_THIEF_SUBCLASS_ID) {
    throw new DomainEvaluationError(`${feature} requires the Thief subclass`);
  }
}

export interface SupremeSneakCunningStrikeDefinition {
  id:string;
  featureId:string;
  label:string;
  sneakAttackDiceCost:number;
}

export const THIEF_SUPREME_SNEAK_CUNNING_STRIKE:SupremeSneakCunningStrikeDefinition = {
  id:THIEF_SUPREME_SNEAK_OPTION_ID,
  featureId:THIEF_SUPREME_SNEAK_FEATURE_ID,
  label:"은신 공격",
  sneakAttackDiceCost:1,
};

export interface SupremeSneakPreservationRequest {
  rogueLevel:number;
  subclassId?:string;
  usedStealthAttackOption:boolean;
  invisibleFromHideAction:boolean;
  endTurnCover:CoverDegree;
}

export function supremeSneakPreservesHideInvisible(request:SupremeSneakPreservationRequest) {
  validateThief(request.rogueLevel,request.subclassId,9,"Supreme Sneak");
  if (!request.usedStealthAttackOption || !request.invisibleFromHideAction) return false;
  return request.endTurnCover === "three-quarters" || request.endTurnCover === "total";
}

export function thiefMagicItemAttunementMaximum(
  ordinaryMaximum:number,
  rogueLevel:number,
  subclassId?:string,
) {
  if (!Number.isInteger(ordinaryMaximum) || ordinaryMaximum < 0) {
    throw new DomainEvaluationError("ordinary attunement maximum must be a non-negative integer");
  }
  validateThief(rogueLevel,subclassId,13,"Use Magic Device");
  return Math.max(ordinaryMaximum,4);
}

export interface ThiefChargeUseResult {
  dieFace:number;
  requestedCharges:number;
  spentCharges:number;
  preserved:boolean;
}

export function resolveThiefMagicItemChargeUse(
  rogueLevel:number,
  subclassId:string|undefined,
  requestedCharges:number,
  dieFace:number,
):ThiefChargeUseResult {
  validateThief(rogueLevel,subclassId,13,"Use Magic Device");
  if (!Number.isInteger(requestedCharges) || requestedCharges < 1) {
    throw new DomainEvaluationError("magic item charge use must request at least one charge");
  }
  if (!Number.isInteger(dieFace) || dieFace < 1 || dieFace > 6) {
    throw new DomainEvaluationError("Use Magic Device charge preservation requires one fixed d6 face");
  }
  const preserved = dieFace === 6;
  return {
    dieFace,
    requestedCharges,
    spentCharges:preserved ? 0 : requestedCharges,
    preserved,
  };
}

export interface ThiefSpellScrollRequest {
  rogueLevel:number;
  subclassId?:string;
  spellLevel:number;
  dice?:FixedDiceInput;
  intelligenceArcanaModifiers?:ModifierContribution[];
}

export interface ThiefSpellScrollResult {
  spellLevel:number;
  spellcastingAbility:"intelligence";
  checkRequired:boolean;
  dc?:number;
  check?:D20TestResult;
  outcome:"cast"|"destroyed";
}

export function resolveThiefSpellScrollUse(
  profile:RulesProfileLike,
  request:ThiefSpellScrollRequest,
):ThiefSpellScrollResult {
  validateThief(request.rogueLevel,request.subclassId,13,"Use Magic Device");
  if (!Number.isInteger(request.spellLevel) || request.spellLevel < 0 || request.spellLevel > 9) {
    throw new DomainEvaluationError("spell scroll level must be an integer from 0 to 9");
  }
  if (request.spellLevel <= 1) {
    return {
      spellLevel:request.spellLevel,
      spellcastingAbility:"intelligence",
      checkRequired:false,
      outcome:"cast",
    };
  }
  if (!request.dice) throw new DomainEvaluationError("level 2+ Thief spell scroll use requires a fixed d20 Arcana check");
  const dc = 10 + request.spellLevel;
  const check = resolveD20Test(profile,{
    family:"ability-check",
    target:dc,
    modifierContributions:request.intelligenceArcanaModifiers ?? [],
    dice:request.dice,
    targetSource:`${THIEF_USE_MAGIC_DEVICE_FEATURE_ID}:scroll-dc`,
  });
  return {
    spellLevel:request.spellLevel,
    spellcastingAbility:"intelligence",
    checkRequired:true,
    dc,
    check,
    outcome:check.outcome === "success" ? "cast" : "destroyed",
  };
}

export interface ThiefFirstRoundTurn {
  actorId:string;
  controller:InitiativeEntry["controller"];
  initiativeTotal:number;
  ordinal:1|2;
  sourceId:"initiative"|typeof THIEF_THIEFS_REFLEXES_FEATURE_ID;
}

export function thiefFirstRoundTurns(
  entry:InitiativeEntry,
  rogueLevel:number,
  subclassId?:string,
):ThiefFirstRoundTurn[] {
  validateThief(rogueLevel,subclassId,17,"Thief's Reflexes");
  if (!Number.isFinite(entry.total)) throw new DomainEvaluationError("initiative total must be finite");
  return [
    {
      actorId:entry.id,
      controller:entry.controller,
      initiativeTotal:entry.total,
      ordinal:1,
      sourceId:"initiative",
    },
    {
      actorId:entry.id,
      controller:entry.controller,
      initiativeTotal:entry.total - 10,
      ordinal:2,
      sourceId:THIEF_THIEFS_REFLEXES_FEATURE_ID,
    },
  ];
}
