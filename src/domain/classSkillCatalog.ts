import rawCatalog from "../generated/classSkillCatalog.generated.json";

export interface ClassSkillPool {
  classId:string;
  choiceCount:number;
  skillIds:string[];
}

export interface SkillDefinition {
  id:string;
  label:string;
}

interface ClassSkillCatalog {
  schemaVersion:string;
  rulesProfileId:string;
  classes:ClassSkillPool[];
  skills:SkillDefinition[];
}

export const CLASS_SKILL_CATALOG = rawCatalog as unknown as ClassSkillCatalog;
const CLASS_BY_ID = new Map(CLASS_SKILL_CATALOG.classes.map((entry) => [entry.classId,entry]));
const SKILL_BY_ID = new Map(CLASS_SKILL_CATALOG.skills.map((entry) => [entry.id,entry]));

export function classSkillPool(classId:string) {
  return CLASS_BY_ID.get(classId);
}

export function skillDefinition(skillId:string) {
  return SKILL_BY_ID.get(skillId);
}

export function classSkillOptions(classId:string) {
  const pool = classSkillPool(classId);
  return (pool?.skillIds ?? []).map((skillId) => SKILL_BY_ID.get(skillId)).filter((entry):entry is SkillDefinition => Boolean(entry));
}
