import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modulesDir = join(root,"content","modules");
const presentationDir = join(root,"content","presentation","dnd-srd-5.2.1.spells");
const outputPath = join(root,"src","generated","spellRuleCatalog.generated.json");

function loadCanonicalSpellMetadata() {
  const manifest = JSON.parse(readFileSync(join(presentationDir,"manifest.json"),"utf8"));
  const payloadDir = join(presentationDir,"payload");
  const chunks = readdirSync(payloadDir,{ withFileTypes:true })
    .filter((entry) => entry.isFile() && /^\d+\.b64$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((a,b) => a.localeCompare(b,"en"));
  if (!chunks.length) throw new Error("spell presentation payload has no chunks");
  const encoded = chunks.map((name) => readFileSync(join(payloadDir,name),"ascii").trim()).join("");
  const compressed = Buffer.from(encoded,"base64");
  const digest = createHash("sha256").update(compressed).digest("hex");
  if (compressed.length !== manifest.compressedBytes) {
    throw new Error(`spell rule metadata source byte mismatch: expected ${manifest.compressedBytes}, got ${compressed.length}`);
  }
  if (digest !== manifest.sha256) {
    throw new Error(`spell rule metadata source sha256 mismatch: expected ${manifest.sha256}, got ${digest}`);
  }
  const inflated = gunzipSync(compressed);
  if (inflated.length !== manifest.uncompressedBytes) {
    throw new Error(`spell rule metadata source uncompressed byte mismatch: expected ${manifest.uncompressedBytes}, got ${inflated.length}`);
  }
  const catalog = JSON.parse(inflated.toString("utf8"));
  if (!Array.isArray(catalog.spells) || catalog.spells.length !== manifest.count || catalog.count !== manifest.count) {
    throw new Error(`spell rule metadata source count mismatch: expected ${manifest.count}`);
  }
  const byId = new Map();
  for (const spell of catalog.spells) {
    if (typeof spell.id !== "string" || !spell.id) throw new Error("spell rule metadata source has missing id");
    if (!Number.isInteger(spell.level) || spell.level < 0 || spell.level > 9) {
      throw new Error(`${spell.id}: invalid spell level ${spell.level}`);
    }
    if (typeof spell.ritual !== "boolean") throw new Error(`${spell.id}: ritual must be boolean`);
    if (byId.has(spell.id)) throw new Error(`duplicate spell id ${spell.id}`);
    byId.set(spell.id,{ id:spell.id, level:spell.level, ritual:spell.ritual });
  }
  return byId;
}

const canonical = loadCanonicalSpellMetadata();
const moduleDirs = readdirSync(modulesDir,{ withFileTypes:true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith("dnd-srd-5.2.1.spells-"))
  .map((entry) => entry.name)
  .sort((a,b) => a.localeCompare(b,"en"));

const mechanicsIds = new Set();
const metadataMismatches = [];
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
    if (mechanicsIds.has(item.id)) throw new Error(`duplicate spell mechanics id ${item.id}`);
    mechanicsIds.add(item.id);
    const expected = canonical.get(item.id);
    if (!expected) throw new Error(`${item.id}: spell-definition has no canonical presentation metadata`);
    if (expected.level !== config.level || expected.ritual !== config.ritual) {
      metadataMismatches.push({
        id:item.id,
        mechanics:{ level:config.level, ritual:config.ritual },
        canonical:{ level:expected.level, ritual:expected.ritual },
      });
    }
  }
}

const spells = [...canonical.values()].sort((left,right) => left.id.localeCompare(right.id,"en"));
if (spells.length !== 339) throw new Error(`expected 339 canonical spell rule metadata entries, got ${spells.length}`);
mkdirSync(dirname(outputPath),{ recursive:true });
writeFileSync(outputPath,JSON.stringify({
  schemaVersion:"simplevtt.spell-rules.v1",
  rulesProfileId:"dnd.srd-5.2.1",
  count:spells.length,
  mechanicsDefinitionCount:mechanicsIds.size,
  spells,
}),"utf8");
if (metadataMismatches.length) {
  console.warn(`Warning: ${metadataMismatches.length} legacy spell-definition level/Ritual metadata values differ from the canonical 339-spell snapshot.`);
  for (const mismatch of metadataMismatches) {
    console.warn(`${mismatch.id}: mechanics=${JSON.stringify(mismatch.mechanics)} canonical=${JSON.stringify(mismatch.canonical)}`);
  }
}
console.log(`Generated canonical spell rule metadata: ${spells.length} spells (${mechanicsIds.size} mechanics-backed definitions validated structurally)`);
