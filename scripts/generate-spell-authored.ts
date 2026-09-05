import { readdirSync, readFileSync, statSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSpellMechanicFile } from "../src/domain/spellMechanicDefinitionRuntime";
import type { SpellMechanicDefinition } from "../src/domain/spellcasting";

/**
 * Collects the authored builtin spell mechanics (`content/spell-mechanics/**\/*.json`) into one generated catalog.
 * Authored definitions take precedence over the reviewed TypeScript definitions and over prose derivation
 * (`src/domain/spellMechanics.ts`). Each file is validated structurally; a duplicate spell id is an error.
 */
const root=fileURLToPath(new URL("..",import.meta.url));
const contentRoot=join(root,"content","spell-mechanics");
const destination=join(root,"src","generated","spellAuthoredMechanics.generated.json");

function jsonFiles(directory:string):string[] {
  let entries:string[];
  try { entries=readdirSync(directory); } catch { return []; }
  return entries.sort((a,b)=>a.localeCompare(b,"en")).flatMap((name)=>{
    const path=join(directory,name);
    if(statSync(path).isDirectory())return jsonFiles(path);
    return name.endsWith(".json")?[path]:[];
  });
}

const definitions:SpellMechanicDefinition[]=[];
const sources:Record<string,string>={};
for(const file of jsonFiles(contentRoot)){
  const relative=file.slice(root.length).replace(/\\/g,"/");
  const parsed=parseSpellMechanicFile(JSON.parse(readFileSync(file,"utf8")),relative);
  for(const definition of parsed){
    if(sources[definition.spellId])throw new Error(`duplicate authored spell mechanic ${definition.spellId}: ${sources[definition.spellId]} and ${relative}`);
    sources[definition.spellId]=relative;
    definitions.push(definition);
  }
}
definitions.sort((a,b)=>a.spellId.localeCompare(b.spellId,"en"));
await writeFile(destination,`${JSON.stringify({schemaVersion:1,profileId:"dnd.srd521",count:definitions.length,sources,definitions},null,2)}\n`,"utf8");
console.log(`Generated authored spell mechanics: ${definitions.length} definitions`);
