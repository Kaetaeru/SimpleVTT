import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modulesDir = join(root,"content","modules");
const outputPath = join(root,"src","generated","spellRuleCatalog.generated.json");

const moduleDirs = readdirSync(modulesDir,{ withFileTypes:true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith("dnd-srd-5.2.1.spells-"))
  .map((entry) => entry.name)
  .sort((a,b) => a.localeCompare(b,"en"));

const spells = [];
const ids = new Set();
for (const moduleDir of moduleDirs) {
  const modulePath = join(modulesDir,moduleDir,"module.json");
  const module = JSON.parse(readFileSync(modulePath,"utf8"));
  for (const item of module.content ?? []) {
    if (item.category !== "spell") continue;
    const mechanic = (item.mechanics ?? []).find((entry) => entry.kind === "spell-definition");
    if (!mechanic) throw new Error(`${item.id}: missing spell-definition mechanic`);
    const config = mechanic.config ?? {};
    if (!Number.isInteger(config.level) || config.level < 0 || config.level > 9) {
      throw new Error(`${item.id}: invalid spell level ${config.level}`);
    }
    if (typeof config.ritual !== "boolean") throw new Error(`${item.id}: ritual must be boolean`);
    if (ids.has(item.id)) throw new Error(`duplicate spell id ${item.id}`);
    ids.add(item.id);
    spells.push({ id:item.id, level:config.level, ritual:config.ritual });
  }
}

spells.sort((left,right) => left.id.localeCompare(right.id,"en"));
if (spells.length === 0) throw new Error("no canonical spell definitions found");
mkdirSync(dirname(outputPath),{ recursive:true });
writeFileSync(outputPath,JSON.stringify({
  schemaVersion:"simplevtt.spell-rules.v1",
  rulesProfileId:"dnd.srd-5.2.1",
  count:spells.length,
  spells,
}),"utf8");
console.log(`Generated canonical spell rule metadata: ${spells.length} spells`);
