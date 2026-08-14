import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)),"..");
const modulePath = join(root,"content","modules","dnd-srd-5.2.1.feats","module.json");
const outputPath = join(root,"src","generated","featRuleCatalog.generated.json");
const module = JSON.parse(readFileSync(modulePath,"utf8"));

const feats = [];
const ids = new Set();
for (const item of module.content ?? []) {
  if (item.category !== "feat") continue;
  const mechanic = (item.mechanics ?? []).find((entry) => entry.kind === "feat-definition");
  if (!mechanic) throw new Error(`${item.id}: missing feat-definition mechanic`);
  if (ids.has(item.id)) throw new Error(`duplicate feat id ${item.id}`);
  ids.add(item.id);
  const config = mechanic.config ?? {};
  feats.push({
    id:item.id,
    name:item.presentation?.locales?.[module.defaultLocale]?.name ?? item.presentation?.originalName ?? item.id,
    originalName:item.presentation?.originalName ?? item.id,
    tags:[...(item.tags ?? [])],
    config,
  });
}

feats.sort((left,right) => left.id.localeCompare(right.id,"en"));
if (!feats.length) throw new Error("no canonical feat definitions found");
mkdirSync(dirname(outputPath),{ recursive:true });
writeFileSync(outputPath,JSON.stringify({
  schemaVersion:"simplevtt.feat-rules.v1",
  rulesProfileId:"dnd.srd-5.2.1",
  count:feats.length,
  feats,
}),"utf8");
console.log(`Generated canonical feat rule metadata: ${feats.length} feats`);
