/**
 * Read a supplement's source documents into one structured JSON (docs/design/v3/PHB_2024_MODULE_PLAN.md §3.2).
 *
 * The PHB 2024 supplement is written as Korean markdown in a private repository: one document per subclass, feat,
 * spell, background and species, each with YAML frontmatter and `## ` sections (a subclass feature is a
 * `## <level>레벨: <name>` section). This script only keeps that shape — it decides no rule and reads no rule — so the
 * module builder downstream can work from the source text instead of from an older compiler's output.
 *
 *   node scripts/phb2024-parse-source.mjs <source>/10-RULEBOOKS/phb-2024 <out>/phb-parsed.json
 *
 * The source stays outside this repository, and so does the output: neither the book's text nor its translation is
 * committed here.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const KINDS = [
  ["subclass", "subclasses"], ["feat", "feats"], ["spell", "spells"],
  ["background", "backgrounds"], ["species", "species"], ["statblock", "appendix-b"],
];

const [root, out] = process.argv.slice(2);
if (!root || !out) { console.error("usage: node scripts/phb2024-parse-source.mjs <phb-2024 dir> <out.json>"); process.exit(2); }

/** Every `.md` under a folder except its index, sorted by name. */
function documents(folder) {
  const found = [];
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir); } catch { return; }
    for (const name of entries.sort()) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith(".md") && name !== "README.md") found.push(path);
    }
  };
  walk(join(root, folder));
  return found;
}

/** Frontmatter, the text before the first `## `, and every section after it. */
function parse(path) {
  const text = readFileSync(path, "utf8");
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  const fm = {};
  let body = text;
  if (match) {
    for (const line of match[1].split("\n")) {
      const at = line.indexOf(":");
      if (at > 0) fm[line.slice(0, at).trim()] = line.slice(at + 1).trim();
    }
    body = match[2];
  }
  const parts = body.split(/^## /m);
  const sections = parts.slice(1).map((part) => {
    const end = part.indexOf("\n");
    return { head: (end < 0 ? part : part.slice(0, end)).trim(), text: (end < 0 ? "" : part.slice(end + 1)).trim() };
  });
  return { fm, intro: parts[0].trim(), sections };
}

const parsed = {};
for (const [kind, folder] of KINDS) {
  parsed[kind] = documents(folder).map((path) => {
    const { fm, intro, sections } = parse(path);
    const name = path.slice(path.lastIndexOf(sep) + 1);
    return { slug: name.slice(0, -3), file: relative(root, path).split(sep).join("/"), fm, intro, sections };
  });
}

writeFileSync(out, JSON.stringify(parsed, null, 1));
const levels = parsed.subclass.reduce((sum, item) => sum + item.sections.filter((section) => /^\d+레벨/.test(section.head)).length, 0);
console.log(JSON.stringify({ ...Object.fromEntries(Object.entries(parsed).map(([kind, items]) => [kind, items.length])), subclassFeatures: levels }));
