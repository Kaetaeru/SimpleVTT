import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const progressionDir = join(root, "content", "presentation", "dnd-srd-5.2.1.progression");
const manifestPath = join(progressionDir, "manifest.json");
const payloadDir = join(progressionDir, "payload");
const outputPath = join(root, "src", "generated", "progressionCatalog.generated.json");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const chunkNames = readdirSync(payloadDir)
  .filter((name) => /^\d+\.b64$/.test(name))
  .sort((a, b) => a.localeCompare(b, "en"));
if (chunkNames.length === 0) throw new Error("progression payload has no chunks");
const encoded = chunkNames.map((name) => readFileSync(join(payloadDir, name), "ascii").trim()).join("");
const compressed = Buffer.from(encoded, "base64");
const digest = createHash("sha256").update(compressed).digest("hex");
if (compressed.length !== manifest.compressedBytes) throw new Error(`progression compressed byte mismatch: expected ${manifest.compressedBytes}, got ${compressed.length}`);
if (digest !== manifest.sha256) throw new Error(`progression sha256 mismatch: expected ${manifest.sha256}, got ${digest}`);
const inflated = gunzipSync(compressed);
if (inflated.length !== manifest.uncompressedBytes) throw new Error(`progression uncompressed byte mismatch: expected ${manifest.uncompressedBytes}, got ${inflated.length}`);
const catalog = JSON.parse(inflated.toString("utf8"));
if (catalog.schemaVersion !== manifest.schemaVersion) throw new Error("progression schemaVersion mismatch");
if (!Array.isArray(catalog.classes) || catalog.classes.length !== manifest.classCount) throw new Error(`progression class count mismatch: expected ${manifest.classCount}`);
const rows = catalog.classes.reduce((sum, cls) => sum + (Array.isArray(cls.progression) ? cls.progression.length : 0), 0);
if (rows !== manifest.levelRows) throw new Error(`progression level row mismatch: expected ${manifest.levelRows}, got ${rows}`);
for (const cls of catalog.classes) {
  if (typeof cls.id !== "string" || typeof cls.nameKo !== "string" || typeof cls.srdSubclassName !== "string") throw new Error("progression class identity/subclass missing");
  if (!Number.isInteger(cls.hitDie) || cls.hitDie < 6 || cls.hitDie > 12) throw new Error(`${cls.id}: invalid hit die`);
  if (!Array.isArray(cls.progression) || cls.progression.length !== 20) throw new Error(`${cls.id}: expected 20 progression rows`);
  for (let level = 1; level <= 20; level += 1) {
    if (cls.progression[level - 1]?.level !== level) throw new Error(`${cls.id}: missing level ${level}`);
  }
}
if (catalog.multiclass?.prerequisites?.length !== manifest.prerequisiteCount) throw new Error("progression prerequisite count mismatch");
if (catalog.multiclass?.spellSlots?.rows?.length !== manifest.multiclassSpellSlotRows) throw new Error("progression multiclass spell slot row mismatch");
if (catalog.levelAdvancement?.growth?.length !== manifest.growthRows) throw new Error("progression growth row mismatch");
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(catalog), "utf8");
console.log(`Generated SRD progression: ${catalog.classes.length} classes / ${rows} level rows, sha256 ${digest.slice(0, 12)}...`);
