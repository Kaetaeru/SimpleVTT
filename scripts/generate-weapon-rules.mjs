import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)),"..");
const modulePaths = [
  "dnd-srd-5.2.1.equipment-simple-melee",
  "dnd-srd-5.2.1.equipment-martial-melee",
  "dnd-srd-5.2.1.equipment-martial-ranged",
].map((name) => join(root,"content","modules",name,"module.json"));
const outputPath = join(root,"src","generated","weaponRuleCatalog.generated.json");

const weapons = [];
const ids = new Set();
for (const modulePath of modulePaths) {
  const module = JSON.parse(readFileSync(modulePath,"utf8"));
  for (const item of module.content ?? []) {
    if (item.category !== "weapon") continue;
    const mechanic = (item.mechanics ?? []).find((entry) => entry.kind === "weapon-definition");
    if (!mechanic) throw new Error(`${item.id}: missing weapon-definition mechanic`);
    if (ids.has(item.id)) throw new Error(`duplicate weapon id ${item.id}`);
    ids.add(item.id);
    const config = mechanic.config ?? {};
    if (config.training !== "simple" && config.training !== "martial") throw new Error(`${item.id}: invalid training`);
    if (config.mode !== "melee" && config.mode !== "ranged") throw new Error(`${item.id}: invalid mode`);
    if (typeof config.mastery !== "string" || config.mastery.length === 0) throw new Error(`${item.id}: missing mastery property`);
    if (!Array.isArray(config.properties)) throw new Error(`${item.id}: properties must be an array`);
    weapons.push({
      id:item.id,
      name:item.presentation?.locales?.[module.defaultLocale]?.name ?? item.presentation?.originalName ?? item.id,
      originalName:item.presentation?.originalName ?? item.id,
      training:config.training,
      mode:config.mode,
      damage:config.damage,
      damageType:config.damageType,
      properties:[...config.properties],
      mastery:config.mastery,
    });
  }
}

weapons.sort((left,right) => left.id.localeCompare(right.id,"en"));
if (weapons.length !== 38) throw new Error(`expected 38 canonical weapons, got ${weapons.length}`);
mkdirSync(dirname(outputPath),{ recursive:true });
writeFileSync(outputPath,JSON.stringify({
  schemaVersion:"simplevtt.weapon-rules.v1",
  rulesProfileId:"dnd.srd-5.2.1",
  count:weapons.length,
  weapons,
}),"utf8");
console.log(`Generated canonical weapon rule metadata: ${weapons.length} weapons`);
