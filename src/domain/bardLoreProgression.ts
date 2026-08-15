import type { ChoiceDefinition, ChoiceSelectionMap } from "./choiceDefinition";
import { classSkillOptions } from "./classSkillCatalog";
import { BARD_COLLEGE_LORE_SUBCLASS_ID } from "./bardCollegeLore";
import type { ProgressionCharacterState } from "./progression";
import { numericProgressionColumn } from "./progressionCatalog";
import { classSpellListAllEntries } from "./spellListCatalog";

export const BARD_LORE_CLASS_ID = "dnd.srd521.class.bard";
export const BARD_LORE_BONUS_PROFICIENCIES_FEATURE_ID = "dnd.srd521.feature.bard.college-of-lore.bonus-proficiencies";
export const BARD_LORE_CUTTING_WORDS_FEATURE_ID = "dnd.srd521.feature.bard.college-of-lore.cutting-words";
export const BARD_LORE_MAGICAL_DISCOVERIES_FEATURE_ID = "dnd.srd521.feature.bard.college-of-lore.magical-discoveries";
export const BARD_LORE_PEERLESS_SKILL_FEATURE_ID = "dnd.srd521.feature.bard.college-of-lore.peerless-skill";

const CLERIC_ID = "dnd.srd521.class.cleric";
const DRUID_ID = "dnd.srd521.class.druid";
const WIZARD_ID = "dnd.srd521.class.wizard";

export interface BardLoreProgressionState extends ProgressionCharacterState {
  subclassIds?:Record<string,string>;
  subclassFeatureIds?:string[];
  subclassFeatureSources?:Record<string,string>;
  bardMagicalDiscoverySpellIds?:string[];
  bardMagicalDiscoverySpellSources?:Record<string,string>;
}

export function loreBonusProficienciesChoiceId() {
  return `progression.${BARD_LORE_CLASS_ID}.3.lore.bonus-proficiencies`;
}

export function loreMagicalDiscoveriesChoiceId() {
  return `progression.${BARD_LORE_CLASS_ID}.6.subclass-feature`;
}

export function loreMagicalDiscoveriesReplacementChoiceId(classLevel:number) {
  return `progression.${BARD_LORE_CLASS_ID}.${classLevel}.lore.magical-discoveries-replacement`;
}

export function bardHighestSpellLevel(classLevel:number) {
  let highest = 0;
  for (let level = 1; level <= 9; level += 1) {
    if (numericProgressionColumn(BARD_LORE_CLASS_ID,classLevel,String(level)) > 0) highest = level;
  }
  return highest;
}

export function loreMagicalDiscoveryCandidates(classLevel:number) {
  const maximum = bardHighestSpellLevel(classLevel);
  const entries = [CLERIC_ID,DRUID_ID,WIZARD_ID]
    .flatMap((classId) => classSpellListAllEntries(classId))
    .filter((entry) => entry.level === 0 || entry.level <= maximum);
  return [...new Map(entries.map((entry) => [entry.id,entry])).values()]
    .sort((left,right) => left.level - right.level || left.nameEn.localeCompare(right.nameEn,"en"));
}

export function loreBonusProficienciesChoice(state:ProgressionCharacterState):ChoiceDefinition {
  const known = new Set(state.proficientSkills ?? []);
  return {
    id:loreBonusProficienciesChoiceId(),
    label:"추가 숙련",
    description:"전승 학파 3레벨 특성으로 원하는 기술 세 개에 숙련을 얻습니다.",
    kind:"skill",
    count:3,
    required:true,
    status:"ready",
    source:"전승 학파 3레벨 · 추가 숙련 · SRD 5.2.1",
    options:classSkillOptions(BARD_LORE_CLASS_ID).map((skill) => ({
      id:`skill:${skill.id}`,
      label:skill.label,
      description:"전승 학파 추가 기술 숙련",
      disabledReason:known.has(skill.label) ? "이미 숙련된 기술입니다." : undefined,
    })),
  };
}

function spellPresentationMap(spellOptions?:Array<{ id:string; label:string; description?:string }>) {
  return new Map((spellOptions ?? []).map((option) => [option.id,option]));
}

export function loreMagicalDiscoveriesChoice(args:{
  state:BardLoreProgressionState;
  spellOptions?:Array<{ id:string; label:string; description?:string }>;
}):ChoiceDefinition {
  const presentation = spellPresentationMap(args.spellOptions);
  const existing = new Set(args.state.bardMagicalDiscoverySpellIds ?? []);
  return {
    id:loreMagicalDiscoveriesChoiceId(),
    label:"마법 발견",
    description:"클레릭, 드루이드 또는 위저드 목록에서 소마법 또는 현재 주문 슬롯 레벨 이하 주문 두 개를 선택해 항상 준비합니다.",
    kind:"spell",
    count:2,
    required:true,
    status:"ready",
    source:"전승 학파 6레벨 · 마법 발견 · SRD 5.2.1",
    options:loreMagicalDiscoveryCandidates(6).map((entry) => ({
      id:entry.id,
      label:presentation.get(entry.id)?.label ?? entry.nameEn,
      description:presentation.get(entry.id)?.description ?? `${entry.level === 0 ? "소마법" : `${entry.level}레벨 주문`} · 마법 발견`,
      disabledReason:existing.has(entry.id) ? "이미 마법 발견으로 선택한 주문입니다." : undefined,
    })),
  };
}

export function encodeLoreMagicalDiscoveryReplacement(oldSpellId:string,newSpellId:string) {
  return `replace=${oldSpellId}|with=${newSpellId}`;
}

export function decodeLoreMagicalDiscoveryReplacement(value:string) {
  const match = value.match(/^replace=([^|]+)\|with=(.+)$/);
  return match ? { oldSpellId:match[1], newSpellId:match[2] } : undefined;
}

export function loreMagicalDiscoveriesReplacementChoice(args:{
  state:BardLoreProgressionState;
  targetClassLevel:number;
  spellOptions?:Array<{ id:string; label:string; description?:string }>;
}):ChoiceDefinition|undefined {
  if (args.targetClassLevel <= 6) return undefined;
  const current = args.state.bardMagicalDiscoverySpellIds ?? [];
  if (current.length !== 2) return undefined;
  const presentation = spellPresentationMap(args.spellOptions);
  const candidates = loreMagicalDiscoveryCandidates(args.targetClassLevel);
  const currentSet = new Set(current);
  const options = current.flatMap((oldSpellId) => candidates
    .filter((entry) => entry.id !== oldSpellId && !currentSet.has(entry.id))
    .map((entry) => ({
      id:encodeLoreMagicalDiscoveryReplacement(oldSpellId,entry.id),
      label:`${presentation.get(oldSpellId)?.label ?? oldSpellId.split(".").at(-1)} → ${presentation.get(entry.id)?.label ?? entry.nameEn}`,
      description:"바드 레벨을 얻을 때 마법 발견 주문 하나를 현재 조건을 만족하는 다른 주문으로 교체합니다.",
    })));
  if (!options.length) return undefined;
  return {
    id:loreMagicalDiscoveriesReplacementChoiceId(args.targetClassLevel),
    label:"마법 발견 교체",
    description:"기존 마법 발견 주문 하나를 현재 선택 가능한 다른 주문으로 교체할 수 있습니다.",
    kind:"spell",
    count:1,
    required:false,
    status:"ready",
    source:`전승 학파 · 바드 ${args.targetClassLevel}레벨 획득 · 마법 발견 교체 · SRD 5.2.1`,
    options,
  };
}

export function selectedOptionIds(choice:ChoiceDefinition|undefined,selections:ChoiceSelectionMap) {
  if (!choice) return [];
  const selection = selections[choice.id];
  return selection?.kind === "options" ? [...selection.optionIds] : [];
}

export function isCollegeOfLore(state:BardLoreProgressionState) {
  return state.subclassIds?.[BARD_LORE_CLASS_ID] === BARD_COLLEGE_LORE_SUBCLASS_ID
    || state.classTracks.some((track) => track.classId === BARD_LORE_CLASS_ID && track.subclassName === "전승 학파");
}
