import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)),"..");
const indexPath = join(root,"content","indexes","dnd-srd-5.2.1.character-creation.json");
const outputPath = join(root,"src","generated","classSkillCatalog.generated.json");
const index = JSON.parse(readFileSync(indexPath,"utf8"));
const allSkillIds = Object.keys(index.skills ?? {});
if (allSkillIds.length !== 18) throw new Error(`expected 18 SRD skills, got ${allSkillIds.length}`);

const classes = [];
for (const [classId,semantics] of Object.entries(index.classes ?? {})) {
  const skills = semantics?.skills;
  if (!skills || !Number.isInteger(skills.count) || skills.count < 0) throw new Error(`${classId}: invalid skill choice count`);
  const optionIds = skills.options === "any" ? [...allSkillIds] : [...(skills.options ?? [])];
  for (const skillId of optionIds) if (!(skillId in index.skills)) throw new Error(`${classId}: unknown skill ${skillId}`);
  classes.push({
    classId,
    choiceCount:skills.count,
    skillIds:optionIds,
  });
}
classes.sort((left,right) => left.classId.localeCompare(right.classId,"en"));
if (classes.length !== 12) throw new Error(`expected 12 class skill pools, got ${classes.length}`);

const skills = allSkillIds.map((id) => ({ id, label:index.skills[id] })).sort((left,right) => left.id.localeCompare(right.id,"en"));
mkdirSync(dirname(outputPath),{ recursive:true });
writeFileSync(outputPath,JSON.stringify({
  schemaVersion:"simplevtt.class-skills.v1",
  rulesProfileId:"dnd.srd-5.2.1",
  classes,
  skills,
}),"utf8");
console.log(`Generated canonical class skill pools: ${classes.length} classes / ${skills.length} skills`);
