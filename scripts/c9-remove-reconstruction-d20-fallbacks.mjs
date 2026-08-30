import fs from "node:fs";

const path="src/app/characterSessionProjectionReconstruction.ts";
let text=fs.readFileSync(path,"utf8");

for(const line of [
  'import { FIEND_DARK_ONES_OWN_LUCK_FEATURE_ID, FIEND_DARK_ONES_OWN_LUCK_RESOURCE_ID } from "../domain/warlockFiend";\n',
  'import { WARLOCK_FIEND_SUBCLASS_ID } from "../domain/srdSubclassCatalog";\n',
  'import { WARLOCK_ID } from "../domain/warlockProgressionChoices";\n',
  'import { BARDIC_INSPIRATION_RESOURCE_ID, bardicInspirationDieSides } from "../domain/bardicInspiration";\n',
  'import { BARD_COLLEGE_LORE_SUBCLASS_ID, LORE_PEERLESS_SKILL_SOURCE } from "../domain/bardCollegeLore";\n',
  'import { BARD_LORE_CLASS_ID } from "../domain/bardLoreProgression";\n',
]){
  if(!text.includes(line))throw new Error(`expected import missing: ${line.trim()}`);
  text=text.replace(line,"");
}

const start='  const warlockLevel=classLevel(projection,WARLOCK_ID);\n';
const end='  return actions;\n';
const startIndex=text.indexOf(start);
const endIndex=text.indexOf(end,startIndex);
if(startIndex<0||endIndex<0)throw new Error("legacy reconstruction d20 fallback block not found");
text=text.slice(0,startIndex)+text.slice(endIndex);
if(text.includes("runtimeD20FollowUps"))throw new Error("runtimeD20FollowUps still present in SessionProjection reconstruction");
fs.writeFileSync(path,text);
