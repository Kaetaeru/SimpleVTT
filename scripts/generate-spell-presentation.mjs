import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const presentationDir = join(root, "content", "presentation", "dnd-srd-5.2.1.spells");
const manifestPath = join(presentationDir, "manifest.json");
const payloadDir = join(presentationDir, "payload");
const outputPath = join(root, "src", "generated", "spellPresentationCatalog.generated.json");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const chunkNames = readdirSync(payloadDir)
  .filter((name) => /^\d+\.b64$/.test(name))
  .sort((a, b) => a.localeCompare(b, "en"));

if (chunkNames.length === 0) throw new Error("spell presentation payload has no chunks");

const encoded = chunkNames.map((name) => readFileSync(join(payloadDir, name), "ascii").trim()).join("");
const compressed = Buffer.from(encoded, "base64");
const digest = createHash("sha256").update(compressed).digest("hex");

if (compressed.length !== manifest.compressedBytes) {
  throw new Error(`spell presentation compressed byte mismatch: expected ${manifest.compressedBytes}, got ${compressed.length}`);
}
if (digest !== manifest.sha256) {
  throw new Error(`spell presentation sha256 mismatch: expected ${manifest.sha256}, got ${digest}`);
}

const inflated = gunzipSync(compressed);
if (inflated.length !== manifest.uncompressedBytes) {
  throw new Error(`spell presentation uncompressed byte mismatch: expected ${manifest.uncompressedBytes}, got ${inflated.length}`);
}

const catalog = JSON.parse(inflated.toString("utf8"));
const requiredText = ["id", "name", "nameEn", "school", "castingTime", "range", "components", "duration", "summary", "description"];

if (catalog.formatVersion !== manifest.formatVersion) throw new Error("spell presentation formatVersion mismatch");
if (catalog.rulesProfileId !== manifest.rulesProfileId) throw new Error("spell presentation rulesProfileId mismatch");
if (catalog.locale !== manifest.locale) throw new Error("spell presentation locale mismatch");
if (!Array.isArray(catalog.spells) || catalog.spells.length !== manifest.count || catalog.count !== manifest.count) {
  throw new Error(`spell presentation count mismatch: expected ${manifest.count}`);
}

const ids = new Set();
const englishNames = new Set();
for (const spell of catalog.spells) {
  for (const field of requiredText) {
    if (typeof spell[field] !== "string" || spell[field].trim().length === 0) {
      throw new Error(`${spell.id ?? "<unknown>"}: missing ${field}`);
    }
  }
  if (!Number.isInteger(spell.level) || spell.level < 0 || spell.level > 9) {
    throw new Error(`${spell.id}: invalid level ${spell.level}`);
  }
  if (typeof spell.ritual !== "boolean") throw new Error(`${spell.id}: ritual must be boolean`);
  if (ids.has(spell.id)) throw new Error(`duplicate spell id ${spell.id}`);
  if (englishNames.has(spell.nameEn)) throw new Error(`duplicate spell English name ${spell.nameEn}`);
  ids.add(spell.id);
  englishNames.add(spell.nameEn);
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(catalog), "utf8");
console.log(`Generated SRD spell presentation: ${catalog.count} spells, sha256 ${digest.slice(0, 12)}...`);
