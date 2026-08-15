import type { ChoiceDefinition, ChoiceSelectionMap } from "./choiceDefinition";
import type { ProgressionCharacterState } from "./progression";
import { classById, numericProgressionColumn } from "./progressionCatalog";
import { allWeaponRules, weaponHasProperty, type WeaponRuleDefinition } from "./weaponRuleCatalog";

export const BARBARIAN_ID = "dnd.srd521.class.barbarian";
export const FIGHTER_ID = "dnd.srd521.class.fighter";
export const PALADIN_WEAPON_MASTERY_ID = "dnd.srd521.class.paladin";
export const RANGER_WEAPON_MASTERY_ID = "dnd.srd521.class.ranger";
export const ROGUE_ID = "dnd.srd521.class.rogue";

const FIXED_TWO_CLASSES = new Set([PALADIN_WEAPON_MASTERY_ID,RANGER_WEAPON_MASTERY_ID,ROGUE_ID]);
const WEAPON_MASTERY_CLASSES = new Set([BARBARIAN_ID,FIGHTER_ID,...FIXED_TWO_CLASSES]);

export interface WeaponMasteryProgressionState extends ProgressionCharacterState {
  weaponMasteryIds?:string[];
  weaponMasterySources?:Record<string,string>;
}

export function weaponMasteryChoiceId(classId:string,classLevel:number) {
  return `progression.${classId}.${classLevel}.column.무기 통달`;
}

export function weaponMasteryMaximum(classId:string,classLevel:number) {
  if (!WEAPON_MASTERY_CLASSES.has(classId) || classLevel <= 0) return 0;
  const tableValue = numericProgressionColumn(classId,classLevel,"무기 통달");
  if (tableValue > 0) return tableValue;
  return FIXED_TWO_CLASSES.has(classId) ? 2 : 0;
}

export function weaponMasteryGainCount(classId:string,targetClassLevel:number) {
  return Math.max(0,weaponMasteryMaximum(classId,targetClassLevel) - weaponMasteryMaximum(classId,targetClassLevel - 1));
}

export function weaponMasteryEligibleWeapons(classId:string):WeaponRuleDefinition[] {
  const all = allWeaponRules();
  if (classId === BARBARIAN_ID) return all.filter((weapon) => weapon.mode === "melee");
  if (classId === ROGUE_ID) {
    return all.filter((weapon) => weapon.training === "simple"
      || (weapon.training === "martial" && (weaponHasProperty(weapon,"finesse") || weaponHasProperty(weapon,"light"))));
  }
  if (classId === FIGHTER_ID || classId === PALADIN_WEAPON_MASTERY_ID || classId === RANGER_WEAPON_MASTERY_ID) return all;
  return [];
}

export function weaponMasteryChoiceDefinition(args:{
  state:WeaponMasteryProgressionState;
  targetClassId:string;
  targetClassLevel:number;
}):ChoiceDefinition|undefined {
  const count = weaponMasteryGainCount(args.targetClassId,args.targetClassLevel);
  if (count <= 0) return undefined;
  const definition = classById(args.targetClassId);
  const known = new Set(args.state.weaponMasteryIds ?? []);
  const source = `${definition?.nameKo ?? args.targetClassId} ${args.targetClassLevel}레벨 · 무기 통달 · SRD 5.2.1`;
  return {
    id:weaponMasteryChoiceId(args.targetClassId,args.targetClassLevel),
    label:`무기 통달 +${count}`,
    description:`${definition?.nameKo ?? "클래스"}가 사용할 수 있는 무기 중 아직 선택하지 않은 무기 ${count}종의 통달 속성을 활성화합니다.`,
    kind:"weapon-mastery",
    count,
    required:true,
    status:"ready",
    source,
    options:weaponMasteryEligibleWeapons(args.targetClassId).map((weapon) => ({
      id:weapon.id,
      label:weapon.name,
      description:`${weapon.originalName} · ${weapon.training}/${weapon.mode} · mastery:${weapon.mastery}`,
      disabledReason:known.has(weapon.id) ? "이미 무기 통달 대상으로 선택한 무기입니다." : undefined,
    })),
  };
}

export function selectedWeaponMasteryIds(choice:ChoiceDefinition|undefined,selections:ChoiceSelectionMap) {
  if (!choice) return [];
  const selection = selections[choice.id];
  return selection?.kind === "options" ? [...selection.optionIds] : [];
}
