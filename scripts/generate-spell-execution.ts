import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import rawCatalog from "../src/generated/spellPresentationCatalog.generated.json";
import { spellMechanicById } from "../src/domain/spellMechanics";

const spells=(rawCatalog as {spells:Array<{id:string}>}).spells;
const definitions=spells.map(({id})=>{
  const definition=spellMechanicById(id);
  if (!definition) throw new Error(`Missing spell execution definition: ${id}`);
  return definition;
});
const ids=new Set(definitions.map(({spellId})=>spellId));
if (ids.size!==spells.length) throw new Error(`Duplicate spell execution definition: ${ids.size}/${spells.length}`);

const output={schemaVersion:1,profileId:"dnd.srd521",definitions};
const destination=fileURLToPath(new URL("../src/generated/spellExecutionCatalog.generated.json",import.meta.url));
await writeFile(destination,`${JSON.stringify(output,null,2)}\n`,"utf8");
console.log(`Generated normalized spell execution catalog: ${definitions.length} definitions`);
