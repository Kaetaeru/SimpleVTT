import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modulesDir = join(root, "content", "modules");
const presentationDir = join(root, "content", "presentation", "dnd-srd-5.2.1.spells");
const outputPath = join(root, "src", "generated", "builtinCatalog.generated.json");
const rulesProfileId = "dnd.srd-5.2.1";
const rulesProfileVersion = "0.1-draft";
const sourceLabel = "SRD 5.2.1";

const directCategories = new Set([
  "class",
  "subclass",
  "species",
  "background",
  "feat",
  "spell",
  "item",
  "condition",
  "combatant",
  "option",
]);
const categoryOrder = new Map([
  "class","subclass","species","background","feat","spell","item","condition","combatant","option",
].map((category,index) => [category,index]));
const categoryLabel = {
  class:"클래스",
  subclass:"서브클래스",
  species:"종족",
  background:"배경",
  feat:"재주",
  spell:"주문",
  item:"아이템",
  condition:"상태",
  combatant:"전투원",
  option:"선택지",
};
const relationshipLabel = {
  parent:"상위 콘텐츠",
  extends:"확장 대상",
  replaces:"대체 대상",
};

function loadSpellPresentation() {
  const manifest = JSON.parse(readFileSync(join(presentationDir,"manifest.json"),"utf8"));
  const chunks = readdirSync(join(presentationDir,"payload"))
    .filter((name) => /^\d+\.b64$/.test(name))
    .sort((a,b) => a.localeCompare(b,"en"));
  if (!chunks.length) throw new Error("spell presentation payload has no chunks");
  const encoded = chunks.map((name) => readFileSync(join(presentationDir,"payload",name),"ascii").trim()).join("");
  const compressed = Buffer.from(encoded,"base64");
  const digest = createHash("sha256").update(compressed).digest("hex");
  if (compressed.length !== manifest.compressedBytes) throw new Error(`spell presentation compressed byte mismatch: expected ${manifest.compressedBytes}, got ${compressed.length}`);
  if (digest !== manifest.sha256) throw new Error(`spell presentation sha256 mismatch: expected ${manifest.sha256}, got ${digest}`);
  const inflated = gunzipSync(compressed);
  if (inflated.length !== manifest.uncompressedBytes) throw new Error(`spell presentation uncompressed byte mismatch: expected ${manifest.uncompressedBytes}, got ${inflated.length}`);
  const catalog = JSON.parse(inflated.toString("utf8"));
  if (catalog.rulesProfileId !== rulesProfileId || catalog.count !== 339 || catalog.spells?.length !== 339) throw new Error("spell presentation catalog does not match the canonical SRD 5.2.1 profile/count");
  return catalog;
}

function genericCategory(entry) {
  if (directCategories.has(entry.category)) return entry.category;
  if (typeof entry.id === "string" && entry.id.startsWith("dnd.srd521.item.")) return "item";
  return null;
}

function localized(entry,module) {
  const presentation = entry.presentation ?? {};
  const locale = presentation.locales?.[presentation.defaultLocale ?? module.defaultLocale ?? "ko-KR"]
    ?? presentation.locales?.["ko-KR"]
    ?? Object.values(presentation.locales ?? {})[0]
    ?? {};
  const nameEn = String(presentation.originalName ?? locale.name ?? entry.id);
  const nameKo = String(locale.name ?? nameEn);
  const summary = typeof locale.summary === "string" ? locale.summary.trim() : "";
  return {nameKo,nameEn,summary};
}

const spellPresentation = loadSpellPresentation();
const records = [];
const allNames = new Map();
const moduleIds = [];

for (const dirent of readdirSync(modulesDir,{withFileTypes:true}).sort((a,b) => a.name.localeCompare(b.name,"en"))) {
  if (!dirent.isDirectory() || !dirent.name.startsWith("dnd-srd-5.2.1.")) continue;
  const module = JSON.parse(readFileSync(join(modulesDir,dirent.name,"module.json"),"utf8"));
  if (module.rulesProfile?.id !== rulesProfileId || module.rulesProfile?.version !== rulesProfileVersion) {
    throw new Error(`${module.moduleId ?? dirent.name}: unexpected RulesProfile ${module.rulesProfile?.id}@${module.rulesProfile?.version}`);
  }
  moduleIds.push(module.moduleId);
  for (const entry of module.content ?? []) {
    const presentation = localized(entry,module);
    if (allNames.has(entry.id)) throw new Error(`duplicate canonical content id while generating builtin catalog: ${entry.id}`);
    allNames.set(entry.id,presentation);
    const category = genericCategory(entry);
    if (category && category !== "spell") records.push({module,entry,category,presentation});
  }
}

for (const spell of spellPresentation.spells) {
  allNames.set(spell.id,{nameKo:spell.name,nameEn:spell.nameEn,summary:spell.summary});
}

const moduleEntries = records.map(({module,entry,category,presentation}) => {
  const nameKo = presentation.nameKo;
  const nameEn = presentation.nameEn;
  const description = presentation.summary
    || `${nameKo} / ${nameEn} · ${sourceLabel} ${categoryLabel[category] ?? category}`;
  return {
    id:entry.id,
    contentId:entry.id,
    category,
    nameKo,
    nameEn,
    scope:"builtin",
    sourceId:rulesProfileId,
    source:sourceLabel,
    version:module.moduleVersion,
    description,
    relationships:(entry.relationships ?? []).map((relationship) => ({
      label:relationshipLabel[relationship.kind] ?? relationship.kind,
      targetId:relationship.target,
      targetName:allNames.get(relationship.target)?.nameKo ?? relationship.target,
    })),
    capabilities:[...new Set(module.capabilities ?? [])].sort((a,b) => a.localeCompare(b,"en")),
    mechanics:(entry.mechanics ?? [])
      .filter((mechanic) => mechanic?.kind === "common-play")
      .map((mechanic) => ({kind:"common-play",config:mechanic.config})),
  };
});

const spellEntries = spellPresentation.spells.map((spell) => ({
  id:spell.id,
  contentId:spell.id,
  category:"spell",
  nameKo:spell.name,
  nameEn:spell.nameEn,
  scope:"builtin",
  sourceId:rulesProfileId,
  source:sourceLabel,
  version:rulesProfileVersion,
  description:spell.summary,
  relationships:[],
  capabilities:[],
  mechanics:[],
}));

const entries = [...moduleEntries,...spellEntries].sort((a,b) => {
  const categoryDelta = (categoryOrder.get(a.category) ?? 99) - (categoryOrder.get(b.category) ?? 99);
  return categoryDelta || a.id.localeCompare(b.id,"en");
});

const ids = new Set();
for (const entry of entries) {
  if (ids.has(entry.id)) throw new Error(`duplicate generic builtin catalog id: ${entry.id}`);
  ids.add(entry.id);
}
const counts = Object.fromEntries([...categoryOrder.keys()].map((category) => [category,entries.filter((entry) => entry.category === category).length]));
if (counts.class !== 12) throw new Error(`builtin class count mismatch: expected 12, got ${counts.class}`);
if (counts.species !== 9) throw new Error(`builtin species count mismatch: expected 9, got ${counts.species}`);
if (counts.background !== 4) throw new Error(`builtin background count mismatch: expected 4, got ${counts.background}`);
if (counts.spell !== 339) throw new Error(`builtin spell count mismatch: expected 339, got ${counts.spell}`);
if (counts.feat < 17) throw new Error(`builtin feat coverage regressed: expected at least 17, got ${counts.feat}`);
if (counts.item < 51) throw new Error(`builtin item-like coverage regressed: expected at least 51, got ${counts.item}`);

const output = {
  formatVersion:1,
  rulesProfile:{id:rulesProfileId,version:rulesProfileVersion},
  source:sourceLabel,
  sourceModules:[...new Set(moduleIds)].sort((a,b) => a.localeCompare(b,"en")),
  counts,
  entries,
};
mkdirSync(dirname(outputPath),{recursive:true});
writeFileSync(outputPath,JSON.stringify(output),"utf8");
console.log(`Generated generic builtin catalog: ${entries.length} entries (${counts.class} classes, ${counts.species} species, ${counts.background} backgrounds, ${counts.feat} feats, ${counts.spell} spells, ${counts.item} items)`);
