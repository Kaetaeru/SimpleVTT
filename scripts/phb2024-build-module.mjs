/**
 * Build the PHB 2024 module from its source (docs/design/v3/PHB_2024_MODULE_PLAN.md §4, §6).
 *
 *   node scripts/phb2024-build-module.mjs <out>/phb-parsed.json <old>/phb-2024-supplement.module.json <out>/phb-2024.module.json
 *
 * The text of every entry comes from the source (the parser's output, `scripts/phb2024-parse-source.mjs`); the rule
 * decisions — definitions and contracts — come from the module the owner already plays with (§8), so nothing that
 * worked is decided twice. Phases add their kinds here as they are rebuilt: P2 backgrounds, the species and feats.
 *
 * Like the parser, this script carries no book text: it reads the source and the old module from outside the
 * repository and writes the new module outside it.
 */
import { readFileSync, writeFileSync } from "node:fs";

const [parsedPath, oldPath, out] = process.argv.slice(2);
if (!parsedPath || !oldPath || !out) { console.error("usage: node scripts/phb2024-build-module.mjs <phb-parsed.json> <old module.json> <out module.json>"); process.exit(2); }

const parsed = JSON.parse(readFileSync(parsedPath, "utf8"));
const old = JSON.parse(readFileSync(oldPath, "utf8"));
const oldById = new Map(old.content.map((entry) => [entry.id, entry]));
const problems = [];

/** The sections a table never plays with: the translator's review notes. */
const SKIPPED = new Set(["검수 기록"]);

/** Markdown to the plain text a sheet shows: headings as their own line, bullets as •, no links or emphasis, tables as `a · b`. */
function plain(markdown) {
  return markdown
    .split("\n")
    .filter((line) => !/^\|\s*-+/.test(line))
    .map((line) => {
      let text = line.replace(/^#{1,6}\s+/, "");
      if (/^\|.*\|$/.test(text.trim())) text = text.trim().slice(1, -1).split("|").map((cell) => cell.trim()).join(" · ");
      text = text.replace(/^(\s*)[-*]\s+/, "$1• ");
      text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/`([^`]+)`/g, "$1");
      return text.trimEnd();
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The document's whole text: the intro without its title, then every played section as `heading\ntext`. */
function fullText(doc) {
  const intro = plain(doc.intro.replace(/^#\s+.*\n?/, ""));
  const sections = doc.sections.filter((section) => !SKIPPED.has(section.head)).map((section) => `${section.head}\n${plain(section.text)}`);
  return [intro, ...sections].filter(Boolean).join("\n\n");
}

function presentation(doc, description) {
  return { defaultLocale: "ko-KR", originalName: doc.fm.original_name, locales: { "ko-KR": { name: doc.fm.name, description }, en: { name: doc.fm.original_name } } };
}

/** The new entry: the source's text over the old entry's rule decisions. */
function rebuild(doc, id, extra = {}) {
  const previous = oldById.get(id);
  if (!previous) { problems.push(`옛 모듈에 ${id} 가 없다`); return undefined; }
  if (!doc.fm.name || !doc.fm.original_name) problems.push(`${doc.file}: frontmatter에 name/original_name 이 없다`);
  return { id, category: previous.category, presentation: presentation(doc, fullText(doc)), tags: [...new Set([...(previous.tags ?? []), "phb-2024"])], mechanics: structuredClone(previous.mechanics ?? []), ...extra };
}

const content = [];
const counts = {};
const add = (kind, entry) => { if (!entry) return; content.push(entry); counts[kind] = (counts[kind] ?? 0) + 1; };

// P2 — backgrounds.
for (const doc of parsed.background) add("background", rebuild(doc, `phb2024.background.${doc.slug}`));

// P2 — species: the entry, then each trait's contract entry named after the trait's own heading.
for (const doc of parsed.species) {
  const id = `phb2024.species.${doc.slug}`;
  const entry = rebuild(doc, id);
  add("species", entry);
  if (!entry) continue;
  const def = entry.mechanics.find((item) => item.kind === "species-definition")?.config ?? {};
  const headings = doc.sections.filter((section) => !SKIPPED.has(section.head) && section.head !== "기본 특성").map((section) => section.head);
  const traits = def.traits ?? [];
  if (headings.length !== traits.length) problems.push(`${doc.file}: 특성 절 ${headings.length}개와 species-definition.traits ${traits.length}개가 다르다`);
  // The catalog finds a trait's text by the name in `semantics.baseFeatures` (a trailing "(종족)" is ignored).
  (def.semantics?.baseFeatures ?? []).forEach((name, index) => { if (name.replace(/\s*\(.*\)\s*$/, "") !== headings[index]) problems.push(`${doc.file}: 특성 이름 "${name}"이 소스 절 "${headings[index]}"와 다르다`); });
  traits.forEach((raw, index) => {
    const key = raw.split("@")[0];
    const trait = oldById.get(`effect.trait.phb2024.${doc.slug}.${key}`);
    if (!trait) { problems.push(`옛 모듈에 ${doc.slug} 특성 ${key}의 계약이 없다`); return; }
    const copy = structuredClone(trait);
    copy.presentation = { ...copy.presentation, originalName: key, locales: { "ko-KR": { name: `${doc.fm.name}: ${headings[index] ?? key}`, summary: "종족 특성의 규칙 계약" } } };
    add("species-contract", copy);
  });
  for (const effect of old.content.filter((item) => item.id.startsWith(`effect.phb2024.${doc.slug}.`))) add("species-effect", structuredClone(effect));
}

// P2 — feats: the category is the source's; the contract entry comes along.
for (const doc of parsed.feat) {
  const id = `phb2024.feat.${doc.slug}`;
  const entry = rebuild(doc, id);
  add("feat", entry);
  if (!entry) continue;
  const def = entry.mechanics.find((item) => item.kind === "feat-definition")?.config;
  if (def && doc.fm.feat_category && def.tier !== doc.fm.feat_category) problems.push(`${id}: 분류가 소스(${doc.fm.feat_category})와 옛 모듈(${def.tier})이 다르다`);
  const contract = oldById.get(`effect.feat.phb2024.${doc.slug}`);
  if (contract) {
    const copy = structuredClone(contract);
    copy.presentation = { ...copy.presentation, originalName: doc.fm.original_name, locales: { "ko-KR": { name: doc.fm.name, summary: "재주의 규칙 계약" } } };
    add("feat-contract", copy);
  } else problems.push(`${id}: 계약 항목이 없다`);
}

const { content: _unused, ...header } = old;
const module = { ...header, moduleId: "phb-2024", moduleVersion: "1", source: { ...header.source, version: "2024" }, content };
writeFileSync(out, JSON.stringify(module, null, 1));
console.log(JSON.stringify({ entries: content.length, ...counts }));
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
