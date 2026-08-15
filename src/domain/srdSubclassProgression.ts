import type { ChoiceDefinition, ChoiceSelectionMap } from "./choiceDefinition";
import {
  BARBARIAN_BERSERKER_SUBCLASS_ID,
  BERSERKER_INTIMIDATING_PRESENCE_FEATURE_ID,
  BERSERKER_MINDLESS_RAGE_FEATURE_ID,
  BERSERKER_RETALIATION_FEATURE_ID,
} from "./barbarianBerserker";
import { CLERIC_LIFE_DOMAIN_SUBCLASS_ID } from "./clericLifeDomain";
import { DRUID_CIRCLE_LAND_SUBCLASS_ID } from "./druidCircleLand";
import { FIGHTER_CHAMPION_SUBCLASS_ID } from "./fighterChampion";
import {
  DEVOTION_AURA_FEATURE_ID,
  DEVOTION_HOLY_NIMBUS_FEATURE_ID,
  DEVOTION_SMITE_OF_PROTECTION_FEATURE_ID,
} from "./paladinDevotion";
import {
  HUNTER_DEFENSIVE_TACTIC_OPTIONS,
  HUNTER_DEFENSIVE_TACTICS_FEATURE_ID,
  HUNTER_SUPERIOR_DEFENSE_FEATURE_ID,
  HUNTER_SUPERIOR_PREY_FEATURE_ID,
} from "./rangerHunter";
import type { ProgressionCharacterState } from "./progression";
import {
  inferSrdSubclassId,
  MONK_OPEN_HAND_SUBCLASS_ID,
  PALADIN_DEVOTION_SUBCLASS_ID,
  RANGER_HUNTER_SUBCLASS_ID,
  ROGUE_THIEF_SUBCLASS_ID,
  srdSubclassIdForClass,
  WARLOCK_FIEND_SUBCLASS_ID,
} from "./srdSubclassCatalog";

export const BARBARIAN_SUBCLASS_CLASS_ID = "dnd.srd521.class.barbarian";
export const CLERIC_SUBCLASS_CLASS_ID = "dnd.srd521.class.cleric";
export const DRUID_SUBCLASS_CLASS_ID = "dnd.srd521.class.druid";
export const FIGHTER_SUBCLASS_CLASS_ID = "dnd.srd521.class.fighter";
export const MONK_SUBCLASS_CLASS_ID = "dnd.srd521.class.monk";
export const PALADIN_SUBCLASS_CLASS_ID = "dnd.srd521.class.paladin";
export const RANGER_SUBCLASS_CLASS_ID = "dnd.srd521.class.ranger";
export const ROGUE_SUBCLASS_CLASS_ID = "dnd.srd521.class.rogue";
export const WARLOCK_SUBCLASS_CLASS_ID = "dnd.srd521.class.warlock";
export const SUBCLASS_AUTO_SELECTION_PREFIX = "auto-subclass-feature:";

export interface SrdSubclassFeatureDefinition {
  id:string;
  label:string;
}

export interface SrdSubclassLevelRelationship {
  classId:string;
  subclassId:string;
  classLevel:number;
  features:SrdSubclassFeatureDefinition[];
  choice?:"fighting-style"|"ranger-defensive-tactics";
}

export interface SrdSubclassProgressionState extends ProgressionCharacterState {
  subclassIds?:Record<string,string>;
  subclassFeatureIds?:string[];
  subclassFeatureSources?:Record<string,string>;
  fightingStyleFeatIds?:string[];
  fightingStyleFeatSources?:Record<string,string>;
}

const RELATIONSHIPS:readonly SrdSubclassLevelRelationship[] = [
  {
    classId:BARBARIAN_SUBCLASS_CLASS_ID,
    subclassId:BARBARIAN_BERSERKER_SUBCLASS_ID,
    classLevel:3,
    features:[],
  },
  {
    classId:BARBARIAN_SUBCLASS_CLASS_ID,
    subclassId:BARBARIAN_BERSERKER_SUBCLASS_ID,
    classLevel:6,
    features:[{ id:BERSERKER_MINDLESS_RAGE_FEATURE_ID, label:"무심한 격노" }],
  },
  {
    classId:BARBARIAN_SUBCLASS_CLASS_ID,
    subclassId:BARBARIAN_BERSERKER_SUBCLASS_ID,
    classLevel:10,
    features:[{ id:BERSERKER_RETALIATION_FEATURE_ID, label:"보복" }],
  },
  {
    classId:BARBARIAN_SUBCLASS_CLASS_ID,
    subclassId:BARBARIAN_BERSERKER_SUBCLASS_ID,
    classLevel:14,
    features:[{ id:BERSERKER_INTIMIDATING_PRESENCE_FEATURE_ID, label:"위압적인 존재감" }],
  },
  {
    classId:CLERIC_SUBCLASS_CLASS_ID,
    subclassId:CLERIC_LIFE_DOMAIN_SUBCLASS_ID,
    classLevel:3,
    features:[
      { id:"dnd.srd521.feature.cleric.life-domain.disciple-of-life", label:"생명의 제자" },
      { id:"dnd.srd521.feature.cleric.life-domain.spells", label:"생명 권역 주문" },
      { id:"dnd.srd521.feature.cleric.life-domain.preserve-life", label:"생명 보존" },
    ],
  },
  {
    classId:CLERIC_SUBCLASS_CLASS_ID,
    subclassId:CLERIC_LIFE_DOMAIN_SUBCLASS_ID,
    classLevel:6,
    features:[{ id:"dnd.srd521.feature.cleric.life-domain.blessed-healer", label:"축복받은 치유자" }],
  },
  {
    classId:CLERIC_SUBCLASS_CLASS_ID,
    subclassId:CLERIC_LIFE_DOMAIN_SUBCLASS_ID,
    classLevel:17,
    features:[{ id:"dnd.srd521.feature.cleric.life-domain.supreme-healing", label:"최고의 치유" }],
  },
  {
    classId:DRUID_SUBCLASS_CLASS_ID,
    subclassId:DRUID_CIRCLE_LAND_SUBCLASS_ID,
    classLevel:3,
    features:[
      { id:"dnd.srd521.feature.druid.circle-of-the-land.spells", label:"대지의 회합 주문" },
      { id:"dnd.srd521.feature.druid.circle-of-the-land.lands-aid", label:"대지의 도움" },
    ],
  },
  {
    classId:DRUID_SUBCLASS_CLASS_ID,
    subclassId:DRUID_CIRCLE_LAND_SUBCLASS_ID,
    classLevel:6,
    features:[{ id:"dnd.srd521.feature.druid.circle-of-the-land.natural-recovery", label:"자연의 회복" }],
  },
  {
    classId:DRUID_SUBCLASS_CLASS_ID,
    subclassId:DRUID_CIRCLE_LAND_SUBCLASS_ID,
    classLevel:10,
    features:[{ id:"dnd.srd521.feature.druid.circle-of-the-land.natures-ward", label:"자연의 수호" }],
  },
  {
    classId:DRUID_SUBCLASS_CLASS_ID,
    subclassId:DRUID_CIRCLE_LAND_SUBCLASS_ID,
    classLevel:14,
    features:[{ id:"dnd.srd521.feature.druid.circle-of-the-land.natures-sanctuary", label:"자연의 성역" }],
  },
  {
    classId:FIGHTER_SUBCLASS_CLASS_ID,
    subclassId:FIGHTER_CHAMPION_SUBCLASS_ID,
    classLevel:3,
    features:[
      { id:"dnd.srd521.feature.fighter.champion.improved-critical", label:"향상된 치명타" },
      { id:"dnd.srd521.feature.fighter.champion.remarkable-athlete", label:"비범한 운동선수" },
    ],
  },
  {
    classId:FIGHTER_SUBCLASS_CLASS_ID,
    subclassId:FIGHTER_CHAMPION_SUBCLASS_ID,
    classLevel:7,
    features:[{ id:"dnd.srd521.feature.fighter.champion.additional-fighting-style", label:"추가 전투 방식" }],
    choice:"fighting-style",
  },
  {
    classId:FIGHTER_SUBCLASS_CLASS_ID,
    subclassId:FIGHTER_CHAMPION_SUBCLASS_ID,
    classLevel:10,
    features:[{ id:"dnd.srd521.feature.fighter.champion.heroic-warrior", label:"영웅적 전사" }],
  },
  {
    classId:FIGHTER_SUBCLASS_CLASS_ID,
    subclassId:FIGHTER_CHAMPION_SUBCLASS_ID,
    classLevel:15,
    features:[{ id:"dnd.srd521.feature.fighter.champion.superior-critical", label:"우월한 치명타" }],
  },
  {
    classId:FIGHTER_SUBCLASS_CLASS_ID,
    subclassId:FIGHTER_CHAMPION_SUBCLASS_ID,
    classLevel:18,
    features:[{ id:"dnd.srd521.feature.fighter.champion.survivor", label:"생존자" }],
  },
  { classId:MONK_SUBCLASS_CLASS_ID, subclassId:MONK_OPEN_HAND_SUBCLASS_ID, classLevel:3, features:[] },
  { classId:PALADIN_SUBCLASS_CLASS_ID, subclassId:PALADIN_DEVOTION_SUBCLASS_ID, classLevel:3, features:[] },
  {
    classId:PALADIN_SUBCLASS_CLASS_ID,
    subclassId:PALADIN_DEVOTION_SUBCLASS_ID,
    classLevel:7,
    features:[{ id:DEVOTION_AURA_FEATURE_ID, label:"헌신의 오라" }],
  },
  {
    classId:PALADIN_SUBCLASS_CLASS_ID,
    subclassId:PALADIN_DEVOTION_SUBCLASS_ID,
    classLevel:15,
    features:[{ id:DEVOTION_SMITE_OF_PROTECTION_FEATURE_ID, label:"보호의 강타" }],
  },
  {
    classId:PALADIN_SUBCLASS_CLASS_ID,
    subclassId:PALADIN_DEVOTION_SUBCLASS_ID,
    classLevel:20,
    features:[{ id:DEVOTION_HOLY_NIMBUS_FEATURE_ID, label:"성스러운 후광" }],
  },
  { classId:RANGER_SUBCLASS_CLASS_ID, subclassId:RANGER_HUNTER_SUBCLASS_ID, classLevel:3, features:[] },
  {
    classId:RANGER_SUBCLASS_CLASS_ID,
    subclassId:RANGER_HUNTER_SUBCLASS_ID,
    classLevel:7,
    features:[{ id:HUNTER_DEFENSIVE_TACTICS_FEATURE_ID, label:"방어 전술" }],
    choice:"ranger-defensive-tactics",
  },
  {
    classId:RANGER_SUBCLASS_CLASS_ID,
    subclassId:RANGER_HUNTER_SUBCLASS_ID,
    classLevel:11,
    features:[{ id:HUNTER_SUPERIOR_PREY_FEATURE_ID, label:"우월한 사냥꾼의 먹잇감" }],
  },
  {
    classId:RANGER_SUBCLASS_CLASS_ID,
    subclassId:RANGER_HUNTER_SUBCLASS_ID,
    classLevel:15,
    features:[{ id:HUNTER_SUPERIOR_DEFENSE_FEATURE_ID, label:"우월한 사냥꾼의 방어" }],
  },
  { classId:ROGUE_SUBCLASS_CLASS_ID, subclassId:ROGUE_THIEF_SUBCLASS_ID, classLevel:3, features:[] },
  { classId:WARLOCK_SUBCLASS_CLASS_ID, subclassId:WARLOCK_FIEND_SUBCLASS_ID, classLevel:3, features:[] },
] as const;

const RELATIONSHIP_BY_KEY = new Map(RELATIONSHIPS.map((entry) => [`${entry.classId}:${entry.subclassId}:${entry.classLevel}`,entry]));

export function srdSubclassRelationship(classId:string,subclassId:string,classLevel:number) {
  return RELATIONSHIP_BY_KEY.get(`${classId}:${subclassId}:${classLevel}`);
}

export function subclassFeatureChoiceId(classId:string,classLevel:number) {
  return `progression.${classId}.${classLevel}.subclass-feature`;
}

export function subclassAcquisitionChoiceId(classId:string,classLevel:number) {
  return `progression.${classId}.${classLevel}.subclass`;
}

export function syntheticSubclassFeatureSelection(subclassId:string) {
  return `${SUBCLASS_AUTO_SELECTION_PREFIX}${subclassId}`;
}

function selectedSubclassName(selections:ChoiceSelectionMap,classId:string,classLevel:number) {
  const selection = selections[subclassAcquisitionChoiceId(classId,classLevel)];
  const optionId = selection?.kind === "options" ? selection.optionIds[0] : undefined;
  return optionId?.startsWith("subclass:") ? optionId.slice("subclass:".length) : undefined;
}

export function resolveSrdSubclassId(args:{
  state:SrdSubclassProgressionState;
  classId:string;
  targetClassLevel:number;
  selections:ChoiceSelectionMap;
}) {
  const explicit = args.state.subclassIds?.[args.classId];
  if (explicit) return explicit;
  const track = args.state.classTracks.find((entry) => entry.classId === args.classId);
  const inferred = inferSrdSubclassId(args.classId,track?.subclassName);
  if (inferred) return inferred;
  const selectedName = selectedSubclassName(args.selections,args.classId,args.targetClassLevel);
  if (!selectedName) return undefined;
  const selected = inferSrdSubclassId(args.classId,selectedName);
  return selected ?? srdSubclassIdForClass(args.classId);
}

export function championAdditionalFightingStyleChoice(args:{
  state:SrdSubclassProgressionState;
  relationship:SrdSubclassLevelRelationship;
  fightingStyleOptions:Array<{ id:string; label:string; description?:string }>;
}):ChoiceDefinition|undefined {
  if (args.relationship.choice !== "fighting-style") return undefined;
  const known = new Set(args.state.fightingStyleFeatIds ?? []);
  for (const option of args.fightingStyleOptions) {
    if (args.state.features.includes(option.id) || args.state.features.includes(option.label)) known.add(option.id);
  }
  const feature = args.relationship.features[0];
  return {
    id:subclassFeatureChoiceId(args.relationship.classId,args.relationship.classLevel),
    label:feature.label,
    description:"챔피언 7레벨 특성으로 아직 보유하지 않은 전투 방식 재주 하나를 추가로 얻습니다.",
    kind:"feature-option",
    count:1,
    required:true,
    status:"ready",
    source:"챔피언 7레벨 · 추가 전투 방식 · SRD 5.2.1",
    options:args.fightingStyleOptions.map((option) => ({
      ...option,
      disabledReason:known.has(option.id) ? "이미 보유한 전투 방식 재주입니다." : undefined,
    })),
  };
}

export function rangerDefensiveTacticsChoice(args:{
  relationship:SrdSubclassLevelRelationship;
}):ChoiceDefinition|undefined {
  if (args.relationship.choice !== "ranger-defensive-tactics") return undefined;
  return {
    id:subclassFeatureChoiceId(args.relationship.classId,args.relationship.classLevel),
    label:"방어 전술",
    description:"사냥꾼 7레벨 방어 전술을 하나 선택합니다. 짧은 휴식이나 긴 휴식이 끝날 때 다른 선택지로 바꿀 수 있습니다.",
    kind:"feature-option",
    count:1,
    required:true,
    status:"ready",
    source:"사냥꾼 7레벨 · 방어 전술 · SRD 5.2.1",
    options:HUNTER_DEFENSIVE_TACTIC_OPTIONS.map((option) => ({ ...option })),
  };
}

export function selectedSubclassFeatureOption(choice:ChoiceDefinition|undefined,selections:ChoiceSelectionMap) {
  if (!choice) return undefined;
  const selection = selections[choice.id];
  return selection?.kind === "options" ? selection.optionIds[0] : undefined;
}
